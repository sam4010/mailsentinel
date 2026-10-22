import React, { useState } from 'react';
import {
  Plus,
  Sliders,
  Check,
  X,
  Edit2,
  Trash2,
  Play,
  Shield,
  Tag,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { MonitoringRule } from '../../types.js';
import { RuleModal } from '../components/RuleModal.js';
import { RuleTesterModal } from '../components/RuleTesterModal.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';

export const RulesView: React.FC = () => {
  const { rules, refreshAll, showToast } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<MonitoringRule | null>(null);

  const [testerRule, setTesterRule] = useState<MonitoringRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<MonitoringRule | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = Array.from(new Set(rules.map(r => r.category || 'General')));

  const filteredRules = categoryFilter === 'all'
    ? rules
    : rules.filter(r => (r.category || 'General') === categoryFilter);

  const handleToggleEnable = async (rule: MonitoringRule) => {
    try {
      const res = await fetch(`/api/rules/${rule.id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) {
        showToast(`Rule "${rule.name}" ${!rule.enabled ? 'enabled' : 'disabled'}.`, 'success');
        refreshAll();
      }
    } catch (e: any) {
      showToast('Failed to toggle rule status', 'error');
    }
  };

  const handleSaveRule = async (ruleData: Partial<MonitoringRule>) => {
    if (ruleToEdit) {
      const res = await fetch(`/api/rules/${ruleToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
      });
      if (!res.ok) throw new Error('Failed to update rule');
      showToast('Rule updated successfully', 'success');
    } else {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
      });
      if (!res.ok) throw new Error('Failed to create rule');
      showToast('New monitoring rule created', 'success');
    }
    refreshAll();
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete) return;
    try {
      const res = await fetch(`/api/rules/${ruleToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Rule "${ruleToDelete.name}" deleted.`, 'info');
        setRuleToDelete(null);
        refreshAll();
      }
    } catch (e: any) {
      showToast('Failed to delete rule', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Monitoring Rules</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic matching conditions that trigger alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {categories.length > 1 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              setRuleToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-sentinel-600 hover:bg-sentinel-500 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-sentinel-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Rule</span>
          </button>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.length > 0 ? (
          filteredRules.map((rule) => {
            const priorityColor =
              rule.priorityThreshold === 'Critical'
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : rule.priorityThreshold === 'High'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-sentinel-500/20 text-sentinel-400 border-sentinel-500/30';

            return (
              <div
                key={rule.id}
                className={`p-5 rounded-2xl border transition-all duration-150 flex flex-col gap-4 ${
                  rule.enabled
                    ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-900/30 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleEnable(rule)}
                      className={`w-10 h-6 flex items-center rounded-full p-1 transition duration-200 ${
                        rule.enabled ? 'bg-sentinel-600 justify-end' : 'bg-slate-700 justify-start'
                      }`}
                      title={rule.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-slate-100">{rule.name}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColor}`}>
                          {rule.priorityThreshold}
                        </span>
                        {rule.category && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            {rule.category}
                          </span>
                        )}
                        {rule.matchAll && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/80 font-mono">
                            Match All
                          </span>
                        )}
                        {rule.subjectOnly && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                            Subject Only
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => setTesterRule(rule)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1"
                      title="Test this rule with a sample email"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Test</span>
                    </button>
                    <button
                      onClick={() => {
                        setRuleToEdit(rule);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                      title="Edit rule"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRuleToDelete(rule)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                      title="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Conditions Tags Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800/60">
                  {/* Senders & Domains */}
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium block">Senders & Domains:</span>
                    <div className="flex flex-wrap gap-1">
                      {rule.senders.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                          {s}
                        </span>
                      ))}
                      {rule.domains.map((d, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-sentinel-950/60 border border-sentinel-900 text-sentinel-300 text-[11px]">
                          @{d}
                        </span>
                      ))}
                      {rule.senderNames.map((sn, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px]">
                          "{sn}"
                        </span>
                      ))}
                      {rule.senders.length === 0 && rule.domains.length === 0 && rule.senderNames.length === 0 && (
                        <span className="text-slate-500 italic text-[11px]">Any sender</span>
                      )}
                    </div>
                  </div>

                  {/* Keywords & Exclusions */}
                  <div className="space-y-1">
                    <span className="text-slate-500 font-medium block">Keywords & Exclusions:</span>
                    <div className="flex flex-wrap gap-1">
                      {rule.keywords.map((k, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-sky-950/50 border border-sky-900 text-sky-300 text-[11px]">
                          "{k}"
                        </span>
                      ))}
                      {rule.excludedKeywords.map((ek, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-red-950/50 border border-red-900 text-red-300 text-[11px]">
                          🚫 {ek}
                        </span>
                      ))}
                      {rule.keywords.length === 0 && (
                        <span className="text-slate-500 italic text-[11px]">Any content</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
            <Sliders className="w-10 h-10 text-slate-500 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-200">No Rules Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create a monitoring rule to tell MailSentinel which senders and keywords are important to you.
            </p>
          </div>
        )}
      </div>

      {/* Edit / Create Rule Modal */}
      <RuleModal
        isOpen={isModalOpen}
        ruleToEdit={ruleToEdit}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRule}
      />

      {/* Rule Tester Modal */}
      <RuleTesterModal
        isOpen={Boolean(testerRule)}
        rule={testerRule}
        onClose={() => setTesterRule(null)}
      />

      {/* Delete Rule Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(ruleToDelete)}
        title="Delete Monitoring Rule?"
        message={`Are you sure you want to delete "${ruleToDelete?.name}"? Emails will no longer be intercepted based on this rule.`}
        confirmLabel="Delete Rule"
        isDestructive={true}
        onConfirm={handleDeleteRule}
        onCancel={() => setRuleToDelete(null)}
      />
    </div>
  );
};
