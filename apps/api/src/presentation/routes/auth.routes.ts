import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { AuthService } from '../../application/auth/auth.service';
import { prisma } from '../../infrastructure/database/prisma';
import { requireAuth } from '../middlewares/auth.guard';
import {
  RegisterSchema,
  LoginSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
} from '@geminihub/shared';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const authService = new AuthService(prisma, (payload) => fastify.jwt.sign(payload, { expiresIn: '15m' }));

  // FR-AUTH-01: Register
  fastify.post('/auth/register', async (req, reply) => {
    const parseRes = RegisterSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    try {
      const user = await authService.register(parseRes.data);
      return reply.status(201).send({ success: true, data: user });
    } catch (err: any) {
      return reply.status(400).send({
        error: { code: err.code || 'REGISTER_FAILED', message: err.message },
      });
    }
  });

  // FR-AUTH-02: Login
  fastify.post('/auth/login', async (req, reply) => {
    const parseRes = LoginSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    try {
      const ip = req.ip;
      const userAgent = req.headers['user-agent'];
      const result = await authService.login(parseRes.data, { ip, userAgent });

      // Set httpOnly cookie for refresh token (30 days)
      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        path: '/api/v1/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      return reply.send({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 401).send({
        error: { code: err.code || 'LOGIN_FAILED', message: err.message },
      });
    }
  });

  // FR-AUTH-02, FR-AUTH-03: Refresh token
  fastify.post('/auth/refresh', async (req, reply) => {
    const refreshToken = (req.cookies as any)?.refreshToken || (req.body as any)?.refreshToken;
    if (!refreshToken) {
      return reply.status(401).send({
        error: { code: 'NO_REFRESH_TOKEN', message: 'Vui lòng cung cấp refresh token' },
      });
    }

    try {
      const ip = req.ip;
      const userAgent = req.headers['user-agent'];
      const result = await authService.refresh(refreshToken, { ip, userAgent });

      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        path: '/api/v1/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
      });

      return reply.send({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 401).send({
        error: { code: err.code || 'REFRESH_FAILED', message: err.message },
      });
    }
  });

  // FR-AUTH-04: Logout
  fastify.post('/auth/logout', async (req, reply) => {
    const refreshToken = (req.cookies as any)?.refreshToken || (req.body as any)?.refreshToken;
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {}
    }

    reply.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return reply.send({ success: true, message: 'Đăng xuất thành công' });
  });

  // FR-AUTH-05: Forgot password
  fastify.post('/auth/forgot-password', async (req, reply) => {
    const parseRes = ForgotPasswordSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    await authService.forgotPassword(parseRes.data.email);
    return reply.send({
      success: true,
      message: 'Nếu email tồn tại trên hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu',
    });
  });

  // FR-AUTH-05: Change password
  fastify.post('/auth/change-password', { preHandler: [requireAuth] }, async (req, reply) => {
    const parseRes = ChangePasswordSchema.safeParse(req.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseRes.error.errors[0].message },
      });
    }

    try {
      await authService.changePassword(req.user!.userId, parseRes.data);
      reply.clearCookie('refreshToken', { path: '/api/v1/auth' });
      return reply.send({
        success: true,
        message: 'Đổi mật khẩu thành công. Các phiên đăng nhập khác đã được thu hồi.',
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({
        error: { code: err.code || 'PASSWORD_CHANGE_FAILED', message: err.message },
      });
    }
  });

  // Get current user profile
  fastify.get('/auth/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        role: true,
        balance: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy thông tin tài khoản' },
      });
    }

    return reply.send({
      success: true,
      data: {
        ...user,
        balance: Number(user.balance),
      },
    });
  });
};

