import React from 'react';
import { AppProvider, useApp } from './context/AppContext.js';
import { Navbar } from './components/Navbar.js';
import { ToastContainer } from './components/Toast.js';
import { OnboardingModal } from './components/OnboardingModal.js';

import { OverviewView } from './views/OverviewView.js';
import { RulesView } from './views/RulesView.js';
import { ImportantEmailsView } from './views/ImportantEmailsView.js';
import { NotificationHistoryView } from './views/NotificationHistoryView.js';
import { ConnectedAccountsView } from './views/ConnectedAccountsView.js';
import { SettingsView } from './views/SettingsView.js';

const MainContent: React.FC = () => {
  const { currentView } = useApp();

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-20 md:pb-8">
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        {currentView === 'overview' && <OverviewView />}
        {currentView === 'rules' && <RulesView />}
        {currentView === 'emails' && <ImportantEmailsView />}
        {currentView === 'notifications' && <NotificationHistoryView />}
        {currentView === 'accounts' && <ConnectedAccountsView />}
        {currentView === 'settings' && <SettingsView />}
      </main>
      <ToastContainer />
      <OnboardingModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <div className="min-h-screen flex flex-col md:flex-row bg-navy-950 text-slate-100">
        <Navbar />
        <MainContent />
      </div>
    </AppProvider>
  );
};

export default App;
