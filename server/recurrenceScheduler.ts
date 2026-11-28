import type { WorkspaceStore } from './workspaceStore';
import { materializeRecurrences } from './recurrenceWorkspace';
import { riyadhDate } from '../src/domain/recurrenceDates';

/** Lock, create bounded batches, and advance cursors in a single workspace transaction. */
export async function runRecurrenceBatch(store: WorkspaceStore, now = new Date()): Promise<{ generated: number; hasMore: boolean }> {
  let generated = 0, hasMore = false;
  await store.change(workspace => {
    const result = materializeRecurrences(workspace.state, riyadhDate(now), now.toISOString(), 100);
    generated = result.generated;
    hasMore = result.hasMore;
    if (result.state === workspace.state) return false;
    workspace.state = result.state;
    return true;
  });
  return { generated, hasMore };
}

/** Runs once on startup then periodically, without overlapping within this process. */
export function startRecurrenceScheduler(store: WorkspaceStore, intervalMs = 60000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runRecurrenceBatch(store); }
    catch (error) { console.error('Recurring work scheduler failed:', error instanceof Error ? error.message : 'unknown error'); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
