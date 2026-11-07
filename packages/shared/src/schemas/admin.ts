import { z } from 'zod';
import { ErrorSeverity } from '../types';

export const AdjustUserBalanceSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().refine((val) => val !== 0, 'Số tiền điều chỉnh không được bằng 0'),
  reason: z.string().min(5, 'Lý do điều chỉnh số dư phải từ 5 ký tự'),
});

export const FulfillManualOrderSchema = z.object({
  orderId: z.string().uuid(),
  links: z.array(z.string().url('Đường dẫn link kích hoạt không hợp lệ')).min(1),
  adminNote: z.string().min(3, 'Ghi chú xử lý đơn là bắt buộc'),
});

export const RefundOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(5, 'Lý do hoàn tiền phải từ 5 ký tự'),
});

export const AssignBankTxSchema = z.object({
  bankTxId: z.string().uuid(),
  userId: z.string().uuid(),
  note: z.string().optional(),
});

export const PricingDefaultsSchema = z.object({
  markupPercent: z.number().min(0).max(500).default(30),
  roundingStep: z.union([z.literal(500), z.literal(1000), z.literal(5000)]).default(1000),
  minMarginAmount: z.number().int().min(0).default(5000),
  usdExchangeRate: z.number().int().positive().default(26000),
  priceChangeAlertThresholdPercent: z.number().min(5).max(100).default(20),
});

export const GeneralSettingsSchema = z.object({
  siteName: z.string().default('GeminiHub'),
  bannerText: z.string().optional(),
  bannerEnabled: z.boolean().default(false),
  bankName: z.string().default('MBBank'),
  bankAccountNumber: z.string().default('0000123456789'),
  bankAccountHolder: z.string().default('CONG TY GEMINIHUB'),
  minTopupAmount: z.number().int().default(10000),
  maxTopupAmount: z.number().int().default(50000000),
  telegramBotToken: z.string().optional(),
  telegramAdminChatId: z.string().optional(),
});

export type AdjustUserBalanceInput = z.infer<typeof AdjustUserBalanceSchema>;
export type FulfillManualOrderInput = z.infer<typeof FulfillManualOrderSchema>;
export type RefundOrderInput = z.infer<typeof RefundOrderSchema>;
export type AssignBankTxInput = z.infer<typeof AssignBankTxSchema>;
export type PricingDefaultsInput = z.infer<typeof PricingDefaultsSchema>;
export type GeneralSettingsInput = z.infer<typeof GeneralSettingsSchema>;

export const ErrorLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  severity: z.nativeEnum(ErrorSeverity).optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const UpdateErrorLogStatusSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED']),
  note: z.string().optional(),
});

export const ClientErrorPayloadSchema = z.object({
  message: z.string().min(1, 'Thông báo lỗi không được để trống'),
  stack: z.string().optional(),
  source: z.string().default('CLIENT'),
  url: z.string().optional(),
  context: z.record(z.any()).optional(),
});

export type ErrorLogQueryInput = z.infer<typeof ErrorLogQuerySchema>;
export type UpdateErrorLogStatusInput = z.infer<typeof UpdateErrorLogStatusSchema>;
export type ClientErrorPayloadInput = z.infer<typeof ClientErrorPayloadSchema>;

