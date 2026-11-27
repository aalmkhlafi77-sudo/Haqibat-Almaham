import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmptyDatabase } from '../src/data/seedData';
import { migrateDatabaseState, StateDataRepository } from '../src/data/repository';
import { createBackupEnvelope, validateBackupFileText } from '../src/domain/backupUtils';
import { applyWorkspaceCommand, assertRestorableWorkspace } from '../server/workspaceCommands';
import type { AppDatabaseState, AuthUser, IdeaItem, ProjectItem, TaskItem } from '../src/types/domain';

const stamp = '2026-11-27T10:00:00.000Z';
const idea: IdeaItem = { id: 'idea-1', title: 'فكرة', category: '', notes: '', pinned: false, taskId: null, projectId: null, createdAt: stamp, updatedAt: stamp };
const project: ProjectItem = { id: 'project-1', title: 'مشروع', status: 'مخطط', specialistId: null, dueDate: null, nextStep: '', notes: '', milestones: [], taskIds: [], documentIds: [], createdAt: stamp, updatedAt: stamp };
const user = { role: 'admin', authMode: 'server', permissions: ['records:write'] } as AuthUser;
const viewer = { role: 'viewer', authMode: 'server', permissions: ['records:read'] } as AuthUser;

test('legacy backup retains original integrity and migrates without sample projects', () => {
  const old = createEmptyDatabase() as Partial<AppDatabaseState>;
  delete old.projects; delete old.ideas;
  const envelope = createBackupEnvelope(old as AppDatabaseState, 'server');
  const verified = validateBackupFileText(JSON.stringify(envelope));
  assert.equal(verified.ok, true);
  const migrated = migrateDatabaseState(verified.envelope!.payload);
  assert.deepEqual(migrated.projects, []); assert.deepEqual(migrated.ideas, []);
  assertRestorableWorkspace(migrated);
});

test('idea conversion is atomic, duplicate and read-only operations rejected', () => {
  const state = createEmptyDatabase(); state.ideas = [idea];
  const workspace = { revision: 0, state };
  const body = { revision: 0, name: 'createProjectFromIdea', args: [project, idea.id] };
  assert.throws(() => applyWorkspaceCommand(workspace, body, viewer), /صلاحيات/);
  applyWorkspaceCommand(workspace, body, user);
  assert.equal(workspace.state.ideas[0].projectId, project.id);
  assert.equal(workspace.state.projects.length, 1);
  assert.throws(() => applyWorkspaceCommand(workspace, body, user), /بالفعل/);
  assert.equal(workspace.state.projects.length, 1);
});

test('planning leaves the due date untouched and deleting a task clears links', () => {
  let state = createEmptyDatabase();
  const task: TaskItem = { id: 't1', orgId: 'org-01', title: 'مهمة', typeId: state.taskTypes[0].id, type: state.taskTypes[0].name, specialistId: null, departmentName: 'عام', priority: 'متوسطة', status: 'جديدة', dueDate: '2027-02-01', plannedDate: '2026-12-01', actualDeliveryDate: null, documentId: null, caseId: null, sessionId: null, notes: '', createdAt: stamp, updatedAt: stamp };
  state.tasks = [task]; state.projects = [{ ...project, taskIds: [task.id] }]; state.ideas = [{ ...idea, taskId: task.id }];
  const repo = new StateDataRepository(() => state, next => { state = next; });
  repo.upsertTask({ ...task, plannedDate: '2026-12-02' });
  assert.equal(state.tasks[0].dueDate, '2027-02-01');
  repo.deleteTask(task.id);
  assert.deepEqual(state.projects[0].taskIds, []); assert.equal(state.ideas[0].taskId, null);
});
