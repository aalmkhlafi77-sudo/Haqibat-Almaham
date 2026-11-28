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
import { migrateDatabaseState } from '../src/data/repository';

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
