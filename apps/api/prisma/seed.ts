import { PrismaClient, Role, UserStatus, AdapterType, SourceStatus } from '@prisma/client';
import { hashPassword } from '../src/infrastructure/security/auth';
import { encrypt } from '../src/infrastructure/security/crypto';

process.env.APP_ENCRYPTION_KEY =
  process.env.APP_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Admin & Test Customer
  const adminPass = await hashPassword('AdminPassword123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@geminihub.vn' },
    update: {},
    create: {
      email: 'admin@geminihub.vn',
      passwordHash: adminPass,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      balance: BigInt(5000000), // 5M VND
    },
  });

  const customerPass = await hashPassword('KhachHang123');
  const customer = await prisma.user.upsert({
    where: { email: 'khachhang@gmail.com' },
    update: {},
    create: {
      email: 'khachhang@gmail.com',
      passwordHash: customerPass,
      role: Role.USER,
      status: UserStatus.ACTIVE,
      balance: BigInt(200000), // 200k VND
    },
  });

  console.log(`👤 Users seeded: ${admin.email} (ADMIN), ${customer.email} (USER)`);

  // 2. Seed Default Settings
  await prisma.setting.upsert({
    where: { key: 'GENERAL' },
    update: {},
    create: {
      key: 'GENERAL',
      value: JSON.stringify({
        siteName: 'GeminiHub - Hệ Thống Bán Link Gemini Tự Động',
        bannerText: 'Khuyến mãi đặc biệt: Tài khoản Gemini Advanced dùng ngay sau khi mua!',
        bannerEnabled: true,
        bankName: 'MBBank',
        bankBin: '970422',
        bankAccountNumber: '0388889999',
        bankAccountHolder: 'CONG TY TNHH GEMINIHUB',
        minTopupAmount: 10000,
        maxTopupAmount: 50000000,
      }),
    },
  });

  await prisma.setting.upsert({
    where: { key: 'PRICING_DEFAULTS' },
    update: {},
    create: {
      key: 'PRICING_DEFAULTS',
      value: JSON.stringify({
        markupPercent: 30,
        roundingStep: 1000,
        minMarginAmount: 5000,
        usdExchangeRate: 26000,
        priceChangeAlertThresholdPercent: 20,
      }),
    },
  });

  // 3. Seed Sources
  const mockSource = await prisma.source.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Nguồn Mock Test (Giả lập bot)',
      adapterType: AdapterType.MOCK,
      baseUrl: 'https://mock.bot.local',
      credentialsEncrypted: encrypt(JSON.stringify({ apiId: 'MOCK-KEY', apiSecret: 'MOCK-SECRET' })),
      config: JSON.stringify({ simulatedBalance: 5000000, latencyMs: 150 }),
      balance: BigInt(5000000),
      status: SourceStatus.ACTIVE,
      liveBuyEnabled: true,
    },
  });

  const sumiSource = await prisma.source.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Sumistore Primary Bot (Telegram API)',
      adapterType: AdapterType.TELE_API,
      baseUrl: 'https://api.sumistore.bot',
      credentialsEncrypted: encrypt(JSON.stringify({ apiId: 'TAPI-P7L3X9Z84F0Y', apiSecret: 'SUMI-SEC-888999' })),
      config: JSON.stringify({}),
      balance: BigInt(2500000),
      status: SourceStatus.ACTIVE,
      liveBuyEnabled: false, // Default false for safety (FR-SRC-08)
    },
  });

  console.log(`🤖 Sources seeded: ${mockSource.name}, ${sumiSource.name}`);

  // 4. Seed Source Products
  const sp1 = await prisma.sourceProduct.upsert({
    where: {
      sourceId_externalId: {
        sourceId: mockSource.id,
        externalId: 'SP-GEMINI-1M',
      },
    },
    update: {},
    create: {
      sourceId: mockSource.id,
      externalId: 'SP-GEMINI-1M',
      name: 'Gemini Advanced 1 Tháng (Nguồn Mock)',
      rawPrice: 17000,
      costVnd: BigInt(17000),
      stock: 50,
      description: 'Link kích hoạt Gemini Advanced 1 tháng',
    },
  });

  const sp2 = await prisma.sourceProduct.upsert({
    where: {
      sourceId_externalId: {
        sourceId: mockSource.id,
        externalId: 'SP-GEMINI-1Y',
      },
    },
    update: {},
    create: {
      sourceId: mockSource.id,
      externalId: 'SP-GEMINI-1Y',
      name: 'Gemini Advanced 1 Năm (Nguồn Mock)',
      rawPrice: 150000,
      costVnd: BigInt(150000),
      stock: 25,
      description: 'Link kích hoạt Gemini Advanced 1 năm',
    },
  });

  // 5. Seed Shop Products & Mappings
  const p1 = await prisma.product.upsert({
    where: { slug: 'gemini-advanced-1-thang' },
    update: {},
    create: {
      slug: 'gemini-advanced-1-thang',
      name: 'Gemini Advanced 1 Tháng',
      description: `### Hướng dẫn sử dụng:
1. Nhấp vào link nhận được sau khi thanh toán.
2. Đăng nhập tài khoản Google của bạn.
3. Nhấn "Tham gia" để kích hoạt gói Gemini Advanced 1 tháng.

> [!WARNING]
> Link kích hoạt phải sử dụng ngay sau khi mua. Thời gian bảo hành: **5 phút**.`,
      warrantyMinutes: 5,
      mustUseImmediately: true,
      maxPerOrder: 5,
      showStockCount: true,
      isActive: true,
      sortOrder: 1,
      routingStrategy: 'PRIORITY',
      pricingMode: 'COST_PLUS',
      markupPercent: 30,
      markupAmount: BigInt(0),
      roundingStep: 1000,
      minMarginAmount: BigInt(5000),
      currentPrice: BigInt(23000), // 17k * 1.3 = 22.1k -> 23k
    },
  });

  await prisma.productSource.upsert({
    where: {
      productId_sourceProductId: {
        productId: p1.id,
        sourceProductId: sp1.id,
      },
    },
    update: {},
    create: {
      productId: p1.id,
      sourceProductId: sp1.id,
      priority: 1,
      enabled: true,
    },
  });

  const p2 = await prisma.product.upsert({
    where: { slug: 'gemini-advanced-1-nam' },
    update: {},
    create: {
      slug: 'gemini-advanced-1-nam',
      name: 'Gemini Advanced 1 Năm (Gia hạn trọn gói)',
      description: `### Hướng dẫn sử dụng:
1. Nhấp vào link nhận được sau khi mua.
2. Xác nhận tài khoản Google cần nâng cấp.
3. Bảo hành 5 phút kiểm tra trạng thái kích hoạt.`,
      warrantyMinutes: 5,
      mustUseImmediately: true,
      maxPerOrder: 3,
      showStockCount: true,
      isActive: true,
      sortOrder: 2,
      routingStrategy: 'PRIORITY',
      pricingMode: 'COST_PLUS',
      markupPercent: 30,
      markupAmount: BigInt(0),
      roundingStep: 1000,
      minMarginAmount: BigInt(15000),
      currentPrice: BigInt(195000), // 150k * 1.3 = 195k
    },
  });

  await prisma.productSource.upsert({
    where: {
      productId_sourceProductId: {
        productId: p2.id,
        sourceProductId: sp2.id,
      },
    },
    update: {},
    create: {
      productId: p2.id,
      sourceProductId: sp2.id,
      priority: 1,
      enabled: true,
    },
  });

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

