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
    },
    { prefix: '/api/v1' }
  );

  // Global Error Handler
  app.setErrorHandler((error: any, req, reply) => {
    app.log.error(sanitizeLogData(error));

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Đã có lỗi xảy ra trên hệ thống',
      },
    });
  });

  return app;
}
