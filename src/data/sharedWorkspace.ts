import type { AppDatabaseState, AppPreferences } from '../types/domain';

export interface SharedWorkspace {
  state: AppDatabaseState;
  revision: number;
}

export const sharedBuild = import.meta.env.VITE_SHARED_MODE === 'true';

export const sharedSettingKeys = [
  'documentWarningDays', 'urgentAlertDays', 'urgentAlertMotion', 'integrations',
] as const satisfies readonly (keyof AppPreferences)[];

const personalKeys = [
  'theme', 'sidebarCollapsed', 'showHijri', 'currentSpecialistId', 'collapsedSections',
  'navGroupCollapsed', 'taskFilters', 'documentFilters', 'vatArchiveFilters', 'activeNav',
] as const satisfies readonly (keyof AppPreferences)[];

const personalKey = 'haqibat_shared_ui_preferences';

export function personalPreferences(preferences: AppPreferences): Partial<AppPreferences> {
  return Object.fromEntries(personalKeys.map((key) => [key, preferences[key]]));
}

export function loadPersonalPreferences(): Partial<AppPreferences> {
  try {
    const saved = JSON.parse(localStorage.getItem(personalKey) || '{}');
    return Object.fromEntries(personalKeys.filter((key) => Object.hasOwn(saved, key)).map((key) => [key, saved[key]]));
  } catch {
    return {};
  }
}

export function savePersonalPreferences(preferences: AppPreferences) {
  try {
    localStorage.setItem(personalKey, JSON.stringify(personalPreferences(preferences)));
  } catch {
    // Preferences remain usable in memory when browser storage is unavailable.
  }
}

export async function fetchWorkspace(command?: { revision: number; name: string; args: unknown[] }): Promise<SharedWorkspace> {
  const response = await fetch(command ? '/api/state/commands' : '/api/state', {
    credentials: 'include',
    cache: 'no-store',
    ...(command && {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(command),
    }),
  });
  const payload = await response.json() as SharedWorkspace & { error?: string };
  if (!response.ok || !payload.state || !Number.isSafeInteger(payload.revision)) {
    throw new Error(payload.error || 'تعذّر تحميل سجلات مساحة العمل من الخادم.');
  }
  return payload;
}
