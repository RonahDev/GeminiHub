import { PrismaClient, TopupStatus, WalletTxType } from '@prisma/client';
import { CreateTopupInput, SepayWebhookInput } from '@geminihub/shared';
import crypto from 'crypto';

export class WalletService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a topup request with VietQR parameters (FR-WAL-03, FR-WAL-04, FR-WAL-05)
   */
  async createTopup(userId: string, input: CreateTopupInput) {
    const amount = BigInt(input.amount);

    // Generate unique 6-char code with GH prefix (e.g. GH8X9Y2Z)
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `GH${randomSuffix}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const topup = await this.prisma.topup.create({
      data: {
        userId,
        code,
        amount,
        status: TopupStatus.PENDING,
        expiresAt,
      },
    });

    // Default or configured bank details
    const settingRecord = await this.prisma.setting.findUnique({ where: { key: 'GENERAL' } });
    let bankConfig = {
      bankName: 'MBBank',
      bankBin: '970422', // MBBank BIN
      bankAccountNumber: '0000123456789',
      bankAccountHolder: 'CONG TY GEMINIHUB',
    };
    if (settingRecord?.value) {
      try {
        const parsed = JSON.parse(settingRecord.value);
        bankConfig = { ...bankConfig, ...parsed };
      } catch {}
    }

    const qrUrl = `https://img.vietqr.io/image/${bankConfig.bankBin || '970422'}-${bankConfig.bankAccountNumber}-compact.png?amount=${input.amount}&addInfo=${code}&accountName=${encodeURIComponent(bankConfig.bankAccountHolder)}`;

    return {
      id: topup.id,
      code: topup.code,
      amount: Number(topup.amount),
      expiresAt: topup.expiresAt,
      qrUrl,
      bankName: bankConfig.bankName,
      bankAccountNumber: bankConfig.bankAccountNumber,
      bankAccountHolder: bankConfig.bankAccountHolder,
    };
  }

  /**
   * Process incoming payment webhook from SePay / Casso (FR-WAL-06, FR-WAL-07, NFR-03)
   */
  async handlePaymentWebhook(payload: SepayWebhookInput) {
    const providerTxId = String(payload.id);
    const transferAmount = BigInt(payload.transferAmount);
    const content = payload.content || '';

    // Idempotent check (NFR-03)
    const existingTx = await this.prisma.bankTransaction.findUnique({
      where: { providerTxId },
    });

    if (existingTx) {
      return { success: true, message: 'Giao dịch đã được xử lý trước đó', id: existingTx.id };
    }

    // Extract topup code from transfer content (e.g. GH followed by 6 alphanumeric characters)
    const codeMatch = content.match(/GH[A-Z0-9]{6}/i);
    const extractedCode = codeMatch ? codeMatch[0].toUpperCase() : null;

    let matchedTopup = null;
    if (extractedCode) {
      matchedTopup = await this.prisma.topup.findUnique({
        where: { code: extractedCode },
        include: { user: true },
      });
    }

    // Execute atomic transaction
    return await this.prisma.$transaction(async (tx) => {
      // Always store raw BankTransaction (FR-ADM-07)
      const bankTx = await tx.bankTransaction.create({
        data: {
          providerTxId,
          amount: transferAmount,
          content,
          matchedTopupId: matchedTopup?.id || null,
          rawPayload: JSON.stringify(payload),
        },
      });

      if (!matchedTopup) {
        return {
          success: true,
          matched: false,
          message: 'Giao dịch không khớp lệnh nạp tự động, đã lưu vào mục chờ gán thủ công',
          bankTxId: bankTx.id,
        };
      }

      // Check if already completed
      if (matchedTopup.status === TopupStatus.COMPLETED) {
        return {
          success: true,
          matched: true,
          message: 'Lệnh nạp này đã được xử lý',
          topupId: matchedTopup.id,
        };
      }

      // FR-WAL-07: Credit even if expired within 24 hours
      const now = new Date();
      const expirationThreshold = new Date(matchedTopup.expiresAt.getTime() + 24 * 60 * 60 * 1000);

      if (now > expirationThreshold) {
        return {
          success: true,
          matched: false,
          message: 'Lệnh nạp đã quá hạn 24 giờ. Chờ admin đối soát thủ công',
          bankTxId: bankTx.id,
        };
      }

      // 1. Credit user balance
      const updatedUser = await tx.user.update({
        where: { id: matchedTopup.userId },
        data: {
          balance: { increment: transferAmount },
        },
      });

      // 2. Mark topup as COMPLETED
      await tx.topup.update({
        where: { id: matchedTopup.id },
        data: {
          status: TopupStatus.COMPLETED,
          paidAmount: transferAmount,
          providerTxId,
          paidAt: now,
        },
      });

      // 3. Write Ledger (WalletTransaction append-only)
      await tx.walletTransaction.create({
        data: {
          userId: matchedTopup.userId,
          type: WalletTxType.TOPUP,
          amount: transferAmount,
          balanceBefore: updatedUser.balance - transferAmount,
          balanceAfter: updatedUser.balance,
          refType: 'TOPUP',
          refId: matchedTopup.id,
          note: `Nạp tiền qua VietQR mã ${matchedTopup.code}`,
        },
      });

      return {
        success: true,
        matched: true,
        message: 'Cộng tiền vào ví thành công',
        userId: matchedTopup.userId,
        amountAdded: Number(transferAmount),
        newBalance: Number(updatedUser.balance),
      };
    });
  }
}

