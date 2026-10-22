import { google } from 'googleapis';
import { getOAuthClient } from './oauth.js';
import { db } from '../db/index.js';
import { EmailPayload } from '../../types.js';

export class GmailService {
  /**
   * Builds an authenticated OAuth2 client for a given user, handling token expiration & refresh.
   */
  public static async getClient(userId: string) {
    const tokens = db.getAccountTokens(userId);
    const account = db.getConnectedAccount(userId);

    if (!tokens || !account) {
      throw new Error(`No connected Gmail account found for user ${userId}`);
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: account.tokenExpiry,
    });

    // Listen for refresh tokens and save new tokens to encrypted DB
    oauth2Client.on('tokens', (newTokens) => {
      console.log(`[Gmail] Tokens refreshed for user ${userId}`);
      db.saveConnectedAccount(
        userId,
        account.email,
        {
          access_token: newTokens.access_token || tokens.accessToken,
          refresh_token: newTokens.refresh_token || tokens.refreshToken,
          expiry_date: newTokens.expiry_date || undefined,
        },
        account.pictureUrl
      );
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Decode base64url encoded string from Gmail API
   */
  private static decodeBase64(data?: string): string {
    if (!data) return '';
    try {
      const sanitized = data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(sanitized, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }

  /**
   * Recursively extract plain text and HTML from Gmail MIME parts
   */
  private static extractBody(payload?: any): { text: string; html: string } {
    let text = '';
    let html = '';

    if (!payload) return { text, html };

    if (payload.body && payload.body.data) {
      const decoded = this.decodeBase64(payload.body.data);
      if (payload.mimeType === 'text/plain') {
        text += decoded;
      } else if (payload.mimeType === 'text/html') {
        html += decoded;
      }
    }

    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        const sub = this.extractBody(part);
        text += sub.text ? (text ? '\n' : '') + sub.text : '';
        html += sub.html ? (html ? '\n' : '') + sub.html : '';
      }
    }

    return { text, html };
  }

  /**
   * Parse a single Gmail message resource into a normalized EmailPayload
   */
  public static parseMessage(msg: any): EmailPayload {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => {
      const found = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return found ? found.value : '';
    };

    const fromHeader = getHeader('From');
    let senderName = '';
    let senderEmail = fromHeader;

    const fromMatch = fromHeader.match(/^(.*?)\s*<([^>]+)>/);
    if (fromMatch) {
      senderName = fromMatch[1].replace(/["']/g, '').trim();
      senderEmail = fromMatch[2].trim();
    }

    const subject = getHeader('Subject') || '(No Subject)';
    const dateStr = getHeader('Date');
    const dateReceived = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

    const { text, html } = this.extractBody(msg.payload);

    return {
      messageId: msg.id,
      threadId: msg.threadId,
      senderName,
      senderEmail,
      subject,
      snippet: msg.snippet || '',
      bodyText: text || msg.snippet || '',
      bodyHtml: html || undefined,
      dateReceived,
    };
  }

  /**
   * Fetch recent messages from Gmail inbox (skips spam and trash)
   */
  public static async fetchRecentMessages(
    userId: string,
    maxResults: number = 20
  ): Promise<{ emails: EmailPayload[]; currentHistoryId?: string }> {
    const gmail = await this.getClient(userId);

    // Get current user profile to obtain latest historyId checkpoint
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const currentHistoryId = profile.data.historyId || undefined;

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: '-in:spam -in:trash',
      maxResults,
    });

    const messagesMeta = listRes.data.messages || [];
    const emails: EmailPayload[] = [];

    for (const item of messagesMeta) {
      if (!item.id) continue;
      try {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: item.id,
          format: 'full',
        });
        if (msgRes.data) {
          emails.push(this.parseMessage(msgRes.data));
        }
      } catch (err) {
        console.warn(`[Gmail] Could not fetch message ${item.id}:`, err);
      }
    }

    return { emails, currentHistoryId };
  }

  /**
   * Incremental fetch via Gmail History API using startHistoryId
   */
  public static async fetchHistoryMessages(
    userId: string,
    startHistoryId: string
  ): Promise<{ emails: EmailPayload[]; latestHistoryId?: string; historyExpired?: boolean }> {
    const gmail = await this.getClient(userId);

    try {
      const historyRes = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
      });

      const histories = historyRes.data.history || [];
      const latestHistoryId = historyRes.data.historyId || undefined;
      const messageIds = new Set<string>();

      for (const h of histories) {
        if (h.messagesAdded) {
          for (const ma of h.messagesAdded) {
            if (ma.message?.id) {
              messageIds.add(ma.message.id);
            }
          }
        }
      }

      const emails: EmailPayload[] = [];
      for (const msgId of messageIds) {
        try {
          const msgRes = await gmail.users.messages.get({
            userId: 'me',
            id: msgId,
            format: 'full',
          });
          if (msgRes.data) {
            // Verify not spam/trash
            const labels = msgRes.data.labelIds || [];
            if (!labels.includes('SPAM') && !labels.includes('TRASH')) {
              emails.push(this.parseMessage(msgRes.data));
            }
          }
        } catch (e) {
          console.warn(`[Gmail] Failed to fetch message ${msgId} from history:`, e);
        }
      }

      return { emails, latestHistoryId, historyExpired: false };
    } catch (err: any) {
      // Check if history ID is expired (404 / 400 with 'history' message)
      if (err?.code === 404 || err?.status === 404 || (err?.message && err.message.toLowerCase().includes('history'))) {
        console.warn(`[Gmail] History cursor ${startHistoryId} is expired or invalid. Full reconciliation needed.`);
        return { emails: [], historyExpired: true };
      }
      throw err;
    }
  }
}
