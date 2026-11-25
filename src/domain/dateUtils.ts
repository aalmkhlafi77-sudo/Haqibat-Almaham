import { DocumentItem, PoaItem, TaskItem } from '../types/domain';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(baseISO: string, days: number): string {
  const [y, m, d] = baseISO.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function diffDaysISO(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split('-').map(Number);
  const [y2, m2, d2] = toISO.split('-').map(Number);
  const utc1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const utc2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((utc2 - utc1) / 86_400_000);
}

export function formatGregorianDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dt);
}

export function formatHijriDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dt);
  } catch {
    return '';
  }
}

export function formatDisplayDate(dateStr?: string | null, showHijri = false): string {
  if (!dateStr) return 'بلا تاريخ';
  const greg = formatGregorianDate(dateStr);
  if (!showHijri) return greg;
  const hijri = formatHijriDate(dateStr);
  return hijri ? `${greg} (${hijri})` : greg;
}

export function formatTimeFromDateTime(dtStr?: string | null): string {
  if (!dtStr || !dtStr.includes('T')) return '';
  const [, timePart] = dtStr.split('T');
  const [hh, mm] = (timePart || '').split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return '';
  const d = new Date(2026, 0, 1, hh, mm);
  return new Intl.DateTimeFormat('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateTime(dtStr?: string | null, showHijri = false): string {
  if (!dtStr) return '—';
  const datePart = dtStr.slice(0, 10);
  const time = formatTimeFromDateTime(dtStr);
  const dateFmt = formatDisplayDate(datePart, showHijri);
  return time ? `${dateFmt} · ${time}` : dateFmt;
}

export interface TaskDelayInfo {
  isOverdue: boolean;
  wasDeliveredLate: boolean;
  delayDays: number;
  label: string | null;
}

/**
 * Delay rules from Project Reference v1.0:
 * - Open tasks (not مكتملة / ملغاة): compare dueDate with today. Today is NOT overdue.
 * - Completed tasks: compare actualDeliveryDate with dueDate. Show "سُلّمت متأخرة" if delivered after dueDate.
 */
export function evaluateTaskDelay(task: TaskItem, todayISO = getTodayISO()): TaskDelayInfo {
  if (task.status === 'ملغاة') {
    return { isOverdue: false, wasDeliveredLate: false, delayDays: 0, label: null };
  }

  if (task.status === 'مكتملة') {
    if (task.actualDeliveryDate && task.actualDeliveryDate > task.dueDate) {
      const days = diffDaysISO(task.dueDate, task.actualDeliveryDate);
      return {
        isOverdue: false,
        wasDeliveredLate: true,
        delayDays: days,
        label: `سُلّمت متأخرة (${days} ${days === 1 ? 'يوم' : 'أيام'})`,
      };
    }
    return { isOverdue: false, wasDeliveredLate: false, delayDays: 0, label: null };
  }

  if (task.dueDate < todayISO) {
    const days = diffDaysISO(task.dueDate, todayISO);
    return {
      isOverdue: true,
      wasDeliveredLate: false,
      delayDays: days,
      label: `متأخرة (${days} ${days === 1 ? 'يوم' : 'أيام'})`,
    };
  }

  return { isOverdue: false, wasDeliveredLate: false, delayDays: 0, label: null };
}

export type DocumentHealthCategory =
  | 'مؤرشفة'
  | 'بلا تاريخ'
  | 'منتهية'
  | 'تنتهي اليوم'
  | 'قريبة الانتهاء'
  | 'سارية';

export interface DocumentHealthInfo {
  category: DocumentHealthCategory;
  filterBucket: 'سارية' | 'قريبة الانتهاء' | 'منتهية' | 'بلا تاريخ' | 'مؤرشفة';
  daysRemaining: number | null;
  badgeText: string;
  needsFollowUp: boolean;
}

/**
 * Document classification rules:
 * - Archived documents excluded from active alerts.
 * - No expiryDate -> "بلا تاريخ" (needs follow-up).
 * - Expiry today === todayISO -> "تنتهي اليوم" (NOT treated as past expired!).
 * - Expiry < todayISO -> "منتهية".
 * - Expiry within warningDays (default 30) -> "قريبة الانتهاء".
 * - Otherwise -> "سارية".
 */
export function evaluateDocumentHealth(
  doc: DocumentItem,
  warningDays = 30,
  todayISO = getTodayISO()
): DocumentHealthInfo {
  if (doc.archivedAt) {
    return {
      category: 'مؤرشفة',
      filterBucket: 'مؤرشفة',
      daysRemaining: doc.expiryDate ? diffDaysISO(todayISO, doc.expiryDate) : null,
      badgeText: 'مؤرشفة',
      needsFollowUp: false,
    };
  }

  if (!doc.expiryDate) {
    return {
      category: 'بلا تاريخ',
      filterBucket: 'بلا تاريخ',
      daysRemaining: null,
      badgeText: 'بلا تاريخ',
      needsFollowUp: true,
    };
  }

  const diff = diffDaysISO(todayISO, doc.expiryDate);

  if (diff < 0) {
    const elapsed = Math.abs(diff);
    return {
      category: 'منتهية',
      filterBucket: 'منتهية',
      daysRemaining: diff,
      badgeText: `منتهية منذ ${elapsed} ${elapsed === 1 ? 'يوم' : 'أيام'}`,
      needsFollowUp: true,
    };
  }

  if (diff === 0) {
    return {
      category: 'تنتهي اليوم',
      filterBucket: 'قريبة الانتهاء',
      daysRemaining: 0,
      badgeText: 'تنتهي اليوم',
      needsFollowUp: true,
    };
  }

  if (diff <= warningDays) {
    return {
      category: 'قريبة الانتهاء',
      filterBucket: 'قريبة الانتهاء',
      daysRemaining: diff,
      badgeText: `قريبة الانتهاء (${diff} ${diff === 1 ? 'يوم' : 'أيام'})`,
      needsFollowUp: true,
    };
  }

  return {
    category: 'سارية',
    filterBucket: 'سارية',
    daysRemaining: diff,
    badgeText: 'سارية',
    needsFollowUp: false,
  };
}

export function evaluatePoaHealth(
  poa: PoaItem,
  warningDays = 30,
  todayISO = getTodayISO()
): { label: string; isUrgent: boolean; isExpired: boolean } {
  if (poa.statusOverride === 'مفسوخة') {
    return { label: 'مفسوخة', isUrgent: false, isExpired: true };
  }
  if (!poa.expiryDate) {
    return { label: 'سارية (غير محددة المدة)', isUrgent: false, isExpired: false };
  }
  const diff = diffDaysISO(todayISO, poa.expiryDate);
  if (diff < 0) {
    return { label: `منتهية منذ ${Math.abs(diff)} يوم`, isUrgent: true, isExpired: true };
  }
  if (diff === 0) {
    return { label: 'تنتهي اليوم', isUrgent: true, isExpired: false };
  }
  if (diff <= warningDays) {
    return { label: `تنتهي خلال ${diff} يوم`, isUrgent: true, isExpired: false };
  }
  return { label: 'سارية', isUrgent: false, isExpired: false };
}
