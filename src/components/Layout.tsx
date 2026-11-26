import { AssistantPanel } from './AssistantPanel';
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Scale,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { canAccessNav } from '../domain/authPermissions';
import {
  resolveDocumentCategoryName,
  resolveTaskTypeName,
} from '../data/repository';
import {
  evaluateDocumentHealth,
  evaluatePoaHealth,
  evaluateTaskDelay,
  formatDateTime,
  formatDisplayDate,
  getTodayISO,
} from '../domain/dateUtils';
import { scoreArabicSearchMatch } from '../domain/searchUtils';
import { NavSection, RecordType } from '../types/domain';
import { StatusBadge } from './StatusBadge';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    db,
    toast,
    setActiveNav,
    setSidebarCollapsed,
    toggleTheme,
    toggleNavGroupCollapsed,
    openRecord,
    showToast,
    currentUser,
    logout,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const activeNav = db.preferences.activeNav;
  const sidebarCollapsed = db.preferences.sidebarCollapsed;
  const isDark = db.preferences.theme === 'dark';
  const today = getTodayISO();

  // Compute live operational alerts
  const alerts = useMemo(() => {
    const list: Array<{
      id: string;
      type: RecordType;
      recordId: string;
      title: string;
      subtitle: string;
      badge: string;
      tone: 'danger' | 'warning' | 'today' | 'purple';
    }> = [];

    for (const t of db.tasks) {
      if (t.archivedAt) continue;
      const delay = evaluateTaskDelay(t, today);
      if (delay.isOverdue) {
        list.push({
          id: `alert-task-${t.id}`,
          type: 'task',
          recordId: t.id,
          title: t.title,
          subtitle: `موعدها ${formatDisplayDate(t.dueDate, db.preferences.showHijri)}`,
          badge: delay.label || 'متأخرة',
          tone: 'danger',
        });
      }
    }

    for (const d of db.documents) {
      const h = evaluateDocumentHealth(d, db.preferences.documentWarningDays, today);
      if (h.needsFollowUp) {
        list.push({
          id: `alert-doc-${d.id}`,
          type: 'document',
          recordId: d.id,
          title: d.name,
          subtitle: d.issuingAuthority,
          badge: h.badgeText,
          tone:
            h.category === 'منتهية'
              ? 'danger'
              : h.category === 'تنتهي اليوم'
              ? 'today'
              : 'warning',
        });
      }
    }

    for (const s of db.sessions) {
      if (s.status === 'مجدولة' && s.scheduledAt.slice(0, 10) >= today) {
        const diffDays =
          (Date.parse(s.scheduledAt.slice(0, 10)) - Date.parse(today)) / 86_400_000;
        if (diffDays <= 3) {
          list.push({
            id: `alert-sess-${s.id}`,
            type: 'session',
            recordId: s.id,
            title: s.title,
            subtitle: formatDateTime(s.scheduledAt, db.preferences.showHijri),
            badge: diffDays === 0 ? 'جلسة اليوم' : 'جلسة قادمة',
            tone: 'purple',
          });
        }
      }
    }

    for (const p of db.poas) {
      if (p.archivedAt) continue;
      const ph = evaluatePoaHealth(p, db.preferences.documentWarningDays, today);
      if (ph.isUrgent) {
        list.push({
          id: `alert-poa-${p.id}`,
          type: 'poa',
          recordId: p.id,
          title: p.title,
          subtitle: `مرجع: ${p.referenceNumber}`,
          badge: ph.label,
          tone: ph.isExpired ? 'danger' : 'warning',
        });
      }
    }

    return list;
  }, [
    db.tasks,
    db.documents,
    db.sessions,
    db.poas,
    db.preferences.documentWarningDays,
    db.preferences.showHijri,
    today,
  ]);

  // Instant ranked Arabic-normalized search results across all core modules
  const searchGroups = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];

    const specName = (id: string | null) =>
      db.specialists.find((s) => s.id === id)?.name || '';

    type RankedHit = {
      id: string;
      title: string;
      meta: string;
      score: number;
      navTarget?: NavSection;
    };

    const groups: Array<{
      groupLabel: string;
      type: RecordType | 'specialist';
      topScore: number;
      items: RankedHit[];
    }> = [];

    const rankAndFilter = <T,>(
      rows: T[],
      getId: (r: T) => string,
      getTitle: (r: T) => string,
      getSecondary: (r: T) => Array<string | null | undefined>,
      getMeta: (r: T) => string,
      limit = 6,
      navTarget?: NavSection
    ): RankedHit[] =>
      rows
        .map((r) => {
          const title = getTitle(r);
          const score = scoreArabicSearchMatch(q, title, getSecondary(r));
          return {
            id: getId(r),
            title,
            meta: getMeta(r),
            score,
            navTarget,
          };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    const taskHits = rankAndFilter(
      db.tasks,
      (t) => t.id,
      (t) => t.title,
      (t) => [
        t.letterNumber,
        t.authorityName,
        t.departmentName,
        resolveTaskTypeName(t, db.taskTypes),
        t.status,
        t.notes,
        specName(t.specialistId),
      ],
      (t) => `${resolveTaskTypeName(t, db.taskTypes)} · ${t.status}`
    );
    if (taskHits.length > 0) {
      groups.push({
        groupLabel: 'المهام',
        type: 'task',
        topScore: taskHits[0].score,
        items: taskHits,
      });
    }

    const docHits = rankAndFilter(
      db.documents,
      (d) => d.id,
      (d) => d.name,
      (d) => [
        d.referenceNumber,
        d.issuingAuthority,
        resolveDocumentCategoryName(d, db.documentCategories),
        d.notes,
        specName(d.specialistId),
      ],
      (d) => `${resolveDocumentCategoryName(d, db.documentCategories)} · ${d.referenceNumber}`
    );
    if (docHits.length > 0) {
      groups.push({
        groupLabel: 'الوثائق والتراخيص',
        type: 'document',
        topScore: docHits[0].score,
        items: docHits,
      });
    }

    const caseHits = rankAndFilter(
      db.cases,
      (c) => c.id,
      (c) => c.title,
      (c) => [c.caseNumber, c.parties, c.court, c.notes, specName(c.lawyerSpecialistId)],
      (c) => `قضية رقم ${c.caseNumber} · ${c.status}`
    );
    if (caseHits.length > 0) {
      groups.push({
        groupLabel: 'القضايا',
        type: 'case',
        topScore: caseHits[0].score,
        items: caseHits,
      });
    }

    const sessHits = rankAndFilter(
      db.sessions,
      (s) => s.id,
      (s) => s.title,
      (s) => [s.location, s.outcome, s.notes, specName(s.specialistId)],
      (s) => formatDateTime(s.scheduledAt, db.preferences.showHijri)
    );
    if (sessHits.length > 0) {
      groups.push({
        groupLabel: 'الجلسات',
        type: 'session',
        topScore: sessHits[0].score,
        items: sessHits,
      });
    }

    const poaHits = rankAndFilter(
      db.poas,
      (p) => p.id,
      (p) => p.title,
      (p) => [p.referenceNumber, p.agent, p.grantor, p.scope, specName(p.specialistId)],
      (p) => `مرجع ${p.referenceNumber}`
    );
    if (poaHits.length > 0) {
      groups.push({
        groupLabel: 'الوكالات والتفويضات',
        type: 'poa',
        topScore: poaHits[0].score,
        items: poaHits,
      });
    }

    const calHits = rankAndFilter(
      db.calendarItems,
      (ci) => ci.id,
      (ci) => ci.title,
      (ci) => [ci.kind, ci.notes, specName(ci.specialistId)],
      (ci) => `${ci.kind} · ${formatDateTime(ci.scheduledAt, db.preferences.showHijri)}`
    );
    if (calHits.length > 0) {
      groups.push({
        groupLabel: 'الأحداث والتذكيرات',
        type: 'calendar_item',
        topScore: calHits[0].score,
        items: calHits,
      });
    }

    const specHits = rankAndFilter(
      db.specialists,
      (sp) => sp.id,
      (sp) => sp.name,
      (sp) => [sp.departmentName, sp.roleTitle, sp.mobile, sp.email],
      (sp) => `${sp.roleTitle} · ${sp.departmentName}`,
      4,
      'specialists'
    );
    if (specHits.length > 0) {
      groups.push({
        groupLabel: 'المختصون',
        type: 'specialist',
        topScore: specHits[0].score,
        items: specHits,
      });
    }

    return groups.sort((a, b) => b.topScore - a.topScore);
  }, [
    searchQuery,
    db.tasks,
    db.taskTypes,
    db.documents,
    db.documentCategories,
    db.cases,
    db.sessions,
    db.poas,
    db.calendarItems,
    db.specialists,
    db.preferences.showHijri,
  ]);

  const navGroups: Array<{
    groupKey: string;
    label: string;
    items: Array<{
      id: NavSection;
      label: string;
      icon: React.ReactNode;
      accentClass: string;
    }>;
  }> = [
    {
      groupKey: 'daily',
      label: 'العمل اليومي',
      items: [
        {
          id: 'today',
          label: 'اليوم',
          icon: <Home className="w-4 h-4" />,
          accentClass: 'text-blue-600 dark:text-blue-400',
        },
        {
          id: 'tasks',
          label: 'المهام',
          icon: <CheckSquare className="w-4 h-4" />,
          accentClass: 'text-blue-600 dark:text-blue-400',
        },
        {
          id: 'calendar',
          label: 'التقويم والأحداث',
          icon: <CalendarDays className="w-4 h-4" />,
          accentClass: 'text-violet-600 dark:text-violet-400',
        },
      ],
    },
    {
      groupKey: 'records',
      label: 'السجلات والامتثال',
      items: [
        {
          id: 'documents',
          label: 'الوثائق والتراخيص',
          icon: <FileText className="w-4 h-4" />,
          accentClass: 'text-teal-600 dark:text-teal-400',
        },
        {
          id: 'cases',
          label: 'القضايا والوكالات',
          icon: <Scale className="w-4 h-4" />,
          accentClass: 'text-amber-600 dark:text-amber-400',
        },
        {
          id: 'reports',
          label: 'التقارير والإحصاءات',
          icon: <BarChart3 className="w-4 h-4" />,
          accentClass: 'text-sky-600 dark:text-sky-400',
        },
      ],
    },
    {
      groupKey: 'finance_team',
      label: 'الضريبة والفريق',
      items: [
        {
          id: 'vat3a',
          label: 'ضريبة القيمة المضافة 3A',
          icon: <Receipt className="w-4 h-4" />,
          accentClass: 'text-emerald-600 dark:text-emerald-400',
        },
        {
          id: 'specialists',
          label: 'المختصون والمشاركة',
          icon: <Users className="w-4 h-4" />,
          accentClass: 'text-slate-600 dark:text-slate-300',
        },
        {
          id: 'settings',
          label: 'الإعدادات',
          icon: <Settings className="w-4 h-4" />,
          accentClass: 'text-slate-600 dark:text-slate-300',
        },
      ],
    },
  ];

  const handleSelectNav = (id: NavSection) => {
    setActiveNav(id);
    setMobileMoreOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip">
      {/* Desktop Fixed Right Collapsible Sidebar (outside scrollable content container) */}
      <aside
        aria-label="القائمة الجانبية الرئيسية"
        className={`hidden lg:flex lg:fixed lg:inset-y-0 lg:right-0 lg:z-40 flex-col border-l border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0c0d11]/92 backdrop-blur-md transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 h-16 border-b border-slate-200 dark:border-white/10">
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-bold text-base text-slate-900 dark:text-white truncate">
                  حقيبة المهام
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                متابعة المهام والوثائق والمواعيد
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'فتح القائمة الجانبية' : 'طي القائمة الجانبية'}
            aria-label={sidebarCollapsed ? 'فتح القائمة الجانبية' : 'طي القائمة الجانبية'}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 mx-auto lg:mx-0"
          >
            {sidebarCollapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 pb-5 space-y-4">
          {navGroups.map((grp) => {
            const isGroupCollapsed = db.preferences.navGroupCollapsed[grp.groupKey] ?? false;
            return (
              <div key={grp.groupKey} className="space-y-1">
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleNavGroupCollapsed(grp.groupKey)}
                    className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <span>{grp.label}</span>
                    {isGroupCollapsed ? (
                      <ChevronLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {(!isGroupCollapsed || sidebarCollapsed) &&
                  grp.items
                    .filter((item) => canAccessNav(currentUser, item.id))
                    .map((item) => {
                      const isActive = activeNav === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectNav(item.id)}
                          title={item.label}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                            isActive
                              ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200 border border-blue-200/80 dark:border-blue-500/30'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 border border-transparent'
                          }`}
                        >
                          <span className={`shrink-0 ${item.accentClass}`}>{item.icon}</span>
                          {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </button>
                      );
                    })}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Column — dynamically offsets right padding on desktop for open/collapsed fixed sidebar */}
      <div
        className={`flex-1 flex flex-col min-w-0 pb-20 lg:pb-0 transition-[padding] duration-200 ${
          sidebarCollapsed ? 'lg:pr-[76px]' : 'lg:pr-[264px]'
        }`}
      >
        {/* Top Bar (Compact on mobile <= 56px) */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 px-3 lg:px-6 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0a0b0f]/88 backdrop-blur-md">
          {/* Mobile Brand */}
          <div className="flex items-center gap-2 lg:hidden shrink-0">
            <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-sm text-slate-900 dark:text-white whitespace-nowrap">
              حقيبة المهام
            </span>
          </div>

          {/* Instant Live Search */}
          <div className="relative flex-1 max-w-xl">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="بحث فوري في المهام، الوثائق، القضايا، الجلسات، المختصين..."
                className="w-full h-10 pr-9 pl-8 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#14161b] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="absolute left-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {searchFocused && searchQuery.trim() !== '' && (
              <div className="absolute right-0 left-0 top-12 z-50 glass-panel rounded-xl shadow-2xl max-h-[65vh] overflow-y-auto p-2 space-y-2">
                {searchGroups.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                    لا توجد نتائج مطابقة لـ «{searchQuery}»
                  </p>
                ) : (
                  searchGroups.map((grp) => (
                    <div key={grp.groupLabel} className="space-y-1">
                      <div className="px-2.5 py-1 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>{grp.groupLabel}</span>
                        <span className="font-mono-tabular">{grp.items.length}</span>
                      </div>
                      {grp.items.map((item) => (
                        <button
                          key={`${grp.type}-${item.id}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (grp.type === 'specialist') {
                              setActiveNav('specialists');
                            } else {
                              openRecord(grp.type, item.id);
                            }
                            setSearchFocused(false);
                          }}
                          className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-between gap-2"
                        >
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {item.title}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                            {item.meta}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Header Actions (User + Theme Switch + Notifications Bell on Left Side in RTL) */}
          <div className="flex items-center gap-2 shrink-0">
            {currentUser?.authMode === 'server' && <AssistantPanel />}
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/10">
                <div className="text-right leading-tight max-w-[165px]">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser.displayName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.roleLabel} ·{' '}
                    {currentUser.authMode === 'server' ? 'خادم فعلي' : 'معاينة محلية'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  title="تسجيل الخروج"
                  aria-label="تسجيل الخروج"
                  className="h-10 px-2.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-white/[0.04] text-slate-700 dark:text-slate-100 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors text-xs font-semibold shrink-0 whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden xl:inline">خروج</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع السينمائي'}
              aria-label={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع السينمائي'}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-white/[0.04] text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors shrink-0"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 dark:text-slate-200" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setAlertsOpen(!alertsOpen)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && alertsOpen) {
                    setAlertsOpen(false);
                  }
                }}
                aria-label="التنبيهات"
                aria-expanded={alertsOpen}
                aria-haspopup="dialog"
                className="h-10 px-2.5 flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white/80 dark:bg-white/[0.04] text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors shrink-0"
              >
                <Bell className="w-4 h-4" />
                <span className="text-xs font-bold font-mono-tabular">{alerts.length}</span>
              </button>

              {alertsOpen && (
                <div className="absolute left-0 top-12 w-80 sm:w-96 z-50 glass-panel rounded-xl shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      التنبيهات النشطة (<span className="font-mono-tabular">{alerts.length}</span>)
                    </span>
                    <button
                      type="button"
                      onClick={() => setAlertsOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      إغلاق
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/10">
                    {alerts.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                        لا توجد تنبيهات عاجلة حاليًا.
                      </p>
                    ) : (
                      alerts.map((al) => (
                        <button
                          key={al.id}
                          type="button"
                          onClick={() => {
                            setAlertsOpen(false);
                            openRecord(al.type, al.recordId);
                          }}
                          className="w-full text-right p-3 hover:bg-slate-50 dark:hover:bg-white/5 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {al.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {al.subtitle}
                            </div>
                          </div>
                          <StatusBadge label={al.badge} tone={al.tone} />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="التنقل السفلي"
        className="lg:hidden fixed bottom-0 right-0 left-0 z-40 h-16 bg-white/95 dark:bg-[#0c0d11]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10 grid grid-cols-5 items-center"
      >
        {[
          { id: 'today' as NavSection, label: 'اليوم', icon: <Home className="w-5 h-5" /> },
          { id: 'tasks' as NavSection, label: 'المهام', icon: <CheckSquare className="w-5 h-5" /> },
          {
            id: 'calendar' as NavSection,
            label: 'التقويم',
            icon: <CalendarDays className="w-5 h-5" />,
          },
          { id: 'documents' as NavSection, label: 'الوثائق', icon: <FileText className="w-5 h-5" /> },
        ].map((tab) => {
          const active = activeNav === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectNav(tab.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            ['cases', 'reports', 'vat3a', 'specialists', 'settings'].includes(activeNav) ||
            mobileMoreOpen
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="whitespace-nowrap">المزيد</span>
        </button>
      </nav>

      {/* Mobile "المزيد" Bottom Sheet */}
      {mobileMoreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end"
          onClick={() => setMobileMoreOpen(false)}
        >
          <div
            className="w-full glass-panel rounded-t-2xl p-4 pb-8 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
              <span className="text-sm font-bold text-slate-900 dark:text-white">أقسام أخرى</span>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className="p-2 rounded-lg text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {[
              {
                id: 'cases' as NavSection,
                label: 'القضايا والجلسات والوكالات',
                icon: <Scale className="w-4 h-4 text-amber-500" />,
              },
              {
                id: 'reports' as NavSection,
                label: 'التقارير والإحصاءات',
                icon: <BarChart3 className="w-4 h-4 text-sky-500" />,
              },
              {
                id: 'vat3a' as NavSection,
                label: 'نموذج ضريبة القيمة المضافة 3A',
                icon: <Receipt className="w-4 h-4 text-emerald-500" />,
              },
              {
                id: 'specialists' as NavSection,
                label: 'المختصون وسجل المشاركة',
                icon: <Users className="w-4 h-4 text-blue-500" />,
              },
              {
                id: 'settings' as NavSection,
                label: 'الإعدادات وقواعد 3A والتكاملات',
                icon: <Settings className="w-4 h-4 text-slate-500" />,
              },
            ]
              .filter((item) => canAccessNav(currentUser, item.id))
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNav(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    activeNav === item.id
                      ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            <button
              type="button"
              onClick={() => {
                toggleTheme();
                showToast(isDark ? 'تم التفعيل: الوضع النهاري' : 'تم التفعيل: الوضع السينمائي');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              <span>{isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع السينمائي'}</span>
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  setMobileMoreOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج ({currentUser.displayName})</span>
                </span>
                <span className="text-xs opacity-80">{currentUser.roleLabel}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 left-4 z-50 bg-slate-900 dark:bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium"
        >
          {toast}
        </div>
      )}
    </div>
  );
};
