import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WalletService } from '../../application/wallet/wallet.service';
import { prisma } from '../../infrastructure/database/prisma';
import { requireAuth } from '../middlewares/auth.guard';
import { CreateTopupSchema, WalletTransactionsQuerySchema } from '@geminihub/shared';

export const walletRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const walletService = new WalletService(prisma);

  // FR-WAL-02: Get balance ledger transactions
  fastify.get('/wallet/transactions', { preHandler: [requireAuth] }, async (req, reply) => {
    const parseRes = WalletTransactionsQuerySchema.safeParse(req.query);
    const query = parseRes.success ? parseRes.data : { page: 1, limit: 20, type: undefined };
    const userId = req.user!.userId;

    const where: any = { userId };
    if (query.type) {
      where.type = query.type;
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: {
        items: transactions.map((t) => ({
          ...t,
          amount: Number(t.amount),
          balanceBefore: Number(t.balanceBefore),
          balanceAfter: Number(t.balanceAfter),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  });

  // FR-WAL-03, FR-WAL-04: Create topup
  fastify.post('/topups', { preHandler: [requireAuth] }, async (req, reply) => {
    const parseRes = CreateTopupSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    try {
      const topup = await walletService.createTopup(req.user!.userId, parseRes.data);
      return reply.status(201).send({ success: true, data: topup });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        error: { code: err.code || 'TOPUP_CREATION_FAILED', message: err.message },
      });
    }
  });

  // Get user's topup history
  fastify.get('/topups', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.user!.userId;
    const topups = await prisma.topup.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return reply.send({
      success: true,
      data: topups.map((t) => ({
        ...t,
        amount: Number(t.amount),
        paidAmount: Number(t.paidAmount),
      })),
    });
  });

  // FR-WAL-05: Poll topup status
  fastify.get('/topups/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;

    const topup = await prisma.topup.findFirst({
      where: { id, userId },
    });

    if (!topup) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy lệnh nạp' },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: topup.id,
        code: topup.code,
        amount: Number(topup.amount),
        paidAmount: Number(topup.paidAmount),
        status: topup.status,
        expiresAt: topup.expiresAt,
        paidAt: topup.paidAt,
      },
    });
  });
};
