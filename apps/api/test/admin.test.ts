import { describe, it, expect, beforeEach } from 'vitest';
import { AdminService } from '../src/application/admin/admin.service';
import { OrderStatus, WalletTxType, OrderItemOrigin } from '@prisma/client';
import { decrypt } from '../src/infrastructure/security/crypto';

process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Feature 7: Admin Interventions & Audit Trail (FR-ADM-01..11)', () => {
  let adminService: AdminService;
  let mockUsers: any[];
  let mockOrders: any[];
  let mockOrderItems: any[];
  let mockWalletTransactions: any[];
  let mockAuditLogs: any[];
  let mockPrisma: any;

  beforeEach(() => {
    mockUsers = [
      {
        id: 'user-admin-target',
        email: 'customer.target@geminihub.vn',
        balance: BigInt(50000),
      },
    ];

    mockOrders = [
      {
        id: 'order-stuck-review',
        code: 'ORD-STUCK-01',
        userId: 'user-admin-target',
        status: OrderStatus.NEEDS_REVIEW,
        quantity: 1,
        totalPrice: BigInt(25000),
        product: {
          id: 'prod-1',
          name: 'Gemini Advanced 1M',
          warrantyMinutes: 5,
        },
      },
      {
        id: 'order-to-refund',
        code: 'ORD-REFUND-02',
        userId: 'user-admin-target',
        status: OrderStatus.PROCESSING,
        quantity: 1,
        totalPrice: BigInt(30000),
      },
    ];

    mockOrderItems = [];
    mockWalletTransactions = [];
    mockAuditLogs = [];

    mockPrisma = {
      order: {
        findUnique: async ({ where }: any) => mockOrders.find((o) => o.id === where.id) || null,
        findUniqueOrThrow: async ({ where }: any) => {
          const found = mockOrders.find((o) => o.id === where.id);
          if (!found) throw new Error('Order not found');
          return found;
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
      user: {
        findUnique: async ({ where }: any) => mockUsers.find((u) => u.id === where.id) || null,
        findUniqueOrThrow: async ({ where }: any) => {
          const user = mockUsers.find((u) => u.id === where.id);
          if (!user) throw new Error('User not found');
          return user;
        },
        update: async ({ where, data }: any) => {
          const user = mockUsers.find((u) => u.id === where.id);
          if (data.balance?.increment) {
            user.balance += BigInt(data.balance.increment);
          }
          return user;
        },
      },
      walletTransaction: {
        create: async ({ data }: any) => {
          const tx = { id: `wtx-${mockWalletTransactions.length + 1}`, ...data };
          mockWalletTransactions.push(tx);
          return tx;
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          const log = { id: `audit-${mockAuditLogs.length + 1}`, createdAt: new Date(), ...data };
          mockAuditLogs.push(log);
          return log;
        },
      },
      topup: {
        aggregate: async () => ({ _sum: { paidAmount: BigInt(0) } }),
      },
      source: {
        count: async () => 0,
        findMany: async () => [],
      },
      product: {
        count: async () => 0,
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    adminService = new AdminService(mockPrisma);
  });

  // TC-ADM-01
  it('TC-ADM-01: Admin gán link thủ công cho đơn hàng bị kẹt ở trạng thái NEEDS_REVIEW', async () => {
    const manualLink = 'https://one.google.com/promo=ADMIN-MANUAL-DELIVERY-123';
    const adminNote = 'Đã đối soát với bot Telegram và cấp link bù cho khách';

    const updated = await adminService.fulfillManual(
      'order-stuck-review',
      [manualLink],
      adminNote,
      'admin-actor-id'
    );

    expect(updated.status).toBe(OrderStatus.COMPLETED);
    expect(updated.failReason).toContain('Hoàn tất thủ công bởi Admin');

    // Link item saved encrypted
    expect(mockOrderItems.length).toBe(1);
    expect(mockOrderItems[0].origin).toBe(OrderItemOrigin.MANUAL);
    expect(decrypt(mockOrderItems[0].linkEncrypted)).toBe(manualLink);

    // Audit log recorded
    expect(mockAuditLogs.length).toBe(1);
    expect(mockAuditLogs[0].action).toBe('ORDER_FULFILL_MANUAL');
    expect(mockAuditLogs[0].target).toContain('order-stuck-review');
  });

  // TC-ADM-02
  it('TC-ADM-02: Admin hoàn tiền đơn hàng thủ công vào ví khách và ghi nhận sổ cái', async () => {
    // Initial balance: 50,000 VND
    expect(mockUsers[0].balance).toBe(BigInt(50000));

    const updated = await adminService.refundOrder(
      'order-to-refund',
      'Nguồn bot hỏng không giao link',
      'admin-actor-id'
    );

    expect(updated.status).toBe(OrderStatus.REFUNDED);

    // Customer balance credited with 30,000 VND -> 80,000 VND
    expect(mockUsers[0].balance).toBe(BigInt(80000));

    // Ledger entry recorded
    expect(mockWalletTransactions.length).toBe(1);
    expect(mockWalletTransactions[0].type).toBe(WalletTxType.REFUND);
    expect(mockWalletTransactions[0].amount).toBe(BigInt(30000));

    // Audit log recorded
    expect(mockAuditLogs.length).toBe(1);
    expect(mockAuditLogs[0].action).toBe('ORDER_REFUND');
  });

  // TC-ADM-03
  it('TC-ADM-03: Admin điều chỉnh tăng/giảm số dư của khách hàng kèm lý do kiểm toán', async () => {
    // Top-up bonus 20,000 VND
    const adjustRes = await adminService.adjustBalance(
      'user-admin-target',
      20000,
      'Thưởng khách hàng thân thiết',
      'admin-actor-id'
    );

    expect(adjustRes.newBalance).toBe(70000);
    expect(mockUsers[0].balance).toBe(BigInt(70000));

    expect(mockWalletTransactions.length).toBe(1);
    expect(mockWalletTransactions[0].type).toBe(WalletTxType.ADJUST);
    expect(mockWalletTransactions[0].amount).toBe(BigInt(20000));

    expect(mockAuditLogs.length).toBe(1);
    expect(mockAuditLogs[0].action).toBe('WALLET_ADJUST');
  });

  // TC-ADM-04
  it('TC-ADM-04: Ngăn chặn điều chỉnh trừ tiền vượt quá số dư hiện có của khách hàng', async () => {
    // Current balance: 50,000 VND. Deducting 60,000 VND must be rejected!
    await expect(
      adminService.adjustBalance(
        'user-admin-target',
        -60000,
        'Trừ tiền phạt gian lận',
        'admin-actor-id'
      )
    ).rejects.toThrow('Số dư của khách không đủ để trừ');

    // Balance remains unchanged
    expect(mockUsers[0].balance).toBe(BigInt(50000));
  });

  // TC-ADM-05
  it('TC-ADM-05: Tính toán báo cáo tài chính Dashboard (Doanh thu, Giá vốn, Lợi nhuận và Cảnh báo)', async () => {
    // Setup mock query responses for dashboard
    mockPrisma.order.findMany = async () => [
      { totalPrice: BigInt(30000), unitCost: BigInt(18000), quantity: 1 },
      { totalPrice: BigInt(50000), unitCost: BigInt(34000), quantity: 2 },
    ];
    mockPrisma.topup.aggregate = async () => ({ _sum: { paidAmount: BigInt(150000) } });
    mockPrisma.order.groupBy = async () => [
      { status: 'COMPLETED', _count: { id: 2 } },
    ];
    mockPrisma.user.count = async () => 5;
    mockPrisma.order.count = async () => 1;
    mockPrisma.source.count = async () => 0;
    mockPrisma.product.count = async () => 0;
    mockPrisma.source.findMany = async () => [
      { id: 'src-1', name: 'Bot 1', balance: BigInt(50000), lowBalanceAlert: BigInt(100000) },
    ];

    const stats = await adminService.getDashboard();

    expect(stats.financials).toBeDefined();
    // Revenue: 30,000 + 50,000 = 80,000đ
    // Cost: 18,000*1 + 34,000*2 = 86,000đ
    expect(stats.financials.today.revenue).toBe(80000);
    expect(stats.financials.today.cost).toBe(86000);
    expect(stats.financials.totalTopupCompleted).toBe(150000);
    expect(stats.alerts.lowBalanceSourcesCount).toBe(1);
    expect(stats.alerts.lowBalanceSourcesList[0].name).toBe('Bot 1');
  });
});
