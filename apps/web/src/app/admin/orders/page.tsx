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
  Search,
  Loader2,
  User,
  Filter,
  Eye,
  ExternalLink,
  Copy,
  Calendar,
  XCircle,
  Sparkles,
  Bot,
  ShieldCheck,
  Hash,
  ChevronRight,
  TrendingUp,
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
  completedAt?: string;
  warrantyUntil?: string;
  user: {
    id: string;
    email: string;
    role?: string;
    balance?: number;
    createdAt?: string;
    totalOrdersCount: number;
  };
  product: { id: string; name: string; slug: string };
  source?: { id: string; name: string };
  items: Array<{ id: string; origin: string; disabled: boolean; link?: string }>;
  sourceCalls?: Array<{
    id: string;
    operation: string;
    result: string;
    durationMs: number;
    createdAt: string;
  }>;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<{ id: string; email: string } | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // Detail Modal state
  const [detailOrder, setDetailOrder] = useState<AdminOrder | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Intervention modals state
  const [selectedOrderForAction, setSelectedOrderForAction] = useState<AdminOrder | null>(null);
  const [modalMode, setModalMode] = useState<'FULFILL' | 'REFUND' | null>(null);
  const [manualLinks, setManualLinks] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, selectedUserFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (selectedUserFilter) params.append('userId', selectedUserFilter.id);
      if (searchTerm) params.append('search', searchTerm);

      const url = `/admin/orders${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await api.get(url);
      if (res.success && res.data) {
        setOrders(res.data.items || []);
        if (res.data.statusCounts) {
          setStatusCounts(res.data.statusCounts);
        }
      }
    } catch {
      toast.error('Lỗi khi tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleOpenDetailModal = async (orderId: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/admin/orders/${orderId}`);
      if (res.success && res.data) {
        setDetailOrder(res.data);
      } else {
        toast.error('Không tìm thấy chi tiết đơn hàng');
      }
    } catch {
      toast.error('Lỗi khi tải chi tiết đơn hàng');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenActionModal = (order: AdminOrder, mode: 'FULFILL' | 'REFUND') => {
    setSelectedOrderForAction(order);
    setModalMode(mode);
    setManualLinks('');
    setAdminNote('');
  };

  const handleSubmitAction = async () => {
    if (!selectedOrderForAction || !modalMode) return;

    if (modalMode === 'FULFILL') {
      const links = manualLinks
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      if (links.length !== selectedOrderForAction.quantity) {
        toast.error(`Vui lòng nhập đúng ${selectedOrderForAction.quantity} link (mỗi dòng 1 link)`);
        return;
      }
      if (!adminNote) {
        toast.error('Vui lòng nhập ghi chú bắt buộc');
        return;
      }

      setSubmitting(true);
      try {
        const res = await api.post(`/admin/orders/${selectedOrderForAction.id}/fulfill-manual`, {
          links,
          adminNote,
        });
        if (res.success) {
          toast.success('Đã hoàn tất đơn hàng thủ công!');
          setModalMode(null);
          fetchOrders();
          if (detailOrder?.id === selectedOrderForAction.id) {
            handleOpenDetailModal(selectedOrderForAction.id);
          }
        } else {
          toast.error(res.error?.message || 'Thất bại');
        }
      } catch (err: any) {
        toast.error(err.message || 'Lỗi kết nối máy chủ');
      } finally {
        setSubmitting(false);
      }
    }

    if (modalMode === 'REFUND') {
      if (!adminNote || adminNote.length < 5) {
        toast.error('Vui lòng nhập lý do hoàn tiền (tối thiểu 5 ký tự)');
        return;
      }

      setSubmitting(true);
      try {
        const res = await api.post(`/admin/orders/${selectedOrderForAction.id}/refund`, {
          reason: adminNote,
        });
        if (res.success) {
          toast.success('Đã hoàn tiền đơn hàng vào ví khách thành công!');
          setModalMode(null);
          fetchOrders();
          if (detailOrder?.id === selectedOrderForAction.id) {
            handleOpenDetailModal(selectedOrderForAction.id);
          }
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép vào bộ nhớ tạm');
  };

  // Helper render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            <span>Đã xử lý (Thành công)</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-400 border border-blue-500/20 animate-pulse">
            <Clock className="h-3 w-3" />
            <span>Đang xử lý gọi Bot</span>
          </span>
        );
      case 'NEEDS_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-3 w-3" />
            <span>Cần đối soát</span>
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-400 border border-purple-500/20">
            <RotateCcw className="h-3 w-3" />
            <span>Đã hoàn tiền</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400 border border-red-500/20">
            <XCircle className="h-3 w-3" />
            <span>Thất bại (Hết hàng)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-bold text-zinc-300">
            <span>{status}</span>
          </span>
        );
    }
  };

  // Total orders in current view
  const totalOrdersCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-purple-400" />
            <span>Quản Lý Khách Đặt Đơn</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Theo dõi trạng thái đơn hàng thời gian thực, lịch sử ngày giờ đặt và tần suất đặt hàng theo từng tài khoản
          </p>
        </div>

        {selectedUserFilter && (
          <div className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3.5 py-1.5 text-xs text-purple-300">
            <User className="h-4 w-4" />
            <span>Đang lọc theo: <strong>{selectedUserFilter.email}</strong></span>
            <button
              onClick={() => setSelectedUserFilter(null)}
              className="ml-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 text-[11px] text-white"
            >
              Hủy lọc
            </button>
          </div>
        )}
      </div>

      {/* Quick Status Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setStatusFilter('')}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            statusFilter === ''
              ? 'border-purple-500/80 bg-purple-500/10 shadow-lg shadow-purple-500/10'
              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-semibold text-zinc-400 block">Tất cả đơn</span>
          <span className="text-xl font-black text-white font-mono mt-0.5 block">{totalOrdersCount}</span>
        </button>

        <button
          onClick={() => setStatusFilter('PROCESSING')}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            statusFilter === 'PROCESSING'
              ? 'border-blue-500/80 bg-blue-500/10 shadow-lg shadow-blue-500/10'
              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-semibold text-blue-400 block">Đang xử lý</span>
          <span className="text-xl font-black text-blue-400 font-mono mt-0.5 block">
            {statusCounts['PROCESSING'] || 0}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('COMPLETED')}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            statusFilter === 'COMPLETED'
              ? 'border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-semibold text-emerald-400 block">Đã xử lý xong</span>
          <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">
            {statusCounts['COMPLETED'] || 0}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('NEEDS_REVIEW')}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            statusFilter === 'NEEDS_REVIEW'
              ? 'border-amber-500/80 bg-amber-500/10 shadow-lg shadow-amber-500/10'
              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-semibold text-amber-400 block">Cần đối soát</span>
          <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">
            {statusCounts['NEEDS_REVIEW'] || 0}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('REFUNDED')}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            statusFilter === 'REFUNDED'
              ? 'border-purple-500/80 bg-purple-500/10 shadow-lg shadow-purple-500/10'
              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-semibold text-purple-400 block">Đã hoàn tiền</span>
          <span className="text-xl font-black text-purple-400 font-mono mt-0.5 block">
            {statusCounts['REFUNDED'] || 0}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('FAILED')}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            statusFilter === 'FAILED'
              ? 'border-red-500/80 bg-red-500/10 shadow-lg shadow-red-500/10'
              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-semibold text-red-400 block">Thất bại</span>
          <span className="text-xl font-black text-red-400 font-mono mt-0.5 block">
            {statusCounts['FAILED'] || 0}
          </span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã đơn (ORD-...) hoặc email khách hàng..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/70 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
          />
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
        </form>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5 text-xs text-zinc-300 focus:border-purple-500 focus:outline-none"
        >
          <option value="">-- Tất cả trạng thái đơn --</option>
          <option value="PROCESSING">Đang xử lý (PROCESSING)</option>
          <option value="COMPLETED">Đã xử lý thành công (COMPLETED)</option>
          <option value="NEEDS_REVIEW">Cần đối soát (NEEDS_REVIEW)</option>
          <option value="REFUNDED">Đã hoàn tiền (REFUNDED)</option>
          <option value="FAILED">Thất bại / Hết hàng (FAILED)</option>
        </select>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-xs text-zinc-400">
          Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3.5">Mã đơn</th>
                <th className="px-4 py-3.5">Tài khoản khách hàng</th>
                <th className="px-4 py-3.5">Tần suất đặt hàng</th>
                <th className="px-4 py-3.5">Sản phẩm</th>
                <th className="px-4 py-3.5">Tổng thanh toán</th>
                <th className="px-4 py-3.5">Trạng thái đơn</th>
                <th className="px-4 py-3.5">Lịch sử ngày & giờ đặt</th>
                <th className="px-4 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-800/40 transition-colors">
                  {/* Order Code */}
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleOpenDetailModal(o.id)}
                      className="font-mono font-bold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                      title="Xem chi tiết đơn này"
                    >
                      <Hash className="h-3.5 w-3.5" />
                      <span>{o.code}</span>
                    </button>
                  </td>

                  {/* Customer Email */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <span className="font-medium text-white block">{o.user?.email}</span>
                      </div>
                    </div>
                  </td>

                  {/* Order Frequency / Count for this user */}
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => setSelectedUserFilter({ id: o.user.id, email: o.user.email })}
                      title={`Lọc tất cả ${o.user.totalOrdersCount} đơn của khách hàng này`}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all hover:scale-105 ${
                        o.user.totalOrdersCount >= 5
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/20'
                          : o.user.totalOrdersCount > 1
                          ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {o.user.totalOrdersCount >= 5 ? (
                        <Sparkles className="h-3 w-3 text-purple-400" />
                      ) : (
                        <TrendingUp className="h-3 w-3" />
                      )}
                      <span>Đã đặt {o.user.totalOrdersCount} đơn</span>
                    </button>
                  </td>

                  {/* Product & Qty */}
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-white block">{o.product?.name}</span>
                    <span className="text-[11px] text-zinc-500">Số lượng: x{o.quantity}</span>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3.5 font-bold font-mono text-white">
                    {formatVnd(o.totalPrice)}
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3.5">
                    {renderStatusBadge(o.status)}
                    {o.failReason && (
                      <p className="text-[10px] text-zinc-500 mt-1 max-w-xs truncate" title={o.failReason}>
                        {o.failReason}
                      </p>
                    )}
                  </td>

                  {/* Order Date & Time History */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-zinc-400">
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{formatDateTime(o.createdAt)}</span>
                    </div>
                    {o.completedAt && (
                      <span className="text-[10px] text-emerald-400 block mt-0.5">
                        Xong lúc: {formatDateTime(o.completedAt)}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenDetailModal(o.id)}
                        className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-zinc-200 font-semibold text-[11px] flex items-center gap-1"
                        title="Xem chi tiết đơn"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Chi tiết</span>
                      </button>

                      {(o.status === 'NEEDS_REVIEW' || o.status === 'PROCESSING') && (
                        <button
                          onClick={() => handleOpenActionModal(o, 'FULFILL')}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-white font-semibold text-[11px]"
                        >
                          Nhập link
                        </button>
                      )}

                      {o.status !== 'REFUNDED' && (
                        <button
                          onClick={() => handleOpenActionModal(o, 'REFUND')}
                          className="rounded-lg bg-red-600/80 hover:bg-red-600 px-2.5 py-1 text-white font-semibold text-[11px]"
                        >
                          Hoàn tiền
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================= */}
      {/* ORDER DETAIL INSPECTION MODAL */}
      {/* ========================================================= */}
      {detailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-7 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4 mb-5">
              <div>
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider block mb-1">
                  Chi Tiết Đơn Hàng Quản Trị
                </span>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <span>Mã đơn: {detailOrder.code}</span>
                  {renderStatusBadge(detailOrder.status)}
                </h3>
              </div>
              <button
                onClick={() => setDetailOrder(null)}
                className="rounded-xl bg-zinc-800 hover:bg-zinc-700 p-2 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 text-xs">
              {/* Customer summary card */}
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                    <User className="h-4 w-4" /> Thông Tin Khách Hàng
                  </span>
                  <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[11px] font-bold text-purple-300 border border-purple-500/30">
                    Tổng cộng: Đã đặt {detailOrder.user.totalOrdersCount} đơn
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-300 pt-1">
                  <div>Email: <strong className="text-white">{detailOrder.user.email}</strong></div>
                  <div>Số dư ví hiện tại: <strong className="text-emerald-400">{formatVnd(detailOrder.user.balance || 0)}</strong></div>
                </div>
              </div>

              {/* Order Info & Time grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-2xl bg-zinc-950 p-4 border border-zinc-800">
                <div>
                  <span className="text-zinc-500 block text-[11px]">Sản phẩm:</span>
                  <span className="font-bold text-white block mt-0.5">{detailOrder.product.name}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Số lượng:</span>
                  <span className="font-bold text-white block mt-0.5">x{detailOrder.quantity} link</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Tổng giá tiền:</span>
                  <span className="font-bold text-blue-400 block mt-0.5 font-mono">{formatVnd(detailOrder.totalPrice)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Ngày giờ đặt đơn:</span>
                  <span className="font-medium text-zinc-200 block mt-0.5">{formatDateTime(detailOrder.createdAt)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Ngày giờ hoàn tất:</span>
                  <span className="font-medium text-zinc-200 block mt-0.5">
                    {detailOrder.completedAt ? formatDateTime(detailOrder.completedAt) : 'Chưa hoàn tất'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Bảo hành đến:</span>
                  <span className="font-medium text-amber-400 block mt-0.5">
                    {detailOrder.warrantyUntil ? formatDateTime(detailOrder.warrantyUntil) : 'Chưa kích hoạt'}
                  </span>
                </div>
              </div>

              {/* Delivered Activation Links (Decrypted) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> Link Kích Hoạt Đã Cấp (Đã Giải Mã)
                  </span>
                  <span className="text-zinc-500 text-[11px]">
                    {detailOrder.items.length} link
                  </span>
                </div>

                {detailOrder.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-zinc-500">
                    Chưa có link kích hoạt nào được cấp cho đơn này.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailOrder.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 p-3 border border-zinc-800"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                            #{idx + 1}
                          </span>
                          <span className="font-mono text-emerald-400 truncate text-[11px]">
                            {item.link}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleCopy(item.link || '')}
                            className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800"
                            title="Sao chép"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800"
                            title="Mở link"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bot Telegram Source Calls History */}
              {detailOrder.sourceCalls && detailOrder.sourceCalls.length > 0 && (
                <div>
                  <span className="font-semibold text-white flex items-center gap-1.5 mb-2">
                    <Bot className="h-4 w-4 text-blue-400" /> Lịch Sử Tương Tác Bot Nguồn Telegram
                  </span>
                  <div className="space-y-1.5">
                    {detailOrder.sourceCalls.map((call) => (
                      <div
                        key={call.id}
                        className="flex items-center justify-between rounded-xl bg-zinc-950 p-2.5 border border-zinc-800 text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              call.result === 'SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {call.result}
                          </span>
                          <span className="text-zinc-300 font-mono">{call.operation}</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-500">
                          <span>{call.durationMs}ms</span>
                          <span>{formatDateTime(call.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-between gap-3">
              <div className="flex gap-2">
                {(detailOrder.status === 'NEEDS_REVIEW' || detailOrder.status === 'PROCESSING') && (
                  <button
                    onClick={() => {
                      setDetailOrder(null);
                      handleOpenActionModal(detailOrder, 'FULFILL');
                    }}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Nhập link thủ công
                  </button>
                )}
                {detailOrder.status !== 'REFUNDED' && (
                  <button
                    onClick={() => {
                      setDetailOrder(null);
                      handleOpenActionModal(detailOrder, 'REFUND');
                    }}
                    className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Hoàn tiền vào ví khách
                  </button>
                )}
              </div>
              <button
                onClick={() => setDetailOrder(null)}
                className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-5 py-2 text-xs font-semibold text-white"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* INTERVENTION ACTION MODAL (FULFILL / REFUND) */}
      {/* ========================================================= */}
      {selectedOrderForAction && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              {modalMode === 'FULFILL'
                ? `Nhập Link Hoàn Tất Đơn ${selectedOrderForAction.code}`
                : `Hoàn Tiền Vào Ví Khách Cho Đơn ${selectedOrderForAction.code}`}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Khách hàng: {selectedOrderForAction.user.email} (Đã đặt {selectedOrderForAction.user.totalOrdersCount} đơn) | Số lượng: {selectedOrderForAction.quantity} link
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
                    placeholder="https://one.google.com/promo=..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Ghi chú đối soát / Lý do hoàn tiền (*):
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ví dụ: Đã đối soát bot Telegram thành công / Cấp link bù cho khách"
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
