import { Router } from 'express';
import { db } from '../db/index.js';
import { SyncWorker } from '../sync/worker.js';

const router = Router();

/**
 * Trigger an immediate manual synchronization
 */
router.post('/now', async (req, res) => {
  const account = db.getConnectedAccount('default_user');
  if (!account) {
    return res.status(400).json({
      success: false,
      error: 'Cannot synchronize: No Gmail account is connected.',
    });
  }

  try {
    const result = await SyncWorker.syncUser('default_user');
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Manual synchronization failed',
    });
  }
});

/**
 * Google Cloud Pub/Sub Webhook for instant Gmail Push Notifications
 * When an email arrives, Google Pub/Sub sends a POST request here.
 */
router.post('/webhook', async (req, res) => {
  try {
    // Acknowledge Google Pub/Sub immediately (must respond 200/204 to avoid retries)
    res.status(200).send('OK');

    const message = req.body?.message;
    if (message && message.data) {
      const decodedStr = Buffer.from(message.data, 'base64').toString('utf8');
      const payload = JSON.parse(decodedStr);
      console.log(`[Gmail Push Webhook] Received notification for ${payload.emailAddress}, historyId: ${payload.historyId}`);
    }

    // Trigger sync immediately in background
    SyncWorker.syncUser('default_user').catch(err => {
      console.error('[Gmail Push Webhook] Sync error:', err);
    });
  } catch (err) {
    console.warn('[Gmail Push Webhook] Processing error:', err);
    if (!res.headersSent) {
      res.status(200).send('OK');
    }
  }
});

/**
 * Get synchronization status and health metrics
 */
router.get('/status', (req, res) => {
  const account = db.getConnectedAccount('default_user');
  if (!account) {
    return res.json({
      connected: false,
      status: 'disconnected',
      lastSyncAt: null,
      historyId: null,
      totalSyncedCount: 0,
      error: null,
    });
  }

  res.json({
    connected: true,
    email: account.email,
    status: account.syncStatus,
    lastSyncAt: account.lastSyncAt,
    historyId: account.historyId,
    totalSyncedCount: account.totalSyncedCount,
    error: account.errorMessage,
  });
});

export default router;
