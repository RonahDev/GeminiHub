import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../database/prisma';
import { sanitizeLogData } from '../security/sanitizer';
import { ErrorSeverity, ErrorStatus } from '@geminihub/shared';

export interface RecordErrorParams {
  severity?: ErrorSeverity;
  source: string;
  code?: string | null;
  message: string;
  stack?: string | null;
  context?: any;
  userId?: string | null;
  userEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  method?: string | null;
  status?: ErrorStatus | string;
}

export interface ErrorListQuery {
  page?: number;
  limit?: number;
  severity?: ErrorSeverity;
  source?: string;
  status?: string;
  userId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export class ErrorLoggerService {
  private db: PrismaClient;

  constructor(customPrisma?: PrismaClient) {
    this.db = customPrisma || defaultPrisma;
  }

  /**
   * Core method to record any error into database asynchronously.
   * Completely non-blocking and safe: handles internal failures gracefully.
   */
  async recordError(params: RecordErrorParams): Promise<any> {
    try {
      const severity = params.severity || ErrorSeverity.ERROR;
      const sanitizedContext = params.context ? sanitizeLogData(params.context) : null;
      let contextString: string | null = null;

      if (sanitizedContext) {
        if (typeof sanitizedContext === 'string') {
          contextString = sanitizedContext;
        } else {
          try {
            contextString = JSON.stringify(sanitizedContext, null, 2);
          } catch {
            contextString = String(sanitizedContext);
          }
        }
      }

      // If userEmail is not provided but userId is, try to fetch email if possible
      let userEmail = params.userEmail;
      if (!userEmail && params.userId) {
        try {
          const user = await this.db.user.findUnique({
            where: { id: params.userId },
            select: { email: true },
          });
          if (user) {
            userEmail = user.email;
          }
        } catch {
          // ignore lookup failure
        }
      }

      const log = await this.db.errorLog.create({
        data: {
          severity: severity as any,
          source: params.source,
          code: params.code || null,
          message: params.message || 'Unknown error occurred',
          stack: params.stack ? String(params.stack).slice(0, 8000) : null,
          context: contextString ? contextString.slice(0, 16000) : null,
          userId: params.userId || null,
          userEmail: userEmail || null,
          ip: params.ip ? String(params.ip).slice(0, 100) : null,
          userAgent: params.userAgent ? String(params.userAgent).slice(0, 500) : null,
          path: params.path ? String(params.path).slice(0, 500) : null,
          method: params.method ? String(params.method).slice(0, 20) : null,
          status: (params.status as string) || ErrorStatus.OPEN,
        },
      });

      return log;
    } catch (err) {
      // Fallback console logging: never crash caller due to logging issue
      console.error('[ErrorLoggerService] Failed to persist error log into database:', err);
      console.error('[Original Error]', params);
      return null;
    }
  }

  /**
   * System-level fatal or internal errors (500s, uncaught rejections, db failures)
   */
  async logSystemError(params: {
    message: string;
    stack?: string | null;
    code?: string;
    source?: string;
    context?: any;
    path?: string;
    method?: string;
  }) {
    return this.recordError({
      severity: ErrorSeverity.FATAL,
      source: params.source || 'SYSTEM',
      code: params.code || 'SYSTEM_INTERNAL_ERROR',
      message: params.message,
      stack: params.stack,
      context: params.context,
      path: params.path,
      method: params.method,
    });
  }

  /**
   * User-facing action errors (400s, validation, insufficient balance, unauthorized)
   */
  async logUserError(params: {
    userId?: string | null;
    userEmail?: string | null;
    message: string;
    code?: string;
    source?: string;
    context?: any;
    ip?: string | null;
    userAgent?: string | null;
    path?: string | null;
    method?: string | null;
    severity?: ErrorSeverity;
  }) {
    return this.recordError({
      severity: params.severity || ErrorSeverity.WARN,
      source: params.source || 'API',
      code: params.code || 'USER_OPERATION_FAILED',
      message: params.message,
      context: params.context,
      userId: params.userId,
      userEmail: params.userEmail,
      ip: params.ip,
      userAgent: params.userAgent,
      path: params.path,
      method: params.method,
    });
  }

  /**
   * Telegram Bot source execution errors (timeout, parse error, adapter crash)
   */
  async logBotError(params: {
    sourceId?: string;
    sourceName?: string;
    message: string;
    stack?: string | null;
    code?: string;
    context?: any;
    orderId?: string;
  }) {
    return this.recordError({
      severity: ErrorSeverity.ERROR,
      source: 'TELEGRAM_BOT',
      code: params.code || 'BOT_EXECUTION_FAILURE',
      message: params.message,
      stack: params.stack,
      context: {
        sourceId: params.sourceId,
        sourceName: params.sourceName,
        orderId: params.orderId,
        ...params.context,
      },
    });
  }

  /**
   * Webhook payment / banking processing errors
   */
  async logWebhookError(params: {
    provider: string;
    message: string;
    context?: any;
    code?: string;
  }) {
    return this.recordError({
      severity: ErrorSeverity.ERROR,
      source: 'WEBHOOK',
      code: params.code || 'WEBHOOK_PROCESS_FAILURE',
      message: `[${params.provider}] ${params.message}`,
      context: params.context,
    });
  }

  /**
   * Client-side errors (Next.js ErrorBoundary, unhandled UI errors)
   */
  async logClientError(params: {
    message: string;
    stack?: string;
    url?: string;
    context?: any;
    userId?: string | null;
    userEmail?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    return this.recordError({
      severity: ErrorSeverity.ERROR,
      source: 'CLIENT',
      code: 'CLIENT_UNCAUGHT_EXCEPTION',
      message: params.message,
      stack: params.stack,
      context: params.context,
      path: params.url,
      userId: params.userId,
      userEmail: params.userEmail,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  /**
   * Query error logs with pagination, filtering, and summary metrics for Admin
   */
  async listErrors(query: ErrorListQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.source) {
      where.source = { equals: query.source, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }
    if (query.search) {
      where.OR = [
        { message: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { userEmail: { contains: query.search, mode: 'insensitive' } },
        { path: { contains: query.search, mode: 'insensitive' } },
        { source: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total, statsRaw] = await Promise.all([
      this.db.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, role: true },
          },
        },
      }),
      this.db.errorLog.count({ where }),
      this.db.errorLog.groupBy({
        by: ['severity', 'status'],
        _count: { id: true },
      }),
    ]);

    // Aggregate statistics
    let fatalCount = 0;
    let errorCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    let openCount = 0;
    let resolvedCount = 0;

    for (const stat of statsRaw) {
      const count = stat._count.id;
      if (stat.severity === 'FATAL') fatalCount += count;
      if (stat.severity === 'ERROR') errorCount += count;
      if (stat.severity === 'WARN') warnCount += count;
      if (stat.severity === 'INFO') infoCount += count;

      if (stat.status === 'OPEN') openCount += count;
      if (stat.status === 'RESOLVED') resolvedCount += count;
    }

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        total,
        fatalCount,
        errorCount,
        warnCount,
        infoCount,
        openCount,
        resolvedCount,
      },
    };
  }

  /**
   * Find single log details
   */
  async getErrorById(id: string) {
    return this.db.errorLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, role: true, balance: true },
        },
      },
    });
  }

  /**
   * Update error status (e.g. mark RESOLVED or INVESTIGATING)
   */
  async updateStatus(id: string, status: string, resolvedBy?: string) {
    return this.db.errorLog.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === ErrorStatus.RESOLVED ? new Date() : null,
        resolvedBy: status === ErrorStatus.RESOLVED ? resolvedBy || null : null,
      },
    });
  }

  /**
   * Delete specific error log
   */
  async deleteError(id: string) {
    return this.db.errorLog.delete({
      where: { id },
    });
  }

  /**
   * Purge resolved errors older than given days
   */
  async clearOldErrors(days: number = 30) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - days);

    return this.db.errorLog.deleteMany({
      where: {
        createdAt: { lt: thresholdDate },
        status: ErrorStatus.RESOLVED,
      },
    });
  }

  /**
   * User-specific error history (allows users to see why their orders/topups failed)
   */
  async listUserErrors(userId: string, limit: number = 20) {
    return this.db.errorLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        severity: true,
        code: true,
        message: true,
        path: true,
        createdAt: true,
      },
    });
  }
}

export const errorLogger = new ErrorLoggerService();
