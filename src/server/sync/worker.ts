import { db } from '../db/index.js';
import { config } from '../config.js';
import { GmailService } from '../gmail/client.js';
import { evaluateAllRules } from '../rules/matcher.js';
import { classifyEmail } from '../rules/classifier.js';
import { NotificationService } from '../notifications/service.js';
import { EmailPayload } from '../../types.js';

export class SyncWorker {
  private static syncingUsers = new Set<string>();
  private static timer: NodeJS.Timeout | null = null;

  /**
   * Start the background polling synchronization loop.
   */
  public static start(): void {
    if (this.timer) return;

    const intervalMs = Math.max(config.sync.pollIntervalSeconds, 15) * 1000;
    console.log(`[SyncWorker] Starting background email monitor. Poll interval: ${intervalMs / 1000}s`);

    this.timer = setInterval(async () => {
      try {
        await this.syncAllConnectedAccounts();
      } catch (err) {
        console.error('[SyncWorker] Error during background sync tick:', err);
      }
    }, intervalMs);

    // Initial run after a short delay
    setTimeout(() => {
      this.syncAllConnectedAccounts().catch((e) => console.error('[SyncWorker] Initial sync error:', e));
    }, 3000);
  }

  /**
   * Stop the background sync loop.
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[SyncWorker] Stopped background sync loop');
    }
  }

  /**
   * Run sync for all connected accounts.
   */
  public static async syncAllConnectedAccounts(): Promise<void> {
    const account = db.getConnectedAccount('default_user');
    if (account) {
      await this.syncUser(account.userId);
    }
  }

  /**
   * Run synchronization for a specific user.
   */
  public static async syncUser(userId: string = 'default_user'): Promise<{
    success: boolean;
    syncedCount: number;
    matchedCount: number;
    error?: string;
  }> {
    if (this.syncingUsers.has(userId)) {
      console.log(`[SyncWorker] User ${userId} is already syncing. Skipping concurrent run.`);
      return { success: true, syncedCount: 0, matchedCount: 0 };
    }

    const account = db.getConnectedAccount(userId);
    if (!account) {
      return { success: false, syncedCount: 0, matchedCount: 0, error: 'No connected Gmail account' };
    }

    this.syncingUsers.add(userId);
    db.updateAccountSync(userId, { syncStatus: 'syncing', errorMessage: null });

    let syncedCount = 0;
    let matchedCount = 0;

    try {
      const rules = db.getRules(userId);
      const settings = db.getUserSettings(userId);
      let emails: EmailPayload[] = [];
      let newHistoryId: string | undefined = account.historyId || undefined;

      if (account.historyId) {
        // Incremental sync using Gmail history cursor
        const histResult = await GmailService.fetchHistoryMessages(userId, account.historyId);
        if (histResult.historyExpired) {
          // Fallback to recent messages
          console.log(`[SyncWorker] History cursor expired for ${userId}. Performing full reconciliation.`);
          const recent = await GmailService.fetchRecentMessages(userId, config.sync.maxEmailsPerSync);
          emails = recent.emails;
          newHistoryId = recent.currentHistoryId;
        } else {
          emails = histResult.emails;
          newHistoryId = histResult.latestHistoryId || account.historyId;
        }
      } else {
        // Initial sync: fetch recent messages
        console.log(`[SyncWorker] Initial sync for user ${userId}.`);
        const recent = await GmailService.fetchRecentMessages(userId, config.sync.maxEmailsPerSync);
        emails = recent.emails;
        newHistoryId = recent.currentHistoryId;
      }

      syncedCount = emails.length;

      // Evaluate each new email
      for (const email of emails) {
        // 1. Deduplication check
        if (db.isMessageProcessed(userId, email.messageId)) {
          continue;
        }

        // 2. Evaluate all active rules
        const evalResult = evaluateAllRules(rules, email);

        if (evalResult.matched) {
          // 3. Classify priority and detect deadlines
          const classification = classifyEmail(evalResult.matchedRules, email, settings.timezone);

          // 4. Save matched email
          const savedEmail = db.saveMatchedEmail({
            userId,
            messageId: email.messageId,
            threadId: email.threadId,
            senderName: email.senderName,
            senderEmail: email.senderEmail,
            subject: email.subject,
            snippet: email.snippet,
            bodyPreview: email.bodyText.slice(0, 500),
            dateReceived: email.dateReceived,
            priority: classification.priority,
            priorityReason: classification.reason,
            matchedRuleIds: evalResult.matchedRules.map(r => r.id),
            matchedRuleNames: evalResult.matchedRules.map(r => r.name),
            matchExplanation: evalResult.explanation,
            deadlineText: classification.deadline?.text || null,
            deadlineTimestamp: classification.deadline?.timestamp || null,
            deadlineIsUncertain: classification.deadline?.isUncertain,
            isRead: false,
            isSnoozed: false,
            snoozedUntil: null,
          });

          matchedCount++;
          console.log(`[SyncWorker] Matched email ${email.messageId}: "${email.subject}" -> Priority: ${classification.priority}`);

          // 5. Dispatch notification
          await NotificationService.dispatch(savedEmail);
        }

        // 6. Record as processed (idempotency checkpoint)
        db.recordProcessedMessage(userId, email.messageId, email.threadId, newHistoryId);
      }

      // Update account status
      db.updateAccountSync(userId, {
        syncStatus: 'success',
        lastSyncAt: new Date().toISOString(),
        historyId: newHistoryId,
        errorMessage: null,
        incrementSynced: syncedCount,
      });

      console.log(`[SyncWorker] Sync complete for ${account.email}. Synced: ${syncedCount}, Matched: ${matchedCount}`);
      return { success: true, syncedCount, matchedCount };
    } catch (err: any) {
      const errMsg = err?.message || 'Sync failed unexpectedly';
      console.error(`[SyncWorker] Sync failed for user ${userId}:`, errMsg);
      db.updateAccountSync(userId, {
        syncStatus: 'error',
        errorMessage: errMsg,
      });
      return { success: false, syncedCount, matchedCount, error: errMsg };
    } finally {
      this.syncingUsers.delete(userId);
    }
  }
}
