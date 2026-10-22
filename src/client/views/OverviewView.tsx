import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Inbox,
  Sliders,
  RefreshCw,
  Bell,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { MatchedEmail } from '../../types.js';
import { EmailDetailModal } from '../components/EmailDetailModal.js';

export const OverviewView: React.FC = () => {
  const {
    stats,
    account,
    authStatus,
    isSyncing,
    triggerSync,
    setCurrentView,
    setIsOnboardingOpen,
    showToast,
    refreshAll,
  } = useApp();

  const [selectedEmail, setSelectedEmail] = useState<MatchedEmail | null>(null);

  const isConnected = Boolean(account);

  const handleToggleRead = async (id: string, currentRead: boolean) => {
    try {
      const res = await fetch(`/api/emails/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: !currentRead }),
      });
      if (res.ok) {
        if (selectedEmail && selectedEmail.id === id) {
          setSelectedEmail({ ...selectedEmail, isRead: !currentRead });
        }
        refreshAll();
      }
    } catch (e: any) {
      showToast('Failed to update email status', 'error');
    }
  };

  const handleLocalTest = async () => {
    try {
      const res = await fetch('/api/notifications/test-local', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('Local in-app test notification triggered!', 'success');
        refreshAll();
      }
    } catch (e: any) {
      showToast('Error sending test notification', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner / Setup Alert if not connected */}
      {!isConnected && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-sentinel-950/80 to-slate-900 border border-sentinel-800/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-sentinel-600/20 text-sentinel-400 border border-sentinel-500/30 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Connect Gmail to Begin Monitoring</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                MailSentinel operates with read-only scopes to keep your account safe. Connect your account or complete OAuth setup in Connected Accounts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Start Guided Setup
            </button>
            <button
              onClick={() => setCurrentView('accounts')}
              className="px-4 py-2 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-sentinel-600/20"
            >
              <span>Connect Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Sync / Integration Error Banner */}
      {stats?.syncError && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/60 text-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold block">Last Synchronization Encountered An Issue</span>
            <span className="text-red-300 font-mono">{stats.syncError}</span>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Connection status */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Gmail Monitoring</span>
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'}`} />
          </div>
          <div className="text-lg font-bold text-slate-100 truncate">
            {isConnected ? 'Active & Watching' : 'Standby'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {stats?.lastSyncAt
              ? `Last synced ${new Date(stats.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'No sync yet'}
          </div>
        </div>

        {/* High priority needing attention */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Critical / High Unread</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {stats?.highPriorityCount || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Need your immediate review
          </div>
        </div>

        {/* Matched today */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Matched Today</span>
            <Inbox className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {stats?.matchedToday || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Emails triggered by rules
          </div>
        </div>

        {/* Active Rules */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Active Rules</span>
            <Sliders className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {stats?.activeRulesCount || 0}
            <span className="text-xs text-slate-500 font-normal ml-1">/ {stats?.totalRulesCount || 0}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Deterministic rule filters
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Quick Actions:</span>
          <button
            onClick={triggerSync}
            disabled={isSyncing || !isConnected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-40 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sentinel-400' : ''}`} />
            <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
          </button>
          <button
            onClick={handleLocalTest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Notification</span>
          </button>
        </div>
        <button
          onClick={() => setCurrentView('rules')}
          className="text-xs text-sentinel-400 hover:text-sentinel-300 font-semibold flex items-center gap-1 transition"
        >
          <span>Manage Rules</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Recent Matched Emails Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Recent Intercepted Emails
          </h3>
          <button
            onClick={() => setCurrentView('emails')}
            className="text-xs text-sentinel-400 hover:text-sentinel-300 font-medium flex items-center gap-1 transition"
          >
            <span>View All Matched</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {stats?.recentEmails && stats.recentEmails.length > 0 ? (
          <div className="space-y-2.5">
            {stats.recentEmails.map((email) => {
              const isCrit = email.priority === 'Critical';
              const isHigh = email.priority === 'High';
              return (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    !email.isRead
                      ? 'bg-slate-900/90 border-slate-700 hover:border-slate-600 shadow-md'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/70 opacity-80'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isCrit
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : isHigh
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-sentinel-500/20 text-sentinel-400 border-sentinel-500/30'
                        }`}
                      >
                        {email.priority}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {email.senderName || email.senderEmail}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(email.dateReceived).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-100 leading-snug">
                      {email.subject}
                    </h4>

                    <p className="text-xs text-slate-400 line-clamp-1">
                      {email.snippet}
                    </p>

                    <div className="text-[11px] text-sentinel-300 font-medium">
                      ↳ {email.matchExplanation}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <a
                      href={`https://mail.google.com/mail/u/0/#all/${email.threadId || email.messageId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1"
                      title="Open in Gmail"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">No Matched Emails Yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              When emails matching your monitoring rules arrive in your inbox, they will be logged here with priority analysis.
            </p>
          </div>
        )}
      </div>

      {/* Email Detail Modal */}
      <EmailDetailModal
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
        onToggleRead={handleToggleRead}
      />
    </div>
  );
};
