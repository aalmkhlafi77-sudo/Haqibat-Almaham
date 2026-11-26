import { createPool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { createEmptyDatabase, createSeedDatabase } from '../src/data/seedData';
import type { AppDatabaseState, UserRole } from '../src/types/domain';

export interface ServerUserAccount {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  specialistId: string | null;
  passwordSalt: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
}

export interface Workspace {
  state: AppDatabaseState;
  revision: number;
}

export interface WorkspaceStore {
  mode: 'preview' | 'mysql';
  read(): Promise<Workspace>;
  change(change: (workspace: Workspace) => void, keepRestorePoint?: boolean): Promise<Workspace>;
  users(): Promise<ServerUserAccount[]>;
  addUser(account: ServerUserAccount, firstOnly?: boolean): Promise<boolean>;
  changeUser(
    id: string,
    change: (account: ServerUserAccount | undefined, accounts: readonly ServerUserAccount[]) => ServerUserAccount | null,
  ): Promise<ServerUserAccount | null>;
}

export function createPreviewStore(): WorkspaceStore {
  let workspace: Workspace = { state: createSeedDatabase(), revision: 0 };
  const accounts: ServerUserAccount[] = [];
  return {
    mode: 'preview',
    async read() { return structuredClone(workspace); },
    async change(change) {
      const next = structuredClone(workspace);
      change(next);
      workspace = { state: next.state, revision: workspace.revision + 1 };
      return structuredClone(workspace);
    },
    async users() { return accounts.slice(); },
    async addUser(account, firstOnly) {
      if ((firstOnly && accounts.length) || accounts.some((u) => u.username === account.username)) {
        return false;
      }
      accounts.push(account);
      return true;
    },
    async changeUser(id, change) {
      const index = accounts.findIndex((account) => account.id === id);
      const next = change(accounts[index], accounts);
      if (index >= 0) {
        if (next) accounts[index] = next;
        else accounts.splice(index, 1);
      }
      return next;
    },
  };
}

export async function openMysqlStore(): Promise<WorkspaceStore> {
  const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD) {
    throw new Error('DB_HOST, DB_NAME, DB_USER and DB_PASSWORD are required.');
  }
  const port = Number(process.env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DB_PORT.');
  const pool = createPool({
    host: DB_HOST, port, database: DB_NAME, user: DB_USER, password: DB_PASSWORD,
    charset: 'utf8mb4', connectionLimit: 8, queueLimit: 40, connectTimeout: 5000,
    supportBigNumbers: true, bigNumberStrings: true,
  });

  const transaction = async <T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };

  const read = async (connection = pool as Pick<PoolConnection, 'execute'>, lock = false) => {
    const [rows] = await connection.execute<RowDataPacket[]>(
      lock
        ? 'SELECT revision, payload FROM haqibat_workspace WHERE id = 1 FOR UPDATE'
        : 'SELECT revision, payload FROM haqibat_workspace WHERE id = 1'
    );
    const row = rows[0];
    if (!row) throw new Error('Shared workspace is missing.');
    const revision = Number(row.revision);
    if (!Number.isSafeInteger(revision)) throw new Error('Invalid workspace revision.');
    const state: AppDatabaseState = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    return { revision, state };
  };

  try {
    // Check the complete schema before opening the listener. Never fall back to volatile storage.
    await pool.execute('SELECT id FROM haqibat_accounts LIMIT 1');
    await pool.execute('SELECT id FROM haqibat_restore_points LIMIT 1');
    await pool.execute(
      'INSERT INTO haqibat_workspace (id, payload) VALUES (1, ?) ON DUPLICATE KEY UPDATE id = id',
      [JSON.stringify(createEmptyDatabase())]
    );
    await read();
  } catch (error) {
    await pool.end();
    throw error;
  }

  const getUsers = async (connection = pool as Pick<PoolConnection, 'execute'>) => {
    const [rows] = await connection.execute<(RowDataPacket & ServerUserAccount)[]>(
      `SELECT id, username, display_name AS displayName, email, role,
              specialist_id AS specialistId, password_salt AS passwordSalt,
              password_hash AS passwordHash, is_active AS isActive, created_at AS createdAt
         FROM haqibat_accounts`
    );
    return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
  };

  return {
    mode: 'mysql',
    read: () => read(),
    async change(change, keepRestorePoint) {
      return transaction(async (connection) => {
        const previous = await read(connection, true);
        const next = { ...previous };
        change(next);
        if (keepRestorePoint) {
          await connection.execute(
            'INSERT INTO haqibat_restore_points (revision, payload) VALUES (?, ?)',
            [previous.revision, JSON.stringify(previous.state)]
          );
        }
        const revision = previous.revision + 1;
        await connection.execute('UPDATE haqibat_workspace SET revision = ?, payload = ? WHERE id = 1', [
          revision, JSON.stringify(next.state),
        ]);
        return { revision, state: next.state };
      });
    },
    users: () => getUsers(),
    async addUser(account, firstOnly) {
      return transaction(async (connection) => {
        // Serialize account creation, including one-time owner provisioning across processes.
        await connection.execute('SELECT id FROM haqibat_workspace WHERE id = 1 FOR UPDATE');
        const users = await getUsers(connection);
        if ((firstOnly && users.length) || users.some((user) => user.username === account.username)) {
          return false;
        }
        await connection.execute(
          `INSERT INTO haqibat_accounts
           (id, username, display_name, email, role, specialist_id, password_salt, password_hash, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [account.id, account.username, account.displayName, account.email, account.role,
            account.specialistId, account.passwordSalt, account.passwordHash, account.isActive, account.createdAt]
        );
        return true;
      });
    },
    async changeUser(id, change) {
      return transaction(async (connection) => {
        await connection.execute('SELECT id FROM haqibat_workspace WHERE id = 1 FOR UPDATE');
        const accounts = await getUsers(connection);
        const next = change(accounts.find((account) => account.id === id), accounts);
        if (next) {
          await connection.execute(
            `UPDATE haqibat_accounts
                SET username = ?, display_name = ?, email = ?, role = ?, password_salt = ?, password_hash = ?
              WHERE id = ?`,
            [next.username, next.displayName, next.email, next.role, next.passwordSalt, next.passwordHash, id]
          );
        } else {
          await connection.execute('DELETE FROM haqibat_accounts WHERE id = ?', [id]);
        }
        return next;
      });
    },
  };
}
