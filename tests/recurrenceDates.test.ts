import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recurrenceDate, dueOccurrences, riyadhDate } from '../src/domain/recurrenceDates';

test('monthly recurrence keeps original day after shorter months', () => {
  assert.deepEqual([0, 1, 2, 3].map(i => recurrenceDate('2027-01-31', 'monthly', i)), ['2027-01-31','2027-02-28','2027-03-31','2027-04-30']);
});
test('annual leap-day, weekly and fifteen-day recurrences use calendar boundaries', () => {
  assert.equal(recurrenceDate('2024-02-29','yearly',1),'2025-02-28');
  assert.equal(recurrenceDate('2024-02-29','yearly',4),'2028-02-29');
  assert.equal(recurrenceDate('2026-12-28','weekly',1),'2027-01-04');
  assert.equal(recurrenceDate('2026-12-28','fortnightly',1),'2027-01-12');
});
test('bounded catch-up cursor never generates the same occurrence twice', () => {
  const first = dueOccurrences({anchor:'2027-01-01',frequency:'weekly',nextIndex:0,cutoff:'2027-02-01',limit:2});
  assert.deepEqual(first.dates,['2027-01-01','2027-01-08']);
  assert.equal(first.hasMore,true);
  const next = dueOccurrences({anchor:'2027-01-01',frequency:'weekly',nextIndex:first.nextIndex,cutoff:'2027-02-01',limit:5,until:'2027-01-22'});
  assert.deepEqual(next.dates,['2027-01-15','2027-01-22']);
  assert.equal(next.hasMore,false);
});
test('rejects invalid dates and calculates Saudi date independently of host timezone', () => {
  assert.throws(() => recurrenceDate('2027-02-30','monthly',0));
  assert.equal(riyadhDate(new Date('2026-12-31T22:30:00Z')),'2027-01-01');
});

import { generateOccurrences, type RecurrenceSeries } from '../src/domain/recurrenceEngine';
import { createSeedDatabase } from '../src/data/seedData';

test('separate occurrences keep overdue task intact and clear completion and planned date', () => {
  const template = { ...createSeedDatabase().tasks[0], dueDate: '2027-01-31', plannedDate: '2027-01-30', status: 'مكتملة' as const, actualDeliveryDate: '2027-01-30' };
  const series: RecurrenceSeries = { id:'s1', kind:'task', template, frequency:'monthly', anchor:'2027-01-31', until:null, active:true, nextIndex:1, reminderDays:3 };
  const result = generateOccurrences(series,'2027-03-31','2027-03-31T00:00:00Z');
  assert.deepEqual(result.occurrences.map(o=>o.date), ['2027-02-28','2027-03-31']);
  assert.deepEqual(result.occurrences.map(o=>o.id), ['rec-s1-1','rec-s1-2']);
  const task = result.occurrences[0];
  assert.equal(task.kind,'task');
  if(task.kind === 'task') { assert.equal(task.record.status,'جديدة'); assert.equal(task.record.actualDeliveryDate,null); assert.equal(task.record.plannedDate,null); }
  assert.equal(template.status,'مكتملة');
  assert.equal(generateOccurrences(result.series,'2027-03-31','2027-03-31T00:00:00Z').occurrences.length,0);
});

import { materializeRecurrences } from '../server/recurrenceWorkspace';
import { createBackupEnvelope, validateBackupFileText } from '../src/domain/backupUtils';
import { migrateDatabaseState, StateDataRepository } from '../src/data/repository';

test('materialization produces immutable deterministic records, catches up, and respects reminder lead', () => {
  const state = createSeedDatabase();
  const template = { ...state.tasks[0], dueDate:'2027-01-01' };
  state.recurrenceSeries = [{id:'series-1',kind:'task',template,frequency:'weekly',anchor:'2027-01-01',until:null,active:true,nextIndex:1,reminderDays:3}];
  const first = materializeRecurrences(state,'2027-01-05','2027-01-05T00:00:00Z');
  assert.equal(first.generated,1);
  assert.equal(first.state.tasks.at(-1)?.dueDate,'2027-01-08');
  assert.equal(state.recurrenceSeries[0].nextIndex,1);
  const second = materializeRecurrences(first.state,'2027-01-05','2027-01-05T00:00:00Z');
  assert.equal(second.generated,0); assert.equal(second.state,first.state);
  const paused = { ...first.state, recurrenceSeries: first.state.recurrenceSeries.map(s => ({...s,active:false})) };
  assert.equal(materializeRecurrences(paused,'2027-04-01','2027-04-01T00:00:00Z').generated,0);
});

test('backup retains recurrence and legacy snapshots receive an empty series list', () => {
  const state = createSeedDatabase();
  state.recurrenceSeries = [{id:'s1',kind:'task',template:state.tasks[0],frequency:'weekly',anchor:'2027-01-01',until:null,active:true,nextIndex:1,reminderDays:3}];
  const backup = createBackupEnvelope(state,'server');
  const result = validateBackupFileText(JSON.stringify(backup));
  assert.equal(result.ok,true);
  assert.equal(migrateDatabaseState(result.envelope!.payload).recurrenceSeries[0].id,'s1');
  const old = { ...state } as Partial<typeof state>; delete old.recurrenceSeries;
  assert.deepEqual(migrateDatabaseState(old).recurrenceSeries,[]);
});

test('materialization rejects a record id collision instead of overwriting data', () => {
  const state = createSeedDatabase();
  const template = state.tasks[0];
  state.recurrenceSeries = [{id:'s1',kind:'task',template,frequency:'weekly',anchor:'2027-01-01',until:null,active:true,nextIndex:1,reminderDays:0}];
  state.tasks.push({...template,id:'rec-s1-1'});
  assert.throws(()=>materializeRecurrences(state,'2027-01-08','2027-01-08T00:00:00Z'),/collision/);
});

import { createPreviewStore } from '../server/workspaceStore';
import { runRecurrenceBatch } from '../server/recurrenceScheduler';

test('scheduler advances state once and leaves revision unchanged on subsequent no-op', async () => {
  const store = createPreviewStore();
  await store.change(w => {
    const template = w.state.tasks[0];
    w.state.recurrenceSeries = [{id:'test-series',kind:'task',template,frequency:'weekly',anchor:'2027-01-01',until:null,active:true,nextIndex:1,reminderDays:0}];
  });
  const start = await store.read();
  const result = await runRecurrenceBatch(store, new Date('2027-01-08T12:00:00Z'));
  assert.equal(result.generated,1);
  const first = await store.read(); assert.equal(first.revision,start.revision+1);
  await runRecurrenceBatch(store, new Date('2027-01-08T13:00:00Z'));
  assert.equal((await store.read()).revision,first.revision);
});

import { applyWorkspaceCommand } from '../server/workspaceCommands';
import type { AuthUser } from '../src/types/domain';
test('recurrence configuration requires write permission and atomically links the original', () => {
  const state = createSeedDatabase(); const workspace = {state,revision:1};
  const source = state.tasks[0];
  const body = {revision:1,name:'configureRecurrence',args:['task',source.id,'series-test','weekly',null,3]};
  const reader = {permissions:['records:read']} as AuthUser;
  const writer = {permissions:['records:read','records:write']} as AuthUser;
  assert.throws(() => applyWorkspaceCommand(workspace,body,reader),/صلاحيات/);
  applyWorkspaceCommand(workspace,body,writer);
  assert.equal(workspace.state.recurrenceSeries[0].id,'series-test');
  assert.equal(workspace.state.tasks.find(t=>t.id===source.id)?.recurrenceIndex,0);
  assert.throws(() => applyWorkspaceCommand(workspace,body,writer),/مرتبط/);
  applyWorkspaceCommand(workspace,{revision:1,name:'stopRecurrence',args:['series-test']},writer);
  assert.equal(workspace.state.recurrenceSeries[0].active,false);
});

test('normal task writes cannot forge a recurrence link', () => {
  const state = createSeedDatabase(); const workspace = {state,revision:2};
  const writer = {permissions:['records:read','records:write']} as AuthUser;
  const forged = {...state.tasks[0],recurrenceSeriesId:'forged',recurrenceIndex:0};
  assert.throws(()=>applyWorkspaceCommand(workspace,{revision:2,name:'upsertTask',args:[forged]},writer),/ارتباط/);
});

test('series settings can be changed only with write permission and valid end date', () => {
  const state = createSeedDatabase(); const workspace = {state, revision:3};
  const writer = {permissions:['records:read','records:write']} as AuthUser;
  const reader = {permissions:['records:read']} as AuthUser;
  const t = state.tasks[0];
  applyWorkspaceCommand(workspace,{revision:3,name:'configureRecurrence',args:['task',t.id,'s-edit','monthly',null,3]},writer);
  const anchor = workspace.state.recurrenceSeries[0].anchor;
  assert.throws(()=>applyWorkspaceCommand(workspace,{revision:3,name:'updateRecurrence',args:['s-edit',null,7,'weekly']},reader),/صلاحيات/);
  assert.throws(()=>applyWorkspaceCommand(workspace,{revision:3,name:'updateRecurrence',args:['s-edit','1900-01-01',7,'weekly']},writer),/غير صالح/);
  applyWorkspaceCommand(workspace,{revision:3,name:'updateRecurrence',args:['s-edit',null,7,'weekly']},writer);
  assert.equal(workspace.state.recurrenceSeries[0].reminderDays,7);
  assert.equal(workspace.state.recurrenceSeries[0].anchor,anchor);
});

test('future edit updates pending records and template but preserves completion and due dates', () => {
  const state = createSeedDatabase(), workspace = { state, revision: 4 };
  const writer = {permissions:['records:read','records:write','records:delete']} as AuthUser;
  const original = state.tasks[0];
  applyWorkspaceCommand(workspace,{revision:4,name:'configureRecurrence',args:['task',original.id,'future-s','weekly',null,0]},writer);
  const series = workspace.state.recurrenceSeries[0];
  const generated = generateOccurrences(series,recurrenceDate(series.anchor,'weekly',2),'2028-01-01T00:00:00Z');
  workspace.state.tasks.push(...generated.occurrences.filter(o=>o.kind==='task').map(o=>o.record as typeof original));
  workspace.state.tasks.at(-1)!.status = 'مكتملة';
  const edited = {...workspace.state.tasks.find(t=>t.id===original.id)!,title:'عنوان جديد'};
  applyWorkspaceCommand(workspace,{revision:4,name:'updateRecurringTaskFuture',args:[edited]},writer);
  const pending = workspace.state.tasks.find(t=>t.recurrenceSeriesId==='future-s' && t.recurrenceIndex===1)!;
  const done = workspace.state.tasks.find(t=>t.recurrenceSeriesId==='future-s' && t.recurrenceIndex===2)!;
  assert.equal(pending.title,'عنوان جديد'); assert.equal(done.title,original.title);
  assert.equal(pending.dueDate,recurrenceDate(series.anchor,'weekly',1));
  assert.equal(workspace.state.recurrenceSeries[0].template.title,'عنوان جديد');
  applyWorkspaceCommand(workspace,{revision:4,name:'deleteRecurringFuture',args:['task',original.id]},writer);
  assert.equal(workspace.state.recurrenceSeries[0].active,false);
  assert.equal(workspace.state.tasks.some(t=>t.id===original.id),false);
  assert.equal(workspace.state.tasks.some(t=>t.id===pending.id),false);
  assert.equal(workspace.state.tasks.some(t=>t.id===done.id),true);
});

test('materialization clears removed specialist and document references before generating', () => {
  const state = createSeedDatabase();
  const template = {...state.tasks[0],specialistId:'missing-person',documentId:'missing-document'};
  state.recurrenceSeries = [{id:'clean-s',kind:'task',template,frequency:'weekly',anchor:'2027-01-01',until:null,active:true,nextIndex:1,reminderDays:0}];
  const result = materializeRecurrences(state,'2027-01-08','2027-01-08T00:00:00Z');
  assert.equal(result.state.tasks.at(-1)?.specialistId,null);
  assert.equal(result.state.tasks.at(-1)?.documentId,null);
  assert.equal(result.state.recurrenceSeries[0].template.specialistId,null);
});

import { once } from 'node:events';
import { createServerApp } from '../server';
import { assertRestorableWorkspace } from '../server/workspaceCommands';

test('authenticated API persists recurrence, rejects stale revision and restores valid backup snapshot', async t => {
  const store = createPreviewStore();
  const server = createServerApp(store).listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const port = (server.address() as {port:number}).port; const base = `http://127.0.0.1:${port}`;
  const headers = {'X-Requested-With':'XMLHttpRequest','Content-Type':'application/json'};
  const login = await fetch(`${base}/api/auth/bootstrap-admin`,{method:'POST',headers,body:JSON.stringify({username:'testrec',password:'test-password'})});
  assert.equal(login.status,201); const cookie=login.headers.get('set-cookie')!.split(';')[0];
  const snapshot = await (await fetch(`${base}/api/state`,{headers:{cookie}})).json();
  const task = snapshot.state.tasks[0];
  const body = {revision:snapshot.revision,name:'configureRecurrence',args:['task',task.id,'http-series','weekly',null,2]};
  const send=()=>fetch(`${base}/api/state/commands`,{method:'POST',headers:{...headers,cookie},body:JSON.stringify(body)});
  assert.equal((await send()).status,200); assert.equal((await send()).status,409);
  const final = await store.read(); assert.equal(final.state.recurrenceSeries.length,1);
  const backup = createBackupEnvelope(final.state,'server'); const parsed = validateBackupFileText(JSON.stringify(backup));
  assert.equal(parsed.ok,true); assert.doesNotThrow(()=>assertRestorableWorkspace(migrateDatabaseState(parsed.envelope!.payload)));
  const damaged=structuredClone(final.state); damaged.tasks.find(t=>t.id===task.id)!.recurrenceIndex=900;
  assert.throws(()=>assertRestorableWorkspace(damaged),/تكرار/);
});

test('changing cadence preserves generated occurrences and continues after the last existing date', () => {
  const state = createSeedDatabase(); const template = state.tasks[0];
  state.recurrenceSeries = [{id:'change-s',kind:'task',template,frequency:'monthly',anchor:'2027-01-31',until:null,active:true,nextIndex:3,reminderDays:0}];
  let current=state; const repo = new StateDataRepository(()=>current,next=>{current=next});
  repo.updateRecurrence('change-s',null,0,'weekly');
  const changed = current.recurrenceSeries[0];
  assert.equal(changed.phaseAnchor,'2027-03-31'); assert.equal(changed.phaseStartIndex,2);
  const next=generateOccurrences(changed,'2027-04-07','2027-04-07T00:00:00Z');
  assert.equal(next.occurrences[0].date,'2027-04-07'); assert.equal(next.occurrences[0].index,3);
  assert.doesNotThrow(()=>assertRestorableWorkspace(current));
});
