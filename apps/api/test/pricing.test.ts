import { describe, it, expect } from 'vitest';
import { PricingService, SourceCandidate } from '../src/domain/pricing/pricing.service';
import { CostBasis, PricingMode } from '@geminihub/shared';

describe('Feature 3: Product Dynamic Pricing Engine (FR-PRICE-01..08)', () => {
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

  // TC-PRICE-01
  it('TC-PRICE-01: Định giá cố định (FIXED mode) không phụ thuộc vào biến động giá vốn nguồn', () => {
    const result = PricingService.calculate(
      {
        pricingMode: PricingMode.FIXED,
        fixedPrice: 25000,
        markupPercent: 0,
        markupAmount: 0,
        costBasis: CostBasis.PRIORITY,
        roundingStep: 1000,
        minMarginAmount: 3000,
      },
      mockCandidates
    );

    expect(result.retailPrice).toBe(25000);
    expect(result.isPaused).toBe(false);
    expect(result.previewRows.length).toBe(2);
    // Margin for primary source: 25,000 - 17,000 = 8,000đ
    expect(result.previewRows[0].marginAmount).toBe(8000);
  });

  // TC-PRICE-02
  it('TC-PRICE-02: Định giá cộng biên độ (COST_PLUS) với cơ sở giá vốn nguồn ưu tiên (PRIORITY)', () => {
    // Example from SRS Section 4.5:
    // 17.000đ + 30% -> 22.100đ -> rounded up to 23.000đ
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

    expect(result.costBasisUsed).toBe(17000);
    expect(result.retailPrice).toBe(23000);
    expect(result.isPaused).toBe(false);

    const primaryRow = result.previewRows.find((r) => r.sourceName === 'Sumistore Primary')!;
    expect(primaryRow.marginAmount).toBe(6000); // 23.000 - 17.000
    expect(primaryRow.isQualified).toBe(true);
  });

  // TC-PRICE-03
  it('TC-PRICE-03: Định giá COST_PLUS với cơ sở giá vốn cao nhất để bảo vệ rủi ro failover (HIGHEST)', () => {
    // Highest cost is 18.500đ
    // 18.500 * 1.2 = 22.200 -> round up 1000 -> 23.000đ
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

    expect(result.costBasisUsed).toBe(18500);
    expect(result.retailPrice).toBe(23000);

    // Both candidate sources remain profitable!
    expect(result.previewRows[0].marginAmount).toBe(6000); // 23.000 - 17.000
    expect(result.previewRows[1].marginAmount).toBe(4500); // 23.000 - 18.500
  });

  // TC-PRICE-04
  it('TC-PRICE-04: Quy tắc làm tròn giá thông minh (Rounding step 1.000 VND và 500 VND)', () => {
    // 17.000 + 15% = 19.550đ -> Round step 1000 => 20.000đ
    const result1000 = PricingService.calculate(
      {
        pricingMode: PricingMode.COST_PLUS,
        markupPercent: 15,
        markupAmount: 0,
        costBasis: CostBasis.PRIORITY,
        roundingStep: 1000,
        minMarginAmount: 1000,
      },
      mockCandidates
    );
    expect(result1000.retailPrice).toBe(20000);

    // 17.000 + 15% = 19.550đ -> Round step 500 => 20.000đ
    const result500 = PricingService.calculate(
      {
        pricingMode: PricingMode.COST_PLUS,
        markupPercent: 15,
        markupAmount: 0,
        costBasis: CostBasis.PRIORITY,
        roundingStep: 500,
        minMarginAmount: 1000,
      },
      mockCandidates
    );
    expect(result500.retailPrice).toBe(20000);
  });

  // TC-PRICE-05
  it('TC-PRICE-05: Bảo vệ biên lợi nhuận tối thiểu (Min Margin) và phát hiện biến động giá vượt ngưỡng an toàn', () => {
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

    // Fixed price 23,000đ, cost is 22,000đ -> Margin 1,000đ < MinMargin 3,000đ
    const result = PricingService.calculate(
      {
        pricingMode: PricingMode.FIXED,
        fixedPrice: 23000,
        markupPercent: 0,
        markupAmount: 0,
        costBasis: CostBasis.PRIORITY,
        roundingStep: 1000,
        minMarginAmount: 3000,
      },
      expensiveCandidates
    );

    // Product must be paused because no source satisfies min margin!
    expect(result.isPaused).toBe(true);
    expect(result.pausedReason).toContain('không đạt mức lãi tối thiểu');

    // Price change safety check: changes > 20% must require admin approval
    const oldPrice = 20000;
    const priceChange10Percent = 22000;
    const priceChange30Percent = 26000;
    expect(PricingService.shouldRequireApproval(oldPrice, priceChange10Percent, 20)).toBe(false);
    expect(PricingService.shouldRequireApproval(oldPrice, priceChange30Percent, 20)).toBe(true);
  });
});
