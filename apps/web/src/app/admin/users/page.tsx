'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatVnd, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import { Users, Sliders, Shield, Loader2 } from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  role: string;
  status: string;
  balance: number;
  orderCount: number;
  topupCount: number;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Adjust balance modal
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState<boolean>(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } catch {
      toast.error('Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedUser || adjustAmount === 0 || !adjustReason) {
      toast.error('Vui lòng nhập số tiền khác 0 và lý do điều chỉnh');
      return;
    }

    setAdjusting(true);
    try {
      const res = await api.post(`/admin/users/${selectedUser.id}/adjust-balance`, {
        amount: adjustAmount,
        reason: adjustReason,
      });

      if (res.success) {
        toast.success(res.message);
        setSelectedUser(null);
        fetchUsers();
      } else {
        toast.error(res.error?.message || 'Không thể điều chỉnh số dư');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Quản Lý Khách Hàng & Số Dư (Users)</h1>
        <p className="text-xs text-zinc-400">
          Xem thông tin tài khoản, đơn hàng và cộng / trừ tiền trực tiếp vào ví có ghi vết sổ cái
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Số dư ví</th>
                <th className="px-4 py-3">Tổng đơn</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-white">{u.email}</td>
                  <td className="px-4 py-3.5 text-purple-400 font-semibold">{u.role}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-extrabold text-emerald-400 text-sm">
                    {formatVnd(u.balance)}
                  </td>
                  <td className="px-4 py-3.5">{u.orderCount} đơn</td>
                  <td className="px-4 py-3.5 text-zinc-500 whitespace-nowrap">
                    {formatDateTime(u.createdAt)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setAdjustAmount(0);
                        setAdjustReason('');
                      }}
                      className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1 font-semibold text-zinc-200 text-[11px]"
                    >
                      Điều chỉnh số dư
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Balance Dialog (FR-ADM-06) */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Điều Chỉnh Số Dư Cho {selectedUser.email}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Số dư hiện tại: <strong className="text-emerald-400">{formatVnd(selectedUser.balance)}</strong>
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Số tiền thay đổi (Dương: cộng tiền, Âm: trừ tiền):
                </label>
                <input
                  type="number"
                  step={1000}
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(parseInt(e.target.value, 10) || 0)}
                  placeholder="Ví dụ: 50000 hoặc -20000"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Lý do bắt buộc (*):</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ví dụ: Bù tiền lỗi giao dịch / Khuyến mãi sự kiện..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                disabled={adjusting}
                className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
              >
                Hủy
              </button>
              <button
                onClick={handleAdjustBalance}
                disabled={adjusting || adjustAmount === 0 || adjustReason.length < 5}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {adjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Lưu Biến Động</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
