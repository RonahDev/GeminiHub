import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/modules/auth/auth.service';
import { hashPassword, hashToken } from '../src/utils/auth';
import { Role, UserStatus } from '@prisma/client';

describe('Authentication & Login Engine (FR-AUTH-01..06, NFR-06)', () => {
  let authService: AuthService;
  let mockUsers: any[];
  let mockSessions: any[];
  let mockPrisma: any;

  beforeEach(() => {
    mockUsers = [];
    mockSessions = [];

    mockPrisma = {
      user: {
        count: async () => mockUsers.length,
        findUnique: async ({ where }: any) => {
          if (where.email) return mockUsers.find((u) => u.email === where.email.toLowerCase()) || null;
          if (where.id) return mockUsers.find((u) => u.id === where.id) || null;
          return null;
        },
        findUniqueOrThrow: async ({ where }: any) => {
          const user = mockUsers.find((u) => u.id === where.id);
          if (!user) throw new Error('User not found');
          return user;
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

    authService = new AuthService(mockPrisma, (payload) => `mock-jwt-${payload.userId}`);
  });

  it('FR-AUTH-01: Registers a user with argon2id password and makes first user ADMIN', async () => {
    const res = await authService.register({
      email: 'admin@geminihub.vn',
      password: 'AdminPassword123',
    });

    expect(res.id).toBeDefined();
    expect(res.email).toBe('admin@geminihub.vn');
    expect(res.role).toBe(Role.ADMIN);
    expect(mockUsers[0].passwordHash).toContain('$argon2id$');
  });

  it('FR-AUTH-01: Rejects duplicate email registration', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'Password123',
    });

    await expect(
      authService.register({
        email: 'test@example.com',
        password: 'Password456',
      })
    ).rejects.toThrow('Email này đã được sử dụng');
  });

  it('FR-AUTH-02: Logs in successfully with correct credentials and returns tokens', async () => {
    await authService.register({
      email: 'user@example.com',
      password: 'CorrectPassword123',
    });

    const loginRes = await authService.login(
      {
        email: 'user@example.com',
        password: 'CorrectPassword123',
      },
      { ip: '127.0.0.1', userAgent: 'Vitest' }
    );

    expect(loginRes.user.email).toBe('user@example.com');
    expect(loginRes.tokens.accessToken).toBeDefined();
    expect(loginRes.tokens.refreshToken).toBeDefined();
    expect(mockSessions.length).toBe(1);
    expect(mockSessions[0].tokenHash).toBe(hashToken(loginRes.tokens.refreshToken));
  });

  it('FR-AUTH-02: Rejects login with wrong password', async () => {
    await authService.register({
      email: 'user@example.com',
      password: 'CorrectPassword123',
    });

    await expect(
      authService.login({
        email: 'user@example.com',
        password: 'WrongPassword999',
      })
    ).rejects.toThrow('Email hoặc mật khẩu không chính xác');
  });

  it('FR-AUTH-08: Rejects login if account status is BANNED', async () => {
    await authService.register({
      email: 'banned@example.com',
      password: 'Password123',
    });

    // Ban user
    mockUsers[0].status = UserStatus.BANNED;

    await expect(
      authService.login({
        email: 'banned@example.com',
        password: 'Password123',
      })
    ).rejects.toThrow('Tài khoản đã bị tạm khóa');
  });

  it('FR-AUTH-02 & 03: Token rotation generates new token and revokes previous session', async () => {
    await authService.register({
      email: 'user@example.com',
      password: 'Password123',
    });

    const { tokens: initialTokens } = await authService.login({
      email: 'user@example.com',
      password: 'Password123',
    });

    const refreshRes = await authService.refresh(initialTokens.refreshToken);
    expect(refreshRes.tokens.refreshToken).not.toBe(initialTokens.refreshToken);
    expect(mockSessions[0].revokedAt).not.toBeNull(); // old session revoked
    expect(mockSessions[1].revokedAt).toBeNull();     // new session active
  });

  it('FR-AUTH-03: Detecting reused old refresh token revokes ALL sessions of user', async () => {
    await authService.register({
      email: 'victim@example.com',
      password: 'Password123',
    });

    const { tokens: session1 } = await authService.login({
      email: 'victim@example.com',
      password: 'Password123',
    });

    // Legitimate rotation
    const { tokens: session2 } = await authService.refresh(session1.refreshToken);

    // Attacker tries to use old session1 refreshToken!
    await expect(authService.refresh(session1.refreshToken)).rejects.toThrow(
      'Phát hiện token cũ bị dùng lại. Toàn bộ phiên đăng nhập đã bị thu hồi'
    );

    // Verify all sessions of this user are now revoked
    const activeSessions = mockSessions.filter((s) => s.userId === mockUsers[0].id && s.revokedAt === null);
    expect(activeSessions.length).toBe(0);
  });

  it('FR-AUTH-04: Logout revokes current session', async () => {
    await authService.register({
      email: 'user@example.com',
      password: 'Password123',
    });

    const { tokens } = await authService.login({
      email: 'user@example.com',
      password: 'Password123',
    });

    await authService.logout(tokens.refreshToken);
    expect(mockSessions[0].revokedAt).not.toBeNull();
  });

  it('FR-AUTH-06: Changing password revokes all other sessions', async () => {
    const user = await authService.register({
      email: 'user@example.com',
      password: 'OldPassword123',
    });

    // Create 2 sessions
    await authService.login({ email: 'user@example.com', password: 'OldPassword123' });
    await authService.login({ email: 'user@example.com', password: 'OldPassword123' });

    expect(mockSessions.filter((s) => s.revokedAt === null).length).toBe(2);

    await authService.changePassword(user.id, {
      currentPassword: 'OldPassword123',
      newPassword: 'NewPassword999',
    });

    // All previous sessions revoked
    expect(mockSessions.filter((s) => s.revokedAt === null).length).toBe(0);

    // Old password no longer works
    await expect(
      authService.login({ email: 'user@example.com', password: 'OldPassword123' })
    ).rejects.toThrow();

    // New password works
    const newLogin = await authService.login({ email: 'user@example.com', password: 'NewPassword999' });
    expect(newLogin.user.email).toBe('user@example.com');
  });
});
