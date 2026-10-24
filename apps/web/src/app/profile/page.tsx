'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatVnd } from '@/lib/utils';
import { toast } from 'sonner';
import { User, KeyRound, Shield, Wallet, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error('Mật khẩu mới xác nhận không khớp');
      return;
    }

    if (newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      toast.error('Mật khẩu mới phải từ 8 ký tự và chứa cả chữ lẫn số');
      return;
    }

    setLoading(true);
    try {
      const res = await api.patch('/me', {
        currentPassword,
        newPassword,
      });

      if (res.success) {
        toast.success(res.message || 'Đổi mật khẩu thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        toast.error(res.error?.message || 'Đổi mật khẩu không thành công');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white mb-6">Hồ Sơ & Bảo Mật</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Info Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-blue-400">
            <User className="h-6 w-6" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Email:</label>
            <p className="font-bold text-white text-sm break-all">{user.email}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Vai trò:</label>
            <p className="font-bold text-indigo-400 text-xs">{user.role}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Số dư ví:</label>
            <p className="font-extrabold text-emerald-400 text-base">{formatVnd(user.balance)}</p>
          </div>
        </div>

        {/* Change Password Form (FR-AUTH-06) */}
        <div className="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Đổi Mật Khẩu</h2>
          </div>
          <p className="text-xs text-zinc-400 mb-6">
            Sau khi đổi mật khẩu thành công, toàn bộ phiên đăng nhập trên các thiết bị khác sẽ được tự động thu hồi.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Mật khẩu hiện tại:</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Mật khẩu mới (từ 8 ký tự, có chữ và số):</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-medium mb-1">Xác nhận mật khẩu mới:</label>
              <input
                type="password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Lưu Mật Khẩu Mới</span>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

