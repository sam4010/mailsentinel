import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../server/crypto/encryption.js';

describe('AES-256-GCM Token Encryption', () => {
  it('encrypts and decrypts OAuth tokens accurately', () => {
    const rawRefreshToken = '1//04r459f8hs9d8f7h9sd8f7h9sdfh-REAL_REFRESH_TOKEN_EXAMPLE';
    const encrypted = encrypt(rawRefreshToken);

    expect(encrypted).not.toBe(rawRefreshToken);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(rawRefreshToken);
  });

  it('rejects tampered or corrupt ciphertexts', () => {
    const raw = 'secret_token_12345';
    const encrypted = encrypt(raw);
    const parts = encrypted.split(':');

    // Tamper with ciphertext
    const tampered = `${parts[0]}:${parts[1]}:deadbeef${parts[2].slice(8)}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('handles empty inputs gracefully', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });
});
