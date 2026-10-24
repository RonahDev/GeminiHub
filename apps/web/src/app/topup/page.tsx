'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatVnd } from '@/lib/utils';
import { toast } from 'sonner';
import {
  QrCode,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

export default function TopupPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [amount, setAmount] = useState<number>(100000);
  const [customAmount, setCustomAmount] = useState<string>('100000');
  const [loading, setLoading] = useState<boolean>(false);

  // Active topup invoice
  const [activeTopup, setActiveTopup] = useState<{
    id: string;
    code: string;
    amount: number;
    expiresAt: string;
    qrUrl: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
  } | null>(null);

  const [timeLeftSec, setTimeLeftSec] = useState<number>(1800);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/topup');
    }
  }, [user, router]);

  // Handle countdown timer (FR-WAL-05)
  useEffect(() => {
    if (!activeTopup || isSuccess) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(activeTopup.expiresAt).getTime() - Date.now()) / 1000)
      );
      setTimeLeftSec(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTopup, isSuccess]);

  // Poll topup status every 3-5 seconds (FR-WAL-05, FR-WAL-06)
  useEffect(() => {
    if (!activeTopup || isSuccess || timeLeftSec <= 0) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await api.get(`/topups/${activeTopup.id}`);
        if (res.success && res.data) {
          if (res.data.status === 'COMPLETED') {
            setIsSuccess(true);
            await refreshUser(); // update header balance immediately
            toast.success(`Nạp tiền thành công +${formatVnd(res.data.paidAmount)}!`);
            clearInterval(pollInterval);
          }
        }
      } catch {}
    }, 3500);

    return () => clearInterval(pollInterval);
  }, [activeTopup, isSuccess, timeLeftSec, refreshUser]);

  const handleCreateTopup = async () => {
    const numAmount = parseInt(customAmount, 10);
    if (isNaN(numAmount) || numAmount < 10000) {
      toast.error('Số tiền nạp tối thiểu là 10.000 đ');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/topups', { amount: numAmount });
      if (res.success && res.data) {
        setActiveTopup(res.data);
        setIsSuccess(false);
        const remaining = Math.max(
          0,
          Math.floor((new Date(res.data.expiresAt).getTime() - Date.now()) / 1000)
        );
        setTimeLeftSec(remaining);
      } else {
        toast.error(res.error?.message || 'Không thể tạo mã nạp tiền');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại trang chủ
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Nạp Tiền Vào Ví</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Chuyển khoản VietQR tự động 24/7. Tiền vào ví sau 3 - 10 giây.
        </p>
      </div>

      {!activeTopup ? (
        /* Step 1: Select Amount Form */
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">1. Chọn số tiền nạp:</h2>

          {/* Quick Select Buttons (FR-WAL-03) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => {
                  setAmount(amt);
                  setCustomAmount(amt.toString());
                }}
                className={`rounded-xl py-3 px-4 text-center font-bold text-sm border transition-all ${
                  amount === amt
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-md shadow-blue-500/20'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {formatVnd(amt)}
              </button>
            ))}
          </div>

          {/* Custom Input */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Hoặc nhập số tiền tùy chọn (Tối thiểu 10.000 đ):
            </label>
            <div className="relative">
              <input
                type="number"
                min={10000}
                step={10000}
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setAmount(parseInt(e.target.value, 10) || 0);
                }}
                placeholder="Ví dụ: 150000"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="absolute right-4 top-3 text-sm text-zinc-500">VNĐ</span>
            </div>
          </div>

          <button
            onClick={handleCreateTopup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <QrCode className="h-4 w-4" />
                <span>Tạo Mã QR Chuyển Khoản</span>
              </>
            )}
          </button>
        </div>
      ) : isSuccess ? (
        /* Topup Success Screen */
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">Nạp Tiền Thành Công!</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Hệ thống đã nhận được số tiền{' '}
            <strong className="text-emerald-400">{formatVnd(activeTopup.amount)}</strong> và cộng vào ví của bạn.
          </p>

          <div className="mt-8 flex gap-4 justify-center">
            <Link
              href="/"
              className="rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              Về Trang Mua Hàng
            </Link>
            <button
              onClick={() => setActiveTopup(null)}
              className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-6 py-2.5 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Tạo Lệnh Nạp Mới
            </button>
          </div>
        </div>
      ) : (
        /* Step 2: VietQR & Payment Details Screen (FR-WAL-04, FR-WAL-05) */
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl">
          {/* Header Countdown */}
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl bg-zinc-950 p-4 border border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span>Đang chờ chuyển khoản (Tự động cập nhật)...</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
              <Clock className="h-4 w-4" />
              <span>Hết hạn trong: {formatCountdown(timeLeftSec)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* VietQR Code */}
            <div className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow-md">
              <img
                src={activeTopup.qrUrl}
                alt="VietQR Code"
                className="h-64 w-64 object-contain rounded-lg"
              />
              <span className="mt-2 text-xs text-zinc-600 font-medium">
                Mở App ngân hàng quét mã QR để chuyển nhanh
              </span>
            </div>

            {/* Bank Transfer Details with Copy Buttons (FR-WAL-04) */}
            <div className="space-y-4 text-xs">
              {/* Ngân hàng */}
              <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800">
                <span className="text-zinc-500">Ngân hàng:</span>
                <p className="font-bold text-white text-sm mt-0.5">{activeTopup.bankName}</p>
              </div>

              {/* Số tài khoản */}
              <div className="flex items-center justify-between rounded-xl bg-zinc-950 p-3 border border-zinc-800">
                <div>
                  <span className="text-zinc-500">Số tài khoản:</span>
                  <p className="font-mono font-bold text-white text-sm mt-0.5">
                    {activeTopup.bankAccountNumber}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(activeTopup.bankAccountNumber, 'Số tài khoản')}
                  className="rounded-lg bg-zinc-800 p-2 text-zinc-300 hover:text-white hover:bg-zinc-700"
                  title="Sao chép"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>

              {/* Tên chủ tài khoản */}
              <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800">
                <span className="text-zinc-500">Chủ tài khoản:</span>
                <p className="font-bold text-white text-sm mt-0.5">
                  {activeTopup.bankAccountHolder}
                </p>
              </div>

              {/* Số tiền */}
              <div className="flex items-center justify-between rounded-xl bg-zinc-950 p-3 border border-zinc-800">
                <div>
                  <span className="text-zinc-500">Số tiền:</span>
                  <p className="font-bold text-emerald-400 text-sm mt-0.5">
                    {formatVnd(activeTopup.amount)}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(activeTopup.amount.toString(), 'Số tiền')}
                  className="rounded-lg bg-zinc-800 p-2 text-zinc-300 hover:text-white hover:bg-zinc-700"
                  title="Sao chép"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>

              {/* Nội dung chuyển khoản (Bắt buộc) */}
              <div className="flex items-center justify-between rounded-xl bg-blue-950/40 p-3 border border-blue-800/60">
                <div>
                  <span className="text-blue-300 font-semibold">Nội dung chuyển khoản (bắt buộc):</span>
                  <p className="font-mono font-bold text-blue-400 text-base mt-0.5">
                    {activeTopup.code}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(activeTopup.code, 'Nội dung chuyển khoản')}
                  className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-500"
                  title="Sao chép nội dung"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center pt-4 border-t border-zinc-800 text-xs text-zinc-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Hệ thống SePay tự động ghi nhận
            </span>
            <button
              onClick={() => setActiveTopup(null)}
              className="text-zinc-400 hover:text-white hover:underline"
            >
              Hủy / Tạo lệnh khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

