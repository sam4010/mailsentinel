import { Router } from 'express';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { generateAuthUrl, exchangeCodeForTokens } from '../gmail/oauth.js';
import { ImapService } from '../imap/client.js';
import { SyncWorker } from '../sync/worker.js';

const router = Router();

/**
 * Connect Gmail directly with 16-letter App Password (No Google Cloud Console needed!)
 */
router.post('/imap/connect', async (req, res) => {
  const { email, appPassword } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid Gmail address.' });
  }

  if (!appPassword || appPassword.replace(/\s+/g, '').length < 8) {
    return res.status(400).json({ error: 'Please enter your 16-letter Google App Password.' });
  }

  try {
    console.log(`[IMAP] Verifying Gmail App Password for ${email}...`);
    await ImapService.verifyConnection(email, appPassword);

    const account = db.saveImapAccount('default_user', email, appPassword);
    console.log(`[IMAP] Successfully connected Gmail account via App Password: ${email}`);

    // Trigger initial sync in background
    SyncWorker.syncUser('default_user').catch(e => console.error('[IMAP] Initial sync error:', e));

    res.json({
      success: true,
      message: `Successfully connected ${email} via Gmail App Password!`,
      account,
    });
  } catch (err: any) {
    console.error('[IMAP] Connection failed:', err?.message || err);
    res.status(400).json({
      error: err?.message || 'Failed to authenticate with Gmail. Please double-check your App Password.',
    });
  }
});

/**
 * Get current authentication and service configuration status
 */
router.get('/status', (req, res) => {
  const account = db.getConnectedAccount('default_user');
  res.json({
    connected: Boolean(account),
    account,
    oauthConfigured: config.google.isConfigured,
    vapidConfigured: config.vapid.isConfigured,
    vapidPublicKey: config.vapid.publicKey,
    redirectUri: config.google.redirectUri,
  });
});

/**
 * Initiate Google OAuth 2.0 flow
 */
router.get('/google/url', (req, res) => {
  if (!config.google.isConfigured) {
    return res.status(400).json({
      error: 'Google OAuth credentials are not configured.',
      help: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.',
      redirectUri: config.google.redirectUri,
    });
  }

  try {
    const { url, state } = generateAuthUrl('default_user');
    res.json({ url, state });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate OAuth URL' });
  }
});

/**
 * OAuth 2.0 Redirect Callback
 */
router.get('/google/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const error = req.query.error as string;

  if (error) {
    console.error('[OAuth] Google returned error:', error);
    return res.redirect(`${config.baseUrl}/accounts?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${config.baseUrl}/accounts?error=missing_code_or_state`);
  }

  try {
    const { tokens, userEmail, pictureUrl, userId } = await exchangeCodeForTokens(code, state);

    db.saveConnectedAccount(userId, userEmail, tokens, pictureUrl);
    console.log(`[OAuth] Successfully connected Gmail account: ${userEmail}`);

    // Register Gmail Watch if topic is configured
    if (config.sync.pubsubTopic) {
      import('../gmail/client.js').then(({ GmailService }) => {
        GmailService.watchInbox(userId, config.sync.pubsubTopic).catch(e => console.warn('[OAuth] Watch registration:', e));
      });
    }

    // Trigger initial background sync asynchronously
    SyncWorker.syncUser(userId).catch(e => console.error('[OAuth] Initial sync error:', e));

    res.redirect(`${config.baseUrl}/accounts?connected=true&email=${encodeURIComponent(userEmail)}`);
  } catch (err: any) {
    console.error('[OAuth] Callback processing failed:', err?.message || err);
    res.redirect(`${config.baseUrl}/accounts?error=${encodeURIComponent(err?.message || 'oauth_exchange_failed')}`);
  }
});

/**
 * Disconnect Gmail Account
 */
router.post('/disconnect', (req, res) => {
  const deleteData = req.body?.deleteData === true;
  db.disconnectAccount('default_user', deleteData);
  res.json({ success: true, message: 'Account disconnected successfully' });
});

export default router;
