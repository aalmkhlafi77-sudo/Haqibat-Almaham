import React from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DOMAIN_TONE_CLASSES, DomainEntityTone } from './StatusBadge';

interface CollapsibleSectionProps {
  sectionKey: string;
  title: string;
  count?: number;
  tone?: DomainEntityTone;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  sectionKey,
  title,
  count,
  tone,
  icon,
  headerAction,
  children,
}) => {
  const { db, toggleSectionCollapsed } = useApp();
  const isCollapsed = db.preferences.collapsedSections[sectionKey] ?? false;
  const toneStyle = tone ? DOMAIN_TONE_CLASSES[tone] : null;

  return (
    <section className="glass-panel rounded-xl overflow-hidden transition-colors">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/60">
        <button
          type="button"
          onClick={() => toggleSectionCollapsed(sectionKey)}
          aria-expanded={!isCollapsed}
          className="flex items-center gap-2.5 text-right flex-1 min-w-0 py-1 rounded-lg hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {isCollapsed ? (
            <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          )}
          {icon && (
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                toneStyle
                  ? toneStyle.iconBg
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {icon}
            </span>
          )}
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h2>
          {typeof count === 'number' && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
              ({count})
            </span>
          )}
        </button>

        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {!isCollapsed && <div className="p-4">{children}</div>}
    </section>
  );
};
