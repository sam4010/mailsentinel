import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MonitoringRule, MatchedEmail, ConnectedAccount, OverviewStats } from '../../types.js';

export type ViewType = 'overview' | 'rules' | 'emails' | 'notifications' | 'accounts' | 'settings';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  stats: OverviewStats | null;
  rules: MonitoringRule[];
  account: ConnectedAccount | null;
  authStatus: {
    connected: boolean;
    oauthConfigured: boolean;
    vapidConfigured: boolean;
    vapidPublicKey?: string;
    redirectUri?: string;
  } | null;
  isSyncing: boolean;
  unreadCount: number;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  refreshAll: () => Promise<void>;
  triggerSync: () => Promise<void>;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('mailsentinel_theme');
    return (saved === 'light' ? 'light' : 'dark');
  });

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [rules, setRules] = useState<MonitoringRule[]>([]);
  const [account, setAccount] = useState<ConnectedAccount | null>(null);
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);

  // Apply theme to html element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('mailsentinel_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [authRes, rulesRes, overviewRes] = await Promise.all([
        fetch('/api/auth/status'),
        fetch('/api/rules'),
        fetch('/api/overview'),
      ]);

      if (authRes.ok) {
        const authData = await authRes.json();
        setAuthStatus(authData);
        setAccount(authData.account);

        // First time check: if no account connected and user hasn't completed onboarding, prompt onboarding
        const onboardingDismissed = localStorage.getItem('mailsentinel_onboarding_dismissed');
        if (!authData.connected && !onboardingDismissed) {
          setIsOnboardingOpen(true);
        }
      }

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData.rules || []);
      }

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        setStats(overviewData);
      }
    } catch (err) {
      console.warn('Failed to refresh application data:', err);
    }
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync/now', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Sync completed! ${data.syncedCount} emails evaluated, ${data.matchedCount} matched.`, 'success');
      } else {
        showToast(data.error || 'Sync failed', 'error');
      }
      await refreshAll();
    } catch (e: any) {
      showToast(e.message || 'Error triggering sync', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // Poll every 15s to update badge & sync states
    const timer = setInterval(refreshAll, 15000);
    return () => clearInterval(timer);
  }, [refreshAll]);

  const unreadCount = stats?.recentEmails ? stats.highPriorityCount : 0;

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        theme,
        toggleTheme,
        stats,
        rules,
        account,
        authStatus,
        isSyncing,
        unreadCount,
        toasts,
        showToast,
        removeToast,
        refreshAll,
        triggerSync,
        isOnboardingOpen,
        setIsOnboardingOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
