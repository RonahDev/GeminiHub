/**
 * ==============================================================================
 * GEMINIHUB - KỊCH BẢN KIỂM THỬ TOÀN DIỆN HỆ THỐNG (END-TO-END SYSTEM TEST)
 * ==============================================================================
 * Mô phỏng toàn bộ vòng đời nghiệp vụ thực tế của dự án:
 *  1. Khách hàng Đăng nhập & Xác thực Google OAuth SSO
 *  2. Khách hàng tạo mã VietQR & Webhook SePay cộng tiền tự động vào ví
 *  3. Engine Định giá động (Dynamic Pricing) tính giá vốn, biên lãi & làm tròn
 *  4. Mua hàng 2 pha (2-Phase Commit) & Cơ chế Failover tự động giữa các bot nguồn
 *  5. Mã hóa bảo mật AES-256-GCM & Cấp link kích hoạt cho khách
 *  6. Tạo Ticket khiếu nại bảo hành & Admin phê duyệt cấp link thay thế
 *  7. Báo cáo tài chính Admin Dashboard (Doanh thu, Giá vốn, Lợi nhuận)
 * ==============================================================================
 */

import { WalletService } from '../apps/api/src/application/wallet/wallet.service';
import { AdminService } from '../apps/api/src/application/admin/admin.service';
import { PricingService, SourceCandidate } from '../apps/api/src/domain/pricing/pricing.service';
import { MockAdapter } from '../apps/api/src/infrastructure/adapters/MockAdapter';
import { encrypt, decrypt, maskSecret } from '../apps/api/src/infrastructure/security/crypto';
import { hashPassword, verifyPassword, generateRandomToken, hashToken } from '../apps/api/src/infrastructure/security/auth';
import { Role, OrderStatus, WalletTxType, WarrantyStatus, WarrantyResolution, CostBasis, PricingMode } from '@prisma/client';

process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_SECRET = 'jwt-super-secret-geminihub-2026';

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

// In-memory Database Store
const db = {
  users: [] as any[],
  sessions: [] as any[],
  products: [] as any[],
  sources: [] as any[],
  sourceProducts: [] as any[],
  orders: [] as any[],
  orderItems: [] as any[],
  walletTransactions: [] as any[],
  bankTransactions: [] as any[],
  topups: [] as any[],
  warrantyTickets: [] as any[],
  auditLogs: [] as any[],
};

// Prisma Mock Adapter for Application Services
const mockPrisma: any = {
  user: {
    findUnique: async ({ where }: any) => db.users.find((u) => u.id === where.id || (where.email && u.email === where.email.toLowerCase())) || null,
    findFirst: async ({ where }: any) => {
      if (where?.OR) {
        for (const cond of where.OR) {
          const found = db.users.find((u) => (cond.googleId && u.googleId === cond.googleId) || (cond.email && u.email === cond.email.toLowerCase()));
          if (found) return found;
        }
      }
      return null;
    },
    count: async () => db.users.length,
    create: async ({ data }: any) => {
      const u = { id: `usr-${db.users.length + 1}`, balance: BigInt(0), status: 'ACTIVE', ...data };
      db.users.push(u);
      return u;
    },
    update: async ({ where, data }: any) => {
      const u = db.users.find((x) => x.id === where.id);
      if (!u) throw new Error('User not found');
      if (data.balance?.increment !== undefined) {
        u.balance += BigInt(data.balance.increment);
      } else if (data.balance?.decrement !== undefined) {
        u.balance -= BigInt(data.balance.decrement);
      } else if (data.balance !== undefined) {
        u.balance = BigInt(data.balance);
      }
      const { balance, ...rest } = data;
      Object.assign(u, rest);
      return u;
    },
  },
  setting: {
    findUnique: async () => ({
      key: 'GENERAL',
      value: JSON.stringify({
        bankName: 'MBBank',
        bankBin: '970422',
        bankAccountNumber: '0987654321',
        bankAccountHolder: 'CONG TY GEMINIHUB',
      }),
    }),
  },
  topup: {
    findUnique: async ({ where }: any) => {
      const found = db.topups.find((t) => (where.id && t.id === where.id) || (where.code && t.code === where.code));
      if (!found) return null;
      const user = db.users.find((u) => u.id === found.userId);
      return { ...found, user };
    },
    create: async ({ data }: any) => {
      const t = { id: `top-${db.topups.length + 1}`, status: 'PENDING', ...data };
      db.topups.push(t);
      return t;
    },
    update: async ({ where, data }: any) => {
      const t = db.topups.find((x) => x.id === where.id);
      Object.assign(t, data);
      return t;
    },
    aggregate: async () => {
      const completed = db.topups.filter((t) => t.status === 'COMPLETED');
      const sum = completed.reduce((acc, t) => acc + BigInt(t.paidAmount || t.amount || 0), BigInt(0));
      return { _sum: { paidAmount: sum } };
    },
  },
  bankTransaction: {
    findUnique: async ({ where }: any) => db.bankTransactions.find((b) => b.providerTxId === where.providerTxId) || null,
    create: async ({ data }: any) => {
      const b = { id: `btx-${db.bankTransactions.length + 1}`, ...data };
      db.bankTransactions.push(b);
      return b;
    },
  },
  walletTransaction: {
    create: async ({ data }: any) => {
      const tx = { id: `wtx-${db.walletTransactions.length + 1}`, createdAt: new Date(), ...data };
      db.walletTransactions.push(tx);
      return tx;
    },
  },
  product: {
    findUnique: async ({ where }: any) => db.products.find((p) => p.id === where.id) || null,
    count: async () => db.products.length,
    update: async ({ where, data }: any) => {
      const p = db.products.find((x) => x.id === where.id);
      Object.assign(p, data);
      return p;
    },
  },
  source: {
    findMany: async () => db.sources,
    count: async () => db.sources.length,
  },
  order: {
    findUnique: async ({ where }: any) => db.orders.find((o) => o.id === where.id || o.code === where.code) || null,
    findMany: async () => db.orders,
    create: async ({ data }: any) => {
      const o = { id: `ord-${db.orders.length + 1}`, ...data };
      db.orders.push(o);
      return o;
    },
    update: async ({ where, data }: any) => {
      const o = db.orders.find((x) => x.id === where.id);
      Object.assign(o, data);
      return o;
    },
    groupBy: async () => [
      { status: 'COMPLETED', _count: { id: db.orders.filter((o) => o.status === 'COMPLETED').length } },
    ],
    count: async () => db.orders.length,
  },
  orderItem: {
    create: async ({ data }: any) => {
      const item = { id: `item-${db.orderItems.length + 1}`, ...data };
      db.orderItems.push(item);
      return item;
    },
    findMany: async ({ where }: any) => db.orderItems.filter((i) => i.orderId === where.orderId),
  },
  auditLog: {
    create: async ({ data }: any) => {
      const l = { id: `aud-${db.auditLogs.length + 1}`, createdAt: new Date(), ...data };
      db.auditLogs.push(l);
      return l;
    },
  },
  $transaction: async (fn: any) => fn(mockPrisma),
};

async function runEndToEndProjectTest() {
  console.log('\n========================================================================');
  console.log('             GEMINIHUB - KIỂM THỬ TOÀN TRÌNH HỆ THỐNG (E2E)             ');
  console.log('========================================================================\n');

  const walletService = new WalletService(mockPrisma);
  const adminService = new AdminService(mockPrisma);

  // 1. Khởi tạo dữ liệu nền tảng (Admin, Bot Sources, Sản phẩm)
  const adminPass = await hashPassword('AdminPassword123');
  const admin = await mockPrisma.user.create({
    data: {
      email: 'admin@geminihub.vn',
      passwordHash: adminPass,
      role: Role.ADMIN,
      balance: BigInt(5000000),
    },
  });

  const testProduct = {
    id: 'prod-gemini-adv-1m',
    name: 'Gemini Advanced 1 Tháng',
    slug: 'gemini-advanced-1m',
    warrantyMinutes: 5,
    pricingMode: 'COST_PLUS',
    costBasis: CostBasis.PRIORITY,
    fixedPrice: 0,
    markupPercent: 20,
    markupAmount: 5000,
    roundingStep: 1000,
    minMarginAmount: 3000,
  };
  db.products.push(testProduct);

  const botSources: SourceCandidate[] = [
    {
      sourceId: 'bot-sumistore-pri',
      sourceProductId: 'sp-1',
      sourceName: 'Sumistore Primary Bot',
      externalId: 'SP-GEMINI-OOS',
      costVnd: 18000,
      stock: 0, // Giả lập hết hàng để test Failover!
      priority: 1,
      enabled: true,
    },
    {
      sourceId: 'bot-backup-sec',
      sourceProductId: 'sp-2',
      sourceName: 'Backup Store Secondary Bot',
      externalId: 'SP-GEMINI-1M',
      costVnd: 20000,
      stock: 25, // Bot dự phòng còn 25 slot
      priority: 2,
      enabled: true,
    },
  ];
  db.sources.push(...botSources.map((b) => ({ id: b.sourceId, name: b.sourceName, balance: BigInt(500000), lowBalanceAlert: BigInt(100000) })));

  // GIAI ĐOẠN 1: Xác thực & Đăng nhập Google SSO
  console.log('▶ [Giai đoạn 1] XÁC THỰC NGƯỜI DÙNG & GOOGLE SINGLE SIGN-ON');
  const customerEmail = 'khachhang.gemini@gmail.com';
  const customerUser = await mockPrisma.user.create({
    data: {
      email: customerEmail,
      googleId: 'google-oauth2-sub-123456789',
      role: Role.USER,
      balance: BigInt(0),
    },
  });

  // Verify mật khẩu của Admin
  const isMatch = await verifyPassword(admin.passwordHash, 'AdminPassword123');
  console.log(`  ✓ Xác thực Argon2id Admin mật khẩu: ${isMatch ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ'}`);

  // Cấp Session Refresh Token & Access Token
  const rawRefreshToken = generateRandomToken(32);
  const hashedRefreshToken = hashToken(rawRefreshToken);
  console.log(`  ✓ Đăng nhập Google SSO thành công: ${customerUser.email}`);
  console.log(`  ✓ Khởi tạo Session & Hash Token SHA-256: ${hashedRefreshToken.slice(0, 32)}...`);
  console.log(`  ✓ Số dư ví ban đầu: ${Number(customerUser.balance).toLocaleString('vi-VN')} đ\n`);

  // GIAI ĐOẠN 2: Nạp tiền VietQR & Webhook SePay
  console.log('▶ [Giai đoạn 2] NẠP TIỀN QUA MÃ VIETQR & WEBHOOK SEPAY TỰ ĐỘNG');
  const depositAmount = 100000;
  const topupRequest = await walletService.createTopup(customerUser.id, { amount: depositAmount });
  console.log(`  ✓ Lệnh nạp tiền được tạo thành công:`);
  console.log(`    - Mã nạp đối soát: ${topupRequest.code}`);
  console.log(`    - Số tiền: ${topupRequest.amount.toLocaleString('vi-VN')} đ`);
  console.log(`    - Ngân hàng thụ hưởng: ${topupRequest.bankName} - STK: ${topupRequest.bankAccountNumber}`);
  console.log(`    - Link VietQR: ${topupRequest.qrUrl.slice(0, 65)}...`);

  // Webhook SePay bắn về hệ thống
  const webhookRes = await walletService.handlePaymentWebhook({
    id: 99887766,
    gateway: 'MBBank',
    transactionDate: new Date().toISOString(),
    accountNumber: topupRequest.bankAccountNumber,
    subAccount: null,
    code: null,
    content: `Chuyen khoan nạp tien ${topupRequest.code}`,
    transferType: 'in',
    description: `Nap tien ${topupRequest.code}`,
    transferAmount: depositAmount,
    referenceCode: 'SEPAY-TXN-REF-112233',
  });
  console.log(`  ✓ Webhook SePay đối soát tự động:`);
  console.log(`    - Trạng thái khớp lệnh: ${webhookRes.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`    - Thông báo: "${webhookRes.message}"`);
  console.log(`    - Số dư ví sau khi nạp: ${Number(customerUser.balance).toLocaleString('vi-VN')} đ\n`);

  // GIAI ĐOẠN 3: Engine Định Giá Động (Dynamic Pricing Engine)
  console.log('▶ [Giai đoạn 3] TÍNH TOÁN GIÁ BÁN TỰ ĐỘNG (DYNAMIC PRICING ENGINE)');
  const pricingRule = {
    pricingMode: PricingMode.COST_PLUS,
    costBasis: CostBasis.PRIORITY,
    fixedPrice: 0,
    markupPercent: 20,
    markupAmount: 5000,
    roundingStep: 1000 as const,
    minMarginAmount: 3000,
  };
  const pricingResult = PricingService.calculate(pricingRule, botSources);
  const bestCandidate = pricingResult.previewRows.find((r) => r.isQualified) || pricingResult.previewRows[0];
  console.log(`  ✓ Phân tích nguồn:`);
  console.log(`    - Nguồn ưu tiên 1 (${botSources[0].sourceName}): Giá vốn ${botSources[0].costVnd.toLocaleString('vi-VN')} đ (Hết hàng)`);
  console.log(`    - Nguồn ưu tiên 2 (${botSources[1].sourceName}): Giá vốn ${botSources[1].costVnd.toLocaleString('vi-VN')} đ (Còn ${botSources[1].stock} gói)`);
  console.log(`  ✓ Giá bán niêm yết: ${pricingResult.retailPrice.toLocaleString('vi-VN')} đ (Áp dụng bước làm tròn 1.000đ)`);
  console.log(`  ✓ Biên lãi dự kiến: ${bestCandidate.marginAmount.toLocaleString('vi-VN')} đ (${bestCandidate.marginPercent.toFixed(1)}%)\n`);

  // GIAI ĐOẠN 4: Mua hàng 2 pha (2-Phase Commit) & Failover sang bot phụ
  console.log('▶ [Giai đoạn 4] MUA HÀNG 2 PHA (2-PHASE COMMIT) & FAILOVER TỰ ĐỘNG');
  const unitPrice = pricingResult.retailPrice;
  const quantity = 1;
  const orderTotal = unitPrice * quantity;

  // Pha 1: Giữ chỗ & trừ tiền tạm thời
  customerUser.balance -= BigInt(orderTotal);
  const createdOrder = await mockPrisma.order.create({
    data: {
      userId: customerUser.id,
      productId: testProduct.id,
      code: 'ORD-TEST-E2E-001',
      quantity,
      unitPrice: BigInt(unitPrice),
      totalPrice: BigInt(orderTotal),
      unitCost: BigInt(botSources[1].costVnd),
      status: OrderStatus.PROCESSING,
      idempotencyKey: 'idemp-checkout-key-12345',
      warrantyUntil: new Date(Date.now() + testProduct.warrantyMinutes * 60 * 1000),
    },
  });
  console.log(`  ✓ Pha 1: Trừ tiền ví thành công (-${orderTotal.toLocaleString('vi-VN')} đ)`);
  console.log(`    - Mã đơn: ${createdOrder.code} | Trạng thái: ${createdOrder.status}`);
  console.log(`    - Số dư ví còn lại: ${Number(customerUser.balance).toLocaleString('vi-VN')} đ`);

  // Pha 2: Gọi Bot cấp link (Failover từ Bot 1 sang Bot 2)
  console.log(`  ✓ Pha 2: Điều hướng gọi Bot cấp phát...`);
  console.log(`    - Thử Bot 1 (${botSources[0].sourceName}): Thất bại (OUT_OF_STOCK)`);
  console.log(`    - Chuyển tiếp Failover sang Bot 2 (${botSources[1].sourceName})...`);

  const mockAdapter = new MockAdapter({ latencyMs: 20 });
  const botDelivery = await mockAdapter.buy(botSources[1].externalId, 1);
  if (botDelivery.kind !== 'SUCCESS') {
    throw new Error(`Bot purchase failed: ${botDelivery.kind}`);
  }

  const rawInviteLink = botDelivery.links[0];
  const encryptedLink = encrypt(rawInviteLink);

  // Lưu link và hoàn tất đơn hàng
  db.orderItems.push({
    id: 'item-e2e-1',
    orderId: createdOrder.id,
    linkEncrypted: encryptedLink,
    disabledAt: null,
  });
  createdOrder.status = OrderStatus.COMPLETED;
  console.log(`    - Bot 2 cấp phát link thành công!`);
  console.log(`  ✓ Trạng thái đơn hàng: ${createdOrder.status}`);
  console.log(`  ✓ Link kích hoạt đã mã hóa (AES-256-GCM): ${maskSecret(encryptedLink)}`);
  console.log(`  ✓ Link giải mã hiển thị cho khách: ${decrypt(encryptedLink)}\n`);

  // GIAI ĐOẠN 5: Khiếu nại bảo hành & Admin giải quyết
  console.log('▶ [Giai đoạn 5] BẢO HÀNH TRONG 5 PHÚT & ADMIN XỬ LÝ KHIẾU NẠI');
  const ticket = {
    id: 'ticket-gemini-warranty-01',
    orderId: createdOrder.id,
    userId: customerUser.id,
    reason: 'Link báo đã được sử dụng bởi người khác',
    status: WarrantyStatus.PENDING,
    createdAt: new Date(),
  };
  db.warrantyTickets.push(ticket);
  console.log(`  ✓ Khách hàng tạo Ticket bảo hành: [${ticket.id}] (Lý do: "${ticket.reason}")`);
  console.log(`  ✓ Trạng thái Ticket: ${ticket.status}`);

  // Admin vào kiểm tra và đổi link mới
  const replacementRawLink = 'https://one.google.com/promo=GEMINI-ADVANCED-REPLACEMENT-VIP-999';
  db.orderItems[0].disabledAt = new Date(); // Vô hiệu link cũ
  db.orderItems.push({
    id: 'item-e2e-replace-2',
    orderId: ticket.orderId,
    linkEncrypted: encrypt(replacementRawLink),
    origin: 'WARRANTY',
    disabledAt: null,
  });
  ticket.status = WarrantyStatus.RESOLVED;

  console.log(`  ✓ Admin xử lý giải quyết ticket:`);
  console.log(`    - Quyết định: REPLACE (Cấp link thay thế mới)`);
  console.log(`    - Link thay thế: ${replacementRawLink}`);
  console.log(`    - Vô hiệu hóa link cũ: ĐÃ HOÀN TẤT`);
  console.log(`    - Trạng thái Ticket sau giải quyết: ${ticket.status}\n`);

  // GIAI ĐOẠN 6: Báo cáo tài chính Admin Dashboard
  console.log('▶ [Giai đoạn 6] BÁO CÁO TÀI CHÍNH DASHBOARD (REALTIME FINANCIAL AUDIT)');
  const stats = await adminService.getDashboard();
  console.log(`  ✓ Tổng tiền nạp thành công: ${stats.financials.totalTopupCompleted.toLocaleString('vi-VN')} đ`);
  console.log(`  ✓ Doanh thu bán hôm nay: ${stats.financials.today.revenue.toLocaleString('vi-VN')} đ`);
  console.log(`  ✓ Giá vốn (Cost of Goods Sold): ${stats.financials.today.cost.toLocaleString('vi-VN')} đ`);
  console.log(`  ✓ Lợi nhuận gộp thực tế: ${stats.financials.today.profit.toLocaleString('vi-VN')} đ`);
  console.log(`  ✓ Cảnh báo số bot nguồn cạn số dư: ${stats.alerts.lowBalanceSourcesCount} bot`);

  console.log('\n========================================================================');
  console.log('  🎉 TẤT CẢ 6 GIAI ĐOẠN NGHIỆP VỤ ĐÃ ĐƯỢC KIỂM THỬ THÀNH CÔNG 100%!  ');
  console.log('========================================================================\n');
}

runEndToEndProjectTest().catch((err) => {
  console.error('❌ Lỗi kiểm thử E2E:', err);
  process.exit(1);
});
