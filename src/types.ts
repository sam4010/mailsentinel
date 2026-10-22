export type Priority = 'Critical' | 'High' | 'Normal' | 'Low';

export type NotificationChannel = 'push' | 'in_app' | 'both';

export type DeliveryStatus = 'Delivered' | 'Failed' | 'Pending' | 'Clicked';

export interface MonitoringRule {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  senders: string[];         // Specific email addresses (e.g. housing@example.com)
  domains: string[];         // Sender domains (e.g. university.edu, company.com)
  senderNames: string[];     // Sender display names/orgs (e.g. "Housing Office", "Stanford Admissions")
  keywords: string[];        // Phrases/keywords to look for (e.g. "interview", "offer", "deadline")
  excludedKeywords: string[];// If present, suppresses match (e.g. "newsletter", "unsubscribe", "marketing")
  matchAll: boolean;         // If true, BOTH sender/domain AND keyword conditions must match. If false, EITHER triggers.
  subjectOnly: boolean;      // Match only in Subject line vs entire email body
  caseSensitive: boolean;    // Case sensitive keyword matching (default false)
  priorityThreshold: Priority;// Critical, High, Normal, Low
  quietHoursEnabled: boolean;// Override or apply quiet hours
  quietHoursStart?: string;  // "22:00"
  quietHoursEnd?: string;    // "07:00"
  notificationChannel: NotificationChannel;
  category?: string;         // e.g. "University", "Career", "Finance", "Housing"
  createdAt: string;
  updatedAt: string;
}

export interface MatchedEmail {
  id: string;
  userId: string;
  messageId: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  bodyPreview?: string;
  dateReceived: string;
  priority: Priority;
  priorityReason: string;
  matchedRuleIds: string[];
  matchedRuleNames: string[];
  matchExplanation: string;
  deadlineText?: string | null;
  deadlineTimestamp?: number | null;
  deadlineIsUncertain?: boolean;
  isRead: boolean;
  isSnoozed: boolean;
  snoozedUntil?: number | null;
  createdAt: string;
}

export interface NotificationEvent {
  id: string;
  userId: string;
  matchedEmailId: string;
  ruleId?: string;
  channel: 'push' | 'in_app';
  status: DeliveryStatus;
  priority: Priority;
  title: string;
  body: string;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export interface ConnectedAccount {
  id: string;
  userId: string;
  provider: 'google';
  email: string;
  pictureUrl?: string | null;
  historyId?: string | null;
  lastSyncAt?: string | null;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  errorMessage?: string | null;
  totalSyncedCount: number;
  tokenExpiry: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  userId: string;
  timezone: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  pushEnabled: boolean;
  syncIntervalSeconds: number;
  retentionDays: number;
  webPushSubscription?: any;
  updatedAt: string;
}

export interface OverviewStats {
  connected: boolean;
  accountEmail?: string | null;
  lastSyncAt?: string | null;
  syncStatus: string;
  syncError?: string | null;
  matchedToday: number;
  highPriorityCount: number;
  activeRulesCount: number;
  totalRulesCount: number;
  recentEmails: MatchedEmail[];
}

export interface RuleMatchResult {
  matched: boolean;
  matchedRules: MonitoringRule[];
  reasons: string[];
  matchedSenders: string[];
  matchedDomains: string[];
  matchedKeywords: string[];
  matchedSenderNames: string[];
  suppressedByExcludedKeyword?: string;
}

export interface EmailPayload {
  messageId: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml?: string;
  dateReceived: string;
}
