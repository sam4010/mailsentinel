import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  
  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
    isConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },

  // Security
  encryptionSecret: process.env.ENCRYPTION_SECRET || 'sentinel_dev_secret_key_32_characters_minimum_gcm_passphrase!',
  
  // Web Push (VAPID)
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@mailsentinel.local',
    isConfigured: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  },

  // Sync settings
  sync: {
    pollIntervalSeconds: parseInt(process.env.SYNC_POLL_INTERVAL_SECONDS || '60', 10),
    maxEmailsPerSync: parseInt(process.env.MAX_EMAILS_PER_SYNC || '50', 10),
  },

  // Storage
  dbPath: path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/sentinel.db'),
  dataDir: DATA_DIR,
};
