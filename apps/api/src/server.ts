import dotenv from 'dotenv';
dotenv.config();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { authRoutes } from './modules/auth/auth.routes';
import { walletRoutes } from './modules/wallet/wallet.routes';
import { productRoutes } from './modules/product/product.routes';
import { orderRoutes } from './modules/order/order.routes';
import { webhookRoutes } from './modules/webhook/webhook.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { backgroundWatcher } from './jobs/watcher';
import { sanitizeLogData } from './utils/sanitizer';

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
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

async function main() {
  // NFR-10: Security Helmet
  await server.register(helmet, {
    contentSecurityPolicy: false, // Disabled for swagger docs / embedded UI
  });

  // NFR-10: CORS
  await server.register(cors, {
    origin: process.env.WEB_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Cookies & JWT
  await server.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'fallback-cookie-secret-2026',
  });

  await server.register(jwt, {
    secret: process.env.JWT_SECRET || 'fallback-jwt-secret-2026',
  });

  // NFR-08: Rate Limiting
  await server.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // Section 8.2: Swagger API Documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'GeminiHub API',
        description: 'Tài liệu API hệ thống bán lại link kích hoạt Gemini',
        version: '1.0.0',
      },
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // NFR-14: Healthcheck
  server.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  // Section 8.2: Register API modules under /api/v1
  server.register(
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
  server.setErrorHandler((error: any, req, reply) => {
    server.log.error(sanitizeLogData(error));
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Đã có lỗi xảy ra trên hệ thống',
      },
    });
  });

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';

  await server.listen({ port, host });
  console.log(`🚀 GeminiHub Backend API running on http://${host}:${port}`);
  console.log(`📑 Swagger Documentation available at http://${host}:${port}/docs`);

  // Start background watcher
  backgroundWatcher.start(30000);
}

main().catch((err) => {
  console.error('Fatal backend startup error:', err);
  process.exit(1);
});
