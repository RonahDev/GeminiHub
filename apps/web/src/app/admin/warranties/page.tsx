'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatVnd, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import { ShieldAlert, CheckCircle2, XCircle, RotateCcw, Link2, Loader2 } from 'lucide-react';

interface WarrantyTicket {
  id: string;
  reason: string;
  attachmentUrl?: string;
  status: string;
  resolution?: string;
  adminNote?: string;
  createdAt: string;
  user: { id: string; email: string };
  order: {
    id: string;
    code: string;
    totalPrice: number;
    product: { name: string };
  };
}

export default function AdminWarrantiesPage() {
  const [tickets, setTickets] = useState<WarrantyTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve dialog
  const [selectedTicket, setSelectedTicket] = useState<WarrantyTicket | null>(null);
  const [resolution, setResolution] = useState<'REPLACED_MANUAL' | 'REFUNDED' | 'REJECTED'>(
    'REPLACED_MANUAL'
  );
  const [manualLink, setManualLink] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/admin/warranties');
      if (res.success && res.data) {
        setTickets(res.data);
      }
    } catch {
      toast.error('Lỗi khi tải danh sách ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedTicket) return;

    if (resolution === 'REPLACED_MANUAL' && !manualLink) {
      toast.error('Vui lòng nhập link thay thế');
      return;
    }

    setResolving(true);
    try {
      const res = await api.post(`/admin/warranties/${selectedTicket.id}/resolve`, {
        resolution,
        manualLink: manualLink || undefined,
        adminNote: adminNote || undefined,
      });

      if (res.success) {
        toast.success(res.message);
        setSelectedTicket(null);
        fetchTickets();
      } else {
        toast.error(res.error?.message || 'Không thể xử lý ticket');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Yêu Cầu Khiếu Nại & Bảo Hành (Warranties)</h1>
        <p className="text-xs text-zinc-400">
          Xử lý các yêu cầu đổi link mới hoặc hoàn tiền cho tài khoản bị lỗi trong hạn 5 phút
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-xs text-zinc-400">
          ✓ Không có khiếu nại bảo hành nào cần xử lý.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Lý do báo lỗi</th>
                <th className="px-4 py-3">Ảnh đính kèm</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-mono font-bold text-blue-400">
                    {t.order?.code}
                  </td>
                  <td className="px-4 py-3.5">{t.user?.email}</td>
                  <td className="px-4 py-3.5 max-w-xs font-medium text-white">{t.reason}</td>
                  <td className="px-4 py-3.5">
                    {t.attachmentUrl ? (
                      <a
                        href={t.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Link2 className="h-3 w-3" /> Xem ảnh
                      </a>
                    ) : (
                      <span className="text-zinc-600">Không có</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold ${
                        t.status === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 whitespace-nowrap">
                    {formatDateTime(t.createdAt)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {t.status === 'PENDING' ? (
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className="rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-1 text-white font-semibold text-[11px]"
                      >
                        Xử lý ticket
                      </button>
                    ) : (
                      <span className="text-zinc-500 text-[11px] font-medium">
                        {t.resolution}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolution Dialog (FR-ADM-08) */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Xử Lý Bảo Hành Đơn {selectedTicket.order.code}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Lý do báo lỗi: <em>"{selectedTicket.reason}"</em>
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Hình thức giải quyết:</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="REPLACED_MANUAL">Dán link mới thay thế (Thủ công)</option>
                  <option value="REFUNDED">Hoàn tiền vào ví khách hàng</option>
                  <option value="REJECTED">Từ chối bảo hành</option>
                </select>
              </div>

              {resolution === 'REPLACED_MANUAL' && (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Link kích hoạt mới:</label>
                  <input
                    type="url"
                    required
                    value={manualLink}
                    onChange={(e) => setManualLink(e.target.value)}
                    placeholder="https://one.google.com/..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Ghi chú cho khách:</label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ví dụ: Đã cấp link mới thay thế, chúc bạn trải nghiệm tốt"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedTicket(null)}
                disabled={resolving}
                className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
              >
                Hủy
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Xác nhận giải quyết</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

