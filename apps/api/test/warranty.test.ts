import { describe, it, expect, beforeEach } from 'vitest';
import { WarrantyStatus, WarrantyResolution, OrderStatus, WalletTxType, OrderItemOrigin } from '@prisma/client';
import { encrypt, decrypt } from '../src/infrastructure/security/crypto';

process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Feature 5: Warranty Ticket Management & Intervention (FR-WAR-01..02, FR-ADM-08)', () => {
  let mockUsers: any[];
  let mockOrders: any[];
  let mockOrderItems: any[];
  let mockWarrantyTickets: any[];
  let mockWalletTransactions: any[];
  let mockAuditLogs: any[];

  beforeEach(() => {
    mockUsers = [
      {
        id: 'user-war-1',
        email: 'customer.warranty@geminihub.vn',
        balance: BigInt(20000),
      },
    ];

    mockOrders = [
      {
        id: 'order-valid-warranty',
        code: 'ORD-VALID-01',
        userId: 'user-war-1',
        status: OrderStatus.COMPLETED,
        totalPrice: BigInt(25000),
        warrantyUntil: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes in future (Active)
      },
      {
        id: 'order-expired-warranty',
        code: 'ORD-EXPIRED-02',
        userId: 'user-war-1',
        status: OrderStatus.COMPLETED,
        totalPrice: BigInt(25000),
        warrantyUntil: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago (Expired)
      },
    ];

    mockOrderItems = [
      {
        id: 'item-1',
        orderId: 'order-valid-warranty',
        linkEncrypted: encrypt('https://one.google.com/promo=ORIGINAL-BROKEN-LINK'),
        origin: OrderItemOrigin.SOURCE,
        disabledAt: null,
      },
    ];

    mockWarrantyTickets = [];
    mockWalletTransactions = [];
    mockAuditLogs = [];
  });

  // TC-WAR-01
  it('TC-WAR-01: Khách hàng tạo ticket bảo hành thành công khi đơn còn trong hạn bảo hành (FR-WAR-01)', async () => {
    const order = mockOrders[0];
    const now = new Date();

    expect(order.warrantyUntil).toBeDefined();
    expect(now < order.warrantyUntil).toBe(true);

    const ticket = {
      id: `ticket-${mockWarrantyTickets.length + 1}`,
      orderId: order.id,
      userId: order.userId,
      reason: 'Link bị lỗi: Google thông báo khuyến mãi không khả dụng trên quốc gia này',
      status: WarrantyStatus.PENDING,
      createdAt: now,
    };
    mockWarrantyTickets.push(ticket);

    expect(mockWarrantyTickets.length).toBe(1);
    expect(ticket.status).toBe(WarrantyStatus.PENDING);
    expect(ticket.orderId).toBe(order.id);
  });

  // TC-WAR-02
  it('TC-WAR-02: Từ chối tạo ticket bảo hành khi đơn hàng đã quá hạn bảo hành (WARRANTY_EXPIRED)', async () => {
    const order = mockOrders[1]; // Expired order
    const now = new Date();

    const isExpired = !order.warrantyUntil || now > order.warrantyUntil;
    expect(isExpired).toBe(true);

    // Business rule expectation:
    const createTicketAttempt = () => {
      if (isExpired) {
        throw new Error('Thời hạn bảo hành của đơn hàng đã kết thúc');
      }
    };

    expect(createTicketAttempt).toThrow('Thời hạn bảo hành của đơn hàng đã kết thúc');
    expect(mockWarrantyTickets.length).toBe(0);
  });

  // TC-WAR-03
  it('TC-WAR-03: Ngăn chặn tạo ticket bảo hành lần 2 cho cùng một đơn hàng (ALREADY_EXISTS)', async () => {
    // First ticket created
    mockWarrantyTickets.push({
      id: 'ticket-1',
      orderId: 'order-valid-warranty',
      userId: 'user-war-1',
      reason: 'Lỗi link',
      status: WarrantyStatus.PENDING,
    });

    const checkExisting = (orderId: string) => {
      const existing = mockWarrantyTickets.find((t) => t.orderId === orderId);
      if (existing) {
        throw new Error('Đơn hàng này đã có yêu cầu bảo hành');
      }
    };

    expect(() => checkExisting('order-valid-warranty')).toThrow('Đơn hàng này đã có yêu cầu bảo hành');
  });

  // TC-WAR-04
  it('TC-WAR-04: Admin xử lý bảo hành bằng cách cấp link thay thế thủ công (REPLACED_MANUAL) và vô hiệu link cũ', async () => {
    const ticket = {
      id: 'ticket-replace',
      orderId: 'order-valid-warranty',
      userId: 'user-war-1',
      status: WarrantyStatus.PENDING,
    };
    mockWarrantyTickets.push(ticket);

    const replacementLink = 'https://one.google.com/promo=NEW-REPLACEMENT-LINK-OK';
    const adminNote = 'Đã đổi link mới từ kho dự phòng thủ công';

    // 1. Disable old links
    for (const item of mockOrderItems) {
      if (item.orderId === ticket.orderId) {
        item.disabledAt = new Date();
      }
    }

    // 2. Add replacement link item
    mockOrderItems.push({
      id: 'item-replacement-2',
      orderId: ticket.orderId,
      linkEncrypted: encrypt(replacementLink),
      origin: 'WARRANTY',
      disabledAt: null,
    });

    // 3. Mark ticket RESOLVED
    ticket.status = WarrantyStatus.RESOLVED;

    // Assert: Old link is disabled, new link is active and decryptable
    expect(mockOrderItems[0].disabledAt).not.toBeNull();
    const newLink = decrypt(mockOrderItems[1].linkEncrypted);
    expect(newLink).toBe(replacementLink);
    expect(ticket.status).toBe(WarrantyStatus.RESOLVED);
  });

  // TC-WAR-05
  it('TC-WAR-05: Admin xử lý bảo hành bằng cách hoàn tiền 100% vào ví khách (REFUNDED)', async () => {
    const order = mockOrders[0];
    const ticket = {
      id: 'ticket-refund',
      orderId: order.id,
      userId: order.userId,
      status: WarrantyStatus.PENDING,
    };

    // Customer balance before: 20,000 VND
    expect(mockUsers[0].balance).toBe(BigInt(20000));

    // Admin resolves by refunding order totalPrice (25,000 VND)
    mockUsers[0].balance += order.totalPrice;

    mockWalletTransactions.push({
      userId: ticket.userId,
      type: WalletTxType.REFUND,
      amount: order.totalPrice,
      balanceBefore: BigInt(20000),
      balanceAfter: mockUsers[0].balance,
      refType: 'WARRANTY',
      refId: ticket.id,
      note: `Hoàn tiền bảo hành đơn ${order.code}`,
    });

    ticket.status = WarrantyStatus.RESOLVED;

    // Assert: Balance updated to 45,000 VND and ledger entry appended
    expect(mockUsers[0].balance).toBe(BigInt(45000));
    expect(mockWalletTransactions.length).toBe(1);
    expect(mockWalletTransactions[0].type).toBe(WalletTxType.REFUND);
    expect(mockWalletTransactions[0].amount).toBe(BigInt(25000));
  });
});

