import { PrismaClient, OrderStatus, WalletTxType, OrderItemOrigin } from '@prisma/client';
import { RoutingStrategy, BuyResult, Role } from '@geminihub/shared';
import { createSourceAdapter } from '../../infrastructure/adapters/factory';
import { encrypt, decrypt, hashSha256 } from '../../infrastructure/security/crypto';
import { BadRequestError, NotFoundError } from '../../core/errors/AppError';
import crypto from 'crypto';

export interface CreateOrderParams {
  userId: string;
  productId: string;
  quantity: number;
  idempotencyKey: string;
  mustUseAcknowledged: boolean;
}

export class OrderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main order purchasing pipeline with 2-phase commit and failover (UC-02, Section 6.4)
   */
  async purchase(params: CreateOrderParams) {
    const { userId, productId, quantity, idempotencyKey, mustUseAcknowledged } = params;

    if (!mustUseAcknowledged) {
      throw new BadRequestError('Bạn cần đồng ý với điều khoản sử dụng ngay');
    }

    // Step 1: Idempotency check (FR-ORD-04)
    const existingOrder = await this.prisma.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey,
        },
      },
      include: {
        items: true,
        product: true,
      },
    });

    if (existingOrder) {
      return this.formatOrderResponse(existingOrder);
    }

    // Step 2: Fetch product and user
    const [user, product] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          sources: {
            where: { enabled: true, broken: false },
            include: {
              sourceProduct: {
                include: {
                  source: true,
                },
              },
            },
            orderBy: { priority: 'asc' },
          },
        },
      }),
    ]);

    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestError('Tài khoản không hoạt động hoặc chưa được kích hoạt');
    }

    if (!product || !product.isActive) {
      throw new BadRequestError('Sản phẩm hiện không mở bán');
    }

    if (quantity < 1 || quantity > product.maxPerOrder) {
      throw new BadRequestError(`Số lượng không hợp lệ (từ 1 đến ${product.maxPerOrder})`);
    }

    const unitPrice = product.currentPrice;
    const totalPrice = unitPrice * BigInt(quantity);

    if (user.balance < totalPrice) {
      const shortage = Number(totalPrice - user.balance);
      throw new BadRequestError(`Số dư ví không đủ. Bạn cần nạp thêm ít nhất ${shortage.toLocaleString('vi-VN')}đ`);
    }

    // Step 3: Build candidate sources list (Section 6.4, Step 2)
    const candidateMappings = product.sources.filter((mapping) => {
      const sp = mapping.sourceProduct;
      const src = sp.source;

      // Must be active and not tripped by circuit breaker (errors < 5)
      if (src.status !== 'ACTIVE' || src.consecutiveErrors >= 5) {
        return false;
      }

      // Check stock
      if (sp.stock < quantity) {
        return false;
      }

      // Check source balance
      const requiredSourceBalance = sp.costVnd * BigInt(quantity);
      if (src.balance < requiredSourceBalance) {
        return false;
      }

      // Check max cost threshold if set
      if (mapping.maxCost && sp.costVnd > mapping.maxCost) {
        return false;
      }

      // Check min margin requirement (FR-PRICE-04)
      const unitMargin = unitPrice - sp.costVnd;
      if (unitMargin < product.minMarginAmount) {
        return false;
      }

      return true;
    });

    if (candidateMappings.length === 0) {
      throw new BadRequestError('Sản phẩm hiện đang tạm hết hàng trên mọi nguồn liên kết');
    }

    // Sort according to routing strategy
    if (product.routingStrategy === 'CHEAPEST') {
      candidateMappings.sort((a, b) => Number(a.sourceProduct.costVnd - b.sourceProduct.costVnd));
    } else {
      // Default: priority ascending
      candidateMappings.sort((a, b) => a.priority - b.priority);
    }

    // Select the first candidate as initial target
    const primaryCandidate = candidateMappings[0];
    const initialUnitCost = primaryCandidate.sourceProduct.costVnd;

    // Step 4: DB Transaction 1 - Conditional balance deduction & create PROCESSING order
    const orderCode = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      // Conditional deduction: balance >= totalPrice
      const updatedUser = await tx.user.updateMany({
        where: {
          id: userId,
          balance: { gte: totalPrice },
        },
        data: {
          balance: { decrement: totalPrice },
        },
      });

      if (updatedUser.count === 0) {
        throw new BadRequestError('Số dư ví không đủ hoặc tài khoản đã thay đổi');
      }

      const freshUser = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      // Create Order
      const newOrder = await tx.order.create({
        data: {
          code: orderCode,
          userId,
          productId,
          quantity,
          unitPrice,
          totalPrice,
          unitCost: initialUnitCost,
          status: OrderStatus.PROCESSING,
          idempotencyKey,
        },
      });

      // Write Ledger (WalletTransaction append-only)
      await tx.walletTransaction.create({
        data: {
          userId,
          type: WalletTxType.PURCHASE,
          amount: -totalPrice,
          balanceBefore: freshUser.balance + totalPrice,
          balanceAfter: freshUser.balance,
          refType: 'ORDER',
          refId: newOrder.id,
          note: `Mua đơn hàng ${newOrder.code} (${product.name} x${quantity})`,
        },
      });

      return newOrder;
    });

    // Step 5: Execute purchase against sources with failover (Max 3 sources)
    const maxFailoverAttempts = Math.min(3, candidateMappings.length);
    let finalOrderState = order;
    let deliveredLinks: string[] = [];

    for (let i = 0; i < maxFailoverAttempts; i++) {
      const candidate = candidateMappings[i];
      const source = candidate.sourceProduct.source;
      const externalProductId = candidate.sourceProduct.externalId;

      const adapter = createSourceAdapter({
        id: source.id,
        name: source.name,
        adapterType: source.adapterType,
        baseUrl: source.baseUrl,
        credentialsEncrypted: source.credentialsEncrypted,
        config: source.config,
        currency: source.currency,
        liveBuyEnabled: source.liveBuyEnabled,
        timeoutMs: source.timeoutMs,
      });

      const callStart = Date.now();
      let callResult: BuyResult;

      try {
        callResult = await adapter.buy(externalProductId, quantity);
      } catch (err: any) {
        callResult = {
          kind: 'UNKNOWN',
          error: err.message || 'Lỗi mạng không xác định',
          raw: JSON.stringify({ error: err.message }),
        };
      }

      const durationMs = Date.now() - callStart;

      // Log SourceCall
      await this.prisma.sourceCall.create({
        data: {
          sourceId: source.id,
          orderId: order.id,
          operation: 'BUY',
          externalProductId,
          quantity,
          result: callResult.kind,
          errorCode: callResult.kind === 'DEFINITE_FAIL' ? callResult.reason : undefined,
          responseEncrypted: callResult.raw ? encrypt(callResult.raw) : undefined,
          durationMs,
        },
      });

      // Handle SUCCESS
      if (callResult.kind === 'SUCCESS') {
        deliveredLinks = callResult.links;
        const warrantyUntil = new Date(Date.now() + product.warrantyMinutes * 60 * 1000);

        await this.prisma.$transaction(async (tx) => {
          // Save encrypted links in OrderItem
          for (const link of deliveredLinks) {
            await tx.orderItem.create({
              data: {
                orderId: order.id,
                linkEncrypted: encrypt(link),
                linkHash: hashSha256(link),
                origin: OrderItemOrigin.SOURCE,
              },
            });
          }

          // Complete Order
          finalOrderState = await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.COMPLETED,
              sourceId: source.id,
              unitCost: candidate.sourceProduct.costVnd,
              completedAt: new Date(),
              warrantyUntil,
            },
          });

          // Decrement stock in SourceProduct
          await tx.sourceProduct.update({
            where: { id: candidate.sourceProduct.id },
            data: {
              stock: { decrement: quantity },
            },
          });

          // Reset circuit breaker error counter
          await tx.source.update({
            where: { id: source.id },
            data: { consecutiveErrors: 0 },
          });
        });

        break; // Purchase succeeded, exit failover loop
      }

      // Handle DEFINITE_FAIL
      if (callResult.kind === 'DEFINITE_FAIL') {
        // Update cache/DB for this candidate
        if (callResult.reason === 'OUT_OF_STOCK') {
          await this.prisma.sourceProduct.update({
            where: { id: candidate.sourceProduct.id },
            data: { stock: 0 },
          });
        }

        // If another candidate exists, continue loop
        if (i < maxFailoverAttempts - 1) {
          continue;
        }

        // All candidates definite failed -> Refund user balance!
        await this.prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: { balance: { increment: totalPrice } },
          });

          const refundedUser = await tx.user.findUniqueOrThrow({ where: { id: userId } });

          await tx.walletTransaction.create({
            data: {
              userId,
              type: WalletTxType.REFUND,
              amount: totalPrice,
              balanceBefore: refundedUser.balance - totalPrice,
              balanceAfter: refundedUser.balance,
              refType: 'ORDER',
              refId: order.id,
              note: `Hoàn tiền đơn hàng ${order.code} do nguồn hết hàng`,
            },
          });

          finalOrderState = await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.FAILED,
              failReason: `Nguồn báo lỗi: ${callResult.reason}`,
            },
          });
        });

        break;
      }

      // Handle UNKNOWN (Timeout, 5xx, network error)
      if (callResult.kind === 'UNKNOWN') {
        // Section 6.4 step 5c: DO NOT retry! DO NOT failover! DO NOT auto-refund!
        await this.prisma.$transaction(async (tx) => {
          // Increment circuit breaker errors
          const updatedSrc = await tx.source.update({
            where: { id: source.id },
            data: { consecutiveErrors: { increment: 1 } },
          });

          // If reached threshold 5, trip to ERROR status
          if (updatedSrc.consecutiveErrors >= 5) {
            await tx.source.update({
              where: { id: source.id },
              data: { status: 'ERROR' },
            });
          }

          finalOrderState = await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.NEEDS_REVIEW,
              failReason: `Kết quả chưa rõ: ${callResult.error}. Đơn được chuyển cho Admin đối soát.`,
            },
          });
        });

        break;
      }
    }

    return this.formatOrderResponse(finalOrderState, deliveredLinks);
  }

  /**
   * Helper to format order output for API response
   */
  public formatOrderResponse(order: any, plainLinks: string[] = []) {
    let links = plainLinks;

    if (links.length === 0 && order.items && order.items.length > 0) {
      links = order.items.map((item: any) => {
        try {
          return decrypt(item.linkEncrypted);
        } catch {
          return '[LINK_ENCRYPTED]';
        }
      });
    }

    return {
      id: order.id,
      code: order.code,
      status: order.status,
      quantity: order.quantity,
      unitPrice: Number(order.unitPrice),
      totalPrice: Number(order.totalPrice),
      warrantyUntil: order.warrantyUntil,
      failReason: order.failReason,
      completedAt: order.completedAt,
      links,
    };
  }
}
