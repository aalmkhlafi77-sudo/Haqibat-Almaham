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
  const recurrenceSeries = state.recurrenceSeries.map(series => {
    if (!series.active) return series;
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
  if (!generated && recurrenceSeries.every((s, i) => s.nextIndex === state.recurrenceSeries[i].nextIndex)) return { state, generated: 0, hasMore };
  return { state: { ...state, tasks, calendarItems, recurrenceSeries }, generated, hasMore };
}
