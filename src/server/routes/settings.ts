import { Router } from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';

const router = Router();

/**
 * Get user settings
 */
router.get('/', (req, res) => {
  const settings = db.getUserSettings('default_user');
  res.json({
    settings,
    serverConfig: {
      oauthConfigured: config.google.isConfigured,
      vapidConfigured: config.vapid.isConfigured,
      vapidPublicKey: config.vapid.publicKey,
      pollIntervalSeconds: config.sync.pollIntervalSeconds,
    },
  });
});

/**
 * Update user settings
 */
router.put('/', (req, res) => {
  const {
    timezone,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    pushEnabled,
    syncIntervalSeconds,
    retentionDays,
  } = req.body;

  const updated = db.updateUserSettings('default_user', {
    timezone,
    quietHoursEnabled: quietHoursEnabled !== undefined ? Boolean(quietHoursEnabled) : undefined,
    quietHoursStart,
    quietHoursEnd,
    pushEnabled: pushEnabled !== undefined ? Boolean(pushEnabled) : undefined,
    syncIntervalSeconds: syncIntervalSeconds ? parseInt(syncIntervalSeconds, 10) : undefined,
    retentionDays: retentionDays ? parseInt(retentionDays, 10) : undefined,
  });

  res.json({ settings: updated });
});

/**
 * Export all rules as JSON backup
 */
router.get('/export/rules', (req, res) => {
  const rules = db.getRules('default_user');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="mailsentinel-rules-backup.json"');
  res.send(JSON.stringify(rules, null, 2));
});

/**
 * Import rules from JSON
 */
router.post('/import/rules', (req, res) => {
  const importedRules = req.body;
  if (!Array.isArray(importedRules)) {
    return res.status(400).json({ error: 'Expected an array of rules' });
  }

  let count = 0;
  for (const r of importedRules) {
    if (r.name) {
      db.createRule({
        userId: 'default_user',
        name: r.name,
        enabled: r.enabled !== false,
        senders: Array.isArray(r.senders) ? r.senders : [],
        domains: Array.isArray(r.domains) ? r.domains : [],
        senderNames: Array.isArray(r.senderNames) ? r.senderNames : [],
        keywords: Array.isArray(r.keywords) ? r.keywords : [],
        excludedKeywords: Array.isArray(r.excludedKeywords) ? r.excludedKeywords : [],
        matchAll: Boolean(r.matchAll),
        subjectOnly: Boolean(r.subjectOnly),
        caseSensitive: Boolean(r.caseSensitive),
        priorityThreshold: r.priorityThreshold || 'High',
        quietHoursEnabled: Boolean(r.quietHoursEnabled),
        quietHoursStart: r.quietHoursStart || '22:00',
        quietHoursEnd: r.quietHoursEnd || '07:00',
        notificationChannel: r.notificationChannel || 'both',
        category: r.category || 'Imported',
      });
      count++;
    }
  }

  res.json({ success: true, count, message: `Successfully imported ${count} rules` });
});

export default router;
