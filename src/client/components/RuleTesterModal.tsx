import React, { useState } from 'react';
import { X, Play, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { MonitoringRule } from '../../types.js';

interface RuleTesterModalProps {
  isOpen: boolean;
  rule: MonitoringRule | null;
  onClose: () => void;
}

export const RuleTesterModal: React.FC<RuleTesterModalProps> = ({ isOpen, rule, onClose }) => {
  const [senderEmail, setSenderEmail] = useState('admissions@stanford.edu');
  const [senderName, setSenderName] = useState('Stanford Admissions Office');
  const [subject, setSubject] = useState('Decision Letter & Enrollment Deadline');
  const [bodyText, setBodyText] = useState(
    'Congratulations! We are delighted to extend you an offer of admission. Please submit your confirmation by November 15, 2026.'
  );

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen || !rule) return null;

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch('/api/rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule,
          email: {
            senderEmail,
            senderName,
            subject,
            bodyText,
          },
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-navy-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sentinel-600/20 text-sentinel-400 border border-sentinel-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Live Rule Tester</h2>
              <p className="text-xs text-slate-400">Testing against rule: <span className="text-sentinel-300 font-medium">{rule.name}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Sender Email</label>
              <input
                type="text"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Sender Display Name</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Email Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Email Body Sample</label>
            <textarea
              rows={3}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={testing}
            className="w-full py-2.5 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sentinel-600/20"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{testing ? 'Evaluating...' : 'Simulate Rule Evaluation'}</span>
          </button>

          {result && (
            <div className={`p-4 rounded-xl border mt-4 animate-in fade-in duration-200 ${
              result.matched
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm mb-2">
                {result.matched ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Rule Matched! Notification would be triggered.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <span>Rule Did Not Match.</span>
                  </>
                )}
              </div>

              {result.suppressedByExcludedKeyword && (
                <div className="text-xs text-red-300 mb-2">
                  🚫 Match was suppressed because excluded keyword "{result.suppressedByExcludedKeyword}" was detected.
                </div>
              )}

              {result.reasons && result.reasons.length > 0 && (
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-slate-300">Matching conditions:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    {result.reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.classification && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-300">Evaluated Priority:</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      result.classification.priority === 'Critical' ? 'bg-red-500/20 text-red-400' :
                      result.classification.priority === 'High' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-sky-500/20 text-sky-400'
                    }`}>
                      {result.classification.priority}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px]">{result.classification.reason}</div>
                  {result.classification.deadline && (
                    <div className="text-amber-300 text-[11px] font-medium">
                      ⏰ Detected deadline: "{result.classification.deadline.text}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
