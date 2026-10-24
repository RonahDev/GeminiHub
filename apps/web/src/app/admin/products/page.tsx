'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatVnd } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  currentPrice: number;
  pendingPrice?: number | null;
  pricingMode: 'FIXED' | 'COST_PLUS';
  markupPercent: number;
  roundingStep: number;
  warrantyMinutes: number;
  isActive: boolean;
  pausedReason?: string;
  sources: Array<{
    id: string;
    priority: number;
    enabled: boolean;
    maxCost?: number | null;
    sourceProduct: {
      name: string;
      costVnd: number;
      stock: number;
      source: { name: string; status: string };
    };
  }>;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Add product modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newWarranty, setNewWarranty] = useState(5);
  const [newMarkup, setNewMarkup] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/admin/products');
      if (res.success && res.data) {
        setProducts(res.data);
      }
    } catch {
      toast.error('Lỗi khi tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await api.post('/admin/products', {
        name: newName,
        slug: newSlug,
        description: newDesc,
        warrantyMinutes: newWarranty,
        markupPercent: newMarkup,
        pricingMode: 'COST_PLUS',
        roundingStep: 1000,
      });

      if (res.success) {
        toast.success('Đã tạo sản phẩm mới thành công!');
        setShowAddModal(false);
        fetchProducts();
      } else {
        toast.error(res.error?.message || 'Không thể tạo sản phẩm');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sản Phẩm Shop & Liên Kết Nguồn (Mapping)</h1>
          <p className="text-xs text-zinc-400">
            Quản lý danh sách sản phẩm hiển thị, quy tắc giá vốn cộng lãi và thứ tự ưu tiên bot nguồn
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-xs font-semibold text-white transition-all shadow-md shadow-purple-600/30"
        >
          <Plus className="h-4 w-4" />
          <span>Tạo Sản Phẩm Mới</span>
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {products.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-blue-400">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{p.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span>Slug: /{p.slug}</span>
                      <span>•</span>
                      <span>Bảo hành: {p.warrantyMinutes} phút</span>
                      <span>•</span>
                      <span className="text-purple-400 font-semibold">
                        {p.pricingMode} (+{p.markupPercent}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block">Giá bán khách thấy:</span>
                    <span className="text-lg font-black text-blue-400">
                      {formatVnd(p.currentPrice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mapped Sources Table (FR-MAP-02..05) */}
              <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Nguồn bot liên kết (Thứ tự ưu tiên failover):
                  </span>
                  <span className="text-xs text-zinc-500">{p.sources.length} nguồn liên kết</span>
                </div>

                {p.sources.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-2">
                    Chưa liên kết nguồn bot nào. Sản phẩm sẽ không thể đặt mua.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {p.sources.map((s) => {
                      const profit = p.currentPrice - s.sourceProduct.costVnd;

                      return (
                        <div
                          key={s.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-zinc-900 p-3 border border-zinc-800/80 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 font-bold text-zinc-300 text-[10px]">
                              #{s.priority}
                            </span>
                            <div>
                              <p className="font-bold text-white">
                                {s.sourceProduct.name} ({s.sourceProduct.source.name})
                              </p>
                              <span className="text-zinc-400 text-[11px]">
                                Tồn kho bot: {s.sourceProduct.stock} | Giá vốn:{' '}
                                <strong className="text-zinc-200">
                                  {formatVnd(s.sourceProduct.costVnd)}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-[10px] text-zinc-500 block">Lãi ước tính:</span>
                              <span
                                className={`font-bold ${
                                  profit >= 5000 ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                +{formatVnd(profit)}
                              </span>
                            </div>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                s.enabled
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              {s.enabled ? 'Đang bật' : 'Tắt'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Tạo Sản Phẩm Mới</h3>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Tên sản phẩm:</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) {
                      setNewSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)/g, '')
                      );
                    }
                  }}
                  placeholder="Ví dụ: Gemini Advanced 1 Tháng"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Slug URL:</label>
                <input
                  type="text"
                  required
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="gemini-advanced-1-thang"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Phút bảo hành:</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newWarranty}
                    onChange={(e) => setNewWarranty(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">% Lãi theo giá vốn:</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newMarkup}
                    onChange={(e) => setNewMarkup(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Mô tả sản phẩm:</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Hướng dẫn kích hoạt..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Lưu Sản Phẩm</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

