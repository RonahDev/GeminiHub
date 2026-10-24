'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatVnd, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';

interface OrderSummary {
  id: string;
  code: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NEEDS_REVIEW' | 'REFUNDED';
  productName: string;
  productSlug: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  failReason?: string;
  warrantyUntil?: string;
  hasWarrantyTicket: boolean;
  linkCount: number;
  createdAt: string;
  completedAt?: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/orders');
      return;
    }
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders');
      if (res.success && res.data?.items) {
        setOrders(res.data.items);
      }
    } catch {
      toast.error('Không thể tải lịch sử đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Hoàn thành
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
            <Loader2 className="h-3 w-3 animate-spin" /> Đang xử lý
          </span>
        );
      case 'NEEDS_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3" /> Đang kiểm tra
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/20">
            <XCircle className="h-3 w-3" /> Thất bại
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/20">
            Đã hoàn tiền
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Lịch Sử Mua Hàng</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Danh sách các link tài khoản Gemini đã mua và thông tin bảo hành
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white">Chưa có đơn hàng nào</h3>
          <p className="mt-1 text-xs text-zinc-400">Hãy chọn mua gói kích hoạt Gemini để bắt đầu sử dụng.</p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Xem Sản Phẩm
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 hover:border-zinc-700 transition-all"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400">{o.code}</span>
                  {getStatusBadge(o.status)}
                  {o.hasWarrantyTicket && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                      Có khiếu nại
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-white">{o.productName}</h4>
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                  <span>Số lượng: {o.quantity}</span>
                  <span>Tổng: <strong className="text-white">{formatVnd(o.totalPrice)}</strong></span>
                  <span>Thời gian: {formatDateTime(o.createdAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-800">
                <Link
                  href={`/orders/${o.id}`}
                  className="flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-200 transition-colors"
                >
                  <span>Chi tiết & Xem link</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

