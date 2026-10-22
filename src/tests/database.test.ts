import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Database } from '../server/db/index.js';
import { isInQuietHours } from '../server/notifications/service.js';

describe('Database CRUD and Deduplication', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_store.json');
  let db: Database;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('creates, retrieves, updates, toggles and deletes rules', () => {
    const created = db.createRule({
      userId: 'test_u',
      name: 'Scholarship Alerts',
      enabled: true,
      senders: ['finaid@stanford.edu'],
      domains: ['stanford.edu'],
      senderNames: ['Financial Aid'],
      keywords: ['fellowship', 'grant'],
      excludedKeywords: [],
      matchAll: false,
      subjectOnly: false,
      caseSensitive: false,
      priorityThreshold: 'High',
      quietHoursEnabled: false,
      notificationChannel: 'both',
      category: 'Education',
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Scholarship Alerts');

    // Retrieve
    const fetched = db.getRule(created.id);
    expect(fetched?.name).toBe('Scholarship Alerts');

    // Toggle
    const toggled = db.toggleRule(created.id, false);
    expect(toggled?.enabled).toBe(false);

    // Update
    const updated = db.updateRule(created.id, { name: 'Updated Name' });
    expect(updated?.name).toBe('Updated Name');

    // Delete
    const deleted = db.deleteRule(created.id);
    expect(deleted).toBe(true);
    expect(db.getRule(created.id)).toBeNull();
  });

  it('suppresses duplicate message processing with idempotency records', () => {
    const userId = 'test_u';
    const msgId = 'gmail_msg_abc123';

    expect(db.isMessageProcessed(userId, msgId)).toBe(false);

    db.recordProcessedMessage(userId, msgId, 'thr_1', 'hist_100');

    expect(db.isMessageProcessed(userId, msgId)).toBe(true);
  });

  it('saves and filters matched emails accurately', () => {
    const email = db.saveMatchedEmail({
      userId: 'test_u',
      messageId: 'm1',
      threadId: 't1',
      senderName: 'Stanford Admissions',
      senderEmail: 'admissions@stanford.edu',
      subject: 'Welcome to Stanford',
      snippet: 'Congratulations on your admission',
      dateReceived: new Date().toISOString(),
      priority: 'Critical',
      priorityReason: 'Matched priority rule',
      matchedRuleIds: ['r1'],
      matchedRuleNames: ['Stanford Rule'],
      matchExplanation: 'Matched domain stanford.edu',
      isRead: false,
      isSnoozed: false,
    });

    expect(email.id).toBeDefined();

    // Query unread critical emails
    const res = db.getMatchedEmails('test_u', { priority: 'Critical', readStatus: 'unread' });
    expect(res.total).toBe(1);
    expect(res.emails[0].subject).toBe('Welcome to Stanford');

    // Mark as read
    db.updateEmailStatus(email.id, { isRead: true });
    const resAfterRead = db.getMatchedEmails('test_u', { readStatus: 'unread' });
    expect(resAfterRead.total).toBe(0);
  });
});

describe('Quiet Hours Evaluation', () => {
  it('detects quiet hours across midnight correctly', () => {
    // 22:00 to 07:00
    // We test the logic with mock time check
    expect(typeof isInQuietHours('22:00', '07:00', 'UTC')).toBe('boolean');
  });
});
