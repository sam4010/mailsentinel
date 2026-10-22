import { google } from 'googleapis';
import crypto from 'crypto';
import { config } from '../config.js';

// In-memory store for pending PKCE verifiers & state tokens (with 10-minute TTL)
interface PendingState {
  codeVerifier: string;
  userId: string;
  createdAt: number;
}
const pendingStates = new Map<string, PendingState>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      pendingStates.delete(state);
    }
  }
}, 60 * 1000);

/**
 * Base64URL encoding helper for PKCE
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Get configured OAuth2 client instance
 */
export function getOAuthClient() {
  if (!config.google.isConfigured) {
    throw new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  }

  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/**
 * Generate Google OAuth authorization URL with PKCE and CSRF state protection
 */
export function generateAuthUrl(userId: string = 'default_user'): { url: string; state: string } {
  const oauth2Client = getOAuthClient();

  // Generate cryptographic PKCE code verifier & challenge
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());

  // Generate secure random state token
  const state = crypto.randomBytes(24).toString('hex');
  pendingStates.set(state, {
    codeVerifier,
    userId,
    createdAt: Date.now()
  });

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Requests refresh_token
    prompt: 'consent',       // Ensures refresh_token is returned
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256' as any,
  });

  return { url, state };
}

/**
 * Exchange auth code for tokens with state and PKCE validation
 */
export async function exchangeCodeForTokens(code: string, state: string): Promise<{
  tokens: any;
  userEmail: string;
  pictureUrl?: string;
  userId: string;
}> {
  const pending = pendingStates.get(state);
  if (!pending) {
    throw new Error('Invalid or expired OAuth state token (CSRF validation failed)');
  }
  pendingStates.delete(state);

  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken({
    code,
    codeVerifier: pending.codeVerifier,
  });

  oauth2Client.setCredentials(tokens);

  // Retrieve user profile email and picture
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  return {
    tokens,
    userEmail: userInfo.data.email || 'unknown@gmail.com',
    pictureUrl: userInfo.data.picture || undefined,
    userId: pending.userId,
  };
}
