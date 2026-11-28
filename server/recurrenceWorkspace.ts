import { generateOccurrences } from '../src/domain/recurrenceEngine';
import { addDaysISO } from '../src/domain/dateUtils';
import type { AppDatabaseState } from '../src/types/domain';

/**
 * Computes a candidate workspace without mutating the input. Caller must execute
 * this while holding the workspace row lock and commit state and revision together.
 */
export function materializeRecurrences(state: AppDatabaseState, today: string, now: string, perSeriesLimit = 100): { state: AppDatabaseState; generated: number; hasMore: boolean } {
  const tasks = state.tasks.slice();
  const calendarItems = state.calendarItems.slice();
  const taskIds = new Set(tasks.map(t => t.id));
  const calendarIds = new Set(calendarItems.map(c => c.id));
  let generated = 0;
  let hasMore = false;
  let cleaned = false;
  const recurrenceSeries = state.recurrenceSeries.map(original => {
    if (!original.active) return original;
    let series = original;
    const spec = original.template.specialistId;
    if (spec && !state.specialists.some(s => s.id === spec)) { series = { ...series, template: { ...series.template, specialistId: null } } as typeof series; cleaned = true; }
    if (series.kind === 'task') {
      const t = series.template;
      const documentId = t.documentId && !state.documents.some(d => d.id === t.documentId) ? null : t.documentId;
      const caseId = t.caseId && !state.cases.some(c => c.id === t.caseId) ? null : t.caseId;
      const sessionId = t.sessionId && !state.sessions.some(c => c.id === t.sessionId) ? null : t.sessionId;
      if (!state.taskTypes.some(type => type.id === t.typeId)) throw new Error('Recurring task type no longer exists');
      if (documentId !== t.documentId || caseId !== t.caseId || sessionId !== t.sessionId) { series = { ...series, template: { ...t, documentId, caseId, sessionId } }; cleaned = true; }
    } else {
      const c = series.template;
      const collections = { task: state.tasks, document: state.documents, case: state.cases, session: state.sessions, poa: state.poas, calendar_item: state.calendarItems };
      if (c.linkedRecordType && c.linkedRecordId && !collections[c.linkedRecordType].some(r => r.id === c.linkedRecordId)) { series = { ...series, template: { ...c, linkedRecordType: null, linkedRecordId: null } }; cleaned = true; }
    }
    const cutoff = addDaysISO(today, series.reminderDays);
    const batch = generateOccurrences(series, cutoff, now, perSeriesLimit);
    for (const occurrence of batch.occurrences) {
      const existing = occurrence.kind === 'task' ? tasks.find(t => t.id === occurrence.id) : calendarItems.find(c => c.id === occurrence.id);
      if (existing) {
        if (existing.recurrenceSeriesId !== series.id || existing.recurrenceIndex !== occurrence.index) throw new Error('Recurring occurrence ID collision');
        continue;
      }
      if (occurrence.kind === 'task') {
        if (taskIds.has(occurrence.id)) throw new Error('Duplicate task occurrence');
        tasks.push(occurrence.record); taskIds.add(occurrence.id);
      } else {
        if (calendarIds.has(occurrence.id)) throw new Error('Duplicate calendar occurrence');
        calendarItems.push(occurrence.record); calendarIds.add(occurrence.id);
      }
      generated++;
    }
    hasMore ||= batch.hasMore;
    return batch.series;
  });
  if (!cleaned && !generated && recurrenceSeries.every((s, i) => s.nextIndex === state.recurrenceSeries[i].nextIndex)) return { state, generated: 0, hasMore };
  return { state: { ...state, tasks, calendarItems, recurrenceSeries }, generated, hasMore };
}
