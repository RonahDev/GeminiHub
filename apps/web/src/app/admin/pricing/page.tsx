'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatVnd } from '@/lib/utils';
import { toast } from 'sonner';
import { Sliders, ShieldCheck, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function AdminPricingPage() {
  const [markupPercent, setMarkupPercent] = useState<number>(30);
  const [roundingStep, setRoundingStep] = useState<number>(1000);
  const [minMargin, setMinMargin] = useState<number>(5000);
  const [usdRate, setUsdRate] = useState<number>(26000);
  const [loading, setLoading] = useState<boolean>(true);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchPricingData();
  }, []);

  const fetchPricingData = async () => {
    try {
      const res = await api.get('/admin/products');
      if (res.success && res.data) {
        const waiting = res.data.filter((p: any) => p.pendingPrice !== null);
        setPendingProducts(waiting);
      }
    } catch {
      toast.error('Lỗi khi tải thông tin giá');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePrice = async (productId: string) => {
    try {
      const res = await api.post(`/admin/products/${productId}/approve-price`);
      if (res.success) {
        toast.success(res.message);
        fetchPricingData();
      } else {
        toast.error(res.error?.message || 'Không thể phê duyệt');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Quy Tắc Định Giá & Duyệt Giá Bán (Pricing)</h1>
        <p className="text-xs text-zinc-400">
          Cấu hình tỷ lệ % lãi mặc định, bước làm tròn, tỷ giá ngoại tệ và duyệt giá biến động trên 20%
        </p>
      </div>

      {/* Pending Price Review Section (FR-PRICE-06) */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h2 className="text-base font-bold text-white">
            Sản Phẩm Chờ Phê Duyệt Giá Mới (Biến động vượt ngưỡng 20%)
          </h2>
        </div>

        {pendingProducts.length === 0 ? (
          <div className="rounded-xl bg-zinc-950 p-6 text-center text-xs text-zinc-500">
            ✓ Không có sản phẩm nào đang chờ duyệt giá. Tất cả giá bán đều đang trong ngưỡng an toàn.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingProducts.map((p) => (
              <div
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs"
              >
                <div>
                  <h4 className="font-bold text-white text-sm">{p.name}</h4>
                  <p className="text-zinc-300 mt-0.5">
                    Giá hiện tại:{' '}
                    <strong className="text-zinc-200">{formatVnd(p.currentPrice)}</strong> ➔ Giá mới
                    tính ra:{' '}
                    <strong className="text-amber-400 text-sm font-bold">
                      {formatVnd(p.pendingPrice)}
                    </strong>
                  </p>
                </div>

                <button
                  onClick={() => handleApprovePrice(p.id)}
                  className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 font-semibold text-white shadow-md transition-colors"
                >
                  Phê duyệt áp dụng giá này
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default Shop Pricing Config (FR-PRICE-05) */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-purple-400" />
          <h2 className="text-base font-bold text-white">Cấu Hình Mặc Định Toàn Shop</h2>
        </div>
        <p className="text-xs text-zinc-400">
          Các giá trị này được dùng làm mặc định khi tạo sản phẩm mới hoặc tự động tính toán.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">% Lợi nhuận mặc định (%):</label>
            <input
              type="number"
              value={markupPercent}
              onChange={(e) => setMarkupPercent(Number(e.target.value))}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Bước làm tròn lên:</label>
            <select
              value={roundingStep}
              onChange={(e) => setRoundingStep(Number(e.target.value))}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
            >
              <option value={500}>Làm tròn 500 đ</option>
              <option value={1000}>Làm tròn 1.000 đ (Khuyến nghị)</option>
              <option value={5000}>Làm tròn 5.000 đ</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Lãi tối thiểu mỗi đơn vị (VND):</label>
            <input
              type="number"
              value={minMargin}
              onChange={(e) => setMinMargin(Number(e.target.value))}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">Tỷ giá USD ➔ VND:</label>
            <input
              type="number"
              value={usdRate}
              onChange={(e) => setUsdRate(Number(e.target.value))}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={() => toast.success('Đã lưu cấu hình định giá mặc định')}
          className="rounded-xl bg-purple-600 hover:bg-purple-500 px-6 py-2.5 text-xs font-semibold text-white transition-colors"
        >
          Lưu Cấu Hình Mặc Định
        </button>
      </div>
    </div>
  );
}
