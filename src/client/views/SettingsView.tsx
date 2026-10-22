import React, { useState, useEffect } from 'react';
import {
  Settings,
  Moon,
  Bell,
  Clock,
  Download,
  Upload,
  Shield,
  Save,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Server,
  Globe
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { usePushNotifications } from '../hooks/usePushNotifications.js';

export const SettingsView: React.FC = () => {
  const { authStatus, showToast, refreshAll } = useApp();

  const {
    permission,
    isSubscribed,
    subscribeUser,
    sendLocalTestNotification,
  } = usePushNotifications();

  const [timezone, setTimezone] = useState('UTC');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState(60);
  const [retentionDays, setRetentionDays] = useState(90);

  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('mailsentinel_server_url') || 'https://mailsentinel-0azx.onrender.com');
  const [serverStatus, setServerStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [serverErrorMessage, setServerErrorMessage] = useState('');

  const testServerConnection = async () => {
    setServerStatus('checking');
    setServerErrorMessage('');
    try {
      const target = (serverUrl.trim() || '').replace(/\/+$/, '');
      const testEndpoint = target ? `${target}/health` : '/health';
      const res = await window.fetch(testEndpoint);
      if (res.ok) {
        setServerStatus('connected');
        showToast('Server connection verified!', 'success');
        if (target) {
          localStorage.setItem('mailsentinel_server_url', target);
        } else {
          localStorage.removeItem('mailsentinel_server_url');
        }
        refreshAll();
      } else {
        setServerStatus('error');
        setServerErrorMessage(`Server returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      setServerStatus('error');
      setServerErrorMessage(err.message || 'Could not connect to server URL');
    }
  };

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings;
        if (s) {
          setTimezone(s.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
          setQuietHoursEnabled(Boolean(s.quietHoursEnabled));
          setQuietHoursStart(s.quietHoursStart || '22:00');
          setQuietHoursEnd(s.quietHoursEnd || '07:00');
          setPushEnabled(s.pushEnabled !== false);
          setSyncInterval(s.syncIntervalSeconds || 60);
          setRetentionDays(s.retentionDays || 90);
        }
      }
    } catch {
      console.warn('Failed to fetch settings');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          quietHoursEnabled,
          quietHoursStart,
          quietHoursEnd,
          pushEnabled,
          syncIntervalSeconds: syncInterval,
          retentionDays,
        }),
      });

      if (res.ok) {
        setSaved(true);
        showToast('Settings saved successfully', 'success');
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      showToast('Error saving settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribePush = async () => {
    if (authStatus?.vapidPublicKey) {
      const res = await subscribeUser(authStatus.vapidPublicKey);
      if (res.success) {
        showToast('Subscribed to Web Push notifications!', 'success');
        refreshAll();
      } else {
        showToast(res.error || 'Failed to subscribe', 'error');
      }
    } else {
      showToast('VAPID public key not configured on server', 'error');
    }
  };

  const handleLocalTest = async () => {
    const ok = await sendLocalTestNotification(
      '🚨 [CRITICAL] MailSentinel Local Alert',
      'Local test notification delivered successfully to your screen!'
    );
    if (ok) {
      showToast('Local test notification triggered!', 'success');
    } else {
      showToast('Permission denied or notifications blocked by device', 'error');
    }
  };

  const handleExportRules = () => {
    window.open('/api/settings/export/rules', '_blank');
  };

  const handleImportRules = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await fetch('/api/settings/import/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Rules imported successfully', 'success');
        refreshAll();
      } else {
        showToast(data.error || 'Failed to import rules', 'error');
      }
    } catch (err: any) {
      showToast('Invalid JSON file format', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">Application Settings</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure notifications, quiet hours, timezone, and backup policies
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Backend Server Connection (for Android APK / Remote) */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-100 font-bold text-sm">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Backend Server Connection</span>
            </div>
            {serverStatus === 'connected' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Server URL</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => {
                    setServerUrl(e.target.value);
                    setServerStatus('idle');
                  }}
                  placeholder="e.g. https://mailsentinel.onrender.com (or leave blank for local)"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sentinel-500 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={testServerConnection}
                disabled={serverStatus === 'checking'}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                {serverStatus === 'checking' ? 'Testing...' : 'Test & Save'}
              </button>
            </div>
            {serverErrorMessage && (
              <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {serverErrorMessage}
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              On Android, enter your hosted Render / cloud server URL to monitor 24/7 with your laptop closed. Leave empty if accessing directly via browser.
            </p>
          </div>
        </div>

        {/* Quiet Hours & Timezone */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2.5 text-slate-100 font-bold text-sm">
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>Quiet Hours & Timezone</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Your Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/Los_Angeles, America/New_York, UTC"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
              />
              <span className="text-[11px] text-slate-500">
                Used to compute explicit deadline alarms and quiet hours.
              </span>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={quietHoursEnabled}
                  onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-sentinel-500 focus:ring-0"
                />
                <span className="text-xs font-semibold text-slate-200">Enable Quiet Hours</span>
              </label>

              {quietHoursEnabled && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex-1 space-y-1">
                    <span className="text-slate-400 text-[11px]">Start Time</span>
                    <input
                      type="time"
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                    />
                  </div>
                  <span className="text-slate-500 pt-5">to</span>
                  <div className="flex-1 space-y-1">
                    <span className="text-slate-400 text-[11px]">End Time</span>
                    <input
                      type="time"
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                    />
                  </div>
                </div>
              )}
              <span className="text-[11px] text-slate-500 block">
                During quiet hours, only Critical alerts will deliver push audio; Normal/High alerts are logged silently.
              </span>
            </div>
          </div>
        </div>

        {/* Browser Push Notifications */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-slate-100 font-bold text-sm">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Browser Push Notifications (Web Push API)</span>
            </div>

            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              isSubscribed
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {isSubscribed ? 'Subscribed ✓' : `Permission: ${permission}`}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            MailSentinel uses standard VAPID Web Push protocols. Push notifications can reach your desktop or Android device via Service Worker even when the browser tab is idle.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!isSubscribed && (
              <button
                type="button"
                onClick={handleSubscribePush}
                className="px-4 py-2 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white text-xs font-semibold transition shadow-md shadow-sentinel-600/20"
              >
                Subscribe Device to Push
              </button>
            )}

            <button
              type="button"
              onClick={handleLocalTest}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Send Local Test Alert</span>
            </button>
          </div>
        </div>

        {/* Sync & Retention */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2.5 text-slate-100 font-bold text-sm">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Sync Frequency & Data Retention</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Background Polling Interval</label>
              <select
                value={syncInterval}
                onChange={(e) => setSyncInterval(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
              >
                <option value={30}>Every 30 seconds (High frequency)</option>
                <option value={60}>Every 1 minute (Recommended)</option>
                <option value={120}>Every 2 minutes</option>
                <option value={300}>Every 5 minutes</option>
              </select>
              <span className="text-[11px] text-slate-500">
                Gmail API quota consumption scales with frequency.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Retention Period</label>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
              >
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days (Recommended)</option>
                <option value={180}>180 Days</option>
                <option value={365}>1 Year</option>
              </select>
              <span className="text-[11px] text-slate-500">
                Processed email alerts older than this will be pruned.
              </span>
            </div>
          </div>
        </div>

        {/* Backup & Restore Rules */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2.5 text-slate-100 font-bold text-sm">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Backup & Restore Monitoring Rules</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Export all your custom rules and regex filters to a portable JSON backup file, or restore existing rules from a backup.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleExportRules}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Rules (JSON)</span>
            </button>

            <label className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Rules</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportRules}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white font-semibold text-xs transition shadow-lg shadow-sentinel-600/20"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : saved ? 'Saved ✓' : 'Save Preferences'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
