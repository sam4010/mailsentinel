import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Sliders, Shield, AlertCircle } from 'lucide-react';
import { MonitoringRule, Priority, NotificationChannel } from '../../types.js';

interface RuleModalProps {
  isOpen: boolean;
  ruleToEdit?: MonitoringRule | null;
  onClose: () => void;
  onSave: (ruleData: Partial<MonitoringRule>) => Promise<void>;
}

export const RuleModal: React.FC<RuleModalProps> = ({
  isOpen,
  ruleToEdit,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [category, setCategory] = useState('General');
  const [priorityThreshold, setPriorityThreshold] = useState<Priority>('High');
  const [notificationChannel, setNotificationChannel] = useState<NotificationChannel>('both');
  const [matchAll, setMatchAll] = useState(false);
  const [subjectOnly, setSubjectOnly] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Chip lists
  const [senders, setSenders] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [senderNames, setSenderNames] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>([]);

  // Input fields for adding chips
  const [senderInput, setSenderInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [senderNameInput, setSenderNameInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [excludedKeywordInput, setExcludedKeywordInput] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ruleToEdit) {
      setName(ruleToEdit.name);
      setEnabled(ruleToEdit.enabled);
      setCategory(ruleToEdit.category || 'General');
      setPriorityThreshold(ruleToEdit.priorityThreshold);
      setNotificationChannel(ruleToEdit.notificationChannel);
      setMatchAll(ruleToEdit.matchAll);
      setSubjectOnly(ruleToEdit.subjectOnly);
      setCaseSensitive(ruleToEdit.caseSensitive);
      setSenders(ruleToEdit.senders || []);
      setDomains(ruleToEdit.domains || []);
      setSenderNames(ruleToEdit.senderNames || []);
      setKeywords(ruleToEdit.keywords || []);
      setExcludedKeywords(ruleToEdit.excludedKeywords || []);
    } else {
      setName('');
      setEnabled(true);
      setCategory('General');
      setPriorityThreshold('High');
      setNotificationChannel('both');
      setMatchAll(false);
      setSubjectOnly(false);
      setCaseSensitive(false);
      setSenders([]);
      setDomains([]);
      setSenderNames([]);
      setKeywords([]);
      setExcludedKeywords([]);
    }
    setError(null);
  }, [ruleToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddChip = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    input: string,
    setInput: (val: string) => void
  ) => {
    const trimmed = input.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput('');
    }
  };

  const handleRemoveChip = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    index: number
  ) => {
    setList(list.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for this rule.');
      return;
    }

    const hasConditions =
      senders.length > 0 ||
      domains.length > 0 ||
      senderNames.length > 0 ||
      keywords.length > 0;

    if (!hasConditions) {
      setError('Please configure at least one sender, domain, or keyword condition.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        enabled,
        category: category.trim(),
        priorityThreshold,
        notificationChannel,
        matchAll,
        subjectOnly,
        caseSensitive,
        senders,
        domains,
        senderNames,
        keywords,
        excludedKeywords,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-navy-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sentinel-600/20 text-sentinel-400 border border-sentinel-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                {ruleToEdit ? 'Edit Monitoring Rule' : 'New Monitoring Rule'}
              </h2>
              <p className="text-xs text-slate-400">Define what emails MailSentinel should intercept</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rule Name & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Rule Name *</label>
              <input
                type="text"
                placeholder="e.g. Stanford University Admissions, Stripe Invoices"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-sentinel-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Category</label>
              <input
                type="text"
                placeholder="e.g. Education, Career"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-sentinel-500"
              />
            </div>
          </div>

          {/* Priority & Channel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Minimum Priority Level</label>
              <select
                value={priorityThreshold}
                onChange={(e) => setPriorityThreshold(e.target.value as Priority)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-sentinel-500"
              >
                <option value="Critical">🚨 Critical (Urgent alerts, deadline sirens)</option>
                <option value="High">⚠️ High (Important notifications)</option>
                <option value="Normal">📬 Normal (Standard priority)</option>
                <option value="Low">💤 Low (Silent logging)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Notification Channel</label>
              <select
                value={notificationChannel}
                onChange={(e) => setNotificationChannel(e.target.value as NotificationChannel)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-sentinel-500"
              >
                <option value="both">Push & In-App Alerts (Recommended)</option>
                <option value="push">Push Notification Only</option>
                <option value="in_app">In-App Notification Center Only</option>
              </select>
            </div>
          </div>

          {/* Senders & Domains Section */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-sentinel-400">1. Senders & Organizations</div>

            {/* Email Addresses */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">Specific Sender Email Addresses</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="e.g. admissions@stanford.edu"
                  value={senderInput}
                  onChange={(e) => setSenderInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChip(senders, setSenders, senderInput, setSenderInput);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sentinel-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddChip(senders, setSenders, senderInput, setSenderInput)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {senders.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-xs text-slate-200">
                    {s}
                    <button type="button" onClick={() => handleRemoveChip(senders, setSenders, i)} className="text-slate-400 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Domains */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">Sender Domains (Matches any address @domain.edu)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. university.edu, company.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChip(domains, setDomains, domainInput, setDomainInput);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sentinel-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddChip(domains, setDomains, domainInput, setDomainInput)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {domains.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sentinel-950/60 border border-sentinel-800/80 text-xs text-sentinel-300">
                    @{d}
                    <button type="button" onClick={() => handleRemoveChip(domains, setDomains, i)} className="text-slate-400 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Sender Display Names */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">Sender Display Names or Organizations</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Admissions Office, Financial Aid"
                  value={senderNameInput}
                  onChange={(e) => setSenderNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChip(senderNames, setSenderNames, senderNameInput, setSenderNameInput);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sentinel-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddChip(senderNames, setSenderNames, senderNameInput, setSenderNameInput)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {senderNames.map((sn, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-xs text-slate-200">
                    {sn}
                    <button type="button" onClick={() => handleRemoveChip(senderNames, setSenderNames, i)} className="text-slate-400 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Keywords Section */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-400">2. Keywords & Phrases</div>

            {/* Important Keywords */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">Important Keywords or Exact Phrases</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. interview invitation, decision letter, deadline, offer"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChip(keywords, setKeywords, keywordInput, setKeywordInput);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sentinel-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddChip(keywords, setKeywords, keywordInput, setKeywordInput)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {keywords.map((k, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-950/60 border border-sky-800/80 text-xs text-sky-300">
                    "{k}"
                    <button type="button" onClick={() => handleRemoveChip(keywords, setKeywords, i)} className="text-slate-400 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Excluded Keywords */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300">Excluded Keywords (Suppresses alert if found)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. newsletter, marketing, unsubscribe"
                  value={excludedKeywordInput}
                  onChange={(e) => setExcludedKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChip(excludedKeywords, setExcludedKeywords, excludedKeywordInput, setExcludedKeywordInput);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sentinel-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddChip(excludedKeywords, setExcludedKeywords, excludedKeywordInput, setExcludedKeywordInput)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {excludedKeywords.map((ek, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-950/60 border border-red-800/80 text-xs text-red-300">
                    🚫 {ek}
                    <button type="button" onClick={() => handleRemoveChip(excludedKeywords, setExcludedKeywords, i)} className="text-slate-400 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Logic & Matching Behavior Toggles */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">3. Matching Semantics</div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={matchAll}
                onChange={(e) => setMatchAll(e.target.checked)}
                className="mt-1 rounded bg-slate-900 border-slate-700 text-sentinel-500 focus:ring-0"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200">Require Both Sender AND Keyword Match (Match All)</span>
                <p className="text-[11px] text-slate-400">
                  When enabled, an email must match both a sender/domain AND a keyword. When disabled (default), either a matching sender or a matching keyword can trigger an alert.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={subjectOnly}
                onChange={(e) => setSubjectOnly(e.target.checked)}
                className="mt-1 rounded bg-slate-900 border-slate-700 text-sentinel-500 focus:ring-0"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200">Match Keywords in Subject Line Only</span>
                <p className="text-[11px] text-slate-400">
                  When checked, ignores email body and looks for keywords strictly in the email Subject.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="mt-1 rounded bg-slate-900 border-slate-700 text-sentinel-500 focus:ring-0"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200">Case Sensitive Matching</span>
                <p className="text-[11px] text-slate-400">Default is case-insensitive.</p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-sentinel-600 hover:bg-sentinel-500 disabled:opacity-50 transition shadow-lg shadow-sentinel-600/20"
            >
              {saving ? 'Saving...' : ruleToEdit ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
