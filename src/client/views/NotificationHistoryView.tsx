import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Trash2,
  RefreshCw,
  Send,
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { NotificationEvent } from '../../types.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';

export const NotificationHistoryView: React.FC = () => {
  const { showToast } = useApp();

  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      showToast('Failed to load notification history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/notifications/clear', { method: 'POST' });
      if (res.ok) {
        showToast('Notification history cleared', 'info');
        setEvents([]);
        setIsClearDialogOpen(false);
      }
    } catch {
      showToast('Failed to clear notification history', 'error');
    }
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/notifications/retry/${id}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('Notification redelivered successfully!', 'success');
        fetchHistory();
      } else {
        showToast(data.error || 'Retry failed', 'error');
      }
    } catch (e: any) {
      showToast('Error retrying notification', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handlePushTest = async () => {
    try {
      const res = await fetch('/api/notifications/test-push', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Web Push test notification sent and verified!', 'success');
        fetchHistory();
      } else {
        showToast(data.message || 'Push test failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error triggering push test', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Notification History</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit log of all in-app and browser push alerts dispatched ({events.length} total)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePushTest}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition"
            title="Send live Web Push test to device"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Web Push</span>
          </button>

          {events.length > 0 && (
            <button
              onClick={() => setIsClearDialogOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </button>
          )}

          <button
            onClick={fetchHistory}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* History Log */}
      <div className="space-y-3">
        {events.length > 0 ? (
          events.map((evt) => {
            const isDelivered = evt.status === 'Delivered';
            const isFailed = evt.status === 'Failed';
            const isPending = evt.status === 'Pending';

            return (
              <div
                key={evt.id}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5 flex-1 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isDelivered
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                          : isFailed
                          ? 'bg-red-950/60 text-red-300 border-red-800/80'
                          : 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                      }`}
                    >
                      {evt.status}
                    </span>

                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Channel: {evt.channel}
                    </span>

                    <span className="text-slate-500 font-mono text-[11px]">
                      {new Date(evt.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-200 text-sm">{evt.title}</h4>
                  <p className="text-slate-400 leading-relaxed line-clamp-2">{evt.body}</p>

                  {evt.errorMessage && (
                    <div className="text-[11px] text-red-400 font-mono pt-1">
                      Error: {evt.errorMessage}
                    </div>
                  )}
                </div>

                {isFailed && evt.channel === 'push' && (
                  <button
                    onClick={() => handleRetry(evt.id)}
                    disabled={retryingId === evt.id}
                    className="self-end sm:self-auto px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 hover:bg-red-900/60 transition flex items-center gap-1.5"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${retryingId === evt.id ? 'animate-spin' : ''}`} />
                    <span>Retry Push</span>
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
            <Bell className="w-10 h-10 text-slate-500 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-200">No Notification Events Logged</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Dispatched browser push notifications and in-app alerts will be recorded here with delivery confirmations.
            </p>
          </div>
        )}
      </div>

      {/* Clear Log Confirmation */}
      <ConfirmDialog
        isOpen={isClearDialogOpen}
        title="Clear Notification History?"
        message="This will permanently delete all logged notification records from the database."
        confirmLabel="Clear All"
        isDestructive={true}
        onConfirm={handleClearHistory}
        onCancel={() => setIsClearDialogOpen(false)}
      />
    </div>
  );
};
