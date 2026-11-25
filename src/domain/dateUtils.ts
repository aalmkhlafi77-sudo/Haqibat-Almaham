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

/**
 * Normalizes any stray Arabic-Indic digits to English 0-9.
 */
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

export function formatGregorianDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return toEnglishDigits(dateStr);
  const dt = new Date(y, m - 1, d);
  return toEnglishDigits(
    new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dt)
  );
}

export function formatHijriDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  try {
    return toEnglishDigits(
      new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(dt)
    );
  } catch {
    return '';
  }
}

export function formatHijriDayNumber(dateStr: string): string {
  const datePart = dateStr.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  try {
    return toEnglishDigits(
      new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
        day: 'numeric',
      }).format(dt)
    );
  } catch {
    return '';
  }
}

export function formatHijriMonthHeader(year: number, monthIndex: number): string {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  try {
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
      month: 'long',
      year: 'numeric',
    });
    const s = toEnglishDigits(fmt.format(start));
    const e = toEnglishDigits(fmt.format(end));
    return s === e ? s : `${s} / ${e}`;
  } catch {
    return '';
  }
}

export function formatGregorianMonthHeader(year: number, monthIndex: number): string {
  return toEnglishDigits(
    new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, monthIndex, 1))
  );
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
  return toEnglishDigits(
    new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  );
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

export interface UrgentAlertResult {
  isUrgentAlert: boolean;
  daysRemaining: number | null;
  kind: 'overdue' | 'today' | 'upcoming' | 'none';
  badgeText: string | null;
}

/**
 * Evaluates whether an active record falls within the configured urgent alert threshold (3 or 5 days).
 * Completed, cancelled, or archived records NEVER trigger urgent motion alerts.
 */
export function evaluateUrgentAlert(
  targetDateISO: string | null | undefined,
  isTerminalOrArchived: boolean,
  alertDays: 3 | 5 = 3,
  todayISO = getTodayISO()
): UrgentAlertResult {
  if (isTerminalOrArchived || !targetDateISO) {
    return {
      isUrgentAlert: false,
      daysRemaining: null,
      kind: 'none',
      badgeText: null,
    };
  }
  const datePart = targetDateISO.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return {
      isUrgentAlert: false,
      daysRemaining: null,
      kind: 'none',
      badgeText: null,
    };
  }

  const diff = diffDaysISO(todayISO, datePart);
  if (diff < 0) {
    return {
      isUrgentAlert: true,
      daysRemaining: diff,
      kind: 'overdue',
      badgeText: 'تنبيه متأخر',
    };
  }
  if (diff === 0) {
    return {
      isUrgentAlert: true,
      daysRemaining: 0,
      kind: 'today',
      badgeText: 'يستحق اليوم',
    };
  }
  if (diff <= alertDays) {
    return {
      isUrgentAlert: true,
      daysRemaining: diff,
      kind: 'upcoming',
      badgeText:
        diff === 1
          ? 'قريب (غدًا)'
          : `قريب (${toEnglishDigits(String(diff))} أيام)`,
    };
  }
  return {
    isUrgentAlert: false,
    daysRemaining: diff,
    kind: 'none',
    badgeText: null,
  };
}

export function getUrgentAlertMotionClass(
  isUrgentAlert: boolean,
  motionMode: 'repeat_5s' | 'continuous' | 'strong_shake'
): string {
  if (!isUrgentAlert) return '';
  if (motionMode === 'continuous') return 'urgent-badge-continuous';
  if (motionMode === 'strong_shake') return 'urgent-badge-strong-shake';
  return 'urgent-badge-repeat-5s';
}

