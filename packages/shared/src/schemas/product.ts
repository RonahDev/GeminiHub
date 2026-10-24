import { z } from 'zod';
import { RoutingStrategy, PricingMode, CostBasis } from '../types';

export const ProductMappingInputSchema = z.object({
  sourceProductId: z.string().uuid(),
  priority: z.number().int().min(1).default(1),
  enabled: z.boolean().default(true),
  maxCost: z.number().int().positive().nullable().optional(),
});

export const CreateProductSchema = z.object({
  name: z.string().min(2, 'Tên sản phẩm ít nhất 2 ký tự'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
  description: z.string().default(''),
  imageUrl: z.string().url().nullable().optional(),
  warrantyMinutes: z.number().int().min(1).default(5),
  mustUseImmediately: z.boolean().default(true),
  maxPerOrder: z.number().int().min(1).max(50).default(5),
  showStockCount: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  routingStrategy: z.nativeEnum(RoutingStrategy).default(RoutingStrategy.PRIORITY),
  pricingMode: z.nativeEnum(PricingMode).default(PricingMode.COST_PLUS),
  fixedPrice: z.number().int().positive().nullable().optional(),
  markupPercent: z.number().min(0).max(500).default(30),
  markupAmount: z.number().int().min(0).default(0),
  costBasis: z.nativeEnum(CostBasis).default(CostBasis.PRIORITY),
  roundingStep: z.union([z.literal(500), z.literal(1000), z.literal(5000)]).default(1000),
  minPrice: z.number().int().positive().nullable().optional(),
  maxPrice: z.number().int().positive().nullable().optional(),
  minMarginAmount: z.number().int().min(0).default(5000),
  sources: z.array(ProductMappingInputSchema).optional().default([]),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const PricePreviewSchema = z.object({
  pricingMode: z.nativeEnum(PricingMode),
  fixedPrice: z.number().int().positive().nullable().optional(),
  markupPercent: z.number().min(0).default(30),
  markupAmount: z.number().int().min(0).default(0),
  costBasis: z.nativeEnum(CostBasis).default(CostBasis.PRIORITY),
  roundingStep: z.union([z.literal(500), z.literal(1000), z.literal(5000)]).default(1000),
  minPrice: z.number().int().positive().nullable().optional(),
  maxPrice: z.number().int().positive().nullable().optional(),
  minMarginAmount: z.number().int().min(0).default(5000),
  mappings: z.array(
    z.object({
      sourceName: z.string(),
      costVnd: z.number(),
      priority: z.number(),
      enabled: z.boolean(),
    })
  ),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type PricePreviewInput = z.infer<typeof PricePreviewSchema>;
