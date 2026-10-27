import { describe, it, expect, beforeEach } from 'vitest';
import { WalletService } from '../src/application/wallet/wallet.service';
import { TopupStatus, WalletTxType } from '@prisma/client';

describe('Feature 2: Wallet & VietQR Balance Management (FR-WAL-01..07, NFR-03)', () => {
  let walletService: WalletService;
  let mockUsers: any[];
  let mockTopups: any[];
  let mockBankTransactions: any[];
  let mockWalletTransactions: any[];
  let mockPrisma: any;

  beforeEach(() => {
    mockUsers = [
      {
        id: 'user-wallet-1',
        email: 'wallet.tester@geminihub.vn',
        balance: BigInt(50000), // 50,000 VND initial balance
        status: 'ACTIVE',
      },
    ];
    mockTopups = [];
    mockBankTransactions = [];
    mockWalletTransactions = [];

    mockPrisma = {
      user: {
        findUnique: async ({ where }: any) => mockUsers.find((u) => u.id === where.id) || null,
        update: async ({ where, data }: any) => {
          const user = mockUsers.find((u) => u.id === where.id);
          if (data.balance?.increment) {
            user.balance = user.balance + BigInt(data.balance.increment);
          }
          return user;
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
        create: async ({ data }: any) => {
          const newTopup = {
            id: `topup-${mockTopups.length + 1}`,
            paidAmount: null,
            paidAt: null,
            ...data,
          };
          mockTopups.push(newTopup);
          return newTopup;
        },
        findUnique: async ({ where }: any) => {
          const found = mockTopups.find((t) => t.code === where.code || t.id === where.id);
          if (!found) return null;
          const user = mockUsers.find((u) => u.id === found.userId);
          return { ...found, user };
        },
        update: async ({ where, data }: any) => {
          const topup = mockTopups.find((t) => t.id === where.id);
          Object.assign(topup, data);
          return topup;
        },
      },
      bankTransaction: {
        create: async ({ data }: any) => {
          const tx = { id: `banktx-${mockBankTransactions.length + 1}`, createdAt: new Date(), ...data };
          mockBankTransactions.push(tx);
          return tx;
        },
        findUnique: async ({ where }: any) => {
          return mockBankTransactions.find((t) => t.providerTxId === where.providerTxId) || null;
        },
      },
      walletTransaction: {
        create: async ({ data }: any) => {
          const wtx = { id: `wtx-${mockWalletTransactions.length + 1}`, createdAt: new Date(), ...data };
          mockWalletTransactions.push(wtx);
          return wtx;
        },
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    walletService = new WalletService(mockPrisma);
  });

  // TC-WAL-01
  it('TC-WAL-01: Tạo lệnh nạp VietQR sinh mã 6 ký tự tiền tố GH và hạn sử dụng 30 phút', async () => {
    const result = await walletService.createTopup('user-wallet-1', { amount: 100000 });

    expect(result.code).toMatch(/^GH[A-Z0-9]{6}$/);
    expect(result.amount).toBe(100000);
    expect(result.bankName).toBe('MBBank');
    expect(result.bankAccountNumber).toBe('0987654321');
    expect(result.qrUrl).toContain('https://img.vietqr.io/image/');
    expect(result.qrUrl).toContain(result.code);

    const now = Date.now();
    const expireTime = new Date(result.expiresAt).getTime();
    const durationMinutes = Math.round((expireTime - now) / 60000);
    expect(durationMinutes).toBe(30);
  });

  // TC-WAL-02
  it('TC-WAL-02: Webhook SePay cộng tiền nguyên tử vào ví và chuyển trạng thái Topup COMPLETED', async () => {
    // Arrange: Create a pending topup
    const topup = await walletService.createTopup('user-wallet-1', { amount: 100000 });

    // Act: Receive webhook containing matching code
    const webhookRes = await walletService.handlePaymentWebhook({
      id: 987654321,
      gateway: 'MBBank',
      transactionDate: '2026-10-27 10:00:00',
      accountNumber: '0987654321',
      transferType: 'in',
      transferAmount: 100000,
      accumulated: 100000,
      code: null,
      content: `CK tien mua Gemini code ${topup.code} cam on`,
      referenceCode: 'FT26102712345',
      description: 'Chuyen khoan',
    });

    // Assert
    expect(webhookRes.success).toBe(true);
    expect(webhookRes.matched).toBe(true);
    expect(webhookRes.newBalance).toBe(150000); // 50,000 + 100,000

    const updatedTopup = mockTopups.find((t) => t.id === topup.id);
    expect(updatedTopup.status).toBe(TopupStatus.COMPLETED);
    expect(updatedTopup.paidAmount).toBe(BigInt(100000));
  });

  // TC-WAL-03
  it('TC-WAL-03: Chống xử lý trùng lặp giao dịch SePay (Idempotent Webhook NFR-03)', async () => {
    const topup = await walletService.createTopup('user-wallet-1', { amount: 50000 });
    const payload = {
      id: 11223344,
      gateway: 'MBBank',
      transactionDate: '2026-10-27 10:00:00',
      accountNumber: '0987654321',
      transferType: 'in',
      transferAmount: 50000,
      accumulated: 50000,
      code: null,
      content: `Thanh toan ma ${topup.code}`,
      referenceCode: 'FT999',
      description: 'Chuyen khoan',
    };

    // First call: Successful processing
    const firstCall = await walletService.handlePaymentWebhook(payload);
    expect(firstCall.success).toBe(true);
    expect(firstCall.matched).toBe(true);
    expect(mockUsers[0].balance).toBe(BigInt(100000));

    // Second call with identical payload / providerTxId
    const secondCall = await walletService.handlePaymentWebhook(payload);
    expect(secondCall.success).toBe(true);
    expect(secondCall.message).toContain('đã được xử lý trước đó');
    // Balance must NOT be incremented again!
    expect(mockUsers[0].balance).toBe(BigInt(100000));
  });

  // TC-WAL-04
  it('TC-WAL-04: Giao dịch không khớp mã nạp được lưu vào BankTransaction chờ đối soát', async () => {
    const webhookRes = await walletService.handlePaymentWebhook({
      id: 55667788,
      gateway: 'MBBank',
      transactionDate: '2026-10-27 10:00:00',
      accountNumber: '0987654321',
      transferType: 'in',
      transferAmount: 200000,
      accumulated: 200000,
      code: null,
      content: 'Chuyen tien mua hang khong ghi ma',
      referenceCode: 'FT777',
      description: 'Khong khop ma',
    });

    expect(webhookRes.success).toBe(true);
    expect(webhookRes.matched).toBe(false);
    expect(webhookRes.message).toContain('chờ gán thủ công');
    expect(mockBankTransactions.length).toBe(1);
    expect(mockBankTransactions[0].matchedTopupId).toBeNull();
    // User balance remains untouched
    expect(mockUsers[0].balance).toBe(BigInt(50000));
  });

  // TC-WAL-05
  it('TC-WAL-05: Ghi nhận biến động số dư bất biến (WalletTransaction append-only) lưu đúng BalanceBefore & BalanceAfter', async () => {
    const topup = await walletService.createTopup('user-wallet-1', { amount: 80000 });

    await walletService.handlePaymentWebhook({
      id: 99887766,
      gateway: 'MBBank',
      transactionDate: '2026-10-27 10:00:00',
      accountNumber: '0987654321',
      transferType: 'in',
      transferAmount: 80000,
      accumulated: 80000,
      code: null,
      content: `Nap tien ${topup.code}`,
      referenceCode: 'FT888',
      description: 'Chuyen tien',
    });

    expect(mockWalletTransactions.length).toBe(1);
    const ledger = mockWalletTransactions[0];
    expect(ledger.userId).toBe('user-wallet-1');
    expect(ledger.type).toBe(WalletTxType.TOPUP);
    expect(ledger.amount).toBe(BigInt(80000));
    expect(ledger.balanceBefore).toBe(BigInt(50000));
    expect(ledger.balanceAfter).toBe(BigInt(130000));
    expect(ledger.refType).toBe('TOPUP');
    expect(ledger.refId).toBe(topup.id);
  });
});

