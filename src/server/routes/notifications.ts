import { Router } from 'express';
import { db } from '../db/index.js';
import { NotificationService } from '../notifications/service.js';

const router = Router();

/**
 * List notification history
 */
router.get('/', (req, res) => {
  const events = db.getNotificationEvents('default_user');
  res.json({ events });
});

/**
 * Clear notification history
 */
router.post('/clear', (req, res) => {
  db.clearNotificationEvents('default_user');
  res.json({ success: true, message: 'Notification history cleared' });
});

/**
 * Retry failed notification
 */
router.post('/retry/:id', async (req, res) => {
  try {
    const updated = await NotificationService.retry(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'Notification event not found or not eligible for retry' });
    }
    res.json({ event: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retry notification' });
  }
});

/**
 * Save browser Web Push subscription
 */
router.post('/subscribe', (req, res) => {
  const subscription = req.body?.subscription;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Valid push subscription object is required' });
  }

  db.updateUserSettings('default_user', {
    webPushSubscription: subscription,
    pushEnabled: true,
  });

  res.json({ success: true, message: 'Push subscription saved successfully' });
});

/**
 * Trigger a local test notification
 */
router.post('/test-local', (req, res) => {
  const event = db.saveNotificationEvent({
    userId: 'default_user',
    matchedEmailId: 'test_local',
    channel: 'in_app',
    status: 'Delivered',
    priority: 'High',
    title: '⚠️ [HIGH] Test In-App Notification',
    body: 'Local notification test confirmed! MailSentinel notification engine is operating normally.',
    sentAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: 'Local test notification recorded successfully.',
    event,
  });
});

/**
 * Trigger a Web Push test notification
 */
router.post('/test-push', async (req, res) => {
  const result = await NotificationService.sendTestPush('default_user');
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

export default router;
