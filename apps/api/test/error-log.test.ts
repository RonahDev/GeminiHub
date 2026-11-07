import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorLoggerService } from '../src/infrastructure/logging/error-logger.service';
import { ErrorSeverity, ErrorStatus } from '@geminihub/shared';

describe('Feature: Error Logging Engine for System and Users (NFR-07, Observability)', () => {
  let errorLogs: any[] = [];
  let users: any[] = [];
  let mockPrisma: any;
  let loggerService: ErrorLoggerService;

  beforeEach(() => {
    errorLogs = [];
    users = [
      { id: 'user-1', email: 'khachhang@geminihub.vn', role: 'USER' },
      { id: 'admin-1', email: 'admin@geminihub.vn', role: 'ADMIN' },
    ];

    mockPrisma = {
      user: {
        findUnique: async ({ where }: any) => {
          return users.find((u) => u.id === where.id) || null;
        },
      },
      errorLog: {
        create: async ({ data }: any) => {
          const item = {
            id: `err-${errorLogs.length + 1}`,
            createdAt: new Date(),
            ...data,
          };
          errorLogs.push(item);
          return item;
        },
        findMany: async ({ where, skip = 0, take = 20 }: any) => {
          let list = [...errorLogs];
          if (where?.severity) {
            list = list.filter((l) => l.severity === where.severity);
          }
          if (where?.source?.equals) {
            list = list.filter((l) => l.source.toLowerCase() === where.source.equals.toLowerCase());
          }
          if (where?.status) {
            list = list.filter((l) => l.status === where.status);
          }
          if (where?.userId) {
            list = list.filter((l) => l.userId === where.userId);
          }
          if (where?.OR) {
            const searchKeyword = where.OR[0]?.message?.contains?.toLowerCase();
            if (searchKeyword) {
              list = list.filter(
                (l) =>
                  l.message.toLowerCase().includes(searchKeyword) ||
                  (l.code && l.code.toLowerCase().includes(searchKeyword)) ||
                  (l.userEmail && l.userEmail.toLowerCase().includes(searchKeyword))
              );
            }
          }
          return list.slice(skip, skip + take).map((l) => ({
            ...l,
            user: users.find((u) => u.id === l.userId) || null,
          }));
        },
        count: async ({ where }: any) => {
          let list = [...errorLogs];
          if (where?.severity) list = list.filter((l) => l.severity === where.severity);
          if (where?.source?.equals) {
            list = list.filter((l) => l.source.toLowerCase() === where.source.equals.toLowerCase());
          }
          if (where?.status) list = list.filter((l) => l.status === where.status);
          if (where?.userId) list = list.filter((l) => l.userId === where.userId);
          if (where?.OR) {
            const searchKeyword = where.OR[0]?.message?.contains?.toLowerCase();
            if (searchKeyword) {
              list = list.filter(
                (l) =>
                  l.message.toLowerCase().includes(searchKeyword) ||
                  (l.code && l.code.toLowerCase().includes(searchKeyword)) ||
                  (l.userEmail && l.userEmail.toLowerCase().includes(searchKeyword))
              );
            }
          }
          return list.length;
        },
        groupBy: async () => {
          const map: Record<string, number> = {};
          for (const l of errorLogs) {
            const key = `${l.severity}_${l.status}`;
            map[key] = (map[key] || 0) + 1;
          }
          return Object.entries(map).map(([k, count]) => {
            const [severity, status] = k.split('_');
            return {
              severity,
              status,
              _count: { id: count },
            };
          });
        },
        findUnique: async ({ where }: any) => {
          const found = errorLogs.find((l) => l.id === where.id);
          if (!found) return null;
          return {
            ...found,
            user: users.find((u) => u.id === found.userId) || null,
          };
        },
        update: async ({ where, data }: any) => {
          const index = errorLogs.findIndex((l) => l.id === where.id);
          if (index === -1) throw new Error('Not found');
          errorLogs[index] = { ...errorLogs[index], ...data };
          return errorLogs[index];
        },
        delete: async ({ where }: any) => {
          const index = errorLogs.findIndex((l) => l.id === where.id);
          if (index === -1) throw new Error('Not found');
          const [removed] = errorLogs.splice(index, 1);
          return removed;
        },
        deleteMany: async ({ where }: any) => {
          const initialLen = errorLogs.length;
          errorLogs = errorLogs.filter((l) => l.status !== where.status);
          return { count: initialLen - errorLogs.length };
        },
      },
    };

    loggerService = new ErrorLoggerService(mockPrisma);
  });

  // TC-LOG-01
  it('TC-LOG-01: Ghi log lỗi hệ thống nghiêm trọng (FATAL / 500) lưu đầy đủ stack trace, mã lỗi, và endpoint', async () => {
    const errorStack = 'Error: Database connection lost\n  at Database.connect (db.ts:42)';
    const log = await loggerService.logSystemError({
      message: 'Mất kết nối cơ sở dữ liệu khi xử lý giao dịch',
      code: 'DB_CONNECTION_LOST',
      stack: errorStack,
      path: '/api/v1/orders/purchase',
      method: 'POST',
      context: { orderId: 'ord-123' },
    });

    expect(log).toBeDefined();
    expect(log.severity).toBe(ErrorSeverity.FATAL);
    expect(log.source).toBe('SYSTEM');
    expect(log.code).toBe('DB_CONNECTION_LOST');
    expect(log.message).toContain('Mất kết nối cơ sở dữ liệu');
    expect(log.stack).toBe(errorStack);
    expect(log.path).toBe('/api/v1/orders/purchase');
    expect(log.method).toBe('POST');
    expect(log.status).toBe(ErrorStatus.OPEN);
  });

  // TC-LOG-02
  it('TC-LOG-02: Ghi log lỗi hành động người dùng (WARN) tự động gắn kết userId và userEmail', async () => {
    const log = await loggerService.logUserError({
      userId: 'user-1',
      message: 'Số dư ví không đủ để thanh toán đơn hàng ORD-001',
      code: 'INSUFFICIENT_FUNDS',
      source: 'ORDER',
      context: { required: 50000, currentBalance: 20000 },
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      path: '/api/v1/orders',
      method: 'POST',
    });

    expect(log).toBeDefined();
    expect(log.severity).toBe(ErrorSeverity.WARN);
    expect(log.source).toBe('ORDER');
    expect(log.code).toBe('INSUFFICIENT_FUNDS');
    expect(log.userId).toBe('user-1');
    expect(log.userEmail).toBe('khachhang@geminihub.vn'); // Auto-resolved from user table
    expect(log.ip).toBe('192.168.1.100');
    expect(log.context).toContain('required');
  });

  // TC-LOG-03
  it('TC-LOG-03: Tự động che giấu / sanitize thông tin nhạy cảm (password, token, apiKey, secret) trước khi lưu log', async () => {
    const sensitivePayload = {
      username: 'testuser',
      password: 'MySecretPassword123!',
      token: 'jwt-access-token-secret-xyz',
      apiKey: 'api-secret-key-123',
      nested: {
        credentialsEncrypted: 'sensitive-blob',
        customRedirectUrl: 'https://sensitive-activation-link.com/redeem?code=123',
      },
    };

    const log = await loggerService.recordError({
      severity: ErrorSeverity.ERROR,
      source: 'AUTH',
      code: 'AUTH_FAILED',
      message: 'Xác thực không thành công',
      context: sensitivePayload,
    });

    expect(log).toBeDefined();
    const storedContext = JSON.parse(log.context);
    expect(storedContext.password).toBe('[REDACTED]');
    expect(storedContext.token).toBe('[REDACTED]');
    expect(storedContext.apiKey).toBe('[REDACTED]');
    expect(storedContext.nested.credentialsEncrypted).toBe('[REDACTED]');
    expect(storedContext.nested.customRedirectUrl).toBe('[REDACTED_LINK]');
  });

  // TC-LOG-04
  it('TC-LOG-04: Lọc và tìm kiếm danh sách log lỗi cho Admin theo mức độ nghiêm trọng (Severity), nguồn (Source), từ khóa', async () => {
    // Seed diverse logs
    await loggerService.logSystemError({ message: 'Ngoại lệ bộ nhớ hệ thống', code: 'MEMORY_LIMIT' });
    await loggerService.logBotError({ message: 'Bot Telegram Timeout', code: 'TIMEOUT' });
    await loggerService.logUserError({ userId: 'user-1', message: 'Sai mật khẩu đăng nhập', code: 'AUTH_FAIL' });

    // Filter by Severity: FATAL
    const fatalResult = await loggerService.listErrors({ severity: ErrorSeverity.FATAL });
    expect(fatalResult.total).toBe(1);
    expect(fatalResult.items[0].code).toBe('MEMORY_LIMIT');

    // Filter by Source: TELEGRAM_BOT
    const botResult = await loggerService.listErrors({ source: 'TELEGRAM_BOT' });
    expect(botResult.total).toBe(1);
    expect(botResult.items[0].code).toBe('TIMEOUT');

    // Search by keyword: 'mật khẩu'
    const searchResult = await loggerService.listErrors({ search: 'mật khẩu' });
    expect(searchResult.total).toBe(1);
    expect(searchResult.items[0].code).toBe('AUTH_FAIL');
  });

  // TC-LOG-05
  it('TC-LOG-05: Quản trị viên cập nhật trạng thái log lỗi sang RESOLVED và ghi nhận người xử lý', async () => {
    const log = await loggerService.logSystemError({
      message: 'Lỗi đồng bộ giá sản phẩm từ API đối tác',
      code: 'SYNC_ERROR',
    });

    expect(log.status).toBe(ErrorStatus.OPEN);

    // Admin resolves the issue
    const resolved = await loggerService.updateStatus(log.id, ErrorStatus.RESOLVED, 'admin@geminihub.vn');
    expect(resolved.status).toBe(ErrorStatus.RESOLVED);
    expect(resolved.resolvedBy).toBe('admin@geminihub.vn');
    expect(resolved.resolvedAt).toBeInstanceOf(Date);

    // Verify detail retrieval
    const fetched = await loggerService.getErrorById(log.id);
    expect(fetched?.status).toBe(ErrorStatus.RESOLVED);
  });
});
