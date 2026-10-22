import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  ExternalLink,
  Inbox,
  AlertTriangle,
  RefreshCw,
  MailCheck,
  Mail
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { MatchedEmail } from '../../types.js';
import { EmailDetailModal } from '../components/EmailDetailModal.js';

export const ImportantEmailsView: React.FC = () => {
  const { rules, showToast } = useApp();

  const [emails, setEmails] = useState<MatchedEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [ruleFilter, setRuleFilter] = useState('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');

  const [selectedEmail, setSelectedEmail] = useState<MatchedEmail | null>(null);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (ruleFilter !== 'all') params.set('ruleId', ruleFilter);
      if (readFilter !== 'all') params.set('readStatus', readFilter);

      const res = await fetch(`/api/emails?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
        setTotal(data.total || 0);
      }
    } catch (err: any) {
      showToast('Failed to load matched emails', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [priorityFilter, ruleFilter, readFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmails();
  };

  const handleToggleRead = async (id: string, currentRead: boolean) => {
    try {
      const res = await fetch(`/api/emails/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: !currentRead }),
      });
      if (res.ok) {
        setEmails(prev =>
          prev.map(e => (e.id === id ? { ...e, isRead: !currentRead } : e))
        );
        if (selectedEmail && selectedEmail.id === id) {
          setSelectedEmail({ ...selectedEmail, isRead: !currentRead });
        }
      }
    } catch {
      showToast('Error updating read status', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Important Emails</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Messages intercepted and prioritized by MailSentinel ({total} total)
          </p>
        </div>

        <button
          onClick={fetchEmails}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sentinel-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search sender, subject, or email content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-sentinel-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
            <option value="Low">Low</option>
          </select>

          {/* Rule filter */}
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none"
          >
            <option value="all">All Rules</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          {/* Read status filter */}
          <select
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read Only</option>
          </select>
        </div>
      </div>

      {/* Emails Feed */}
      <div className="space-y-3">
        {emails.length > 0 ? (
          emails.map((email) => {
            const isCrit = email.priority === 'Critical';
            const isHigh = email.priority === 'High';

            return (
              <div
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  !email.isRead
                    ? 'bg-slate-900/90 border-slate-700 hover:border-slate-600 shadow-md'
                    : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/70 opacity-80'
                }`}
              >
                <div className="space-y-2 flex-1 pr-4">
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
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {email.deadlineText && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/80 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Deadline: {email.deadlineText}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                    {email.subject}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {email.snippet}
                  </p>

                  <div className="text-[11px] text-sentinel-300 font-medium">
                    ↳ {email.matchExplanation}
                  </div>
                </div>

                {/* Direct quick action buttons */}
                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRead(email.id, email.isRead);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs"
                    title={email.isRead ? 'Mark as Unread' : 'Mark as Read'}
                  >
                    {email.isRead ? <Mail className="w-4 h-4" /> : <MailCheck className="w-4 h-4 text-emerald-400" />}
                  </button>

                  <a
                    href={`https://mail.google.com/mail/u/0/#all/${email.threadId || email.messageId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    title="Open message in Gmail"
                  >
                    <span>Gmail</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
            <Inbox className="w-10 h-10 text-slate-500 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-200">No Emails Match Selected Filters</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your search criteria or priority filter above.
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
