import webPush from 'web-push';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { MatchedEmail, NotificationEvent, Priority } from '../../types.js';

// Initialize web-push if VAPID keys are provided
if (config.vapid.isConfigured) {
  webPush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey
  );
}

/**
 * Checks if the current time falls within user's configured quiet hours.
 */
export function isInQuietHours(
  startStr: string = '22:00',
  endStr: string = '07:00',
  timezone: string = 'UTC'
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = startStr.split(':').map(n => parseInt(n, 10));
    const [endH, endM] = endStr.split(':').map(n => parseInt(n, 10));
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // e.g. 13:00 to 17:00
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Over midnight, e.g. 22:00 to 07:00
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  } catch (err) {
    return false;
  }
}

export class NotificationService {
  /**
   * Dispatches notifications (in-app and push) for a matched email.
   */
  public static async dispatch(email: MatchedEmail): Promise<NotificationEvent[]> {
    const events: NotificationEvent[] = [];
    const settings = db.getUserSettings(email.userId);

    const gmailUrl = `https://mail.google.com/mail/u/0/#all/${email.threadId || email.messageId}`;
    const priorityIcon = email.priority === 'Critical' ? '🚨' : email.priority === 'High' ? '⚠️' : '📬';
    const title = `${priorityIcon} [${email.priority}] ${email.senderName || email.senderEmail}: ${email.subject}`;
    const body = `${email.matchExplanation}\nSnippet: "${email.snippet.slice(0, 120)}..."`;

    // 1. Always record in-app notification event
    const inAppEvent = db.saveNotificationEvent({
      userId: email.userId,
      matchedEmailId: email.id,
      ruleId: email.matchedRuleIds[0] || undefined,
      channel: 'in_app',
      status: 'Delivered',
      priority: email.priority,
      title,
      body,
      sentAt: new Date().toISOString(),
    });
    events.push(inAppEvent);

    // 2. Web Push Notification (if enabled and subscription exists)
    if (settings.pushEnabled && settings.webPushSubscription) {
      // Check quiet hours
      const quiet = settings.quietHoursEnabled && isInQuietHours(
        settings.quietHoursStart,
        settings.quietHoursEnd,
        settings.timezone
      );

      if (quiet && email.priority !== 'Critical') {
        console.log(`[Notification] Suppressing push notification for email ${email.id} due to quiet hours`);
        const deferredEvent = db.saveNotificationEvent({
          userId: email.userId,
          matchedEmailId: email.id,
          ruleId: email.matchedRuleIds[0] || undefined,
          channel: 'push',
          status: 'Pending',
          priority: email.priority,
          title,
          body: `(Deferred during quiet hours) ${body}`,
          errorMessage: 'Deferred: User is in quiet hours',
        });
        events.push(deferredEvent);
        return events;
      }

      const pushPayload = JSON.stringify({
        title,
        body,
        priority: email.priority,
        sender: email.senderName || email.senderEmail,
        messageId: email.messageId,
        gmailUrl,
        url: `/emails?id=${email.id}`,
      });

      const pushEvent = db.saveNotificationEvent({
        userId: email.userId,
        matchedEmailId: email.id,
        ruleId: email.matchedRuleIds[0] || undefined,
        channel: 'push',
        status: 'Pending',
        priority: email.priority,
        title,
        body,
      });

      try {
        if (!config.vapid.isConfigured) {
          throw new Error('VAPID keys not configured in server environment');
        }

        await webPush.sendNotification(
          settings.webPushSubscription,
          pushPayload,
          {
            TTL: 3600 * 24, // 24 hours
            urgency: email.priority === 'Critical' ? 'high' : 'normal',
          }
        );

        db.updateNotificationEvent(pushEvent.id, {
          status: 'Delivered',
          sentAt: new Date().toISOString(),
          errorMessage: null,
        });
        pushEvent.status = 'Delivered';
        pushEvent.sentAt = new Date().toISOString();
      } catch (err: any) {
        console.error('[Notification] Web Push delivery failed:', err?.message || err);
        const errMessage = err?.message || 'Failed to send web push notification';
        db.updateNotificationEvent(pushEvent.id, {
          status: 'Failed',
          errorMessage: errMessage,
        });
        pushEvent.status = 'Failed';
        pushEvent.errorMessage = errMessage;
      }

      events.push(pushEvent);
    }

    return events;
  }

  /**
   * Retry sending a failed push notification
   */
  public static async retry(eventId: string): Promise<NotificationEvent | null> {
    const notif = db.getNotificationEvents().find(n => n.id === eventId);
    if (!notif || notif.channel !== 'push') return null;

    const email = db.getMatchedEmail(notif.matchedEmailId);
    const settings = db.getUserSettings(notif.userId);

    if (!settings.webPushSubscription) {
      throw new Error('No active Web Push subscription on file');
    }

    if (!config.vapid.isConfigured) {
      throw new Error('VAPID keys are not configured on server');
    }

    const gmailUrl = email ? `https://mail.google.com/mail/u/0/#all/${email.threadId || email.messageId}` : '/';

    const pushPayload = JSON.stringify({
      title: notif.title,
      body: notif.body,
      priority: notif.priority,
      messageId: email?.messageId,
      gmailUrl,
      url: email ? `/emails?id=${email.id}` : '/',
    });

    try {
      await webPush.sendNotification(settings.webPushSubscription, pushPayload);
      return db.updateNotificationEvent(eventId, {
        status: 'Delivered',
        sentAt: new Date().toISOString(),
        errorMessage: null,
      });
    } catch (err: any) {
      return db.updateNotificationEvent(eventId, {
        status: 'Failed',
        errorMessage: `Retry failed: ${err?.message || err}`,
      });
    }
  }

  /**
   * Send a test push notification to verify push delivery
   */
  public static async sendTestPush(userId: string): Promise<{ success: boolean; message: string }> {
    const settings = db.getUserSettings(userId);
    if (!settings.webPushSubscription) {
      return {
        success: false,
        message: 'No active push subscription found. Please allow push notifications in your browser first.',
      };
    }

    if (!config.vapid.isConfigured) {
      return {
        success: false,
        message: 'Server VAPID keys are not configured. Run "npx web-push generate-vapid-keys" and add them to .env',
      };
    }

    const payload = JSON.stringify({
      title: '🚨 [CRITICAL] MailSentinel Test Alert',
      body: 'Verified! MailSentinel background push alerts are active and working.',
      priority: 'Critical',
      url: '/',
    });

    try {
      await webPush.sendNotification(settings.webPushSubscription, payload);
      return {
        success: true,
        message: 'Web Push test notification was successfully sent and acknowledged by the push service.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Push service rejected delivery: ${err?.message || err}`,
      };
    }
  }
}
