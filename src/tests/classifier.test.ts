import { describe, it, expect } from 'vitest';
import { detectDeadline, classifyEmail } from '../server/rules/classifier.js';
import { MonitoringRule, EmailPayload } from '../types.js';

describe('Deadline Detection Engine', () => {
  it('detects explicit date deadlines with year', () => {
    const text = 'Please submit your acceptance by November 15, 2026 to secure your spot.';
    const dl = detectDeadline(text);
    expect(dl).not.toBeNull();
    expect(dl?.isUncertain).toBe(false);
    expect(dl?.text.toLowerCase()).toContain('november 15, 2026');
  });

  it('detects relative deadlines e.g. within 48 hours', () => {
    const ref = new Date('2026-10-23T10:00:00Z');
    const text = 'Action needed: please confirm your attendance within 48 hours.';
    const dl = detectDeadline(text, ref);
    expect(dl).not.toBeNull();
    expect(dl?.isUncertain).toBe(false);
    expect(dl?.timestamp).toBe(ref.getTime() + 48 * 3600 * 1000);
  });

  it('flags ambiguous dates as uncertain without hallucinating precision', () => {
    const text = 'Final paper due by Oct 25.';
    const dl = detectDeadline(text);
    expect(dl).not.toBeNull();
    expect(dl?.isUncertain).toBe(true); // missing year -> flagged as uncertain
  });

  it('returns null when no deadline pattern is present', () => {
    const text = 'Here is the summary of our monthly team meeting.';
    const dl = detectDeadline(text);
    expect(dl).toBeNull();
  });
});

describe('Email Priority Classification', () => {
  const dummyRule: MonitoringRule = {
    id: 'r1',
    userId: 'u1',
    name: 'Standard Rule',
    enabled: true,
    senders: [],
    domains: [],
    senderNames: [],
    keywords: ['test'],
    excludedKeywords: [],
    matchAll: false,
    subjectOnly: false,
    caseSensitive: false,
    priorityThreshold: 'Normal',
    quietHoursEnabled: false,
    notificationChannel: 'both',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleEmail: EmailPayload = {
    messageId: 'm1',
    threadId: 't1',
    senderName: 'Test Sender',
    senderEmail: 'test@example.com',
    subject: 'General Update',
    snippet: 'Here is some info',
    bodyText: 'Just standard information.',
    dateReceived: new Date().toISOString(),
  };

  it('uses highest priority threshold from matched rules as baseline', () => {
    const criticalRule = { ...dummyRule, priorityThreshold: 'Critical' as const };
    const res = classifyEmail([dummyRule, criticalRule], sampleEmail);
    expect(res.priority).toBe('Critical');
    expect(res.reason).toContain('Base priority set to Critical');
  });

  it('escalates priority to Critical when urgent markers are present', () => {
    const urgentEmail: EmailPayload = {
      ...sampleEmail,
      subject: 'Urgent Action Required: Confirm Enrollment',
      bodyText: 'Immediate action required on your account.',
    };
    const res = classifyEmail([dummyRule], urgentEmail);
    expect(res.priority).toBe('Critical');
    expect(res.reason).toContain('critical urgency marker');
  });

  it('escalates priority when an imminent deadline is detected', () => {
    const futureDate = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours away
    const deadlineEmail: EmailPayload = {
      ...sampleEmail,
      subject: 'Offer response',
      bodyText: `Your response is due within 24 hours.`,
    };
    const res = classifyEmail([dummyRule], deadlineEmail);
    expect(res.priority).toBe('Critical');
    expect(res.reason).toContain('imminent deadline');
  });
});
