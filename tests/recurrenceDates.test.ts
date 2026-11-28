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
