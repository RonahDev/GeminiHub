import { ExternalProduct, BuyResult, SourceAdapter } from '../../domain/adapters/types';

export interface MockAdapterOptions {
  balance?: number;
  currency?: 'VND' | 'USD';
  latencyMs?: number;
  failureMode?: 'NONE' | 'OUT_OF_STOCK' | 'SOURCE_BALANCE' | 'UNKNOWN' | 'AUTH';
  customProducts?: ExternalProduct[];
}

export class MockAdapter implements SourceAdapter {
  private balance: number;
  private currency: 'VND' | 'USD';
  private latencyMs: number;
  private failureMode: string;
  private products: ExternalProduct[];

  constructor(options: MockAdapterOptions = {}) {
    this.balance = options.balance ?? 5_000_000;
    this.currency = options.currency ?? 'VND';
    this.latencyMs = options.latencyMs ?? 150;
    this.failureMode = options.failureMode ?? 'NONE';
    this.products = options.customProducts ?? [
      {
        externalId: 'SP-GEMINI-1M',
        name: 'Gói Gemini Advanced 1 Tháng (Bot Nguồn Test)',
        rawPrice: 17000,
        costVnd: 17000,
        stock: 50,
        description: 'Link kích hoạt Gemini Advanced 1 tháng hạn bảo hành 5 phút',
      },
      {
        externalId: 'SP-GEMINI-1Y',
        name: 'Gói Gemini Advanced 1 Năm (Bot Nguồn Test)',
        rawPrice: 150000,
        costVnd: 150000,
        stock: 20,
        description: 'Link kích hoạt Gemini Advanced 1 năm hạn bảo hành 5 phút',
      },
      {
        externalId: 'SP-GEMINI-OOS',
        name: 'Gói Hết Hàng (Test Failover)',
        rawPrice: 15000,
        costVnd: 15000,
        stock: 0,
        description: 'Mặt hàng luôn báo hết hàng để kiểm thử chuyển nguồn failover',
      },
    ];
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
  }

  async testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    await this.delay();
    const duration = Date.now() - start;
    return {
      ok: true,
      latencyMs: duration,
    };
  }

  async getBalance(): Promise<{ amount: number; currency: 'VND' | 'USD' }> {
    await this.delay();
    return {
      amount: this.balance,
      currency: this.currency,
    };
  }

  async listProducts(): Promise<ExternalProduct[]> {
    await this.delay();
    return [...this.products];
  }

  async getProduct(externalId: string): Promise<ExternalProduct> {
    await this.delay();
    const found = this.products.find((p) => p.externalId === externalId);
    if (!found) {
      throw new Error(`Product not found: ${externalId}`);
    }
    return found;
  }

  async buy(externalId: string, quantity: number): Promise<BuyResult> {
    await this.delay();

    if (this.failureMode === 'UNKNOWN' || externalId.includes('TRIGGER-UNKNOWN')) {
      return {
        kind: 'UNKNOWN',
        error: 'Simulated source timeout / unclear gateway response',
        raw: JSON.stringify({ error: 'Gateway timeout 504', code: 504 }),
      };
    }

    if (this.failureMode === 'OUT_OF_STOCK' || externalId === 'SP-GEMINI-OOS') {
      return {
        kind: 'DEFINITE_FAIL',
        reason: 'OUT_OF_STOCK',
        raw: JSON.stringify({ code: 400, message: 'Sản phẩm đã hết hàng trong kho bot nguồn' }),
      };
    }

    if (this.failureMode === 'SOURCE_BALANCE') {
      return {
        kind: 'DEFINITE_FAIL',
        reason: 'SOURCE_BALANCE',
        raw: JSON.stringify({ code: 400, message: 'Số dư bot nguồn không đủ để thanh toán' }),
      };
    }

    if (this.failureMode === 'AUTH') {
      return {
        kind: 'DEFINITE_FAIL',
        reason: 'AUTH',
        raw: JSON.stringify({ code: 401, message: 'Chữ ký hoặc API ID không hợp lệ' }),
      };
    }

    const product = this.products.find((p) => p.externalId === externalId);
    if (!product) {
      return {
        kind: 'DEFINITE_FAIL',
        reason: 'NOT_FOUND',
        raw: JSON.stringify({ code: 404, message: 'Không tìm thấy sản phẩm nguồn' }),
      };
    }

    if (product.stock < quantity) {
      return {
        kind: 'DEFINITE_FAIL',
        reason: 'OUT_OF_STOCK',
        raw: JSON.stringify({ code: 400, message: 'Tồn kho không đủ' }),
      };
    }

    product.stock -= quantity;
    this.balance -= product.costVnd * quantity;

    const links: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      links.push(`https://one.google.com/explore-plan/gemini-advanced?promo=MOCK-${code}`);
    }

    return {
      kind: 'SUCCESS',
      links,
      raw: JSON.stringify({
        success: true,
        data: {
          orderId: `MOCK-ORDER-${Date.now()}`,
          externalId,
          quantity,
          links,
        },
      }),
    };
  }
}
