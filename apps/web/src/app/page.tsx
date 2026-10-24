'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatVnd } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Copy,
  ChevronRight,
  Loader2,
  Wallet,
  ArrowRight,
} from 'lucide-react';

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  currentPrice: number;
  warrantyMinutes: number;
  mustUseImmediately: boolean;
  maxPerOrder: number;
  showStockCount: boolean;
  stock?: number;
  inStock: boolean;
  isPaused: boolean;
  pausedReason?: string;
}

export default function HomePage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Purchase Modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Purchase Result state
  const [purchaseResult, setPurchaseResult] = useState<{
    status: string;
    code?: string;
    links?: string[];
    failReason?: string;
    warrantyUntil?: string;
  } | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      if (res.success && res.data) {
        setProducts(res.data);
      }
    } catch {
      toast.error('Không thể tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBuyModal = (prod: Product) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/')}`);
      return;
    }
    setSelectedProduct(prod);
    setQuantity(1);
    setAcknowledged(false);
    setPurchaseResult(null);
    // FR-ORD-04: Generate new idempotency key on each modal open
    setIdempotencyKey(`KEY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedProduct || !acknowledged) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(
        '/orders',
        {
          productId: selectedProduct.id,
          quantity,
          mustUseAcknowledged: acknowledged,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      if (res.success && res.data) {
        setPurchaseResult(res.data);
        await refreshUser(); // update balance
        if (res.data.status === 'COMPLETED') {
          toast.success('Mua link thành công!');
        } else if (res.data.status === 'NEEDS_REVIEW') {
          toast.warning('Đơn hàng đang chờ Admin đối soát');
        } else if (res.data.status === 'FAILED') {
          toast.error(res.data.failReason || 'Đơn hàng không thành công');
        }
      } else {
        toast.error(res.error?.message || 'Có lỗi xảy ra khi tạo đơn hàng');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Đã sao chép link vào bộ nhớ tạm');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Banner */}
      <div className="relative mb-12 overflow-hidden rounded-3xl border border-blue-900/30 bg-gradient-to-br from-blue-950/40 via-indigo-950/30 to-purple-950/40 p-8 sm:p-12 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Hệ Thống Tự Động 100%
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent">
            Kích Hoạt Google Gemini Advanced
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-300">
            Link kích hoạt tài khoản bản quyền nhận ngay sau khi mua. Hệ thống tự động kết nối nguồn Telegram, bảo vệ số dư và hỗ trợ bảo hành tức thì.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-xs sm:text-sm text-zinc-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Giao link tức thì
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <Clock className="h-4 w-4" /> Bảo hành 5 phút
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <ShieldCheck className="h-4 w-4" /> Chuyển khoản VietQR tự động
            </span>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Gói Dịch Vụ Đang Bán</h2>
          <p className="text-xs sm:text-sm text-zinc-400">Chọn gói kích hoạt phù hợp với nhu cầu của bạn</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-400">
          Hiện chưa có sản phẩm nào được mở bán. Vui lòng quay lại sau!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((prod) => {
            const isAvailable = prod.inStock && !prod.isPaused;

            return (
              <div
                key={prod.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div>
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {prod.mustUseImmediately && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="h-3 w-3" /> Phải dùng ngay
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20">
                      <Clock className="h-3 w-3" /> Bảo hành {prod.warrantyMinutes} phút
                    </span>
                    {prod.showStockCount && prod.stock !== undefined ? (
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                        prod.stock > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        Còn {prod.stock}
                      </span>
                    ) : (
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                        prod.inStock ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {prod.inStock ? 'Còn hàng' : 'Hết hàng'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                    {prod.name}
                  </h3>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-blue-400">
                      {formatVnd(prod.currentPrice)}
                    </span>
                    <span className="text-xs text-zinc-500">/ link</span>
                  </div>

                  {prod.description && (
                    <div className="mt-4 text-xs text-zinc-400 line-clamp-3 whitespace-pre-line">
                      {prod.description}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800/80">
                  {prod.isPaused ? (
                    <button
                      disabled
                      className="w-full rounded-xl bg-zinc-800 py-2.5 text-center text-xs font-semibold text-zinc-500 cursor-not-allowed"
                    >
                      {prod.pausedReason || 'Tạm ngưng bán'}
                    </button>
                  ) : !prod.inStock ? (
                    <button
                      disabled
                      className="w-full rounded-xl bg-zinc-800 py-2.5 text-center text-xs font-semibold text-zinc-500 cursor-not-allowed"
                    >
                      Hết hàng
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenBuyModal(prod)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-semibold text-white transition-all shadow-md shadow-blue-600/20"
                    >
                      <span>Mua ngay</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation & Purchase Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            {purchaseResult ? (
              /* Purchase Result View */
              <div>
                {purchaseResult.status === 'COMPLETED' ? (
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Mua Link Thành Công!</h3>
                    <p className="mt-1 text-xs text-zinc-400">Mã đơn: {purchaseResult.code}</p>

                    <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 text-left flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Lưu ý:</strong> Link có hạn bảo hành <strong>{selectedProduct.warrantyMinutes} phút</strong>. Vui lòng bấm vào link và kích hoạt ngay vào tài khoản Google của bạn!
                      </span>
                    </div>

                    {/* Links Display */}
                    <div className="my-4 space-y-2 text-left">
                      <label className="text-xs font-semibold text-zinc-300">Link kích hoạt của bạn:</label>
                      {purchaseResult.links?.map((link, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950 p-2.5 border border-zinc-800"
                        >
                          <input
                            type="text"
                            readOnly
                            value={link}
                            className="w-full bg-transparent text-xs text-emerald-400 focus:outline-none select-all"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopyLink(link)}
                              className="rounded p-1 text-zinc-400 hover:text-white hover:bg-zinc-800"
                              title="Sao chép"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded p-1 text-zinc-400 hover:text-white hover:bg-zinc-800"
                              title="Mở link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex gap-3">
                      <Link
                        href="/orders"
                        className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 text-center"
                      >
                        Xem trong Lịch sử đơn
                      </Link>
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                ) : purchaseResult.status === 'NEEDS_REVIEW' ? (
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                      <Clock className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Đơn Đang Được Xử Lý</h3>
                    <p className="mt-2 text-xs text-zinc-300">
                      Hệ thống đã gửi lệnh mua nhưng kết quả từ bot nguồn cần được Admin đối soát. Link sẽ được cập nhật trong mục <strong>Lịch sử mua</strong> ngay sau khi kiểm tra xong.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        Đã hiểu
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Mua Hàng Thất Bại</h3>
                    <p className="mt-2 text-xs text-zinc-300">
                      {purchaseResult.failReason || 'Nguồn hàng hiện đang hết hoặc tạm thời không thể cung cấp.'}
                    </p>
                    <p className="mt-1 text-xs text-emerald-400 font-medium">
                      ✓ Tiền đã được tự động hoàn lại vào số dư ví của bạn.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="w-full rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Confirmation Form */
              <div>
                <h3 className="text-lg font-bold text-white">Xác Nhận Đặt Mua</h3>
                <p className="text-xs text-zinc-400">{selectedProduct.name}</p>

                {/* Quantity */}
                <div className="mt-4 flex items-center justify-between border-y border-zinc-800 py-3">
                  <span className="text-sm text-zinc-300">Số lượng:</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1 || isSubmitting}
                      className="h-8 w-8 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold text-white">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(selectedProduct.maxPerOrder, q + 1))}
                      disabled={quantity >= selectedProduct.maxPerOrder || isSubmitting}
                      className="h-8 w-8 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Pricing & Balance Calculation (FR-ORD-02) */}
                {(() => {
                  const unitPrice = selectedProduct.currentPrice;
                  const totalPrice = unitPrice * quantity;
                  const currentBalance = user?.balance || 0;
                  const balanceAfter = currentBalance - totalPrice;
                  const isShortage = balanceAfter < 0;
                  const shortageAmount = Math.abs(balanceAfter);

                  return (
                    <div className="mt-4 space-y-2 rounded-xl bg-zinc-950 p-4 border border-zinc-800 text-xs">
                      <div className="flex justify-between text-zinc-400">
                        <span>Đơn giá:</span>
                        <span>{formatVnd(unitPrice)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-white">
                        <span>Tổng thanh toán:</span>
                        <span className="text-blue-400 text-sm">{formatVnd(totalPrice)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400 pt-2 border-t border-zinc-800">
                        <span>Số dư ví hiện tại:</span>
                        <span>{formatVnd(currentBalance)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Số dư sau khi mua:</span>
                        <span className={isShortage ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                          {formatVnd(balanceAfter)}
                        </span>
                      </div>

                      {isShortage && (
                        <div className="mt-3 rounded-lg bg-red-500/10 p-2.5 border border-red-500/20 text-red-300 flex items-center justify-between">
                          <span>Thiếu {formatVnd(shortageAmount)}</span>
                          <Link
                            href="/topup"
                            className="inline-flex items-center gap-1 font-semibold text-red-400 hover:underline"
                          >
                            <span>Nạp thêm</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* FR-ORD-03: Mandatory Checkbox */}
                {selectedProduct.mustUseImmediately && (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-amber-200">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="mt-0.5 rounded border-amber-500/50 bg-zinc-900 text-amber-500 focus:ring-0"
                      />
                      <span>
                        Tôi đã hiểu: Link kích hoạt <strong>phải sử dụng ngay</strong> và chỉ được bảo hành trong vòng <strong>{selectedProduct.warrantyMinutes} phút</strong> sau khi mua.
                      </span>
                    </label>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setSelectedProduct(null)}
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleConfirmPurchase}
                    disabled={
                      !acknowledged ||
                      isSubmitting ||
                      (user?.balance || 0) < selectedProduct.currentPrice * quantity
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <span>Xác nhận thanh toán</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
