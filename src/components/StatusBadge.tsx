import React from 'react';
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileWarning,
  Gavel,
  PauseCircle,
  XCircle,
} from 'lucide-react';

export type DomainEntityTone = 'tasks' | 'sessions' | 'documents' | 'cases' | 'vat';

export const DOMAIN_TONE_CLASSES: Record<
  DomainEntityTone,
  { accentText: string; softBg: string; border: string; iconBg: string }
> = {
  tasks: {
    accentText: 'text-blue-700 dark:text-blue-300',
    softBg: 'bg-blue-50/80 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800/60',
    iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  },
  sessions: {
    accentText: 'text-violet-700 dark:text-violet-300',
    softBg: 'bg-violet-50/80 dark:bg-violet-950/40',
    border: 'border-violet-200 dark:border-violet-800/60',
    iconBg: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  },
  documents: {
    accentText: 'text-teal-700 dark:text-teal-300',
    softBg: 'bg-teal-50/80 dark:bg-teal-950/40',
    border: 'border-teal-200 dark:border-teal-800/60',
    iconBg: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  },
  cases: {
    accentText: 'text-amber-700 dark:text-amber-300',
    softBg: 'bg-amber-50/80 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800/60',
    iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
  vat: {
    accentText: 'text-emerald-700 dark:text-emerald-300',
    softBg: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
};

export type SemanticBadgeTone =
  | 'danger'
  | 'warning'
  | 'today'
  | 'success'
  | 'info'
  | 'neutral'
  | 'purple'
  | 'gold';

const BADGE_STYLES: Record<SemanticBadgeTone, string> = {
  danger:
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800/70',
  warning:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800/70',
  today:
    'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800/70',
  success:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/70',
  info:
    'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800/70',
  purple:
    'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-800/70',
  gold:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800/70',
  neutral:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700',
};

export const StatusBadge: React.FC<{
  label: string;
  tone: SemanticBadgeTone;
  icon?: 'alert' | 'clock' | 'check' | 'archive' | 'pause' | 'cancel' | 'gavel' | 'doc';
  motionClass?: string;
}> = ({ label, tone, icon, motionClass = '' }) => {
  const renderIcon = () => {
    const cls = 'w-3.5 h-3.5 shrink-0';
    switch (icon) {
      case 'alert':
        return <AlertTriangle className={cls} />;
      case 'clock':
        return <Clock className={cls} />;
      case 'check':
        return <CheckCircle2 className={cls} />;
      case 'archive':
        return <Archive className={cls} />;
      case 'pause':
        return <PauseCircle className={cls} />;
      case 'cancel':
        return <XCircle className={cls} />;
      case 'gavel':
        return <Gavel className={cls} />;
      case 'doc':
        return <FileCheck2 className={cls} />;
      default:
        return tone === 'danger' ? (
          <FileWarning className={cls} />
        ) : tone === 'warning' || tone === 'today' ? (
          <CalendarClock className={cls} />
        ) : null;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 badge-tone-${tone} ${BADGE_STYLES[tone]} ${motionClass}`}
    >
      {renderIcon()}
      <span>{label}</span>
    </span>
  );
};
