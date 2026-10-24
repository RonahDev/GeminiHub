import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const envKey = process.env.APP_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error('APP_ENCRYPTION_KEY environment variable is not configured');
  }
  // Support 64-char hex or fallback to sha256 of the string
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all in hex)
 */
export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Compute SHA-256 hash for link deduplication.
 */
export function hashSha256(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * Compute HMAC-SHA256 for Tele API requests.
 */
export function computeHmacSha256(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Mask sensitive credentials for safe UI display (FR-SRC-06).
 * Example: TAPI-P7L3••••4F0Y
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length <= 8) {
    return '••••••••';
  }
  const prefix = secret.slice(0, 8);
  const suffix = secret.slice(-4);
  return `${prefix}••••${suffix}`;
}
