import { z } from 'zod';
import { AdapterType, Currency, SourceStatus } from '../types';

export const TeleApiConfigSchema = z.object({
  apiId: z.string().min(1, 'API ID không được để trống'),
  apiSecret: z.string().min(1, 'API Secret không được để trống'),
});

export const HttpCustomConfigSchema = z.object({
  balance: z.object({
    method: z.enum(['GET', 'POST']),
    path: z.string(),
    headers: z.record(z.string()).optional(),
    bodyTemplate: z.string().optional(),
    dataPath: z.string(), // jsonpath
  }),
  products: z.object({
    method: z.enum(['GET', 'POST']),
    path: z.string(),
    headers: z.record(z.string()).optional(),
    bodyTemplate: z.string().optional(),
    dataPath: z.string(),
    idPath: z.string(),
    namePath: z.string(),
    pricePath: z.string(),
    stockPath: z.string(),
  }),
  buy: z.object({
    method: z.enum(['GET', 'POST']),
    path: z.string(),
    headers: z.record(z.string()).optional(),
    bodyTemplate: z.string(),
    signatureTemplate: z.string().optional(),
    linksPath: z.string().optional(),
    successCondition: z.string().optional(),
    errorRules: z.array(z.object({
      pattern: z.string(),
      reason: z.enum(['OUT_OF_STOCK', 'SOURCE_BALANCE', 'NOT_FOUND', 'AUTH']),
    })).optional(),
  }),
});

export const MockConfigSchema = z.object({
  simulatedBalance: z.number().default(1000000),
  latencyMs: z.number().default(200),
  simulateFailureRate: z.number().min(0).max(1).default(0),
});

export const CreateSourceSchema = z.object({
  name: z.string().min(2, 'Tên nguồn ít nhất 2 ký tự'),
  adapterType: z.nativeEnum(AdapterType),
  baseUrl: z.string().url('Base URL phải là URL hợp lệ'),
  currency: z.nativeEnum(Currency).default(Currency.VND),
  credentials: z.record(z.any()), // e.g. apiId, apiSecret
  config: z.record(z.any()).optional().default({}),
  liveBuyEnabled: z.boolean().default(false),
  timeoutMs: z.number().int().min(1000).max(60000).default(20000),
  maxConcurrency: z.number().int().min(1).max(20).default(3),
  lowBalanceAlert: z.number().int().min(0).default(100000),
  syncIntervalSec: z.number().int().min(30).default(60),
});

export const UpdateSourceSchema = CreateSourceSchema.partial().extend({
  status: z.nativeEnum(SourceStatus).optional(),
});

export const TestBuySchema = z.object({
  sourceId: z.string().uuid(),
  externalProductId: z.string(),
  quantity: z.number().int().min(1).default(1),
  confirmSourceName: z.string(),
});

export type CreateSourceInput = z.infer<typeof CreateSourceSchema>;
export type UpdateSourceInput = z.infer<typeof UpdateSourceSchema>;
export type TestBuyInput = z.infer<typeof TestBuySchema>;

