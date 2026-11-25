/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CalendarView } from './components/CalendarView';
import { CasesPoasView } from './components/CasesPoasView';
import { DocumentsView } from './components/DocumentsView';
import { Layout } from './components/Layout';
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
  const { db } = useApp();
  const activeNav = db.preferences.activeNav;

  return (
    <Layout>
      {activeNav === 'today' && <TodayView />}
      {activeNav === 'tasks' && <TasksView />}
      {activeNav === 'documents' && <DocumentsView />}
      {activeNav === 'cases' && <CasesPoasView />}
      {activeNav === 'calendar' && <CalendarView />}
      {activeNav === 'reports' && <ReportsView />}
      {activeNav === 'specialists' && <SpecialistsView />}
      {activeNav === 'vat3a' && <Vat3AView />}
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
