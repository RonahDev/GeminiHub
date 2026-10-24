'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatVnd, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

interface OrderItem {
  id: string;
  url: string;
  origin: string;
  disabled: boolean;
}

interface OrderDetail {
  id: string;
  code: string;
  status: string;
  product: {
    id: string;
    name: string;
    slug: string;
    warrantyMinutes: number;
  };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  failReason?: string;
  warrantyUntil?: string;
  isWarrantyAvailable: boolean;
  links: OrderItem[];
  warrantyTicket?: {
    id: string;
    reason: string;
    status: string;
    resolution?: string;
    adminNote?: string;
    createdAt: string;
    resolvedAt?: string;
  };
  createdAt: string;
  completedAt?: string;
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealedLinks, setRevealedLinks] = useState<Record<string, boolean>>({});

  // Warranty modal state
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);
  const [warrantyReason, setWarrantyReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submittingWarranty, setSubmittingWarranty] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push(`/login?redirect=/orders/${id}`);
      return;
    }
    fetchOrder();
  }, [id, user]);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        toast.error('Không tìm thấy thông tin đơn hàng');
      }
    } catch {
      toast.error('Lỗi khi tải chi tiết đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const toggleReveal = (itemId: string) => {
    setRevealedLinks((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép link');
  };

  const handleSubmitWarranty = async () => {
    if (!warrantyReason || warrantyReason.length < 5) {
      toast.error('Vui lòng nhập lý do báo lỗi cụ thể (tối thiểu 5 ký tự)');
      return;
    }

    setSubmittingWarranty(true);
    try {
      const res = await api.post(`/orders/${id}/warranty`, {
        reason: warrantyReason,
        attachmentUrl: attachmentUrl.trim() || undefined,
      });

      if (res.success) {
        toast.success('Đã gửi yêu cầu bảo hành thành công!');
        setShowWarrantyModal(false);
        fetchOrder();
      } else {
        toast.error(res.error?.message || 'Không thể gửi yêu cầu bảo hành');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi yêu cầu');
    } finally {
      setSubmittingWarranty(false);
    }
  };

  const maskLink = (link: string) => {
    if (link.length <= 25) return '••••••••••••••••••••••••';
    return `${link.slice(0, 20)}••••••••${link.slice(-8)}`;
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-zinc-400">Không tìm thấy đơn hàng</p>
        <Link href="/orders" className="mt-4 inline-block text-xs font-semibold text-blue-400">
          ← Quay lại danh sách đơn
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Quay lại danh sách đơn hàng
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">Đơn hàng {order.code}</h1>
          </div>
          <p className="text-xs text-zinc-400">Tạo lúc {formatDateTime(order.createdAt)}</p>
        </div>

        {/* FR-WAR-01: Warranty Action Button */}
        {order.isWarrantyAvailable && (
          <button
            onClick={() => setShowWarrantyModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Báo lỗi bảo hành ({order.product.warrantyMinutes} phút)</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Delivered Links (FR-HIST-02) */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
            <h2 className="text-base font-bold text-white mb-4">Link Kích Hoạt Đã Mua</h2>

            {order.links.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">Chưa có link kích hoạt cho đơn hàng này.</p>
            ) : (
              <div className="space-y-3">
                {order.links.map((item, idx) => {
                  const isRevealed = revealedLinks[item.id];
                  const displayUrl = isRevealed ? item.url : maskLink(item.url);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 transition-all ${
                        item.disabled
                          ? 'border-red-900/40 bg-red-950/20 opacity-60'
                          : 'border-zinc-800 bg-zinc-950'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                        <span className="font-semibold">Link #{idx + 1} {item.origin === 'WARRANTY' && '(Link Đổi Mới)'}</span>
                        {item.disabled && (
                          <span className="text-red-400 font-medium">Link đã bị thay thế</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-900 p-2.5 border border-zinc-800/80">
                        <span
                          className={`font-mono text-xs select-all truncate ${
                            item.disabled ? 'line-through text-zinc-500' : 'text-emerald-400'
                          }`}
                        >
                          {displayUrl}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* FR-HIST-02: Show/Hide */}
                          <button
                            onClick={() => toggleReveal(item.id)}
                            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
                            title={isRevealed ? 'Ẩn bớt link' : 'Hiện đầy đủ link'}
                          >
                            {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          {/* Copy */}
                          <button
                            onClick={() => handleCopy(item.url)}
                            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
                            title="Sao chép link"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          {/* Open */}
                          {!item.disabled && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
                              title="Mở trong tab mới"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Warranty Ticket History (FR-HIST-05) */}
          {order.warrantyTicket && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-2">Thông Tin Khiếu Nại Bảo Hành</h3>
              <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Trạng thái ticket:</span>
                  <span className="font-semibold text-amber-400">{order.warrantyTicket.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Lý do báo lỗi:</span>
                  <span className="text-zinc-200">{order.warrantyTicket.reason}</span>
                </div>
                {order.warrantyTicket.resolution && (
                  <div className="flex justify-between pt-2 border-t border-zinc-800">
                    <span className="text-zinc-500">Kết quả xử lý:</span>
                    <span className="font-semibold text-emerald-400">{order.warrantyTicket.resolution}</span>
                  </div>
                )}
                {order.warrantyTicket.adminNote && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Phản hồi của Admin:</span>
                    <span className="text-zinc-300">{order.warrantyTicket.adminNote}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Order Summary Sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl text-xs space-y-3">
            <h3 className="text-sm font-bold text-white mb-3">Tóm Tắt Đơn Hàng</h3>
            <div className="flex justify-between">
              <span className="text-zinc-400">Sản phẩm:</span>
              <span className="font-semibold text-white">{order.product.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Số lượng:</span>
              <span className="font-semibold text-white">{order.quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Đơn giá:</span>
              <span className="text-white">{formatVnd(order.unitPrice)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-zinc-800 font-bold text-sm">
              <span className="text-white">Tổng tiền:</span>
              <span className="text-blue-400">{formatVnd(order.totalPrice)}</span>
            </div>

            {order.warrantyUntil && (
              <div className="mt-4 pt-3 border-t border-zinc-800">
                <span className="text-zinc-400 block mb-1">Thời hạn bảo hành:</span>
                <span className="font-semibold text-amber-400 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateTime(order.warrantyUntil)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warranty Submission Modal (FR-WAR-02) */}
      {showWarrantyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Gửi Yêu Cầu Bảo Hành Đơn {order.code}</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Vui lòng mô tả chi tiết lỗi bạn gặp phải khi sử dụng link để bộ phận kỹ thuật hỗ trợ đổi link hoặc hoàn tiền.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Mô tả lỗi gặp phải (*):</label>
                <textarea
                  rows={3}
                  value={warrantyReason}
                  onChange={(e) => setWarrantyReason(e.target.value)}
                  placeholder="Ví dụ: Link báo đã có người kích hoạt / Link không truy cập được..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Đường dẫn ảnh chụp màn hình (tùy chọn):</label>
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://imgur.com/..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowWarrantyModal(false)}
                disabled={submittingWarranty}
                className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitWarranty}
                disabled={submittingWarranty || warrantyReason.length < 5}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {submittingWarranty ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Gửi yêu cầu</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
