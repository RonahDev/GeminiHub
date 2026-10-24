import { z } from 'zod';
import { WalletTxType, TopupStatus } from '../types';

export const CreateTopupSchema = z.object({
  amount: z
    .number()
    .int('Số tiền phải là số nguyên')
    .min(10000, 'Số tiền nạp tối thiểu là 10.000đ')
    .max(50000000, 'Số tiền nạp tối đa là 50.000.000đ'),
});

export const WalletTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.nativeEnum(WalletTxType).optional(),
});

export const SepayWebhookSchema = z.object({
  id: z.union([z.number(), z.string()]),
  gateway: z.string().optional(),
  transactionDate: z.string().optional(),
  accountNumber: z.string().optional(),
  code: z.string().nullable().optional(),
  content: z.string(),
  transferType: z.string().optional(),
  transferAmount: z.number().int().positive(),
  accumulated: z.number().optional(),
  subAccount: z.string().nullable().optional(),
  referenceCode: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type CreateTopupInput = z.infer<typeof CreateTopupSchema>;
export type WalletTransactionsQuery = z.infer<typeof WalletTransactionsQuerySchema>;
export type SepayWebhookInput = z.infer<typeof SepayWebhookSchema>;

