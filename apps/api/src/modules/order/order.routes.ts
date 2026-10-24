import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { OrderService } from './order.service';
import { prisma } from '../../plugins/prisma';
import { requireAuth } from '../../plugins/auth';
import {
  CreateOrderSchema,
  OrdersQuerySchema,
  CreateWarrantyTicketSchema,
  WarrantyStatus,
} from '@geminihub/shared';
import { decrypt } from '../../utils/crypto';

export const orderRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const orderService = new OrderService(prisma);

  // FR-ORD-01..08: Create Order
  fastify.post('/orders', { preHandler: [requireAuth] }, async (req, reply) => {
    const parseRes = CreateOrderSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      (req.body as any)?.idempotencyKey ||
      `KEY-${Date.now()}`;

    try {
      const order = await orderService.purchase({
        userId: req.user!.userId,
        productId: parseRes.data.productId,
        quantity: parseRes.data.quantity,
        mustUseAcknowledged: parseRes.data.mustUseAcknowledged,
        idempotencyKey,
      });

      return reply.status(200).send({ success: true, data: order });
    } catch (err: any) {
      return reply.status(400).send({
        error: { code: 'ORDER_FAILED', message: err.message },
      });
    }
  });

  // FR-HIST-01, FR-HIST-03: Order history
  fastify.get('/orders', { preHandler: [requireAuth] }, async (req, reply) => {
    const parseRes = OrdersQuerySchema.safeParse(req.query);
    const query = parseRes.success ? parseRes.data : { page: 1, limit: 20 };
    const userId = req.user!.userId;

    const where: any = { userId };
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = query.productId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          items: true,
          warrantyTicket: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    const formatted = orders.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      productName: o.product.name,
      productSlug: o.product.slug,
      quantity: o.quantity,
      unitPrice: Number(o.unitPrice),
      totalPrice: Number(o.totalPrice),
      failReason: o.failReason,
      warrantyUntil: o.warrantyUntil,
      hasWarrantyTicket: !!o.warrantyTicket,
      createdAt: o.createdAt,
      completedAt: o.completedAt,
      // For list view, links are masked by default (FR-HIST-02)
      linkCount: o.items.length,
    }));

    return reply.send({
      success: true,
      data: {
        items: formatted,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  });

  // FR-HIST-02, FR-HIST-05: Order detail with links
  fastify.get('/orders/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;

    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: {
        product: true,
        items: true,
        warrantyTicket: true,
      },
    });

    if (!order) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng' },
      });
    }

    // Decrypt links
    const links = order.items.map((item) => {
      let url = '';
      try {
        url = decrypt(item.linkEncrypted);
      } catch {
        url = '[Lỗi giải mã link]';
      }
      return {
        id: item.id,
        url,
        origin: item.origin,
        disabled: !!item.disabledAt,
      };
    });

    const isWarrantyAvailable =
      order.status === 'COMPLETED' &&
      order.warrantyUntil !== null &&
      new Date() < order.warrantyUntil &&
      !order.warrantyTicket;

    return reply.send({
      success: true,
      data: {
        id: order.id,
        code: order.code,
        status: order.status,
        product: {
          id: order.product.id,
          name: order.product.name,
          slug: order.product.slug,
          warrantyMinutes: order.product.warrantyMinutes,
        },
        quantity: order.quantity,
        unitPrice: Number(order.unitPrice),
        totalPrice: Number(order.totalPrice),
        failReason: order.failReason,
        warrantyUntil: order.warrantyUntil,
        isWarrantyAvailable,
        links,
        warrantyTicket: order.warrantyTicket,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
      },
    });
  });

  // FR-WAR-01, FR-WAR-02: Create warranty ticket
  fastify.post('/orders/:id/warranty', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;

    const parseRes = CreateWarrantyTicketSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: { warrantyTicket: true },
    });

    if (!order) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng' },
      });
    }

    if (order.status !== 'COMPLETED') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATUS', message: 'Chỉ đơn hàng đã hoàn thành mới có thể gửi bảo hành' },
      });
    }

    if (order.warrantyUntil && new Date() > order.warrantyUntil) {
      return reply.status(400).send({
        error: { code: 'WARRANTY_EXPIRED', message: 'Đơn hàng này đã hết hạn bảo hành' },
      });
    }

    if (order.warrantyTicket) {
      return reply.status(400).send({
        error: { code: 'TICKET_EXISTS', message: 'Đơn hàng đã có yêu cầu bảo hành đang xử lý' },
      });
    }

    const ticket = await prisma.warrantyTicket.create({
      data: {
        orderId: order.id,
        userId,
        reason: parseRes.data.reason,
        attachmentUrl: parseRes.data.attachmentUrl,
        status: WarrantyStatus.PENDING,
      },
    });

    return reply.status(201).send({
      success: true,
      message: 'Gửi yêu cầu bảo hành thành công. Admin sẽ kiểm tra và phản hồi sớm nhất.',
      data: ticket,
    });
  });
};

