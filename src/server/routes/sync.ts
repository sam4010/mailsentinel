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
