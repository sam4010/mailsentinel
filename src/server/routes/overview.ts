import { Router } from 'express';
import { db } from '../db/index.js';
import { config } from '../config.js';

const router = Router();

/**
 * Get unified dashboard overview data
 */
router.get('/', (req, res) => {
  const stats = db.getOverviewStats('default_user');
  res.json({
    ...stats,
    oauthConfigured: config.google.isConfigured,
    vapidConfigured: config.vapid.isConfigured,
  });
});

export default router;
