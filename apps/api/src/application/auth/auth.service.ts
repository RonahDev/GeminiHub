import { PrismaClient, UserStatus, Role } from '@prisma/client';
import { hashPassword, verifyPassword, generateRandomToken, hashToken } from '../../infrastructure/security/auth';
import { RegisterInput, LoginInput, ChangePasswordInput } from '@geminihub/shared';
import { AppError, ConflictError, UnauthorizedError } from '../../core/errors/AppError';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(private prisma: PrismaClient, private signJwt: (payload: any) => string) {}

  async register(input: RegisterInput) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictError('Email này đã được sử dụng');
    }

    const passwordHash = await hashPassword(input.password);

    const count = await this.prisma.user.count();
    const role = count === 0 ? Role.ADMIN : Role.USER;

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role,
        status: UserStatus.ACTIVE,
        balance: BigInt(0),
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      balance: Number(user.balance),
    };
  }

  async login(
    input: LoginInput,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ user: any; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    if (user.status === UserStatus.BANNED) {
      throw new AppError('Tài khoản đã bị tạm khóa. Vui lòng liên hệ hỗ trợ', 403, 'ACCOUNT_BANNED');
    }

    const isValid = await verifyPassword(user.passwordHash, input.password);
    if (!isValid) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    const rawRefreshToken = generateRandomToken(40);
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    const accessToken = this.signJwt({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        balance: Number(user.balance),
      },
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
      },
    };
  }

  /**
   * Token rotation and refresh token reuse detection (FR-AUTH-02, FR-AUTH-03)
   */
  async refresh(
    rawRefreshToken: string,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ user: any; tokens: TokenPair }> {
    const tokenHash = hashToken(rawRefreshToken);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedError('Phiên đăng nhập không hợp lệ');
    }

    // FR-AUTH-03: Revocation of all sessions on token reuse detection
    if (session.revokedAt !== null) {
      await this.prisma.session.updateMany({
        where: { userId: session.userId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedError('Phát hiện token cũ bị dùng lại. Toàn bộ phiên đăng nhập đã bị thu hồi vì lý do an toàn');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedError('Phiên đăng nhập đã hết hạn');
    }

    if (session.user.status === UserStatus.BANNED) {
      throw new AppError('Tài khoản đã bị khóa', 403, 'ACCOUNT_BANNED');
    }

    // Revoke current session (Rotate token)
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const newRawRefreshToken = generateRandomToken(40);
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        userId: session.userId,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    const accessToken = this.signJwt({
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
    });

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        balance: Number(session.user.balance),
      },
      tokens: {
        accessToken,
        refreshToken: newRawRefreshToken,
      },
    };
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    // Silent return to avoid email enumeration attack (FR-AUTH-05)
    if (!user) return;
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const isOldValid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!isOldValid) {
      throw new UnauthorizedError('Mật khẩu hiện tại không chính xác');
    }

    const newHash = await hashPassword(input.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });

      // FR-AUTH-06: Revoke all existing sessions
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
