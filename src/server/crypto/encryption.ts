import crypto from 'crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'mailsentinel_fixed_salt_v1';

// Derive 32-byte key deterministically using scrypt
const DERIVED_KEY = crypto.scryptSync(config.encryptionSecret, SALT, KEY_LENGTH);

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (hex encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, DERIVED_KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted string using AES-256-GCM.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, DERIVED_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
