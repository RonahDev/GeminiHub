'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatVnd, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Wallet,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';

interface WalletTx {
  id: string;
  type: 'TOPUP' | 'PURCHASE' | 'REFUND' | 'ADJUST';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  refType?: string;
  refId?: string;
  note?: string;
  createdAt: string;
}

export default function WalletPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/wallet');
      return;
    }
    fetchTransactions();
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/wallet/transactions');
      if (res.success && res.data?.items) {
        setTransactions(res.data.items);
      }
    } catch {
      toast.error('Không thể tải lịch sử số dư');
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (type: string, amount: number) => {
    switch (type) {
      case 'TOPUP':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
            <ArrowDownLeft className="h-3 w-3" /> Nạp tiền
          </span>
        );
      case 'PURCHASE':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400">
            <ArrowUpRight className="h-3 w-3" /> Mua hàng
          </span>
        );
      case 'REFUND':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-400">
            <RefreshCw className="h-3 w-3" /> Hoàn tiền
          </span>
        );
      case 'ADJUST':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
            <SlidersHorizontal className="h-3 w-3" /> Điều chỉnh
          </span>
        );
      default:
        return <span>{type}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Wallet Balance Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 p-6 sm:p-8 shadow-xl">
        <div>
          <span className="text-xs text-zinc-400 font-medium">Số dư khả dụng hiện tại:</span>
          <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 mt-1">
            {formatVnd(user?.balance || 0)}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Mọi biến động đều được lưu vết sổ cái bất biến</p>
        </div>

        <Link
          href="/topup"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Nạp Tiền Vào Ví</span>
        </Link>
      </div>

      {/* Sổ cái Biến động số dư (FR-WAL-02) */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Lịch Sử Biến Động Số Dư (Sổ Cái)</h2>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-xs text-zinc-400">
          Chưa có biến động số dư nào được ghi nhận.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Số tiền</th>
                <th className="px-4 py-3">Số dư sau</th>
                <th className="px-4 py-3">Nội dung</th>
                <th className="px-4 py-3">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {transactions.map((tx) => {
                const isPositive = tx.amount > 0;

                return (
                  <tr key={tx.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3.5">{getTypeBadge(tx.type, tx.amount)}</td>
                    <td className="px-4 py-3.5 font-bold">
                      <span className={isPositive ? 'text-emerald-400' : 'text-zinc-200'}>
                        {isPositive ? `+${formatVnd(tx.amount)}` : formatVnd(tx.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-zinc-300">
                      {formatVnd(tx.balanceAfter)}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs truncate text-zinc-400">
                      {tx.note || tx.refType || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 whitespace-nowrap">
                      {formatDateTime(tx.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
