import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { env } from '../core/config/env';
import { sanitizeLogData } from '../infrastructure/security/sanitizer';
import { AppError } from '../core/errors/AppError';
import { errorLogger } from '../infrastructure/logging/error-logger.service';
import { ErrorSeverity, ClientErrorPayloadSchema } from '@geminihub/shared';
import { requireAuth } from './middlewares/auth.guard';

import { authRoutes } from './routes/auth.routes';
import { walletRoutes } from './routes/wallet.routes';
import { productRoutes } from './routes/product.routes';
import { orderRoutes } from './routes/order.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { adminRoutes } from './routes/admin.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            path: req.routeOptions?.url,
            parameters: sanitizeLogData(req.params),
          };
        },
      },
    },
  });

  // Security Helmet
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // CORS
  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Cookies & JWT
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  // Rate Limiting
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // Swagger Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'GeminiHub Enterprise API',
        description: 'Tài liệu API hệ thống bán lại link kích hoạt Gemini - Clean Architecture',
        version: '1.0.0',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Healthcheck
  app.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  // API v1 Routing
  await app.register(
    async (v1) => {
      await v1.register(authRoutes);
      await v1.register(walletRoutes);
      await v1.register(productRoutes);
      await v1.register(orderRoutes);
      await v1.register(webhookRoutes);
      await v1.register(adminRoutes);

      // Client-side crash / error reporting route (Rate-limited, accepts client exceptions)
      v1.post('/logs/client-error', async (req, reply) => {
        const parseRes = ClientErrorPayloadSchema.safeParse(req.body);
        if (!parseRes.success) {
          return reply.status(400).send({
            error: { code: 'INVALID_PAYLOAD', message: parseRes.error.errors[0].message },
          });
        }
        const user = (req as any).user;
        await errorLogger.logClientError({
          message: parseRes.data.message,
          stack: parseRes.data.stack,
          url: parseRes.data.url,
          context: parseRes.data.context,
          userId: user?.userId,
          userEmail: user?.email,
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string,
        });
        return reply.send({ success: true, message: 'Đã tiếp nhận báo cáo lỗi' });
      });

      // User-specific error log history
      v1.get('/user/logs', { preHandler: [requireAuth] }, async (req, reply) => {
        const user = (req as any).user;
        const logs = await errorLogger.listUserErrors(user.userId, 20);
        return reply.send({ success: true, data: logs });
      });
    },
    { prefix: '/api/v1' }
  );

  // Global Error Handler
  app.setErrorHandler(async (error: any, req, reply) => {
    app.log.error(sanitizeLogData(error));

    const user = (req as any).user;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] as string;
    const path = req.url;
    const method = req.method;

    if (error instanceof AppError) {
      const isServerError = error.statusCode >= 500;
      await errorLogger.recordError({
        severity: isServerError ? ErrorSeverity.FATAL : ErrorSeverity.WARN,
        source: 'API',
        code: error.code,
        message: error.message,
        stack: isServerError ? error.stack : undefined,
        context: {
          details: error.details,
          params: req.params,
          query: req.query,
        },
        userId: user?.userId,
        userEmail: user?.email,
        ip,
        userAgent,
        path,
        method,
      });

      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    const statusCode = error.statusCode || 500;
    const isFatal = statusCode >= 500;

    await errorLogger.recordError({
      severity: isFatal ? ErrorSeverity.FATAL : ErrorSeverity.WARN,
      source: isFatal ? 'SYSTEM' : 'API',
      code: error.code || (isFatal ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
      message: error.message || 'Đã có lỗi xảy ra trên hệ thống',
      stack: isFatal ? error.stack : undefined,
      context: {
        params: req.params,
        query: req.query,
      },
      userId: user?.userId,
      userEmail: user?.email,
      ip,
      userAgent,
      path,
      method,
    });

    return reply.status(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Đã có lỗi xảy ra trên hệ thống',
      },
    });
  });

  return app;
}

