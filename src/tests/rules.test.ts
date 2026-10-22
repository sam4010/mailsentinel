import { describe, it, expect } from 'vitest';
import {
  evaluateRule,
  evaluateAllRules,
  matchesDomain,
  containsKeyword,
  extractDomain,
  normalizeEmail
} from '../server/rules/matcher.js';
import { MonitoringRule, EmailPayload } from '../types.js';

describe('Domain Extraction and Boundary Matching', () => {
  it('extracts normalized domain from email strings', () => {
    expect(extractDomain('admissions@university.edu')).toBe('university.edu');
    expect(extractDomain('Dean Smith <dean@law.stanford.edu>')).toBe('law.stanford.edu');
    expect(extractDomain('invalid-email')).toBe('');
  });

  it('normalizes email addresses', () => {
    expect(normalizeEmail('John Doe <JOHN.DOE@EXAMPLE.COM>')).toBe('john.doe@example.com');
    expect(normalizeEmail('housing@university.edu')).toBe('housing@university.edu');
  });

  it('respects domain boundaries strictly and prevents accidental substring matches', () => {
    // Exact domain
    expect(matchesDomain('university.edu', 'university.edu')).toBe(true);
    // Subdomain
    expect(matchesDomain('admissions.university.edu', 'university.edu')).toBe(true);
    expect(matchesDomain('cs.dept.university.edu', 'university.edu')).toBe(true);
    // Boundary attacks / substring collisions MUST NOT match
    expect(matchesDomain('fakeuniversity.edu', 'university.edu')).toBe(false);
    expect(matchesDomain('notuniversity.edu', 'university.edu')).toBe(false);
    expect(matchesDomain('university.edu.attacker.com', 'university.edu')).toBe(false);
  });
});

describe('Keyword Matching with Word Boundaries', () => {
  it('matches words respecting word boundaries to prevent accidental substring hits', () => {
    expect(containsKeyword('Your bill is due today', 'due')).toBe(true);
    expect(containsKeyword('Payment overdue notification', 'due')).toBe(false); // "overdue" != "due"
    expect(containsKeyword('He tried to subdue the crowd', 'due')).toBe(false); // "subdue" != "due"
  });

  it('handles multi-word phrases and case insensitivity', () => {
    expect(containsKeyword('Please note: Urgent Action Required immediately', 'urgent action required')).toBe(true);
    expect(containsKeyword('interview invitation for software role', 'Interview Invitation')).toBe(true);
  });

  it('supports case sensitive matching when configured', () => {
    expect(containsKeyword('URGENT NOTICE', 'urgent', true)).toBe(false);
    expect(containsKeyword('URGENT NOTICE', 'URGENT', true)).toBe(true);
  });
});

describe('Rule Matching Engine Semantics', () => {
  const baseRule: MonitoringRule = {
    id: 'rule_1',
    userId: 'user_1',
    name: 'University Admissions',
    enabled: true,
    senders: ['admissions@stanford.edu'],
    domains: ['stanford.edu'],
    senderNames: ['Stanford Admissions'],
    keywords: ['offer', 'acceptance', 'deadline'],
    excludedKeywords: ['marketing', 'newsletter'],
    matchAll: false,
    subjectOnly: false,
    caseSensitive: false,
    priorityThreshold: 'High',
    quietHoursEnabled: false,
    notificationChannel: 'both',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleEmail: EmailPayload = {
    messageId: 'msg_101',
    threadId: 'thr_101',
    senderName: 'Stanford Admissions Office',
    senderEmail: 'admissions@stanford.edu',
    subject: 'Decision Update: Stanford University',
    snippet: 'We are pleased to extend an offer of admission...',
    bodyText: 'We are pleased to extend an offer of admission. Please respond by the deadline.',
    dateReceived: new Date().toISOString(),
  };

  it('matches sender-only when sender is in rule and no keywords match', () => {
    const senderOnlyRule: MonitoringRule = {
      ...baseRule,
      keywords: [], // No keywords configured
    };
    const emailNoKeywords: EmailPayload = {
      ...sampleEmail,
      subject: 'Hello there',
      snippet: 'Just checking in',
      bodyText: 'Nothing special here',
    };

    const res = evaluateRule(senderOnlyRule, emailNoKeywords);
    expect(res.matched).toBe(true);
    expect(res.matchedSenders).toContain('admissions@stanford.edu');
  });

  it('matches keyword-only when sender does not match but keyword matches in Match Any mode', () => {
    const emailUnknownSender: EmailPayload = {
      ...sampleEmail,
      senderEmail: 'stranger@random.com',
      senderName: 'Unknown',
    };

    const res = evaluateRule(baseRule, emailUnknownSender);
    expect(res.matched).toBe(true);
    expect(res.matchedKeywords).toContain('offer');
  });

  it('requires BOTH sender AND keyword matches when matchAll is true', () => {
    const matchAllRule: MonitoringRule = {
      ...baseRule,
      matchAll: true,
    };

    // 1. Both match
    const resBoth = evaluateRule(matchAllRule, sampleEmail);
    expect(resBoth.matched).toBe(true);

    // 2. Only sender matches, no keywords
    const emailSenderOnly: EmailPayload = {
      ...sampleEmail,
      subject: 'Quarterly greetings',
      snippet: 'Hello student',
      bodyText: 'No special words here',
    };
    const resSenderOnly = evaluateRule(matchAllRule, emailSenderOnly);
    expect(resSenderOnly.matched).toBe(false);

    // 3. Only keyword matches, different sender
    const emailKeywordOnly: EmailPayload = {
      ...sampleEmail,
      senderEmail: 'spam@unrelated.com',
      senderName: 'Random Corp',
    };
    const resKeywordOnly = evaluateRule(matchAllRule, emailKeywordOnly);
    expect(resKeywordOnly.matched).toBe(false);
  });

  it('suppresses match immediately if excluded keywords are present', () => {
    const emailWithNewsletter: EmailPayload = {
      ...sampleEmail,
      bodyText: 'We are pleased to extend an offer. Unsubscribe from this newsletter here.',
    };

    const res = evaluateRule(baseRule, emailWithNewsletter);
    expect(res.matched).toBe(false);
    expect(res.suppressedByExcludedKeyword).toBe('newsletter');
  });

  it('never matches when rule is disabled', () => {
    const disabledRule: MonitoringRule = {
      ...baseRule,
      enabled: false,
    };

    const res = evaluateRule(disabledRule, sampleEmail);
    expect(res.matched).toBe(false);
  });

  it('evaluates multiple rules against the same email and collects explanations', () => {
    const rule2: MonitoringRule = {
      ...baseRule,
      id: 'rule_2',
      name: 'Deadline Watcher',
      senders: [],
      domains: [],
      keywords: ['deadline'],
      matchAll: false,
    };

    const res = evaluateAllRules([baseRule, rule2], sampleEmail);
    expect(res.matched).toBe(true);
    expect(res.matchedRules.length).toBe(2);
    expect(res.explanation).toContain('Stanford Admissions');
    expect(res.explanation).toContain('Deadline Watcher');
  });
});
