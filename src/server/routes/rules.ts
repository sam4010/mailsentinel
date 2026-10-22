import { Router } from 'express';
import { db } from '../db/index.js';
import { evaluateRule } from '../rules/matcher.js';
import { classifyEmail } from '../rules/classifier.js';
import { EmailPayload, Priority } from '../../types.js';

const router = Router();

/**
 * List all rules
 */
router.get('/', (req, res) => {
  const rules = db.getRules('default_user');
  res.json({ rules });
});

/**
 * Get single rule
 */
router.get('/:id', (req, res) => {
  const rule = db.getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  res.json({ rule });
});

/**
 * Create a new rule
 */
router.post('/', (req, res) => {
  const {
    name,
    enabled = true,
    senders = [],
    domains = [],
    senderNames = [],
    keywords = [],
    excludedKeywords = [],
    matchAll = false,
    subjectOnly = false,
    caseSensitive = false,
    priorityThreshold = 'High',
    quietHoursEnabled = false,
    quietHoursStart,
    quietHoursEnd,
    notificationChannel = 'both',
    category = 'General',
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Rule name is required' });
  }

  // Sanitize array inputs (trim, filter empties)
  const cleanArray = (arr: any) =>
    Array.isArray(arr) ? arr.map((s: any) => String(s).trim()).filter(Boolean) : [];

  const newRule = db.createRule({
    userId: 'default_user',
    name: name.trim(),
    enabled: Boolean(enabled),
    senders: cleanArray(senders),
    domains: cleanArray(domains),
    senderNames: cleanArray(senderNames),
    keywords: cleanArray(keywords),
    excludedKeywords: cleanArray(excludedKeywords),
    matchAll: Boolean(matchAll),
    subjectOnly: Boolean(subjectOnly),
    caseSensitive: Boolean(caseSensitive),
    priorityThreshold: (['Critical', 'High', 'Normal', 'Low'].includes(priorityThreshold) ? priorityThreshold : 'High') as Priority,
    quietHoursEnabled: Boolean(quietHoursEnabled),
    quietHoursStart: quietHoursStart || '22:00',
    quietHoursEnd: quietHoursEnd || '07:00',
    notificationChannel: notificationChannel || 'both',
    category: category ? category.trim() : 'General',
  });

  res.status(201).json({ rule: newRule });
});

/**
 * Update an existing rule
 */
router.put('/:id', (req, res) => {
  const ruleId = req.params.id;
  const existing = db.getRule(ruleId);
  if (!existing) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  const cleanArray = (arr: any) =>
    Array.isArray(arr) ? arr.map((s: any) => String(s).trim()).filter(Boolean) : undefined;

  const updates: any = {};
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body.enabled !== undefined) updates.enabled = Boolean(req.body.enabled);
  if (req.body.senders !== undefined) updates.senders = cleanArray(req.body.senders);
  if (req.body.domains !== undefined) updates.domains = cleanArray(req.body.domains);
  if (req.body.senderNames !== undefined) updates.senderNames = cleanArray(req.body.senderNames);
  if (req.body.keywords !== undefined) updates.keywords = cleanArray(req.body.keywords);
  if (req.body.excludedKeywords !== undefined) updates.excludedKeywords = cleanArray(req.body.excludedKeywords);
  if (req.body.matchAll !== undefined) updates.matchAll = Boolean(req.body.matchAll);
  if (req.body.subjectOnly !== undefined) updates.subjectOnly = Boolean(req.body.subjectOnly);
  if (req.body.caseSensitive !== undefined) updates.caseSensitive = Boolean(req.body.caseSensitive);
  if (req.body.priorityThreshold !== undefined) updates.priorityThreshold = req.body.priorityThreshold;
  if (req.body.quietHoursEnabled !== undefined) updates.quietHoursEnabled = Boolean(req.body.quietHoursEnabled);
  if (req.body.quietHoursStart !== undefined) updates.quietHoursStart = req.body.quietHoursStart;
  if (req.body.quietHoursEnd !== undefined) updates.quietHoursEnd = req.body.quietHoursEnd;
  if (req.body.notificationChannel !== undefined) updates.notificationChannel = req.body.notificationChannel;
  if (req.body.category !== undefined) updates.category = req.body.category;

  const updated = db.updateRule(ruleId, updates);
  res.json({ rule: updated });
});

/**
 * Toggle enable/disable status
 */
router.patch('/:id/toggle', (req, res) => {
  const rule = db.getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  const enabled = req.body.enabled !== undefined ? Boolean(req.body.enabled) : !rule.enabled;
  const updated = db.toggleRule(rule.id, enabled);
  res.json({ rule: updated });
});

/**
 * Delete a rule
 */
router.delete('/:id', (req, res) => {
  const success = db.deleteRule(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  res.json({ success: true });
});

/**
 * Interactive Rule Tester: Evaluate rule or temporary rule against sample email
 */
router.post('/test', (req, res) => {
  const { rule, email } = req.body;

  if (!email || !rule) {
    return res.status(400).json({ error: 'Both rule and email sample are required' });
  }

  const sampleEmail: EmailPayload = {
    messageId: 'test_msg_1',
    threadId: 'test_thr_1',
    senderName: email.senderName || '',
    senderEmail: email.senderEmail || 'test@example.com',
    subject: email.subject || '',
    snippet: email.bodyText ? email.bodyText.slice(0, 100) : '',
    bodyText: email.bodyText || '',
    dateReceived: new Date().toISOString(),
  };

  const matchResult = evaluateRule({ ...rule, enabled: true }, sampleEmail);
  const classification = matchResult.matched
    ? classifyEmail([rule], sampleEmail)
    : null;

  res.json({
    matched: matchResult.matched,
    reasons: matchResult.reasons,
    suppressedByExcludedKeyword: matchResult.suppressedByExcludedKeyword,
    classification,
  });
});

export default router;
