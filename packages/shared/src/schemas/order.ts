import { z } from 'zod';
import { OrderStatus, WarrantyStatus } from '../types';

export const CreateOrderSchema = z.object({
  productId: z.string().uuid('ID sản phẩm không hợp lệ'),
  quantity: z.number().int().min(1, 'Số lượng tối thiểu là 1').max(20, 'Số lượng tối đa là 20'),
  mustUseAcknowledged: z.boolean().refine((val) => val === true, {
    message: 'Bạn phải đồng ý với điều khoản sử dụng ngay',
  }),
});

export const OrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
  productId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export const CreateWarrantyTicketSchema = z.object({
  reason: z.string().min(5, 'Lý do báo lỗi phải từ 5 ký tự'),
  attachmentUrl: z.string().url('Đường dẫn ảnh chụp không hợp lệ').optional(),
});

export const ResolveWarrantyTicketSchema = z.object({
  resolution: z.enum(['REPLACED_SOURCE', 'REPLACED_MANUAL', 'REFUNDED', 'REJECTED']),
  manualLink: z.string().optional(),
  adminNote: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type OrdersQuery = z.infer<typeof OrdersQuerySchema>;
export type CreateWarrantyTicketInput = z.infer<typeof CreateWarrantyTicketSchema>;
export type ResolveWarrantyTicketInput = z.infer<typeof ResolveWarrantyTicketSchema>;
