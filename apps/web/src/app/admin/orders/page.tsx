'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatVnd, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  Search,
  Loader2,
} from 'lucide-react';

interface AdminOrder {
  id: string;
  code: string;
  status: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitCost: number;
  failReason?: string;
  createdAt: string;
  user: { id: string; email: string };
  product: { id: string; name: string };
  source?: { id: string; name: string };
  items: Array<{ id: string; origin: string; disabled: boolean }>;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('NEEDS_REVIEW');
  const [searchTerm, setSearchTerm] = useState('');

  // Intervention modals
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [modalMode, setModalMode] = useState<'FULFILL' | 'REFUND' | null>(null);
  const [manualLinks, setManualLinks] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const url = statusFilter
        ? `/admin/orders?status=${statusFilter}`
        : '/admin/orders';
      const res = await api.get(url);
      if (res.success && res.data?.items) {
        setOrders(res.data.items);
      }
    } catch {
      toast.error('Lỗi khi tải danh sách đơn');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (order: AdminOrder, mode: 'FULFILL' | 'REFUND') => {
    setSelectedOrder(order);
    setModalMode(mode);
    setManualLinks('');
    setAdminNote('');
  };

  const handleSubmitAction = async () => {
    if (!selectedOrder || !modalMode) return;

    if (modalMode === 'FULFILL') {
      const links = manualLinks
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      if (links.length !== selectedOrder.quantity) {
        toast.error(`Vui lòng nhập đúng ${selectedOrder.quantity} link (mỗi dòng 1 link)`);
        return;
      }
      if (!adminNote) {
        toast.error('Vui lòng nhập ghi chú bắt buộc');
        return;
      }

      setSubmitting(true);
      try {
        const res = await api.post(`/admin/orders/${selectedOrder.id}/fulfill-manual`, {
          links,
          adminNote,
        });
        if (res.success) {
          toast.success('Đã hoàn tất đơn hàng thủ công!');
          setModalMode(null);
          fetchOrders();
        } else {
          toast.error(res.error?.message || 'Thất bại');
        }
      } catch (err: any) {
        toast.error(err.message || 'Lỗi');
      } finally {
        setSubmitting(false);
      }
    }

    if (modalMode === 'REFUND') {
      if (!adminNote || adminNote.length < 5) {
        toast.error('Vui lòng nhập lý do hoàn tiền (từ 5 ký tự)');
        return;
      }

      setSubmitting(true);
      try {
        const res = await api.post(`/admin/orders/${selectedOrder.id}/refund`, {
          reason: adminNote,
        });
        if (res.success) {
          toast.success('Đã hoàn tiền đơn hàng vào ví khách thành công!');
          setModalMode(null);
          fetchOrders();
        } else {
          toast.error(res.error?.message || 'Thất bại');
        }
      } catch (err: any) {
        toast.error(err.message || 'Lỗi');
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Quản Lý Đơn Hàng & Đối Soát</h1>
        <p className="text-xs text-zinc-400">
          Xử lý các đơn chưa rõ kết quả từ bot nguồn (NEEDS_REVIEW) và lịch sử giao dịch
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 text-xs">
        <button
          onClick={() => setStatusFilter('NEEDS_REVIEW')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            statusFilter === 'NEEDS_REVIEW'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Đơn Cần Đối Soát (NEEDS_REVIEW)</span>
        </button>
        <button
          onClick={() => setStatusFilter('')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            statusFilter === ''
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Tất cả đơn hàng</span>
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-xs text-zinc-400">
          Không có đơn hàng nào trong mục này.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Giá bán</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-mono font-bold text-blue-400">{o.code}</td>
                  <td className="px-4 py-3.5">{o.user?.email}</td>
                  <td className="px-4 py-3.5 font-medium text-white">
                    {o.product?.name} (x{o.quantity})
                  </td>
                  <td className="px-4 py-3.5 font-bold text-white">{formatVnd(o.totalPrice)}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold ${
                        o.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : o.status === 'NEEDS_REVIEW'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {o.status}
                    </span>
                    {o.failReason && (
                      <p className="text-[10px] text-zinc-500 mt-1 max-w-xs truncate">
                        {o.failReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 whitespace-nowrap">
                    {formatDateTime(o.createdAt)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {o.status === 'NEEDS_REVIEW' ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(o, 'FULFILL')}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-white font-semibold text-[11px]"
                        >
                          Nhập link
                        </button>
                        <button
                          onClick={() => handleOpenModal(o, 'REFUND')}
                          className="rounded-lg bg-red-600 hover:bg-red-500 px-2.5 py-1 text-white font-semibold text-[11px]"
                        >
                          Hoàn tiền
                        </button>
                      </div>
                    ) : (
                      <span className="text-zinc-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Intervention Dialog (FR-ADM-04) */}
      {selectedOrder && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              {modalMode === 'FULFILL'
                ? `Nhập Link Hoàn Tất Đơn ${selectedOrder.code}`
                : `Hoàn Tiền Vào Ví Khách Cho Đơn ${selectedOrder.code}`}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Khách hàng: {selectedOrder.user.email} | Số lượng link: {selectedOrder.quantity}
            </p>

            <div className="space-y-4 text-xs">
              {modalMode === 'FULFILL' && (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Nhập link kích hoạt (mỗi dòng 1 link):
                  </label>
                  <textarea
                    rows={4}
                    value={manualLinks}
                    onChange={(e) => setManualLinks(e.target.value)}
                    placeholder="https://one.google.com/..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Ghi chú đối soát / Lý do (*):
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ví dụ: Đã đối soát số dư bot Telegram thành công / Bot không trừ tiền"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setModalMode(null)}
                disabled={submitting}
                className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitAction}
                disabled={submitting}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white ${
                  modalMode === 'FULFILL'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Xác nhận thực hiện</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
