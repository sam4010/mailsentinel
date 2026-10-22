import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

/**
 * List matched emails with filters, search, and pagination
 */
router.get('/', (req, res) => {
  const {
    priority,
    ruleId,
    readStatus,
    search,
    limit = '50',
    offset = '0',
  } = req.query;

  const result = db.getMatchedEmails('default_user', {
    priority: priority as string,
    ruleId: ruleId as string,
    readStatus: readStatus as 'read' | 'unread' | 'all',
    search: search as string,
    limit: parseInt(limit as string, 10),
    offset: parseInt(offset as string, 10),
  });

  res.json(result);
});

/**
 * Get single matched email by id
 */
router.get('/:id', (req, res) => {
  const email = db.getMatchedEmail(req.params.id);
  if (!email) {
    return res.status(404).json({ error: 'Matched email not found' });
  }
  res.json({ email });
});

/**
 * Update email status (read, unread, snooze)
 */
router.patch('/:id', (req, res) => {
  const { isRead, isSnoozed, snoozedUntil } = req.body;
  const updated = db.updateEmailStatus(req.params.id, {
    isRead,
    isSnoozed,
    snoozedUntil,
  });

  if (!updated) {
    return res.status(404).json({ error: 'Matched email not found' });
  }

  res.json({ email: updated });
});

export default router;
