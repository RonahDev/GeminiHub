import { CostBasis, PricingMode } from '@geminihub/shared';

export interface SourceCandidate {
  sourceId: string;
  sourceProductId: string;
  sourceName: string;
  externalId: string;
  costVnd: number;
  stock: number;
  priority: number;
  enabled: boolean;
  maxCost?: number | null;
}

export interface PricingRuleConfig {
  pricingMode: PricingMode;
  fixedPrice?: number | null;
  markupPercent: number; // e.g. 30 for 30%
  markupAmount: number; // e.g. 0
  costBasis: CostBasis;
  roundingStep: 500 | 1000 | 5000;
  minPrice?: number | null;
  maxPrice?: number | null;
  minMarginAmount: number; // e.g. 5000
}

export interface PricingCalculationResult {
  retailPrice: number;
  costBasisUsed: number;
  isPaused: boolean;
  pausedReason?: string;
  previewRows: Array<{
    sourceName: string;
    costVnd: number;
    retailPrice: number;
    marginAmount: number;
    marginPercent: number;
    isQualified: boolean;
    disqualifyReason?: string;
  }>;
}

export class PricingService {
  /**
   * Round up to the specified step (500, 1000, 5000)
   */
  static roundUp(value: number, step: 500 | 1000 | 5000): number {
    return Math.ceil(value / step) * step;
  }

  /**
   * Calculate retail price and evaluate source candidate qualification (FR-PRICE-01..08)
   */
  static calculate(
    rule: PricingRuleConfig,
    candidates: SourceCandidate[]
  ): PricingCalculationResult {
    const activeCandidates = candidates.filter((c) => c.enabled);

    if (rule.pricingMode === PricingMode.FIXED) {
      const retailPrice = rule.fixedPrice || 0;
      return this.evaluateMargins(retailPrice, 0, rule.minMarginAmount, activeCandidates);
    }

    // COST_PLUS mode
    if (activeCandidates.length === 0) {
      return {
        retailPrice: 0,
        costBasisUsed: 0,
        isPaused: true,
        pausedReason: 'Không có nguồn liên kết nào đang hoạt động',
        previewRows: [],
      };
    }

    // Determine cost basis
    let costBasisValue = 0;
    if (rule.costBasis === CostBasis.HIGHEST) {
      costBasisValue = Math.max(...activeCandidates.map((c) => c.costVnd));
    } else {
      // PRIORITY: lowest priority number = highest priority
      const sortedByPriority = [...activeCandidates].sort((a, b) => a.priority - b.priority);
      // Prefer source with stock > 0, otherwise first priority
      const candidateWithStock = sortedByPriority.find((c) => c.stock > 0) || sortedByPriority[0];
      costBasisValue = candidateWithStock.costVnd;
    }

    // Formula: costBasis * (1 + markup%) + markupAmount
    const rawPrice = costBasisValue * (1 + rule.markupPercent / 100) + rule.markupAmount;

    // Round up
    let finalPrice = this.roundUp(rawPrice, rule.roundingStep);

    // Apply min/max clamp
    if (rule.minPrice && finalPrice < rule.minPrice) {
      finalPrice = rule.minPrice;
    }
    if (rule.maxPrice && finalPrice > rule.maxPrice) {
      finalPrice = rule.maxPrice;
    }

    return this.evaluateMargins(finalPrice, costBasisValue, rule.minMarginAmount, activeCandidates);
  }

  private static evaluateMargins(
    retailPrice: number,
    costBasisUsed: number,
    minMarginAmount: number,
    candidates: SourceCandidate[]
  ): PricingCalculationResult {
    let qualifiedCount = 0;

    const previewRows = candidates.map((cand) => {
      const margin = retailPrice - cand.costVnd;
      const marginPercent = cand.costVnd > 0 ? (margin / cand.costVnd) * 100 : 0;

      let isQualified = true;
      let disqualifyReason: string | undefined;

      if (cand.maxCost && cand.costVnd > cand.maxCost) {
        isQualified = false;
        disqualifyReason = `Giá vốn (${cand.costVnd.toLocaleString('vi-VN')}đ) vượt trần quy định (${cand.maxCost.toLocaleString('vi-VN')}đ)`;
      } else if (margin < minMarginAmount) {
        isQualified = false;
        disqualifyReason = `Lãi (${margin.toLocaleString('vi-VN')}đ) thấp hơn lãi tối thiểu (${minMarginAmount.toLocaleString('vi-VN')}đ)`;
      }

      if (isQualified) {
        qualifiedCount++;
      }

      return {
        sourceName: cand.sourceName,
        costVnd: cand.costVnd,
        retailPrice,
        marginAmount: margin,
        marginPercent: Math.round(marginPercent * 10) / 10,
        isQualified,
        disqualifyReason,
      };
    });

    const isPaused = candidates.length > 0 && qualifiedCount === 0;
    const pausedReason = isPaused
      ? 'Tất cả các nguồn đều không đạt mức lãi tối thiểu quy định'
      : undefined;

    return {
      retailPrice,
      costBasisUsed,
      isPaused,
      pausedReason,
      previewRows,
    };
  }

  /**
   * Check if price change exceeds safety threshold (FR-PRICE-06)
   * Default 20%
   */
  static shouldRequireApproval(
    currentPrice: number,
    newCalculatedPrice: number,
    thresholdPercent: number = 20
  ): boolean {
    if (currentPrice <= 0) return false;
    const percentChange = (Math.abs(newCalculatedPrice - currentPrice) / currentPrice) * 100;
    return percentChange > thresholdPercent;
  }
}

