/** Pure calendar arithmetic for recurrence. Dates are Gregorian YYYY-MM-DD. */
export type RecurrenceFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'yearly';

function parseDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Invalid recurrence date');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 100 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new Error('Invalid recurrence date');
  return { year, month, day };
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function formatDate(year: number, month: number, day: number): string {
  if (year > 9999) throw new Error('Recurrence date out of range');
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** index 0 is the anchor itself. Month/year calculations always use the original anchor. */
export function recurrenceDate(anchor: string, frequency: RecurrenceFrequency, index: number): string {
  const { year, month, day } = parseDate(anchor);
  if (!Number.isSafeInteger(index) || index < 0 || index > 1_000_000) throw new Error('Invalid recurrence index');
  if (frequency === 'weekly' || frequency === 'fortnightly') {
    const dt = new Date(Date.UTC(year, month - 1, day) + index * (frequency === 'weekly' ? 7 : 15) * 86400000);
    if (!Number.isFinite(dt.getTime())) throw new Error('Recurrence date out of range');
    return formatDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  if (frequency === 'monthly' || frequency === 'yearly') {
    const totalMonths = year * 12 + month - 1 + index * (frequency === 'monthly' ? 1 : 12);
    const y = Math.floor(totalMonths / 12), m = totalMonths % 12 + 1;
    if (y > 9999) throw new Error('Recurrence date out of range');
    return formatDate(y, m, Math.min(day, daysInMonth(y, m)));
  }
  throw new Error('Invalid recurrence frequency');
}

/** Dates due up to cutoff, starting at the stored index. The caller persists dates and cursor atomically. */
export function dueOccurrences(input: { anchor: string; frequency: RecurrenceFrequency; nextIndex: number; cutoff: string; until?: string | null; limit?: number }): { dates: string[]; nextIndex: number; hasMore: boolean } {
  parseDate(input.cutoff);
  if (input.until) parseDate(input.until);
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid recurrence batch limit');
  let index = input.nextIndex;
  const dates: string[] = [];
  while (dates.length < limit) {
    const date = recurrenceDate(input.anchor, input.frequency, index);
    if (date > input.cutoff || (input.until && date > input.until)) return { dates, nextIndex: index, hasMore: false };
    dates.push(date);
    index++;
  }
  const next = recurrenceDate(input.anchor, input.frequency, index);
  return { dates, nextIndex: index, hasMore: next <= input.cutoff && (!input.until || next <= input.until) };
}

/** Business date in Saudi Arabia regardless of the server's local timezone. */
export function riyadhDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
