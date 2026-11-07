'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  User,
  Globe,
  Terminal,
  Copy,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Flame,
  Bug,
  Info,
  Archive,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ErrorLogItem {
  id: string;
  severity: 'FATAL' | 'ERROR' | 'WARN' | 'INFO';
  source: string;
  code?: string | null;
  message: string;
  stack?: string | null;
  context?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  method?: string | null;
  status: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    role: string;
    balance?: number;
  } | null;
}

interface ErrorStats {
  total: number;
  fatalCount: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  openCount: number;
  resolvedCount: number;
}

export default function AdminErrorLogsPage() {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const [stats, setStats] = useState<ErrorStats>({
    total: 0,
    fatalCount: 0,
    errorCount: 0,
    warnCount: 0,
    infoCount: 0,
    openCount: 0,
    resolvedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected for Modal
  const [selectedLog, setSelectedLog] = useState<ErrorLogItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (search.trim()) params.append('search', search.trim());
      if (severityFilter) params.append('severity', severityFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = (await api.get(`/admin/logs/errors?${params.toString()}`)) as any;
      if (res.success && res.data) {
        setLogs(res.data);
        if (res.totalPages) setTotalPages(res.totalPages);
        if (res.stats) setStats(res.stats);
      } else {
        toast.error('Không thể tải nhật ký lỗi hệ thống');
      }
    } catch {
      toast.error('Lỗi kết nối khi tải danh sách log');
    } finally {
      setLoading(false);
    }
  }, [page, search, severityFilter, sourceFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handle Quick Status Change
  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/admin/logs/errors/${id}/status`, { status: newStatus });
      if (res.success) {
        toast.success(`Đã cập nhật trạng thái: ${newStatus}`);
        setLogs((prev) =>
          prev.map((log) => (log.id === id ? { ...log, status: newStatus } : log))
        );
        if (selectedLog && selectedLog.id === id) {
          setSelectedLog((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        // Refresh metrics
        fetchLogs();
      } else {
        toast.error(res.error?.message || 'Không thể cập nhật trạng thái');
      }
    } catch {
      toast.error('Lỗi khi cập nhật trạng thái log');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi lỗi này?')) return;
    try {
      const res = await api.delete(`/admin/logs/errors/${id}`);
      if (res.success) {
        toast.success('Đã xóa log lỗi thành công');
        setIsModalOpen(false);
        fetchLogs();
      } else {
        toast.error('Xóa thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối khi xóa log');
    }
  };

  // Handle Purge Old Resolved Logs
  const handleClearOld = async () => {
    if (!confirm('Hành động này sẽ xóa vĩnh viễn tất cả log lỗi ĐÃ XỬ LÝ (RESOLVED) cũ hơn 30 ngày. Tiếp tục?')) {
      return;
    }
    try {
      const res = await api.post('/admin/logs/errors/clear', { days: 30 });
      if (res.success) {
        toast.success(res.message || 'Đã dọn dẹp log cũ thành công');
        fetchLogs();
      } else {
        toast.error('Dọn dẹp thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối khi dọn dẹp');
    }
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success(`Đã sao chép ${type}`);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Helper for Severity Badge
  const renderSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'FATAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-950">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            FATAL
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            ERROR
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            WARN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            INFO
          </span>
        );
    }
  };

  // Helper for Status Badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <Badge variant="success" dot>ĐÃ XỬ LÝ</Badge>;
      case 'INVESTIGATING':
        return <Badge variant="warning" dot>ĐANG XỬ LÝ</Badge>;
      case 'IGNORED':
        return <Badge variant="neutral">BỎ QUA</Badge>;
      default:
        return <Badge variant="purple" dot>MỚI / OPEN</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Nhật Ký Lỗi Hệ Thống & Users
              </h1>
              <p className="text-xs text-zinc-400">
                Ghi nhận, giám sát và cảnh báo lỗi bất biến từ máy chủ, bot Telegram, thanh toán và hành vi khách hàng.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearOld}
            className="text-xs border-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <Archive className="h-3.5 w-3.5 mr-1 text-zinc-500" />
            Dọn dẹp log cũ (&gt;30d)
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => fetchLogs()}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* KPI Stats Counter Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Tổng số sự cố</span>
            <Bug className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono">
            {stats.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Tất cả các bản ghi</div>
        </div>

        <div className="rounded-2xl border border-rose-900/30 bg-rose-950/20 p-4">
          <div className="flex items-center justify-between text-xs text-rose-400">
            <span className="font-semibold">Nghiêm trọng (FATAL)</span>
            <Flame className="h-4 w-4 text-rose-400 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-300 font-mono">
            {stats.fatalCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-400/70 mt-0.5">Lỗi máy chủ 500 & sập mạng</div>
        </div>

        <div className="rounded-2xl border border-orange-900/30 bg-orange-950/20 p-4">
          <div className="flex items-center justify-between text-xs text-orange-400">
            <span className="font-semibold">Lỗi nguồn & Bot (ERROR)</span>
            <AlertTriangle className="h-4 w-4 text-orange-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-300 font-mono">
            {stats.errorCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-orange-400/70 mt-0.5">Bot timeout, hết hàng, crash</div>
        </div>

        <div className="rounded-2xl border border-amber-900/30 bg-amber-950/20 p-4">
          <div className="flex items-center justify-between text-xs text-amber-400">
            <span className="font-semibold">Cảnh báo khách (WARN)</span>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300 font-mono">
            {stats.warnCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-400/70 mt-0.5">Thiếu số dư ví, sai auth</div>
        </div>

        <div className="rounded-2xl border border-purple-900/30 bg-purple-950/20 p-4 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-purple-400">
            <span className="font-semibold">Chờ xử lý (OPEN)</span>
            <Clock className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-300 font-mono">
            {stats.openCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-purple-400/70 mt-0.5">Cần Admin kiểm tra</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Keyword Search */}
          <div className="relative md:col-span-5">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Tìm theo nội dung lỗi, code, email user, endpoint..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Severity Dropdown */}
          <div className="md:col-span-2">
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">Tất cả mức độ</option>
              <option value="FATAL">🔴 FATAL (Nghiêm trọng)</option>
              <option value="ERROR">🟠 ERROR (Lỗi hệ thống/Bot)</option>
              <option value="WARN">🟡 WARN (Cảnh báo người dùng)</option>
              <option value="INFO">🔵 INFO (Thông tin)</option>
            </select>
          </div>

          {/* Source Dropdown */}
          <div className="md:col-span-2">
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">Tất cả nguồn lỗi</option>
              <option value="SYSTEM">Hệ thống (SYSTEM)</option>
              <option value="API">API REST</option>
              <option value="TELEGRAM_BOT">Bot Telegram</option>
              <option value="ORDER">Đặt hàng (ORDER)</option>
              <option value="WALLET">Ví tiền (WALLET)</option>
              <option value="AUTH">Xác thực (AUTH)</option>
              <option value="WEBHOOK">Webhook thanh toán</option>
              <option value="CLIENT">Trình duyệt (CLIENT)</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="OPEN">Mới phát sinh (OPEN)</option>
              <option value="INVESTIGATING">Đang kiểm tra</option>
              <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
              <option value="IGNORED">Bỏ qua (IGNORED)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex h-72 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <span className="text-xs text-zinc-400">Đang nạp nhật ký lỗi...</span>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/80 text-emerald-400 mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">Không phát hiện sự cố nào!</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Hệ thống và người dùng đang vận hành hoàn toàn ổn định theo bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Mức độ</th>
                  <th className="px-4 py-3">Nguồn / Mã lỗi</th>
                  <th className="px-4 py-3">Nội dung lỗi & Đường dẫn</th>
                  <th className="px-4 py-3">Người dùng liên quan</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      setSelectedLog(log);
                      setIsModalOpen(true);
                    }}
                  >
                    {/* Severity */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderSeverityBadge(log.severity)}
                    </td>

                    {/* Source & Code */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                          {log.source}
                        </span>
                        {log.code && (
                          <span className="font-mono text-[10px] text-purple-400 font-semibold truncate max-w-[130px]" title={log.code}>
                            {log.code}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Message & Route */}
                    <td className="px-4 py-3.5 max-w-md">
                      <div className="font-medium text-white truncate" title={log.message}>
                        {log.message}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                        {log.method && (
                          <span className="font-mono font-bold text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-purple-300 uppercase">
                            {log.method}
                          </span>
                        )}
                        {log.path && (
                          <span className="font-mono text-zinc-400 truncate max-w-[280px]" title={log.path}>
                            {log.path}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {log.userEmail || log.userId ? (
                        <div
                          className="flex items-center gap-1.5 text-zinc-300 hover:text-purple-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearch(log.userEmail || log.userId || '');
                            setPage(1);
                          }}
                          title="Bấm để lọc lỗi theo người dùng này"
                        >
                          <User className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="font-mono text-[11px] font-medium underline underline-offset-2">
                            {log.userEmail || log.userId}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 italic text-[11px]">Hệ thống chung</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderStatusBadge(log.status)}
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-400 font-mono text-[11px]">
                      {formatDateTime(log.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {log.status !== 'RESOLVED' ? (
                          <button
                            onClick={() => handleStatusChange(log.id, 'RESOLVED')}
                            title="Đánh dấu đã xử lý xong"
                            className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(log.id, 'OPEN')}
                            title="Mở lại bản ghi lỗi"
                            className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-500/10 border border-purple-500/20 transition-colors"
                          title="Xem chi tiết kỹ thuật & Stack trace"
                        >
                          <Terminal className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(log.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Xóa log này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-t border-zinc-800 text-xs text-zinc-400">
            <div>
              Hiển thị <span className="font-semibold text-white">{logs.length}</span> trên tổng số{' '}
              <span className="font-semibold text-white">{stats.total}</span> bản ghi
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-2.5 text-xs border-zinc-800"
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                Trước
              </Button>
              <span className="text-zinc-400 font-mono text-[11px] px-2">
                Trang {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 px-2.5 text-xs border-zinc-800"
              >
                Sau
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Chi Tiết Kỹ Thuật Log Lỗi"
          description={`Mã định danh sự cố: ${selectedLog.id}`}
          maxWidth="lg"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Meta summary badges */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
              <div>{renderSeverityBadge(selectedLog.severity)}</div>
              <div>{renderStatusBadge(selectedLog.status)}</div>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                Nguồn: {selectedLog.source}
              </span>
              {selectedLog.code && (
                <span className="px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-800/40 font-mono text-[11px]">
                  Mã: {selectedLog.code}
                </span>
              )}
              <span className="text-zinc-500 text-[11px] ml-auto">
                {formatDateTime(selectedLog.createdAt)}
              </span>
            </div>

            {/* Error Message Box */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Thông báo lỗi chính (Message)
              </label>
              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/30 text-rose-200 text-xs font-mono font-medium leading-relaxed select-all">
                {selectedLog.message}
              </div>
            </div>

            {/* Request context / Client info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Đường dẫn & Phương thức</span>
                <div className="font-mono text-zinc-200 flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-purple-300 font-bold text-[10px]">
                    {selectedLog.method || 'GET'}
                  </span>
                  <span className="truncate">{selectedLog.path || '-'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Người dùng bị ảnh hưởng</span>
                <div className="font-mono text-zinc-200 truncate">
                  {selectedLog.userEmail ? (
                    <span className="text-purple-300 font-semibold">{selectedLog.userEmail}</span>
                  ) : selectedLog.userId ? (
                    selectedLog.userId
                  ) : (
                    <span className="text-zinc-500 italic">Không gắn ID người dùng</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Địa chỉ IP</span>
                <div className="font-mono text-zinc-300">{selectedLog.ip || 'Local / Internal'}</div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">User-Agent</span>
                <div className="font-mono text-[10px] text-zinc-400 truncate" title={selectedLog.userAgent || ''}>
                  {selectedLog.userAgent || 'Hệ thống Backend'}
                </div>
              </div>
            </div>

            {/* Stack trace */}
            {selectedLog.stack && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Stack Trace
                  </label>
                  <button
                    onClick={() => handleCopy(selectedLog.stack || '', 'Stack Trace')}
                    className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
                  >
                    {copiedType === 'Stack Trace' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Sao chép
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 leading-relaxed overflow-x-auto max-h-48 whitespace-pre-wrap select-all">
                  {selectedLog.stack}
                </pre>
              </div>
            )}

            {/* Sanitized Context Payload */}
            {selectedLog.context && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Bối cảnh yêu cầu (Context / Sanitized Payload)
                  </label>
                  <button
                    onClick={() => handleCopy(selectedLog.context || '', 'Context')}
                    className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
                  >
                    {copiedType === 'Context' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Sao chép JSON
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-emerald-400 leading-relaxed overflow-x-auto max-h-44 whitespace-pre-wrap select-all">
                  {selectedLog.context}
                </pre>
              </div>
            )}

            {/* Action Bar inside Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Trạng thái:</span>
                <select
                  value={selectedLog.status}
                  disabled={updatingStatus}
                  onChange={(e) => handleStatusChange(selectedLog.id, e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="OPEN">Mới (OPEN)</option>
                  <option value="INVESTIGATING">Đang kiểm tra (INVESTIGATING)</option>
                  <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
                  <option value="IGNORED">Bỏ qua (IGNORED)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(selectedLog.id)}
                  className="text-xs text-rose-400 border-rose-900/40 hover:bg-rose-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Xóa log
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
