import { dueOccurrences, type RecurrenceFrequency } from './recurrenceDates';
import type { CalendarItem, TaskItem } from '../types/domain';

export type RecurrenceSeries = {
  id: string;
  frequency: RecurrenceFrequency;
  anchor: string;
  until: string | null;
  active: boolean;
  nextIndex: number;
  reminderDays: number;
} & (
  | { kind: 'task'; template: TaskItem }
  | { kind: 'calendar_item'; template: CalendarItem }
);

export type RecurrenceOccurrence = {
  seriesId: string;
  index: number;
  date: string;
  id: string;
} & ({ kind: 'task'; record: TaskItem } | { kind: 'calendar_item'; record: CalendarItem });

/** Generates only the bounded batch. Persist records, generated keys and nextIndex in the same transaction. */
export function generateOccurrences(series: RecurrenceSeries, cutoff: string, now: string, limit = 100): {
  series: RecurrenceSeries;
  occurrences: RecurrenceOccurrence[];
  hasMore: boolean;
} {
  if (!series.active) return { series, occurrences: [], hasMore: false };
  if (!series.id || !Number.isInteger(series.reminderDays) || series.reminderDays < 0 || series.reminderDays > 365) throw new Error('Invalid recurrence settings');
  const batch = dueOccurrences({ anchor: series.anchor, frequency: series.frequency, nextIndex: series.nextIndex, cutoff, until: series.until, limit });
  const occurrences = batch.dates.map((date, offset): RecurrenceOccurrence => {
    const index = series.nextIndex + offset;
    const id = `rec-${series.id}-${index}`;
    if (series.kind === 'task') {
      return { seriesId: series.id, index, date, id, kind: 'task', record: {
        ...series.template, id, recurrenceSeriesId: series.id, recurrenceIndex: index, dueDate: date, plannedDate: null, status: 'جديدة',
        actualDeliveryDate: null, archivedAt: null, createdAt: now, updatedAt: now,
      } };
    }
    const time = series.template.scheduledAt.slice(10);
    return { seriesId: series.id, index, date, id, kind: 'calendar_item', record: {
      ...series.template, id, recurrenceSeriesId: series.id, recurrenceIndex: index, scheduledAt: `${date}${time}`, isDone: false, createdAt: now, updatedAt: now,
    } };
  });
  return { series: { ...series, nextIndex: batch.nextIndex }, occurrences, hasMore: batch.hasMore };
}
