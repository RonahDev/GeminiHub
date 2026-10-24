'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatVnd } from '@/lib/utils';
import { toast } from 'sonner';
import {
  TrendingUp,
  AlertTriangle,
  Bot,
  ShoppingCart,
  Users,
  Wallet,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

interface DashboardData {
  financials: {
    today: { revenue: number; cost: number; profit: number };
    last7Days: { revenue: number; cost: number; profit: number };
    thisMonth: { revenue: number; cost: number; profit: number };
    totalTopupCompleted: number;
  };
  ordersByStatus: Record<string, number>;
  newUsersCount: number;
  alerts: {
    needsReviewOrders: number;
    errorSources: number;
    lowBalanceSourcesCount: number;
    lowBalanceSourcesList: Array<{ id: string; name: string; balance: number }>;
    pausedProducts: number;
    pendingPriceReviews: number;
  };
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch {
      toast.error('Không thể tải thông tin Dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!data) return null;

  const { financials, alerts, ordersByStatus } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Tổng Quan Quản Trị (Dashboard)</h1>
        <p className="text-xs text-zinc-400">Doanh thu, lợi nhuận và các cảnh báo hệ thống thời gian thực</p>
      </div>

      {/* Critical Alert Cards (FR-ADM-01) */}
      {(alerts.needsReviewOrders > 0 ||
        alerts.errorSources > 0 ||
        alerts.lowBalanceSourcesCount > 0 ||
        alerts.pendingPriceReviews > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Cảnh báo cần xử lý ngay
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {alerts.needsReviewOrders > 0 && (
              <Link
                href="/admin/orders"
                className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 text-amber-200 hover:bg-amber-950/30 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold">{alerts.needsReviewOrders}</div>
                  <div className="text-xs text-amber-300">Đơn cần đối soát thủ công</div>
                </div>
              </Link>
            )}

            {alerts.errorSources > 0 && (
              <Link
                href="/admin/sources"
                className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-950/20 p-4 text-red-200 hover:bg-red-950/30 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold">{alerts.errorSources}</div>
                  <div className="text-xs text-red-300">Nguồn bot ngắt mạch (Lỗi)</div>
                </div>
              </Link>
            )}

            {alerts.lowBalanceSourcesCount > 0 && (
              <Link
                href="/admin/sources"
                className="flex items-center gap-3 rounded-2xl border border-yellow-500/40 bg-yellow-950/20 p-4 text-yellow-200 hover:bg-yellow-950/30 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold">{alerts.lowBalanceSourcesCount}</div>
                  <div className="text-xs text-yellow-300">Nguồn sắp hết số dư</div>
                </div>
              </Link>
            )}

            {alerts.pendingPriceReviews > 0 && (
              <Link
                href="/admin/pricing"
                className="flex items-center gap-3 rounded-2xl border border-purple-500/40 bg-purple-950/20 p-4 text-purple-200 hover:bg-purple-950/30 transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold">{alerts.pendingPriceReviews}</div>
                  <div className="text-xs text-purple-300">Sản phẩm chờ duyệt giá mới</div>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Financials Cards (Today, 7 days, Month) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Hôm nay</span>
            <span className="rounded bg-blue-500/10 px-2 py-0.5 text-blue-400 font-semibold">24h</span>
          </div>
          <div className="text-2xl font-black text-white">{formatVnd(financials.today.revenue)}</div>
          <div className="mt-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Giá vốn bot:</span>
              <span className="text-zinc-200">{formatVnd(financials.today.cost)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1.5 border-t border-zinc-800">
              <span className="text-emerald-400">Lợi nhuận ròng:</span>
              <span className="text-emerald-400 text-sm">{formatVnd(financials.today.profit)}</span>
            </div>
          </div>
        </div>

        {/* 7 Days */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>7 ngày qua</span>
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-indigo-400 font-semibold">Tuần</span>
          </div>
          <div className="text-2xl font-black text-white">{formatVnd(financials.last7Days.revenue)}</div>
          <div className="mt-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Giá vốn bot:</span>
              <span className="text-zinc-200">{formatVnd(financials.last7Days.cost)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1.5 border-t border-zinc-800">
              <span className="text-emerald-400">Lợi nhuận ròng:</span>
              <span className="text-emerald-400 text-sm">{formatVnd(financials.last7Days.profit)}</span>
            </div>
          </div>
        </div>

        {/* Month */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Tháng này</span>
            <span className="rounded bg-purple-500/10 px-2 py-0.5 text-purple-400 font-semibold">Tháng</span>
          </div>
          <div className="text-2xl font-black text-white">{formatVnd(financials.thisMonth.revenue)}</div>
          <div className="mt-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Giá vốn bot:</span>
              <span className="text-zinc-200">{formatVnd(financials.thisMonth.cost)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1.5 border-t border-zinc-800">
              <span className="text-emerald-400">Lợi nhuận ròng:</span>
              <span className="text-emerald-400 text-sm">{formatVnd(financials.thisMonth.profit)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders By Status Grid */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
        <h2 className="text-base font-bold text-white mb-4">Trạng Thái Đơn Hàng</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800">
            <span className="text-xs text-zinc-500">Hoàn thành</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {ordersByStatus['COMPLETED'] || 0}
            </div>
          </div>
          <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800">
            <span className="text-xs text-zinc-500">Cần đối soát</span>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {ordersByStatus['NEEDS_REVIEW'] || 0}
            </div>
          </div>
          <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800">
            <span className="text-xs text-zinc-500">Đang xử lý</span>
            <div className="text-xl font-bold text-blue-400 mt-1">
              {ordersByStatus['PROCESSING'] || 0}
            </div>
          </div>
          <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800">
            <span className="text-xs text-zinc-500">Thất bại</span>
            <div className="text-xl font-bold text-red-400 mt-1">
              {ordersByStatus['FAILED'] || 0}
            </div>
          </div>
          <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800">
            <span className="text-xs text-zinc-500">Đã hoàn tiền</span>
            <div className="text-xl font-bold text-purple-400 mt-1">
              {ordersByStatus['REFUNDED'] || 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
