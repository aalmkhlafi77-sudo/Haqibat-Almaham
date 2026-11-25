/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CalendarView } from './components/CalendarView';
import { CasesPoasView } from './components/CasesPoasView';
import { DocumentsView } from './components/DocumentsView';
import HaqibatLampLogin from './components/HaqibatLampLogin';
import { Layout } from './components/Layout';
import { LoginView } from './components/LoginView';
import { RecordDrawer } from './components/RecordDrawer';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { ShareModal } from './components/ShareModal';
import { SpecialistsView } from './components/SpecialistsView';
import { TasksView } from './components/TasksView';
import { TodayView } from './components/TodayView';
import { Vat3AView } from './components/Vat3AView';
import { AppProvider, useApp } from './context/AppContext';

const MainRouter: React.FC = () => {
  const { db, currentUser, authLoading, hasPerm } = useApp();
  const activeNav = db.preferences.activeNav;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-600 dark:text-slate-300">
        جارٍ التحقق من الجلسة...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <HaqibatLampLogin>
        <LoginView />
      </HaqibatLampLogin>
    );
  }

  return (
    <Layout>
      {activeNav === 'today' && <TodayView />}
      {activeNav === 'tasks' && <TasksView />}
      {activeNav === 'documents' && <DocumentsView />}
      {activeNav === 'cases' && <CasesPoasView />}
      {activeNav === 'calendar' && <CalendarView />}
      {activeNav === 'reports' && <ReportsView />}
      {activeNav === 'specialists' && <SpecialistsView />}
      {activeNav === 'vat3a' &&
        (hasPerm('vat3a:view') ? (
          <Vat3AView />
        ) : (
          <div className="glass-panel rounded-xl p-6 text-center space-y-2 max-w-lg mx-auto mt-8">
            <h2 className="text-base font-bold text-rose-700 dark:text-rose-300">
              صلاحية غير متوفرة لوحدة ضريبة القيمة المضافة 3A
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              الحساب الحالي ({currentUser.roleLabel}) محجوب عن عرض أو تعديل نموذج 3A.
            </p>
          </div>
        ))}
      {activeNav === 'settings' && <SettingsView />}
      <RecordDrawer />
      <ShareModal />
    </Layout>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
}
