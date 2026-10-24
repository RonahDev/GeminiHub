import { describe, it, expect } from 'vitest';
import { PricingService, SourceCandidate } from '../src/domain/pricing/pricing.service';
import { CostBasis, PricingMode } from '@geminihub/shared';

describe('Pricing Engine (FR-PRICE-01..08)', () => {
  const mockCandidates: SourceCandidate[] = [
    {
      sourceId: 'src-1',
      sourceProductId: 'sp-1',
      sourceName: 'Sumistore Primary',
      externalId: 'SP-TY9J9GO9',
      costVnd: 17000,
      stock: 50,
      priority: 1,
      enabled: true,
    },
    {
      sourceId: 'src-2',
      sourceProductId: 'sp-2',
      sourceName: 'Backup Store',
      externalId: 'SP-BACKUP-01',
      costVnd: 18500,
      stock: 30,
      priority: 2,
      enabled: true,
    },
  ];

  it('calculates cost-plus price matching SRS example (17.000đ + 30% -> 22.100đ -> rounded to 23.000đ)', () => {
    // Example from SRS Section 4.5:
    // "Ví dụ: giá vốn 17.000 đ, lãi 30%, cộng thêm 0 đ, làm tròn lên 1.000 đ.
    //  Giá bán = 17.000 × 1,3 = 22.100, làm tròn thành 23.000 đ. Lãi 6.000 đ mỗi link."
    const result = PricingService.calculate(
      {
        pricingMode: PricingMode.COST_PLUS,
        markupPercent: 30,
        markupAmount: 0,
        costBasis: CostBasis.PRIORITY,
        roundingStep: 1000,
        minMarginAmount: 5000,
      },
      mockCandidates
    );

    expect(result.retailPrice).toBe(23000);
    expect(result.costBasisUsed).toBe(17000);
    expect(result.isPaused).toBe(false);

    const primaryRow = result.previewRows.find((r) => r.sourceName === 'Sumistore Primary')!;
    expect(primaryRow.marginAmount).toBe(6000);
    expect(primaryRow.isQualified).toBe(true);
  });

  it('uses highest cost basis when configured for safety during failover (FR-PRICE-02)', () => {
    const result = PricingService.calculate(
      {
        pricingMode: PricingMode.COST_PLUS,
        markupPercent: 20,
        markupAmount: 0,
        costBasis: CostBasis.HIGHEST,
        roundingStep: 1000,
        minMarginAmount: 3000,
      },
      mockCandidates
    );

    // Highest cost is 18.500đ
    // 18.500 * 1.2 = 22.200 -> round up 1000 -> 23.000đ
    expect(result.costBasisUsed).toBe(18500);
    expect(result.retailPrice).toBe(23000);
  });

  it('detects when price change exceeds safety threshold (>20%) (FR-PRICE-06)', () => {
    const oldPrice = 20000;
    const newPriceNormal = 22000; // 10% change
    const newPriceSurge = 26000;  // 30% change

    expect(PricingService.shouldRequireApproval(oldPrice, newPriceNormal, 20)).toBe(false);
    expect(PricingService.shouldRequireApproval(oldPrice, newPriceSurge, 20)).toBe(true);
  });

  it('disqualifies sources with margins lower than minMarginAmount (FR-PRICE-04)', () => {
    const expensiveCandidates: SourceCandidate[] = [
      {
        sourceId: 'src-expensive',
        sourceProductId: 'sp-expensive',
        sourceName: 'Too Expensive Store',
        externalId: 'SP-EXP-01',
        costVnd: 22000,
        stock: 10,
        priority: 1,
        enabled: true,
      },
    ];

    const result = PricingService.calculate(
      {
        pricingMode: PricingMode.FIXED,
        fixedPrice: 23000,
        markupPercent: 0,
        markupAmount: 0,
        costBasis: CostBasis.PRIORITY,
        roundingStep: 1000,
        minMarginAmount: 5000, // Margin is 1000 < 5000
      },
      expensiveCandidates
    );

    expect(result.isPaused).toBe(true);
    expect(result.pausedReason).toContain('không đạt mức lãi tối thiểu');
    expect(result.previewRows[0].isQualified).toBe(false);
  });
});

