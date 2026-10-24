import { prisma } from '../plugins/prisma';
import { OrderStatus } from '@prisma/client';
import { createSourceAdapter } from '../adapters/factory';

export class BackgroundWatcher {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  start(intervalMs: number = 30000) {
    if (this.timer) return;
    this.timer = setInterval(() => this.runChecks(), intervalMs);
    // Run an initial check immediately on boot
    this.runChecks().catch((err) => console.error('Initial background watcher error:', err));
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runChecks() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await Promise.all([
        this.checkStuckProcessingOrders(),
        this.retryErrorSources(),
      ]);
    } catch (err) {
      console.error('Error during background watcher checks:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Section 6.4 Step 7 & NFR-13:
   * Orders stuck in PROCESSING for more than 2 minutes are automatically transitioned to NEEDS_REVIEW
   */
  private async checkStuckProcessingOrders() {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const stuckOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PROCESSING,
        createdAt: { lt: twoMinutesAgo },
      },
    });

    for (const order of stuckOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.NEEDS_REVIEW,
          failReason: 'Đơn bị kẹt ở trạng thái Đang xử lý quá 2 phút. Hệ thống tự động chuyển sang Cần xử lý để Admin đối soát.',
        },
      });
      console.warn(`[Watcher] Order ${order.code} was stuck in PROCESSING > 2m and transitioned to NEEDS_REVIEW`);
    }
  }

  /**
   * FR-SRC-13:
   * Re-probe ERROR status sources every 5 minutes to restore them if reachable
   */
  private async retryErrorSources() {
    const errorSources = await prisma.source.findMany({
      where: { status: 'ERROR' },
    });

    for (const src of errorSources) {
      try {
        const adapter = createSourceAdapter(src);
        const testRes = await adapter.testConnection();
        if (testRes.ok) {
          await prisma.source.update({
            where: { id: src.id },
            data: {
              status: 'ACTIVE',
              consecutiveErrors: 0,
            },
          });
          console.log(`[Watcher] Circuit breaker restored source ${src.name} to ACTIVE`);
        }
      } catch {}
    }
  }
}

export const backgroundWatcher = new BackgroundWatcher();
