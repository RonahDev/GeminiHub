const SENSITIVE_KEYS = new Set([
  'apiid',
  'apisecret',
  'signature',
  'token',
  'refreshtoken',
  'password',
  'passwordhash',
  'credentials',
  'credentialsencrypted',
  'link',
  'links',
  'linkencrypted',
  'session',
  'rawpayload',
  'rawresponse',
  'responseencrypted',
]);

/**
 * Recursively sanitize objects before logging or returning to client (NFR-07)
 */
export function sanitizeLogData<T = any>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    if (data.startsWith('http://') || data.startsWith('https://')) {
      return '[REDACTED_LINK]' as unknown as T;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeLogData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized as T;
  }

  return data;
}
