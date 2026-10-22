import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { EmailPayload } from '../../types.js';

export class ImapService {
  /**
   * Test IMAP connection with Gmail App Password
   */
  public static async verifyConnection(email: string, appPassword: string): Promise<boolean> {
    const cleanPass = appPassword.replace(/\s+/g, '');
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: email.trim(),
        pass: cleanPass,
      },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
      return true;
    } catch (err: any) {
      console.error(`[IMAP] Connection verification failed for ${email}:`, err?.message || err);
      throw new Error(err?.message || 'Invalid Gmail address or App Password');
    }
  }

  /**
   * Fetch recent messages from Gmail inbox via IMAP
   */
  public static async fetchRecentEmails(
    email: string,
    appPassword: string,
    limit: number = 25
  ): Promise<EmailPayload[]> {
    const cleanPass = appPassword.replace(/\s+/g, '');
    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: email.trim(),
        pass: cleanPass,
      },
      logger: false,
    });

    const emails: EmailPayload[] = [];

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Find latest messages in INBOX
      const status = await client.status('INBOX', { messages: true });
      const totalMessages = (status && typeof status === 'object' && 'messages' in status && typeof status.messages === 'number')
        ? status.messages
        : 0;

      if (totalMessages > 0) {
        const startSeq = Math.max(1, totalMessages - limit + 1);
        const sequenceRange = `${startSeq}:${totalMessages}`;

        // Fetch messages newest first
        for await (const message of client.fetch(sequenceRange, { envelope: true, source: true })) {
          if (!message.source) continue;

          try {
            const parsed = await simpleParser(message.source);
            const fromObj = parsed.from?.value?.[0];

            const senderEmail = fromObj?.address || message.envelope?.from?.[0]?.address || 'unknown@gmail.com';
            const senderName = fromObj?.name || message.envelope?.from?.[0]?.name || '';
            const subject = parsed.subject || message.envelope?.subject || '(No Subject)';
            const messageId = parsed.messageId || `${message.uid}_${Date.now()}`;
            const dateReceived = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
            const bodyText = parsed.text || '';
            const snippet = bodyText.slice(0, 160).replace(/\s+/g, ' ').trim();

            emails.push({
              messageId,
              threadId: messageId,
              senderName,
              senderEmail,
              subject,
              snippet: snippet || subject,
              bodyText,
              bodyHtml: typeof parsed.html === 'string' ? parsed.html : undefined,
              dateReceived,
            });
          } catch (parseErr) {
            console.warn('[IMAP] Failed to parse message payload:', parseErr);
          }
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }

    // Sort newest first
    return emails.sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
  }
}
