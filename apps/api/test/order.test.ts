import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from '../src/application/order/order.service';
import { OrderStatus, WalletTxType, OrderItemOrigin } from '@prisma/client';
import { encrypt } from '../src/infrastructure/security/crypto';

// Ensure encryption key is available
process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock source adapter factory
let mockBuyImplementation: (externalProductId: string, quantity: number) => Promise<any>;

vi.mock('../src/infrastructure/adapters/factory', () => ({
  createSourceAdapter: () => ({
    buy: (productId: string, qty: number) => mockBuyImplementation(productId, qty),
  }),
}));

describe('Feature 4: Order Purchasing Pipeline & 2-Phase Commit Failover (UC-02, Section 6.4)', () => {
  let orderService: OrderService;
  let mockUsers: any[];
  let mockOrders: any[];
  let mockOrderItems: any[];
  let mockSourceCalls: any[];
  let mockWalletTransactions: any[];
  let mockSources: any[];
  let mockSourceProducts: any[];
  let mockPrisma: any;

  beforeEach(() => {
    mockUsers = [
      {
        id: 'user-order-1',
        email: 'customer@geminihub.vn',
        balance: BigInt(100000), // 100,000 VND
        status: 'ACTIVE',
      },
    ];

    mockSources = [
      {
        id: 'source-1',
        name: 'Primary Telegram Bot',
        adapterType: 'TELE_API',
        status: 'ACTIVE',
        balance: BigInt(500000),
        consecutiveErrors: 0,
      },
      {
        id: 'source-2',
        name: 'Backup Telegram Bot',
        adapterType: 'TELE_API',
        status: 'ACTIVE',
        balance: BigInt(500000),
        consecutiveErrors: 0,
      },
    ];

    mockSourceProducts = [
      {
        id: 'sp-1',
        sourceId: 'source-1',
        externalId: 'EXT-GEMINI-1',
        costVnd: BigInt(17000),
        stock: 10,
        source: mockSources[0],
      },
      {
        id: 'sp-2',
        sourceId: 'source-2',
        externalId: 'EXT-GEMINI-2',
        costVnd: BigInt(18500),
        stock: 10,
        source: mockSources[1],
      },
    ];

    mockOrders = [];
    mockOrderItems = [];
    mockSourceCalls = [];
    mockWalletTransactions = [];

    mockPrisma = {
      user: {
        findUnique: async ({ where }: any) => mockUsers.find((u) => u.id === where.id) || null,
        findUniqueOrThrow: async ({ where }: any) => {
          const user = mockUsers.find((u) => u.id === where.id);
          if (!user) throw new Error('User not found');
          return user;
        },
        updateMany: async ({ where, data }: any) => {
          const user = mockUsers.find((u) => u.id === where.id);
          if (user && user.balance >= where.balance.gte) {
            user.balance = user.balance - BigInt(data.balance.decrement);
            return { count: 1 };
          }
          return { count: 0 };
        },
        update: async ({ where, data }: any) => {
          const user = mockUsers.find((u) => u.id === where.id);
          if (data.balance?.increment) {
            user.balance = user.balance + BigInt(data.balance.increment);
          }
          return user;
        },
      },
      product: {
        findUnique: async () => ({
          id: 'prod-gemini-1m',
          name: 'Gemini Advanced 1 Tháng',
          slug: 'gemini-advanced-1m',
          currentPrice: BigInt(25000),
          minMarginAmount: BigInt(3000),
          maxPerOrder: 5,
          warrantyMinutes: 5,
          isActive: true,
          routingStrategy: 'PRIORITY',
          sources: [
            {
              priority: 1,
              enabled: true,
              broken: false,
              sourceProduct: mockSourceProducts[0],
            },
            {
              priority: 2,
              enabled: true,
              broken: false,
              sourceProduct: mockSourceProducts[1],
            },
          ],
        }),
      },
      order: {
        findUnique: async ({ where }: any) => {
          if (where.userId_idempotencyKey) {
            const found = mockOrders.find(
              (o) =>
                o.userId === where.userId_idempotencyKey.userId &&
                o.idempotencyKey === where.userId_idempotencyKey.idempotencyKey
            );
            if (!found) return null;
            return { ...found, items: mockOrderItems.filter((i) => i.orderId === found.id) };
          }
          return mockOrders.find((o) => o.id === where.id) || null;
        },
        create: async ({ data }: any) => {
          const order = { id: `order-${mockOrders.length + 1}`, ...data };
          mockOrders.push(order);
          return order;
        },
        update: async ({ where, data }: any) => {
          const order = mockOrders.find((o) => o.id === where.id);
          Object.assign(order, data);
          return order;
        },
      },
      orderItem: {
        create: async ({ data }: any) => {
          const item = { id: `item-${mockOrderItems.length + 1}`, ...data };
          mockOrderItems.push(item);
          return item;
        },
      },
      sourceCall: {
        create: async ({ data }: any) => {
          const call = { id: `call-${mockSourceCalls.length + 1}`, ...data };
          mockSourceCalls.push(call);
          return call;
        },
      },
      source: {
        update: async ({ where, data }: any) => {
          const src = mockSources.find((s) => s.id === where.id);
          if (data.consecutiveErrors?.increment) {
            src.consecutiveErrors += data.consecutiveErrors.increment;
          } else if (data.consecutiveErrors !== undefined) {
            src.consecutiveErrors = data.consecutiveErrors;
          }
          if (data.status) src.status = data.status;
          return src;
        },
      },
      sourceProduct: {
        update: async ({ where, data }: any) => {
          const sp = mockSourceProducts.find((p) => p.id === where.id);
          if (data.stock?.decrement) {
            sp.stock -= data.stock.decrement;
          } else if (data.stock !== undefined) {
            sp.stock = data.stock;
          }
          return sp;
        },
      },
      walletTransaction: {
        create: async ({ data }: any) => {
          const tx = { id: `wtx-${mockWalletTransactions.length + 1}`, ...data };
          mockWalletTransactions.push(tx);
          return tx;
        },
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    orderService = new OrderService(mockPrisma);
  });

  // TC-ORD-01
  it('TC-ORD-01: Mua hàng thành công với 2-Phase Commit (trừ ví tạm thời, cấp link mã hóa, chuyển COMPLETED)', async () => {
    // Arrange: Mock source returns success with activation link
    mockBuyImplementation = async () => ({
      kind: 'SUCCESS',
      links: ['https://one.google.com/explore-plan/gemini-advanced?promo=PROMO-SUCCESS-123'],
      raw: '{"status":"ok"}',
    });

    // Act: Purchase 1 unit (Price 25,000 VND)
    const result = await orderService.purchase({
      userId: 'user-order-1',
      productId: 'prod-gemini-1m',
      quantity: 1,
      idempotencyKey: 'IDEMP-TEST-01',
      mustUseAcknowledged: true,
    });

    // Assert
    expect(result.status).toBe(OrderStatus.COMPLETED);
    expect(result.links.length).toBe(1);
    expect(result.links[0]).toContain('gemini-advanced');
    expect(result.totalPrice).toBe(25000);

    // User balance decremented from 100,000 to 75,000
    expect(mockUsers[0].balance).toBe(BigInt(75000));

    // Ledger record created
    expect(mockWalletTransactions.length).toBe(1);
    expect(mockWalletTransactions[0].type).toBe(WalletTxType.PURCHASE);
    expect(mockWalletTransactions[0].amount).toBe(BigInt(-25000));

    // Source call logged
    expect(mockSourceCalls.length).toBe(1);
    expect(mockSourceCalls[0].result).toBe('SUCCESS');
  });

  // TC-ORD-02
  it('TC-ORD-02: Chống gửi lệnh mua trùng lặp bằng Idempotency Key (FR-ORD-04)', async () => {
    mockBuyImplementation = async () => ({
      kind: 'SUCCESS',
      links: ['https://one.google.com/promo=DUP-KEY-TEST'],
    });

    const firstOrder = await orderService.purchase({
      userId: 'user-order-1',
      productId: 'prod-gemini-1m',
      quantity: 1,
      idempotencyKey: 'IDEMP-DUPLICATE-KEY',
      mustUseAcknowledged: true,
    });

    expect(firstOrder.status).toBe(OrderStatus.COMPLETED);
    expect(mockUsers[0].balance).toBe(BigInt(75000));

    // Second request with SAME idempotency key
    const secondOrder = await orderService.purchase({
      userId: 'user-order-1',
      productId: 'prod-gemini-1m',
      quantity: 1,
      idempotencyKey: 'IDEMP-DUPLICATE-KEY',
      mustUseAcknowledged: true,
    });

    // Must return the exact existing order without re-deducting balance!
    expect(secondOrder.id).toBe(firstOrder.id);
    expect(mockUsers[0].balance).toBe(BigInt(75000)); // Still 75,000
    expect(mockOrders.length).toBe(1); // Only 1 order created in DB
  });

  // TC-ORD-03
  it('TC-ORD-03: Tự động Failover sang nguồn dự phòng khi nguồn chính báo hết hàng (DEFINITE_FAIL)', async () => {
    let callCount = 0;
    mockBuyImplementation = async (extId) => {
      callCount++;
      if (extId === 'EXT-GEMINI-1') {
        // Source 1 is OUT_OF_STOCK
        return { kind: 'DEFINITE_FAIL', reason: 'OUT_OF_STOCK' };
      }
      // Source 2 (Backup) succeeds!
      return {
        kind: 'SUCCESS',
        links: ['https://one.google.com/promo=BACKUP-SUCCESS'],
      };
    };

    const order = await orderService.purchase({
      userId: 'user-order-1',
      productId: 'prod-gemini-1m',
      quantity: 1,
      idempotencyKey: 'IDEMP-FAILOVER-TEST',
      mustUseAcknowledged: true,
    });

    // Succeeded via failover to secondary source
    expect(order.status).toBe(OrderStatus.COMPLETED);
    expect(order.links[0]).toContain('BACKUP-SUCCESS');
    expect(callCount).toBe(2); // Called source 1 then source 2
    expect(mockSourceCalls.length).toBe(2);
    expect(mockSourceCalls[0].result).toBe('DEFINITE_FAIL');
    expect(mockSourceCalls[1].result).toBe('SUCCESS');
  });

  // TC-ORD-04
  it('TC-ORD-04: Tự động hoàn tiền 100% vào ví khách khi tất cả nguồn dự phòng đều hết hàng', async () => {
    // Both sources definite fail
    mockBuyImplementation = async () => ({
      kind: 'DEFINITE_FAIL',
      reason: 'OUT_OF_STOCK',
    });

    const order = await orderService.purchase({
      userId: 'user-order-1',
      productId: 'prod-gemini-1m',
      quantity: 1,
      idempotencyKey: 'IDEMP-REFUND-TEST',
      mustUseAcknowledged: true,
    });

    expect(order.status).toBe(OrderStatus.FAILED);
    expect(order.failReason).toContain('OUT_OF_STOCK');

    // User's balance was refunded back to original 100,000 VND
    expect(mockUsers[0].balance).toBe(BigInt(100000));

    // Ledger has two records: 1 PURCHASE (-25,000) and 1 REFUND (+25,000)
    expect(mockWalletTransactions.length).toBe(2);
    expect(mockWalletTransactions[1].type).toBe(WalletTxType.REFUND);
    expect(mockWalletTransactions[1].amount).toBe(BigInt(25000));
  });

  // TC-ORD-05
  it('TC-ORD-05: Chuyển đơn sang NEEDS_REVIEW và tăng consecutiveErrors khi nguồn gặp lỗi UNKNOWN', async () => {
    // Network timeout / unknown 5xx error
    mockBuyImplementation = async () => ({
      kind: 'UNKNOWN',
      error: 'Gateway Timeout 504 from Telegram Bot',
    });

    const order = await orderService.purchase({
      userId: 'user-order-1',
      productId: 'prod-gemini-1m',
      quantity: 1,
      idempotencyKey: 'IDEMP-UNKNOWN-TEST',
      mustUseAcknowledged: true,
    });

    // As per SRS Section 6.4 Step 5c:
    // DO NOT retry! DO NOT failover! DO NOT auto-refund!
    // Transition to NEEDS_REVIEW for admin manual review to avoid double delivery risk.
    expect(order.status).toBe(OrderStatus.NEEDS_REVIEW);
    expect(order.failReason).toContain('Admin đối soát');

    // Balance is kept on hold (75,000đ remaining)
    expect(mockUsers[0].balance).toBe(BigInt(75000));

    // Circuit breaker error incremented on source 1
    expect(mockSources[0].consecutiveErrors).toBe(1);
  });
});

