import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';
import { encrypt, decrypt } from '../crypto/encryption.js';
import {
  MonitoringRule,
  MatchedEmail,
  NotificationEvent,
  ConnectedAccount,
  UserSettings,
  OverviewStats,
  Priority
} from '../../types.js';

interface StoredAccount extends Omit<ConnectedAccount, 'id'> {
  id: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
}

interface DatabaseSchema {
  version: number;
  accounts: Record<string, StoredAccount>; // key: userId
  rules: Record<string, MonitoringRule>;   // key: ruleId
  processedMessages: Record<string, { threadId: string; historyId?: string; processedAt: string }>; // key: `${userId}:${messageId}`
  matchedEmails: Record<string, MatchedEmail>; // key: emailId
  notificationEvents: Record<string, NotificationEvent>; // key: eventId
  settings: Record<string, UserSettings>; // key: userId
}

const DEFAULT_USER_ID = 'default_user';

export class Database {
  private filePath: string;
  private data: DatabaseSchema;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(config.dataDir, 'sentinel_store.json');
    this.data = this.load();
    this.seedDefaultsIfNeeded();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load database from disk, initializing fresh:', err);
    }

    return {
      version: 1,
      accounts: {},
      rules: {},
      processedMessages: {},
      matchedEmails: {},
      notificationEvents: {},
      settings: {}
    };
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.filePath}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('Failed to persist database to disk:', err);
    }
  }

  private seedDefaultsIfNeeded(): void {
    // Ensure default settings exist
    if (!this.data.settings[DEFAULT_USER_ID]) {
      this.data.settings[DEFAULT_USER_ID] = {
        userId: DEFAULT_USER_ID,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        pushEnabled: true,
        syncIntervalSeconds: config.sync.pollIntervalSeconds,
        retentionDays: 90,
        updatedAt: new Date().toISOString()
      };
      this.persist();
    }

    // If rules are completely empty, add helpful starter rules (enabled by default as template examples)
    const existingRules = Object.values(this.data.rules).filter(r => r.userId === DEFAULT_USER_ID);
    if (existingRules.length === 0) {
      const starterRules: MonitoringRule[] = [
        {
          id: 'rule_admissions',
          userId: DEFAULT_USER_ID,
          name: 'University & College Admissions',
          enabled: true,
          senders: ['admissions@university.edu', 'housing@university.edu'],
          domains: ['university.edu', 'college.edu'],
          senderNames: ['Admissions Office', 'Financial Aid Office'],
          keywords: ['application status', 'decision letter', 'acceptance', 'enrollment deadline', 'scholarship', 'action required'],
          excludedKeywords: ['marketing', 'newsletter', 'weekly digest'],
          matchAll: false,
          subjectOnly: false,
          caseSensitive: false,
          priorityThreshold: 'High',
          quietHoursEnabled: false,
          notificationChannel: 'both',
          category: 'Education',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'rule_careers',
          userId: DEFAULT_USER_ID,
          name: 'Job Applications & Offers',
          enabled: true,
          senders: ['recruiter@company.com'],
          domains: ['greenhouse.io', 'lever.co', 'workday.com'],
          senderNames: ['Recruiting', 'Talent Acquisition'],
          keywords: ['interview invitation', 'offer letter', 'coding challenge', 'background check', 'next steps'],
          excludedKeywords: ['job alerts', 'promoted jobs'],
          matchAll: false,
          subjectOnly: false,
          caseSensitive: false,
          priorityThreshold: 'Critical',
          quietHoursEnabled: false,
          notificationChannel: 'both',
          category: 'Career',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'rule_urgent_deadlines',
          userId: DEFAULT_USER_ID,
          name: 'Urgent Action & Deadlines',
          enabled: true,
          senders: [],
          domains: [],
          senderNames: [],
          keywords: ['urgent action required', 'immediate response requested', 'deadline expiring', 'payment past due', 'final notice'],
          excludedKeywords: ['unsubscribe', 'sale ends tonight'],
          matchAll: false,
          subjectOnly: true,
          caseSensitive: false,
          priorityThreshold: 'Critical',
          quietHoursEnabled: false,
          notificationChannel: 'both',
          category: 'Urgent',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (const r of starterRules) {
        this.data.rules[r.id] = r;
      }
      this.persist();
    }
  }

  // --- Rules ---
  public getRules(userId: string = DEFAULT_USER_ID): MonitoringRule[] {
    return Object.values(this.data.rules)
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getRule(ruleId: string): MonitoringRule | null {
    return this.data.rules[ruleId] || null;
  }

  public createRule(rule: Omit<MonitoringRule, 'id' | 'createdAt' | 'updatedAt'>): MonitoringRule {
    const id = `rule_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const newRule: MonitoringRule = {
      ...rule,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.data.rules[id] = newRule;
    this.persist();
    return newRule;
  }

  public updateRule(ruleId: string, updates: Partial<MonitoringRule>): MonitoringRule | null {
    const existing = this.data.rules[ruleId];
    if (!existing) return null;
    const updated: MonitoringRule = {
      ...existing,
      ...updates,
      id: ruleId,
      updatedAt: new Date().toISOString()
    };
    this.data.rules[ruleId] = updated;
    this.persist();
    return updated;
  }

  public deleteRule(ruleId: string): boolean {
    if (this.data.rules[ruleId]) {
      delete this.data.rules[ruleId];
      this.persist();
      return true;
    }
    return false;
  }

  public toggleRule(ruleId: string, enabled: boolean): MonitoringRule | null {
    return this.updateRule(ruleId, { enabled });
  }

  // --- Account & OAuth Credentials ---
  public getConnectedAccount(userId: string = DEFAULT_USER_ID): ConnectedAccount | null {
    const stored = this.data.accounts[userId];
    if (!stored) return null;
    const { accessTokenEnc, refreshTokenEnc, ...rest } = stored;
    return rest;
  }

  public getAccountTokens(userId: string = DEFAULT_USER_ID): { accessToken: string; refreshToken: string } | null {
    const stored = this.data.accounts[userId];
    if (!stored) return null;
    try {
      return {
        accessToken: decrypt(stored.accessTokenEnc),
        refreshToken: decrypt(stored.refreshTokenEnc)
      };
    } catch (e) {
      console.error('Failed to decrypt tokens:', e);
      return null;
    }
  }

  public saveImapAccount(userId: string, email: string, appPassword: string): ConnectedAccount {
    const existing = this.data.accounts[userId];
    const now = new Date().toISOString();
    const cleanPassword = appPassword.replace(/\s+/g, '');

    const stored: StoredAccount = {
      id: existing?.id || `acc_${crypto.randomBytes(8).toString('hex')}`,
      userId,
      provider: 'imap',
      email: email.trim(),
      pictureUrl: null,
      historyId: null,
      lastSyncAt: null,
      syncStatus: 'idle',
      errorMessage: null,
      totalSyncedCount: existing?.totalSyncedCount || 0,
      tokenExpiry: Date.now() + 365 * 24 * 3600 * 1000,
      accessTokenEnc: encrypt(cleanPassword),
      refreshTokenEnc: '',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.data.accounts[userId] = stored;
    this.persist();

    const { accessTokenEnc, refreshTokenEnc, ...publicAccount } = stored;
    return publicAccount;
  }

  public getImapPassword(userId: string = DEFAULT_USER_ID): string | null {
    const stored = this.data.accounts[userId];
    if (!stored || stored.provider !== 'imap') return null;
    try {
      return decrypt(stored.accessTokenEnc);
    } catch {
      return null;
    }
  }

  public saveConnectedAccount(
    userId: string,
    email: string,
    tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
    pictureUrl?: string | null
  ): ConnectedAccount {
    const existing = this.data.accounts[userId];
    const now = new Date().toISOString();

    const currentRefreshEnc = existing?.refreshTokenEnc || '';
    const newRefreshEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : currentRefreshEnc;
    const newAccessEnc = tokens.access_token ? encrypt(tokens.access_token) : existing?.accessTokenEnc || '';

    const stored: StoredAccount = {
      id: existing?.id || `acc_${crypto.randomBytes(8).toString('hex')}`,
      userId,
      provider: 'google',
      email,
      pictureUrl: pictureUrl !== undefined ? pictureUrl : existing?.pictureUrl || null,
      historyId: existing?.historyId || null,
      lastSyncAt: existing?.lastSyncAt || null,
      syncStatus: 'idle',
      errorMessage: null,
      totalSyncedCount: existing?.totalSyncedCount || 0,
      tokenExpiry: tokens.expiry_date || Date.now() + 3600 * 1000,
      accessTokenEnc: newAccessEnc,
      refreshTokenEnc: newRefreshEnc,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    this.data.accounts[userId] = stored;
    this.persist();

    const { accessTokenEnc, refreshTokenEnc, ...publicAccount } = stored;
    return publicAccount;
  }

  public updateAccountSync(
    userId: string,
    updates: {
      syncStatus?: 'idle' | 'syncing' | 'error' | 'success';
      lastSyncAt?: string;
      historyId?: string;
      errorMessage?: string | null;
      incrementSynced?: number;
    }
  ): void {
    const account = this.data.accounts[userId];
    if (!account) return;

    if (updates.syncStatus !== undefined) account.syncStatus = updates.syncStatus;
    if (updates.lastSyncAt !== undefined) account.lastSyncAt = updates.lastSyncAt;
    if (updates.historyId !== undefined) account.historyId = updates.historyId;
    if (updates.errorMessage !== undefined) account.errorMessage = updates.errorMessage;
    if (updates.incrementSynced) account.totalSyncedCount = (account.totalSyncedCount || 0) + updates.incrementSynced;
    account.updatedAt = new Date().toISOString();

    this.persist();
  }

  public disconnectAccount(userId: string = DEFAULT_USER_ID, deleteData: boolean = false): void {
    delete this.data.accounts[userId];
    if (deleteData) {
      // Clear processed emails, matched emails and notifications
      for (const key of Object.keys(this.data.processedMessages)) {
        if (key.startsWith(`${userId}:`)) {
          delete this.data.processedMessages[key];
        }
      }
      for (const [id, email] of Object.entries(this.data.matchedEmails)) {
        if (email.userId === userId) {
          delete this.data.matchedEmails[id];
        }
      }
      for (const [id, event] of Object.entries(this.data.notificationEvents)) {
        if (event.userId === userId) {
          delete this.data.notificationEvents[id];
        }
      }
    }
    this.persist();
  }

  // --- Processed Message Deduplication ---
  public isMessageProcessed(userId: string, messageId: string): boolean {
    const key = `${userId}:${messageId}`;
    return Boolean(this.data.processedMessages[key]);
  }

  public recordProcessedMessage(userId: string, messageId: string, threadId: string, historyId?: string): void {
    const key = `${userId}:${messageId}`;
    this.data.processedMessages[key] = {
      threadId,
      historyId,
      processedAt: new Date().toISOString()
    };
    this.persist();
  }

  // --- Matched Emails ---
  public saveMatchedEmail(email: Omit<MatchedEmail, 'id' | 'createdAt'>): MatchedEmail {
    const id = `email_${crypto.randomBytes(8).toString('hex')}`;
    const newEmail: MatchedEmail = {
      ...email,
      id,
      createdAt: new Date().toISOString()
    };
    this.data.matchedEmails[id] = newEmail;
    this.persist();
    return newEmail;
  }

  public getMatchedEmails(
    userId: string = DEFAULT_USER_ID,
    filters?: {
      priority?: string;
      ruleId?: string;
      search?: string;
      readStatus?: 'read' | 'unread' | 'all';
      limit?: number;
      offset?: number;
    }
  ): { emails: MatchedEmail[]; total: number } {
    let list = Object.values(this.data.matchedEmails).filter(e => e.userId === userId);

    if (filters?.priority && filters.priority !== 'all') {
      list = list.filter(e => e.priority.toLowerCase() === filters.priority!.toLowerCase());
    }

    if (filters?.ruleId && filters.ruleId !== 'all') {
      list = list.filter(e => e.matchedRuleIds.includes(filters.ruleId!));
    }

    if (filters?.readStatus === 'read') {
      list = list.filter(e => e.isRead);
    } else if (filters?.readStatus === 'unread') {
      list = list.filter(e => !e.isRead);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase();
      list = list.filter(e =>
        e.subject.toLowerCase().includes(q) ||
        e.senderEmail.toLowerCase().includes(q) ||
        e.senderName.toLowerCase().includes(q) ||
        e.snippet.toLowerCase().includes(q)
      );
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());

    const total = list.length;
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    const paginated = list.slice(offset, offset + limit);

    return { emails: paginated, total };
  }

  public getMatchedEmail(id: string): MatchedEmail | null {
    return this.data.matchedEmails[id] || null;
  }

  public updateEmailStatus(
    id: string,
    updates: { isRead?: boolean; isSnoozed?: boolean; snoozedUntil?: number | null }
  ): MatchedEmail | null {
    const email = this.data.matchedEmails[id];
    if (!email) return null;
    if (updates.isRead !== undefined) email.isRead = updates.isRead;
    if (updates.isSnoozed !== undefined) email.isSnoozed = updates.isSnoozed;
    if (updates.snoozedUntil !== undefined) email.snoozedUntil = updates.snoozedUntil;
    this.persist();
    return email;
  }

  // --- Notification Events ---
  public saveNotificationEvent(event: Omit<NotificationEvent, 'id' | 'createdAt'>): NotificationEvent {
    const id = `notif_${crypto.randomBytes(8).toString('hex')}`;
    const newEvent: NotificationEvent = {
      ...event,
      id,
      createdAt: new Date().toISOString()
    };
    this.data.notificationEvents[id] = newEvent;
    this.persist();
    return newEvent;
  }

  public getNotificationEvents(userId: string = DEFAULT_USER_ID, limit: number = 100): NotificationEvent[] {
    return Object.values(this.data.notificationEvents)
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  public updateNotificationEvent(id: string, updates: Partial<NotificationEvent>): NotificationEvent | null {
    const event = this.data.notificationEvents[id];
    if (!event) return null;
    Object.assign(event, updates);
    this.persist();
    return event;
  }

  public clearNotificationEvents(userId: string = DEFAULT_USER_ID): void {
    for (const [id, event] of Object.entries(this.data.notificationEvents)) {
      if (event.userId === userId) {
        delete this.data.notificationEvents[id];
      }
    }
    this.persist();
  }

  // --- Settings ---
  public getUserSettings(userId: string = DEFAULT_USER_ID): UserSettings {
    if (!this.data.settings[userId]) {
      this.data.settings[userId] = {
        userId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        pushEnabled: true,
        syncIntervalSeconds: config.sync.pollIntervalSeconds,
        retentionDays: 90,
        updatedAt: new Date().toISOString()
      };
      this.persist();
    }
    return this.data.settings[userId];
  }

  public updateUserSettings(userId: string = DEFAULT_USER_ID, updates: Partial<UserSettings>): UserSettings {
    const current = this.getUserSettings(userId);
    const updated: UserSettings = {
      ...current,
      ...updates,
      userId,
      updatedAt: new Date().toISOString()
    };
    this.data.settings[userId] = updated;
    this.persist();
    return updated;
  }

  // --- Overview & Dashboard Metrics ---
  public getOverviewStats(userId: string = DEFAULT_USER_ID): OverviewStats {
    const account = this.getConnectedAccount(userId);
    const rules = this.getRules(userId);
    const emails = Object.values(this.data.matchedEmails).filter(e => e.userId === userId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const matchedToday = emails.filter(e => new Date(e.createdAt) >= startOfToday).length;
    const highPriorityCount = emails.filter(e => (e.priority === 'Critical' || e.priority === 'High') && !e.isRead).length;
    const activeRulesCount = rules.filter(r => r.enabled).length;

    // Get 5 most recent matched emails
    const recentEmails = emails
      .sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime())
      .slice(0, 5);

    return {
      connected: Boolean(account),
      accountEmail: account?.email || null,
      lastSyncAt: account?.lastSyncAt || null,
      syncStatus: account?.syncStatus || 'disconnected',
      syncError: account?.errorMessage || null,
      matchedToday,
      highPriorityCount,
      activeRulesCount,
      totalRulesCount: rules.length,
      recentEmails
    };
  }
}

export const db = new Database();
