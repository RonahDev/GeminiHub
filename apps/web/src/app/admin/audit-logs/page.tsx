'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import { FileText, Shield, Loader2 } from 'lucide-react';

interface AuditLogItem {
  id: string;
  actorId: string;
  action: string;
  target: string;
  before?: string;
  after?: string;
  ip?: string;
  createdAt: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/audit-logs');
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } catch {
      toast.error('Lỗi khi tải nhật ký kiểm toán');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Nhật Ký Kiểm Toán (Audit Logs)</h1>
        <p className="text-xs text-zinc-400">
          Lưu vết bất biến mọi hành động của quản trị viên: sửa nguồn, đổi giá, hoàn tiền, điều chỉnh ví
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-xs text-zinc-400">
          Chưa có nhật ký kiểm toán nào được ghi nhận.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Hành động</th>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3">Chi tiết thay đổi</th>
                <th className="px-4 py-3">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-purple-400 font-mono">
                    {log.action}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-white">{log.target}</td>
                  <td className="px-4 py-3.5 max-w-sm truncate font-mono text-[11px] text-zinc-400">
                    {log.after || log.before || '-'}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

