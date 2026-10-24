import {
  PrismaClient,
  OrderStatus,
  WalletTxType,
  OrderItemOrigin,
  WarrantyStatus,
  WarrantyResolution,
} from '@prisma/client';
import { encrypt, hashSha256 } from '../../infrastructure/security/crypto';
import { BadRequestError, NotFoundError } from '../../core/errors/AppError';

export class AdminService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Admin Dashboard statistics & alert counters (FR-ADM-01)
   */
  async getDashboard() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      ordersToday,
      orders7Days,
      ordersMonth,
      topupsCompleted,
      ordersByStatusRaw,
      newUsersCount,
      needsReviewCount,
      errorSourcesCount,
      pausedProductsCount,
      pendingPriceCount,
      sources,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: startOfToday }, status: OrderStatus.COMPLETED },
        select: { totalPrice: true, unitCost: true, quantity: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: sevenDaysAgo }, status: OrderStatus.COMPLETED },
        select: { totalPrice: true, unitCost: true, quantity: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: startOfMonth }, status: OrderStatus.COMPLETED },
        select: { totalPrice: true, unitCost: true, quantity: true },
      }),
      this.prisma.topup.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { paidAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.NEEDS_REVIEW },
      }),
      this.prisma.source.count({
        where: { status: 'ERROR' },
      }),
      this.prisma.product.count({
        where: { OR: [{ isActive: false }, { pausedReason: { not: null } }] },
      }),
      this.prisma.product.count({
        where: { pendingPrice: { not: null } },
      }),
      this.prisma.source.findMany({
        select: { id: true, balance: true, lowBalanceAlert: true, name: true },
      }),
    ]);

    const calcRevenueCostProfit = (orders: any[]) => {
      let revenue = 0;
      let cost = 0;
      for (const o of orders) {
        revenue += Number(o.totalPrice);
        cost += Number(o.unitCost) * o.quantity;
      }
      return { revenue, cost, profit: revenue - cost };
    };

    const lowBalanceSources = sources.filter((s) => s.balance < s.lowBalanceAlert);

    const ordersByStatus: Record<string, number> = {};
    for (const g of ordersByStatusRaw) {
      ordersByStatus[g.status] = g._count.id;
    }

    return {
      financials: {
        today: calcRevenueCostProfit(ordersToday),
        last7Days: calcRevenueCostProfit(orders7Days),
        thisMonth: calcRevenueCostProfit(ordersMonth),
        totalTopupCompleted: Number(topupsCompleted._sum.paidAmount || 0),
      },
      ordersByStatus,
      newUsersCount,
      alerts: {
        needsReviewOrders: needsReviewCount,
        errorSources: errorSourcesCount,
        lowBalanceSourcesCount: lowBalanceSources.length,
        lowBalanceSourcesList: lowBalanceSources.map((s) => ({
          id: s.id,
          name: s.name,
          balance: Number(s.balance),
        })),
        pausedProducts: pausedProductsCount,
        pendingPriceReviews: pendingPriceCount,
      },
    };
  }

  /**
   * Source statistics (FR-ADM-02)
   */
  async getSourceStats() {
    const sources = await this.prisma.source.findMany({
      include: {
        orders: {
          where: { status: OrderStatus.COMPLETED },
          select: { unitCost: true, quantity: true },
        },
        sourceCalls: {
          select: { result: true, durationMs: true },
        },
      },
    });

    return sources.map((src) => {
      let totalCostSpent = 0;
      for (const o of src.orders) {
        totalCostSpent += Number(o.unitCost) * o.quantity;
      }

      const totalCalls = src.sourceCalls.length;
      const successCalls = src.sourceCalls.filter((c) => c.result === 'SUCCESS').length;
      const successRate = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 0;
      const avgDuration =
        totalCalls > 0
          ? src.sourceCalls.reduce((acc, c) => acc + c.durationMs, 0) / totalCalls
          : 0;

      return {
        id: src.id,
        name: src.name,
        adapterType: src.adapterType,
        status: src.status,
        balance: Number(src.balance),
        totalOrders: src.orders.length,
        totalCostSpent,
        successRate: Math.round(successRate * 10) / 10,
        averageLatencyMs: Math.round(avgDuration),
      };
    });
  }

  /**
   * Admin manual order fulfillment (FR-ADM-04)
   */
  async fulfillManual(orderId: string, links: string[], adminNote: string, actorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });

    if (!order) {
      throw new NotFoundError('Không tìm thấy đơn hàng cần xử lý');
    }

    if (order.status !== OrderStatus.NEEDS_REVIEW) {
      throw new BadRequestError(`Đơn hàng ở trạng thái ${order.status}, không thể gán link thủ công`);
    }

    if (links.length !== order.quantity) {
      throw new BadRequestError(`Số lượng link (${links.length}) không khớp với đơn hàng (${order.quantity})`);
    }

    const warrantyUntil = new Date(Date.now() + order.product.warrantyMinutes * 60 * 1000);

    return await this.prisma.$transaction(async (tx) => {
      for (const link of links) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            linkEncrypted: encrypt(link),
            linkHash: hashSha256(link),
            origin: OrderItemOrigin.MANUAL,
          },
        });
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
          warrantyUntil,
          failReason: `Hoàn tất thủ công bởi Admin. Ghi chú: ${adminNote}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ORDER_FULFILL_MANUAL',
          target: `Order:${order.id}`,
          before: JSON.stringify({ status: order.status }),
          after: JSON.stringify({ status: OrderStatus.COMPLETED, note: adminNote }),
        },
      });

      return updated;
    });
  }

  /**
   * Refund order manually (FR-ADM-04, FR-ADM-05)
   */
  async refundOrder(orderId: string, reason: string, actorId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundError('Không tìm thấy đơn hàng cần hoàn tiền');
    }

    if (order.status === OrderStatus.REFUNDED || order.status === OrderStatus.FAILED) {
      throw new BadRequestError('Đơn hàng đã được hoàn tiền trước đó');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Credit wallet
      const updatedUser = await tx.user.update({
        where: { id: order.userId },
        data: { balance: { increment: order.totalPrice } },
      });

      // 2. Append ledger
      await tx.walletTransaction.create({
        data: {
          userId: order.userId,
          type: WalletTxType.REFUND,
          amount: order.totalPrice,
          balanceBefore: updatedUser.balance - order.totalPrice,
          balanceAfter: updatedUser.balance,
          refType: 'ORDER',
          refId: order.id,
          note: `Admin hoàn tiền đơn ${order.code}. Lý do: ${reason}`,
        },
      });

      // 3. Update order
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REFUNDED,
          failReason: `Đã hoàn tiền vào ví: ${reason}`,
        },
      });

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ORDER_REFUND',
          target: `Order:${order.id}`,
          before: JSON.stringify({ status: order.status }),
          after: JSON.stringify({ status: OrderStatus.REFUNDED, reason }),
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Adjust customer balance (FR-ADM-06)
   */
  async adjustBalance(userId: string, amountNum: number, reason: string, actorId: string) {
    const amount = BigInt(amountNum);

    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundError('Không tìm thấy người dùng');
      }

      if (amount < 0 && user.balance < -amount) {
        throw new BadRequestError('Số dư của khách không đủ để trừ số tiền này');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          type: WalletTxType.ADJUST,
          amount,
          balanceBefore: user.balance,
          balanceAfter: updatedUser.balance,
          refType: 'MANUAL_ADJUST',
          note: `Admin điều chỉnh: ${reason}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'WALLET_ADJUST',
          target: `User:${userId}`,
          before: JSON.stringify({ balance: Number(user.balance) }),
          after: JSON.stringify({ balance: Number(updatedUser.balance), amount: amountNum, reason }),
        },
      });

      return {
        userId,
        newBalance: Number(updatedUser.balance),
      };
    });
  }
}
