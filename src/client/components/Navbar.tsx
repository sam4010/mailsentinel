import React from 'react';
import {
  LayoutDashboard,
  Sliders,
  Inbox,
  Bell,
  Mail,
  Settings,
  RefreshCw,
  Sun,
  Moon,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useApp, ViewType } from '../context/AppContext.js';

export const Navbar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    theme,
    toggleTheme,
    stats,
    account,
    authStatus,
    isSyncing,
    triggerSync,
  } = useApp();

  const navItems: Array<{ id: ViewType; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'rules', label: 'Monitoring Rules', icon: <Sliders className="w-5 h-5" /> },
    {
      id: 'emails',
      label: 'Important Emails',
      icon: <Inbox className="w-5 h-5" />,
      badge: stats?.highPriorityCount && stats.highPriorityCount > 0 ? stats.highPriorityCount : undefined,
    },
    { id: 'notifications', label: 'Notification History', icon: <Bell className="w-5 h-5" /> },
    { id: 'accounts', label: 'Connected Accounts', icon: <Mail className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const isConnected = Boolean(account);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 dark:border-slate-800/80 bg-navy-950/90 dark:bg-navy-950 backdrop-blur-md p-4 justify-between h-screen sticky top-0">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sentinel-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-100 tracking-tight flex items-center gap-1.5">
                MailSentinel
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sentinel-500/20 text-sentinel-400 border border-sentinel-500/30">MVP</span>
              </h1>
              <p className="text-xs text-slate-400">Intelligent Email Monitor</p>
            </div>
          </div>

          {/* Sync status card */}
          <div className="mx-1 mb-6 p-3 rounded-xl bg-slate-900/60 dark:bg-slate-900/70 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
                  }`}
                />
                <span className="text-xs font-medium text-slate-300">
                  {isConnected ? 'Gmail Active' : 'Not Connected'}
                </span>
              </div>
              <button
                onClick={triggerSync}
                disabled={isSyncing || !isConnected}
                title={isConnected ? 'Sync now' : 'Connect Gmail to sync'}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sentinel-400' : ''}`} />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {isConnected ? account?.email : 'Connect Gmail to monitor'}
            </p>
          </div>

          {/* Nav links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    active
                      ? 'bg-sentinel-600/15 text-sentinel-400 border border-sentinel-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-semibold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between px-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition py-1 px-2 rounded-lg hover:bg-slate-900"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-navy-950 border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sentinel-600 to-sky-400 flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-bold text-base text-slate-100 tracking-tight">MailSentinel</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerSync}
            disabled={isSyncing || !isConnected}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-sentinel-400' : ''}`} />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-navy-950/95 backdrop-blur-lg border-t border-slate-800 flex justify-around py-2 px-1">
        {navItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex flex-col items-center py-1 px-2 rounded-lg relative ${
                active ? 'text-sentinel-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 text-[10px] w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center font-bold">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 truncate max-w-[56px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
