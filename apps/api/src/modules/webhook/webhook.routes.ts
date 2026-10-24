import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WalletService } from '../wallet/wallet.service';
import { prisma } from '../../plugins/prisma';
import { SepayWebhookSchema } from '@geminihub/shared';

export const webhookRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const walletService = new WalletService(prisma);

  fastify.post('/webhooks/payment', async (req, reply) => {
    // Optional secret verification from header
    const authHeader = req.headers['authorization'];
    const expectedKey = process.env.SEPAY_API_KEY;

    if (expectedKey && authHeader && !authHeader.includes(expectedKey)) {
      return reply.status(401).send({ error: { message: 'Unauthorized webhook' } });
    }

    const parseRes = SepayWebhookSchema.safeParse(req.body);
    if (!parseRes.success) {
      // Return 200 anyway to prevent webhook retry spam from bank gateways for invalid schemas
      return reply.status(200).send({
        success: false,
        message: 'Invalid payload structure, ignored',
      });
    }

    try {
      const result = await walletService.handlePaymentWebhook(parseRes.data);
      return reply.status(200).send(result);
    } catch (err: any) {
      fastify.log.error(err, 'Lỗi xử lý webhook thanh toán');
      // Always return 200 as per Section 8.4 ("Luôn trả 200 sau khi đã lưu")
      return reply.status(200).send({
        success: false,
        error: err.message,
      });
    }
  });
};

