import React from 'react';
import { X, ExternalLink, Clock, ShieldAlert, CheckCircle, BellOff, Calendar } from 'lucide-react';
import { MatchedEmail } from '../../types.js';

interface EmailDetailModalProps {
  email: MatchedEmail | null;
  onClose: () => void;
  onToggleRead: (id: string, currentRead: boolean) => void;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({
  email,
  onClose,
  onToggleRead,
}) => {
  if (!email) return null;

  const gmailUrl = `https://mail.google.com/mail/u/0/#all/${email.threadId || email.messageId}`;

  const priorityColor =
    email.priority === 'Critical'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : email.priority === 'High'
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : email.priority === 'Normal'
      ? 'bg-sentinel-500/20 text-sentinel-400 border-sentinel-500/30'
      : 'bg-slate-500/20 text-slate-400 border-slate-500/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-navy-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="space-y-2 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${priorityColor}`}>
                {email.priority} Priority
              </span>
              {email.matchedRuleNames && email.matchedRuleNames.map((rn, idx) => (
                <span key={idx} className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Rule: {rn}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-bold text-slate-100 leading-snug">{email.subject}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sender and Date info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-6 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">From</span>
            <span className="font-semibold text-slate-200">{email.senderName || email.senderEmail}</span>
            {email.senderName && <span className="text-slate-400 block font-mono text-[11px]">{email.senderEmail}</span>}
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Date Received</span>
            <span className="text-slate-300 font-mono">
              {new Date(email.dateReceived).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
        </div>

        {/* Why it matched & Priority analysis */}
        <div className="p-4 rounded-2xl bg-sentinel-950/40 border border-sentinel-800/50 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-sentinel-400 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Why MailSentinel Intercepted This Email</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-medium">
            {email.matchExplanation}
          </p>
          <div className="text-[11px] text-slate-400 pt-1 border-t border-sentinel-900/50">
            <strong>Priority Rationale:</strong> {email.priorityReason}
          </div>
        </div>

        {/* Deadline indicator if detected */}
        {email.deadlineText && (
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/40 mb-6 flex items-start gap-3 text-xs">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-200">
                Deadline Detected: {email.deadlineText}
              </div>
              <p className="text-[11px] text-amber-400/80 mt-0.5">
                {email.deadlineIsUncertain
                  ? 'Note: Exact timestamp was not explicitly verified from the text.'
                  : 'Time-sensitive response recommended before expiration.'}
              </p>
            </div>
          </div>
        )}

        {/* Snippet & Body Preview */}
        <div className="space-y-2 mb-6">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Content Preview</span>
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-mono">
            {email.bodyPreview || email.snippet}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={() => onToggleRead(email.id, email.isRead)}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{email.isRead ? 'Mark as Unread' : 'Mark as Read'}</span>
          </button>

          <a
            href={gmailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white font-semibold text-xs transition shadow-lg shadow-sentinel-600/20"
          >
            <span>Open Original in Gmail</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
