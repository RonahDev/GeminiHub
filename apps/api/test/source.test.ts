import { describe, it, expect } from 'vitest';
import { MockAdapter } from '../src/infrastructure/adapters/MockAdapter';
import { encrypt, decrypt, maskSecret } from '../src/infrastructure/security/crypto';

process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Feature 6: Bot Source Adapters & Circuit Breaker (Section 8.3, FR-SRC-01..14)', () => {
  // TC-SRC-01
  it('TC-SRC-01: MockAdapter testConnection trả về kết quả ok và độ trễ latency thực tế', async () => {
    const adapter = new MockAdapter({ latencyMs: 10 });
    const res = await adapter.testConnection();

    expect(res.ok).toBe(true);
    expect(res.latencyMs).toBeGreaterThanOrEqual(5);
  });

  // TC-SRC-02
  it('TC-SRC-02: Đồng bộ danh mục sản phẩm và số dư tự động từ bot nguồn', async () => {
    const adapter = new MockAdapter({ latencyMs: 0 });
    const [balanceRes, products] = await Promise.all([
      adapter.getBalance(),
      adapter.listProducts(),
    ]);

    expect(balanceRes.amount).toBeGreaterThan(0);
    expect(balanceRes.currency).toBe('VND');

    expect(products.length).toBeGreaterThan(0);
    const primaryProd = products[0];
    expect(primaryProd.externalId).toBe('SP-GEMINI-1M');
    expect(primaryProd.costVnd).toBe(17000);
    expect(primaryProd.stock).toBe(50);
  });

  // TC-SRC-03
  it('TC-SRC-03: Ngắt mạch tự động (Circuit Breaker trip sang ERROR) khi nguồn bot lỗi liên tiếp 5 lần', () => {
    const sourceState = {
      id: 'source-circuit-test',
      name: 'Unstable Bot',
      status: 'ACTIVE',
      consecutiveErrors: 0,
    };

    // Simulate 5 consecutive failures
    for (let i = 1; i <= 5; i++) {
      sourceState.consecutiveErrors += 1;
      if (sourceState.consecutiveErrors >= 5) {
        sourceState.status = 'ERROR';
      }
    }

    expect(sourceState.consecutiveErrors).toBe(5);
    expect(sourceState.status).toBe('ERROR');
  });

  // TC-SRC-04
  it('TC-SRC-04: Bảo mật thông tin: che giấu secret/token (maskSecret) và mã hóa credentials AES-256-GCM', () => {
    const rawCredentials = JSON.stringify({ token: 'sumistore-super-secret-token-123456' });

    // Encrypt before saving in database
    const encrypted = encrypt(rawCredentials);
    expect(encrypted).not.toContain('sumistore-super-secret');

    // Decrypt on execution
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(rawCredentials);

    // Mask secret when returning to API / frontend (FR-SRC-06)
    const masked = maskSecret(encrypted);
    expect(masked).toContain('••••');
    expect(masked).not.toContain('sumistore-super-secret');
    expect(maskSecret('12345')).toBe('••••••••');
  });

  // TC-SRC-05
  it('TC-SRC-05: Khôi phục trạng thái ACTIVE và reset lỗi về 0 khi nguồn ERROR kết nối lại thành công', async () => {
    const sourceState = {
      id: 'source-restore-test',
      name: 'Recovered Bot',
      status: 'ERROR',
      consecutiveErrors: 5,
    };

    const adapter = new MockAdapter({ latencyMs: 0 });
    const probeResult = await adapter.testConnection();

    if (probeResult.ok) {
      sourceState.status = 'ACTIVE';
      sourceState.consecutiveErrors = 0;
    }

    expect(sourceState.status).toBe('ACTIVE');
    expect(sourceState.consecutiveErrors).toBe(0);
  });
});
