'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || '/';
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.success && res.data) {
        login(res.data.accessToken, res.data.user);
        toast.success('Đăng nhập thành công!');
        router.push(redirect);
      } else {
        toast.error(res.error?.message || 'Email hoặc mật khẩu không chính xác');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl backdrop-blur-md">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-white">Đăng Nhập GeminiHub</h1>
        <p className="mt-1 text-xs text-zinc-400">Truy cập tài khoản để mua link và quản lý ví</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-zinc-300 mb-1.5">Email:</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="font-medium text-zinc-300">Mật khẩu:</label>
            <Link href="/forgot-password" className="text-blue-400 hover:underline">
              Quên mật khẩu?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span>Đăng Nhập</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-zinc-400">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="font-semibold text-blue-400 hover:underline">
          Đăng ký ngay
        </Link>
      </div>
    </div>
  );
}

