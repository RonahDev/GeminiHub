import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, maskSecret, hashSha256, computeHmacSha256 } from '../src/infrastructure/security/crypto';

describe('Cryptography Utilities (NFR-06, FR-SRC-06)', () => {
  beforeAll(() => {
    process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  it('should encrypt and decrypt plaintext using AES-256-GCM successfully', () => {
    const originalText = 'https://one.google.com/explore-plan/gemini-advanced?promo=SEC-1234-ABCD';
    const encrypted = encrypt(originalText);

    expect(encrypted).not.toBe(originalText);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it('should fail decryption when ciphertext is tampered with', () => {
    const originalText = 'test-secret-token';
    const encrypted = encrypt(originalText);
    const parts = encrypted.split(':');
    // Tamper with ciphertext
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}ff`;

    expect(() => decrypt(tampered)).toThrow();
  });

  it('should mask credentials safely for UI display (FR-SRC-06)', () => {
    const secret = 'TAPI-P7L3X9Z84F0Y';
    const masked = maskSecret(secret);
    expect(masked).toBe('TAPI-P7L••••4F0Y');

    expect(maskSecret('short')).toBe('••••••••');
  });

  it('should compute consistent SHA-256 hashes for deduplication', () => {
    const link = 'https://one.google.com/explore-plan/test';
    const hash1 = hashSha256(link);
    const hash2 = hashSha256(link + ' ');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it('should compute valid HMAC-SHA256 signature', () => {
    const secret = 'my-api-secret';
    const payload = '1729760000|uuid-123|{"id":"SP-1"}';
    const sig = computeHmacSha256(secret, payload);
    expect(sig.length).toBe(64);
  });
});

