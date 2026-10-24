import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AdminService } from '../../application/admin/admin.service';
import { prisma } from '../../infrastructure/database/prisma';
import { requireAdmin, requireStaffOrAdmin } from '../middlewares/auth.guard';
import { createSourceAdapter } from '../../infrastructure/adapters/factory';
import { encrypt, decrypt, maskSecret } from '../../infrastructure/security/crypto';
import { PricingService } from '../../domain/pricing/pricing.service';
import {
  CreateSourceSchema,
  UpdateSourceSchema,
  CreateProductSchema,
  UpdateProductSchema,
  AdjustUserBalanceSchema,
  FulfillManualOrderSchema,
  RefundOrderSchema,
  ResolveWarrantyTicketSchema,
  PricePreviewSchema,
  OrdersQuerySchema,
  OrderStatus,
  Role,
} from '@geminihub/shared';

export const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const adminService = new AdminService(prisma);

  // ----------------------------------------------------
  // Dashboard & Reports
  // ----------------------------------------------------
  fastify.get('/admin/dashboard', { preHandler: [requireAdmin] }, async (req, reply) => {
    const data = await adminService.getDashboard();
    return reply.send({ success: true, data });
  });

  fastify.get('/admin/stats/sources', { preHandler: [requireAdmin] }, async (req, reply) => {
    const data = await adminService.getSourceStats();
    return reply.send({ success: true, data });
  });

  // ----------------------------------------------------
  // Orders & Interventions
  // ----------------------------------------------------
  fastify.get('/admin/orders', { preHandler: [requireStaffOrAdmin] }, async (req, reply) => {
    const parseRes = OrdersQuerySchema.safeParse(req.query);
    const query = parseRes.success ? parseRes.data : { page: 1, limit: 20 };

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.productId) where.productId = query.productId;
    if (query.sourceId) where.sourceId = query.sourceId;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          user: { select: { id: true, email: true } },
          product: { select: { id: true, name: true, slug: true } },
          source: { select: { id: true, name: true } },
          items: true,
          sourceCalls: {
            select: { id: true, operation: true, result: true, durationMs: true, createdAt: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    const formatted = orders.map((o) => ({
      ...o,
      unitPrice: Number(o.unitPrice),
      totalPrice: Number(o.totalPrice),
      unitCost: Number(o.unitCost),
      items: o.items.map((i) => ({
        id: i.id,
        origin: i.origin,
        disabled: !!i.disabledAt,
        link: '[Bấm để giải mã xem link]',
      })),
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

  // FR-ADM-04: Fulfill manual order
  fastify.post('/admin/orders/:id/fulfill-manual', { preHandler: [requireStaffOrAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseRes = FulfillManualOrderSchema.safeParse({ ...(req.body as any), orderId: id });
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    try {
      const order = await adminService.fulfillManual(
        id,
        parseRes.data.links,
        parseRes.data.adminNote,
        req.user!.userId
      );
      return reply.send({ success: true, message: 'Đã hoàn tất đơn hàng thủ công', data: order });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        error: { code: err.code || 'FULFILL_FAILED', message: err.message },
      });
    }
  });

  // FR-ADM-04, FR-ADM-05: Refund order
  fastify.post('/admin/orders/:id/refund', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseRes = RefundOrderSchema.safeParse({ ...(req.body as any), orderId: id });
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    try {
      const order = await adminService.refundOrder(id, parseRes.data.reason, req.user!.userId);
      return reply.send({ success: true, message: 'Đã hoàn tiền đơn hàng vào ví khách', data: order });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        error: { code: err.code || 'REFUND_FAILED', message: err.message },
      });
    }
  });

  // ----------------------------------------------------
  // Sources Management (FR-SRC)
  // ----------------------------------------------------
  fastify.get('/admin/sources', { preHandler: [requireAdmin] }, async (req, reply) => {
    const sources = await prisma.source.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { products: true, orders: true },
        },
      },
    });

    const formatted = sources.map((s) => ({
      ...s,
      balance: Number(s.balance),
      lowBalanceAlert: Number(s.lowBalanceAlert),
      credentialsEncrypted: maskSecret(s.credentialsEncrypted),
      productCount: s._count.products,
      orderCount: s._count.orders,
    }));

    return reply.send({ success: true, data: formatted });
  });

  fastify.post('/admin/sources', { preHandler: [requireAdmin] }, async (req, reply) => {
    const parseRes = CreateSourceSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    const { credentials, config, lowBalanceAlert, ...rest } = parseRes.data;
    const credentialsEncrypted = encrypt(JSON.stringify(credentials));

    const source = await prisma.source.create({
      data: {
        ...rest,
        lowBalanceAlert: BigInt(lowBalanceAlert),
        credentialsEncrypted,
        config: JSON.stringify(config || {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.userId,
        action: 'SOURCE_CREATE',
        target: `Source:${source.id}`,
        after: JSON.stringify({ name: source.name, adapterType: source.adapterType }),
      },
    });

    return reply.status(201).send({
      success: true,
      data: {
        ...source,
        balance: Number(source.balance),
        lowBalanceAlert: Number(source.lowBalanceAlert),
        credentialsEncrypted: maskSecret(credentialsEncrypted),
      },
    });
  });

  fastify.patch('/admin/sources/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseRes = UpdateSourceSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    const { credentials, config, lowBalanceAlert, ...rest } = parseRes.data;
    const updateData: any = { ...rest };

    if (credentials) {
      updateData.credentialsEncrypted = encrypt(JSON.stringify(credentials));
    }
    if (config) {
      updateData.config = JSON.stringify(config);
    }
    if (lowBalanceAlert !== undefined) {
      updateData.lowBalanceAlert = BigInt(lowBalanceAlert);
    }

    const updated = await prisma.source.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.userId,
        action: 'SOURCE_UPDATE',
        target: `Source:${id}`,
        after: JSON.stringify(updateData),
      },
    });

    return reply.send({
      success: true,
      data: {
        ...updated,
        balance: Number(updated.balance),
        lowBalanceAlert: Number(updated.lowBalanceAlert),
        credentialsEncrypted: maskSecret(updated.credentialsEncrypted),
      },
    });
  });

  fastify.delete('/admin/sources/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.source.delete({ where: { id } });
    return reply.send({ success: true, message: 'Đã xóa nguồn thành công' });
  });

  // FR-SRC-07: Test connection (Never calls buy)
  fastify.post('/admin/sources/:id/test', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const source = await prisma.source.findUniqueOrThrow({ where: { id } });

    const adapter = createSourceAdapter(source);
    const testResult = await adapter.testConnection();

    let balanceInfo = null;
    let productsFound = 0;

    if (testResult.ok) {
      try {
        balanceInfo = await adapter.getBalance();
        const products = await adapter.listProducts();
        productsFound = products.length;

        await prisma.source.update({
          where: { id },
          data: {
            balance: BigInt(balanceInfo.amount),
            balanceSyncedAt: new Date(),
            consecutiveErrors: 0,
          },
        });
      } catch (e: any) {
        testResult.ok = false;
        testResult.error = e.message;
      }
    }

    return reply.send({
      success: testResult.ok,
      latencyMs: testResult.latencyMs,
      error: testResult.error,
      balance: balanceInfo,
      productsCount: productsFound,
    });
  });

  // FR-SRC-12: Sync products and balance
  fastify.post('/admin/sources/:id/sync', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const source = await prisma.source.findUniqueOrThrow({ where: { id } });

    const adapter = createSourceAdapter(source);
    const [balanceResult, products] = await Promise.all([
      adapter.getBalance(),
      adapter.listProducts(),
    ]);

    await prisma.source.update({
      where: { id },
      data: {
        balance: BigInt(balanceResult.amount),
        balanceSyncedAt: new Date(),
        consecutiveErrors: 0,
      },
    });

    const now = new Date();
    for (const p of products) {
      await prisma.sourceProduct.upsert({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: p.externalId,
          },
        },
        create: {
          sourceId: source.id,
          externalId: p.externalId,
          name: p.name,
          rawPrice: p.rawPrice,
          costVnd: BigInt(p.costVnd),
          stock: p.stock,
          description: p.description,
          lastSeenAt: now,
        },
        update: {
          name: p.name,
          rawPrice: p.rawPrice,
          costVnd: BigInt(p.costVnd),
          stock: p.stock,
          description: p.description,
          lastSeenAt: now,
          missing: false,
        },
      });
    }

    return reply.send({
      success: true,
      message: `Đã đồng bộ thành công ${products.length} sản phẩm và số dư ${balanceResult.amount.toLocaleString('vi-VN')}đ`,
      count: products.length,
      balance: balanceResult.amount,
    });
  });

  // FR-SRC-09: Test buy 1 unit (requires confirming source name)
  fastify.post('/admin/sources/:id/test-buy', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { externalProductId, confirmSourceName } = req.body as {
      externalProductId: string;
      confirmSourceName: string;
    };

    const source = await prisma.source.findUniqueOrThrow({ where: { id } });

    if (confirmSourceName.trim() !== source.name.trim()) {
      return reply.status(400).send({
        error: { code: 'CONFIRMATION_MISMATCH', message: 'Tên nguồn xác nhận không khớp' },
      });
    }

    const adapter = createSourceAdapter(source);
    const start = Date.now();
    const result = await adapter.buy(externalProductId, 1);
    const durationMs = Date.now() - start;

    const callLog = await prisma.sourceCall.create({
      data: {
        sourceId: source.id,
        operation: 'BUY',
        externalProductId,
        quantity: 1,
        result: result.kind,
        errorCode: result.kind === 'DEFINITE_FAIL' ? result.reason : undefined,
        responseEncrypted: result.raw ? encrypt(result.raw) : undefined,
        durationMs,
      },
    });

    return reply.send({
      success: result.kind === 'SUCCESS',
      result,
      durationMs,
      callId: callLog.id,
    });
  });

  // FR-SRC-11: Products of a source
  fastify.get('/admin/sources/:id/products', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const products = await prisma.sourceProduct.findMany({
      where: { sourceId: id },
      orderBy: { updatedAt: 'desc' },
      include: {
        productSources: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });

    return reply.send({
      success: true,
      data: products.map((p) => ({
        ...p,
        costVnd: Number(p.costVnd),
        mappedProducts: p.productSources.map((ps) => ps.product),
      })),
    });
  });

  // FR-SRC-14: Source call logs
  fastify.get('/admin/sources/:id/calls', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const calls = await prisma.sourceCall.findMany({
      where: { sourceId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { order: { select: { id: true, code: true } } },
    });

    return reply.send({
      success: true,
      data: calls.map((c) => ({
        ...c,
        responseEncrypted: undefined,
        hasRawPayload: !!c.responseEncrypted,
      })),
    });
  });

  // FR-SRC-14: Decrypt raw call response on demand + write AuditLog
  fastify.get('/admin/calls/:callId/raw', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { callId } = req.params as { callId: string };
    const call = await prisma.sourceCall.findUniqueOrThrow({ where: { id: callId } });

    if (!call.responseEncrypted) {
      return reply.send({ success: true, raw: null });
    }

    const decryptedRaw = decrypt(call.responseEncrypted);

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.userId,
        action: 'VIEW_RAW_SOURCE_CALL',
        target: `SourceCall:${callId}`,
      },
    });

    return reply.send({ success: true, raw: decryptedRaw });
  });

  // ----------------------------------------------------
  // Products & Pricing Management (FR-MAP, FR-PRICE)
  // ----------------------------------------------------
  fastify.get('/admin/products', { preHandler: [requireAdmin] }, async (req, reply) => {
    const products = await prisma.product.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        sources: {
          include: {
            sourceProduct: {
              include: { source: { select: { id: true, name: true, status: true } } },
            },
          },
          orderBy: { priority: 'asc' },
        },
      },
    });

    return reply.send({
      success: true,
      data: products.map((p) => ({
        ...p,
        currentPrice: Number(p.currentPrice),
        pendingPrice: p.pendingPrice ? Number(p.pendingPrice) : null,
        fixedPrice: p.fixedPrice ? Number(p.fixedPrice) : null,
        markupAmount: Number(p.markupAmount),
        minPrice: p.minPrice ? Number(p.minPrice) : null,
        maxPrice: p.maxPrice ? Number(p.maxPrice) : null,
        minMarginAmount: Number(p.minMarginAmount),
        sources: p.sources.map((s) => ({
          ...s,
          maxCost: s.maxCost ? Number(s.maxCost) : null,
          sourceProduct: {
            ...s.sourceProduct,
            costVnd: Number(s.sourceProduct.costVnd),
          },
        })),
      })),
    });
  });

  fastify.post('/admin/products', { preHandler: [requireAdmin] }, async (req, reply) => {
    const parseRes = CreateProductSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    const { sources, fixedPrice, markupAmount, minPrice, maxPrice, minMarginAmount, ...rest } =
      parseRes.data;

    const product = await prisma.product.create({
      data: {
        ...rest,
        fixedPrice: fixedPrice ? BigInt(fixedPrice) : null,
        markupAmount: BigInt(markupAmount),
        minPrice: minPrice ? BigInt(minPrice) : null,
        maxPrice: maxPrice ? BigInt(maxPrice) : null,
        minMarginAmount: BigInt(minMarginAmount),
      },
    });

    if (sources && sources.length > 0) {
      for (const m of sources) {
        await prisma.productSource.create({
          data: {
            productId: product.id,
            sourceProductId: m.sourceProductId,
            priority: m.priority,
            enabled: m.enabled,
            maxCost: m.maxCost ? BigInt(m.maxCost) : null,
          },
        });
      }
    }

    return reply.status(201).send({ success: true, data: product });
  });

  // FR-PRICE-07: Preview pricing calculation before saving
  fastify.post('/admin/products/price-preview', { preHandler: [requireAdmin] }, async (req, reply) => {
    const parseRes = PricePreviewSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    const input = parseRes.data;
    const candidates = input.mappings.map((m, idx) => ({
      sourceId: `src-${idx}`,
      sourceProductId: `sp-${idx}`,
      sourceName: m.sourceName,
      externalId: `ext-${idx}`,
      costVnd: m.costVnd,
      stock: 99,
      priority: m.priority,
      enabled: m.enabled,
    }));

    const result = PricingService.calculate(
      {
        pricingMode: input.pricingMode,
        fixedPrice: input.fixedPrice,
        markupPercent: input.markupPercent,
        markupAmount: input.markupAmount,
        costBasis: input.costBasis,
        roundingStep: input.roundingStep,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        minMarginAmount: input.minMarginAmount,
      },
      candidates
    );

    return reply.send({ success: true, data: result });
  });

  // FR-PRICE-06: Approve pending price change
  fastify.post('/admin/products/:id/approve-price', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const product = await prisma.product.findUniqueOrThrow({ where: { id } });

    if (!product.pendingPrice) {
      return reply.status(400).send({
        error: { code: 'NO_PENDING_PRICE', message: 'Sản phẩm này không có giá mới cần duyệt' },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.priceHistory.create({
        data: {
          productId: id,
          oldPrice: product.currentPrice,
          newPrice: product.pendingPrice!,
          costBasis: BigInt(0),
          reason: 'Admin phê duyệt giá mới sau khi đồng bộ vượt ngưỡng',
          actorId: req.user!.userId,
        },
      });

      return await tx.product.update({
        where: { id },
        data: {
          currentPrice: product.pendingPrice!,
          pendingPrice: null,
        },
      });
    });

    return reply.send({
      success: true,
      message: 'Đã phê duyệt giá bán mới thành công',
      newPrice: Number(updated.currentPrice),
    });
  });

  // ----------------------------------------------------
  // Warranty Tickets Management (FR-ADM-08)
  // ----------------------------------------------------
  fastify.get('/admin/warranties', { preHandler: [requireStaffOrAdmin] }, async (req, reply) => {
    const tickets = await prisma.warrantyTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true } },
        order: {
          select: {
            id: true,
            code: true,
            warrantyUntil: true,
            totalPrice: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    return reply.send({
      success: true,
      data: tickets.map((t) => ({
        ...t,
        order: {
          ...t.order,
          totalPrice: Number(t.order.totalPrice),
        },
      })),
    });
  });

  fastify.post('/admin/warranties/:id/resolve', { preHandler: [requireStaffOrAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseRes = ResolveWarrantyTicketSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    const { resolution, manualLink, adminNote } = parseRes.data;
    const ticket = await prisma.warrantyTicket.findUniqueOrThrow({
      where: { id },
      include: { order: true },
    });

    await prisma.$transaction(async (tx) => {
      if (resolution === 'REFUNDED') {
        const order = ticket.order;
        await tx.user.update({
          where: { id: ticket.userId },
          data: { balance: { increment: order.totalPrice } },
        });

        const updatedUser = await tx.user.findUniqueOrThrow({ where: { id: ticket.userId } });

        await tx.walletTransaction.create({
          data: {
            userId: ticket.userId,
            type: 'REFUND',
            amount: order.totalPrice,
            balanceBefore: updatedUser.balance - order.totalPrice,
            balanceAfter: updatedUser.balance,
            refType: 'WARRANTY',
            refId: ticket.id,
            note: `Hoàn tiền bảo hành đơn ${order.code}`,
          },
        });
      }

      if (resolution === 'REPLACED_MANUAL' && manualLink) {
        await tx.orderItem.updateMany({
          where: { orderId: ticket.orderId },
          data: { disabledAt: new Date() },
        });

        await tx.orderItem.create({
          data: {
            orderId: ticket.orderId,
            linkEncrypted: encrypt(manualLink),
            linkHash: `WARRANTY-${Date.now()}`,
            origin: 'WARRANTY',
          },
        });
      }

      await tx.warrantyTicket.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolution: resolution as any,
          adminNote,
          resolvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.userId,
          action: 'WARRANTY_RESOLVE',
          target: `WarrantyTicket:${id}`,
          after: JSON.stringify({ resolution, adminNote }),
        },
      });
    });

    return reply.send({ success: true, message: 'Đã xử lý ticket bảo hành thành công' });
  });

  // ----------------------------------------------------
  // User Management (FR-ADM-06)
  // ----------------------------------------------------
  fastify.get('/admin/users', { preHandler: [requireAdmin] }, async (req, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        balance: true,
        createdAt: true,
        _count: {
          select: { orders: true, topups: true },
        },
      },
    });

    return reply.send({
      success: true,
      data: users.map((u) => ({
        ...u,
        balance: Number(u.balance),
        orderCount: u._count.orders,
        topupCount: u._count.topups,
      })),
    });
  });

  fastify.post('/admin/users/:id/adjust-balance', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseRes = AdjustUserBalanceSchema.safeParse({ ...(req.body as any), userId: id });
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    try {
      const result = await adminService.adjustBalance(
        id,
        parseRes.data.amount,
        parseRes.data.reason,
        req.user!.userId
      );
      return reply.send({ success: true, message: 'Điều chỉnh số dư thành công', data: result });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        error: { code: err.code || 'ADJUST_FAILED', message: err.message },
      });
    }
  });

  // ----------------------------------------------------
  // Audit Logs (FR-ADM-11)
  // ----------------------------------------------------
  fastify.get('/admin/audit-logs', { preHandler: [requireAdmin] }, async (req, reply) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return reply.send({ success: true, data: logs });
  });
};

