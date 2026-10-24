import { describe, it, expect } from 'vitest';
import { MockAdapter } from '../src/infrastructure/adapters/MockAdapter';

describe('Source Adapters (Section 8.3, FR-SRC)', () => {
  it('MockAdapter testConnection returns ok and realistic latency', async () => {
    const adapter = new MockAdapter({ latencyMs: 10 });
    const res = await adapter.testConnection();
    expect(res.ok).toBe(true);
    expect(res.latencyMs).toBeGreaterThanOrEqual(5);
  });

  it('MockAdapter lists products with externalId, rawPrice, costVnd, and stock', async () => {
    const adapter = new MockAdapter({ latencyMs: 0 });
    const products = await adapter.listProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].externalId).toBe('SP-GEMINI-1M');
    expect(products[0].costVnd).toBe(17000);
    expect(products[0].stock).toBe(50);
  });

  it('MockAdapter delivers correct quantity of links on success', async () => {
    const adapter = new MockAdapter({ latencyMs: 0 });
    const result = await adapter.buy('SP-GEMINI-1M', 2);
    expect(result.kind).toBe('SUCCESS');
    if (result.kind === 'SUCCESS') {
      expect(result.links.length).toBe(2);
      expect(result.links[0]).toContain('gemini-advanced');
    }
  });

  it('MockAdapter simulates OUT_OF_STOCK definite fail', async () => {
    const adapter = new MockAdapter({ latencyMs: 0, failureMode: 'OUT_OF_STOCK' });
    const result = await adapter.buy('SP-GEMINI-1M', 1);
    expect(result.kind).toBe('DEFINITE_FAIL');
    if (result.kind === 'DEFINITE_FAIL') {
      expect(result.reason).toBe('OUT_OF_STOCK');
    }
  });

  it('MockAdapter simulates UNKNOWN timeout fail requiring admin review', async () => {
    const adapter = new MockAdapter({ latencyMs: 0, failureMode: 'UNKNOWN' });
    const result = await adapter.buy('SP-GEMINI-1M', 1);
    expect(result.kind).toBe('UNKNOWN');
    if (result.kind === 'UNKNOWN') {
      expect(result.error).toContain('timeout');
    }
  });
});

