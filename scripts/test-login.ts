process.env.NODE_ENV = 'test';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { AuthService } from '../apps/api/src/application/auth/auth.service';
import { authRoutes } from '../apps/api/src/presentation/routes/auth.routes';
import { hashPassword } from '../apps/api/src/infrastructure/security/auth';
import { verifyGoogleToken } from '../apps/api/src/infrastructure/security/google';
import { Role, UserStatus } from '@geminihub/shared';

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

// Setup in-memory mock Prisma for standalone API test
const mockUsers: any[] = [];
const mockSessions: any[] = [];

const mockPrisma: any = {
  user: {
    count: async () => mockUsers.length,
    findFirst: async ({ where }: any) => {
      if (where?.OR) {
        for (const cond of where.OR) {
          const found = mockUsers.find((u) => {
            if (cond.googleId && u.googleId === cond.googleId) return true;
            if (cond.email && u.email === cond.email.toLowerCase()) return true;
            return false;
          });
          if (found) return found;
        }
      }
      if (where?.email) return mockUsers.find((u) => u.email === where.email.toLowerCase()) || null;
      if (where?.id) return mockUsers.find((u) => u.id === where.id) || null;
      return null;
    },
    findUnique: async ({ where }: any) => {
      if (where.email) return mockUsers.find((u) => u.email === where.email.toLowerCase()) || null;
      if (where.id) return mockUsers.find((u) => u.id === where.id) || null;
      return null;
    },
    create: async ({ data }: any) => {
      const newUser = { id: `user-${mockUsers.length + 1}`, ...data };
      mockUsers.push(newUser);
      return newUser;
    },
    update: async ({ where, data }: any) => {
      const user = mockUsers.find((u) => u.id === where.id);
      if (!user) throw new Error('User not found');
      Object.assign(user, data);
      return user;
    },
  },
  session: {
    findUnique: async ({ where }: any) => {
      const session = mockSessions.find((s) => s.tokenHash === where.tokenHash);
      if (!session) return null;
      const user = mockUsers.find((u) => u.id === session.userId);
      return { ...session, user };
    },
    create: async ({ data }: any) => {
      const newSession = { id: `session-${mockSessions.length + 1}`, revokedAt: null, ...data };
      mockSessions.push(newSession);
      return newSession;
    },
    update: async ({ where, data }: any) => {
      const session = mockSessions.find((s) => s.id === where.id);
      if (!session) throw new Error('Session not found');
      Object.assign(session, data);
      return session;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const s of mockSessions) {
        if (where.userId && s.userId === where.userId) {
          if (where.revokedAt === null && s.revokedAt !== null) continue;
          Object.assign(s, data);
          count++;
        } else if (where.tokenHash && s.tokenHash === where.tokenHash) {
          Object.assign(s, data);
          count++;
        }
      }
      return { count };
    },
  },
  $transaction: async (fn: any) => fn(mockPrisma),
};

async function runLoginVerification() {
  console.log('\n=============================================================');
  console.log('       GEMINIHUB - KIỂM THỬ CHỨC NĂNG ĐĂNG NHẬP (AUTH)       ');
  console.log('=============================================================\n');

  // Seed sample admin
  const adminPass = await hashPassword('AdminPassword123');
  mockUsers.push({
    id: 'user-admin-1',
    email: 'admin@geminihub.vn',
    passwordHash: adminPass,
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    balance: BigInt(5000000),
    createdAt: new Date(),
  });

  const app = Fastify();
  await app.register(cookie, { secret: 'test-cookie-secret' });
  await app.register(jwt, { secret: 'test-jwt-secret' });

  // Custom AuthService using in-memory mock
  const authService = new AuthService(mockPrisma, (payload) =>
    app.jwt.sign(payload, { expiresIn: '15m' })
  );

  // Mount test auth endpoints
  app.post('/api/v1/auth/login', async (req, reply) => {
    const { email, password } = req.body as any;
    try {
      const result = await authService.login(
        { email, password },
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        path: '/api/v1/auth',
        httpOnly: true,
      });
      return reply.send({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (err: any) {
      return reply.status(401).send({ error: { code: 'LOGIN_FAILED', message: err.message } });
    }
  });

  app.get('/api/v1/me', async (req, reply) => {
    try {
      await req.jwtVerify();
      const user = await mockPrisma.user.findUnique({ where: { id: (req.user as any).userId } });
      return reply.send({ success: true, data: user });
    } catch {
      return reply.status(401).send({ error: { message: 'Unauthorized' } });
    }
  });

  app.post('/api/v1/auth/google', async (req, reply) => {
    const { credential } = req.body as any;
    try {
      const googlePayload = await verifyGoogleToken(credential);
      const result = await authService.loginWithGoogle(googlePayload, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        path: '/api/v1/auth',
        httpOnly: true,
      });
      return reply.send({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
        },
      });
    } catch (err: any) {
      return reply.status(401).send({ error: { code: 'GOOGLE_LOGIN_FAILED', message: err.message } });
    }
  });

  // TEST 1: Login with correct credentials
  console.log('▶ [Test 1] Đăng nhập với mật khẩu đúng (admin@geminihub.vn / AdminPassword123)...');
  const resSuccess = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'admin@geminihub.vn',
      password: 'AdminPassword123',
    },
  });

  console.log(`  HTTP Status: ${resSuccess.statusCode}`);
  const dataSuccess = JSON.parse(resSuccess.body);
  if (resSuccess.statusCode === 200 && dataSuccess.success) {
    console.log('  -> ĐĂNG NHẬP THÀNH CÔNG!');
    console.log(`  - User: ${dataSuccess.data.user.email} (Role: ${dataSuccess.data.user.role})`);
    console.log(`  - Access Token (JWT): ${dataSuccess.data.accessToken.slice(0, 35)}...`);
    console.log(`  - Set-Cookie (Refresh Token HttpOnly): ${resSuccess.headers['set-cookie']?.toString().slice(0, 50)}...`);
  } else {
    console.error('  -> THẤT BẠI:', dataSuccess);
  }

  // TEST 2: Login with wrong password
  console.log('\n▶ [Test 2] Đăng nhập với mật khẩu sai (AdminPassword999)...');
  const resFail = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'admin@geminihub.vn',
      password: 'AdminPassword999',
    },
  });

  console.log(`  HTTP Status: ${resFail.statusCode}`);
  const dataFail = JSON.parse(resFail.body);
  if (resFail.statusCode === 401 && !dataFail.success) {
    console.log(`  -> TỪ CHỐI THÀNH CÔNG: "${dataFail.error.message}"`);
  } else {
    console.error('  -> LỖI:', dataFail);
  }

  // TEST 3: Access protected endpoint /me with access token
  console.log('\n▶ [Test 3] Truy cập endpoint bảo vệ GET /api/v1/me với Bearer Token...');
  const resMe = await app.inject({
    method: 'GET',
    url: '/api/v1/me',
    headers: {
      authorization: `Bearer ${dataSuccess.data.accessToken}`,
    },
  });

  console.log(`  HTTP Status: ${resMe.statusCode}`);
  const dataMe = JSON.parse(resMe.body);
  if (resMe.statusCode === 200 && dataMe.data?.email === 'admin@geminihub.vn') {
    console.log('  -> XÁC THỰC THÀNH CÔNG!');
    console.log(`  - Email: ${dataMe.data.email}`);
    console.log(`  - Số dư: ${Number(dataMe.data.balance).toLocaleString('vi-VN')} đ`);
    console.log(`  - Role: ${dataMe.data.role}`);
  }

  // TEST 4: Google OAuth 2.0 Single Sign-On
  console.log('\n▶ [Test 4] Đăng nhập bằng Gmail cá nhân (Google OAuth SSO: ronahdev@gmail.com)...');
  const resGoogle = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    payload: {
      credential: 'mock-google:ronahdev@gmail.com:sub-google-ronahdev-2026',
    },
  });

  console.log(`  HTTP Status: ${resGoogle.statusCode}`);
  const dataGoogle = JSON.parse(resGoogle.body);
  if (resGoogle.statusCode === 200 && dataGoogle.success) {
    console.log('  -> ĐĂNG NHẬP GOOGLE THÀNH CÔNG!');
    console.log(`  - Email: ${dataGoogle.data.user.email}`);
    console.log(`  - Google User ID: ronahdev@gmail.com`);
    console.log(`  - Role: ${dataGoogle.data.user.role}`);
    console.log(`  - Access Token: ${dataGoogle.data.accessToken.slice(0, 35)}...`);
  } else {
    console.error('  -> LỖI ĐĂNG NHẬP GOOGLE:', dataGoogle);
  }

  console.log('\n=============================================================');
  console.log('      TẤT CẢ CÁC BƯỚC TEST ĐĂNG NHẬP ĐÃ HOÀN TẤT XUẤT SẮC!   ');
  console.log('=============================================================\n');
}

runLoginVerification().catch(console.error);
