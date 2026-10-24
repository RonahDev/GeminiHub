'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatVnd, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Bot,
  Plus,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wifi,
  ShoppingBag,
  Loader2,
  Trash2,
} from 'lucide-react';

interface Source {
  id: string;
  name: string;
  adapterType: string;
  baseUrl: string;
  credentialsEncrypted: string;
  currency: string;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  liveBuyEnabled: boolean;
  balance: number;
  lowBalanceAlert: number;
  balanceSyncedAt?: string;
  productCount: number;
  orderCount: number;
}

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  // Add source modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAdapterType, setNewAdapterType] = useState('TELE_API');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiId, setNewApiId] = useState('');
  const [newApiSecret, setNewApiSecret] = useState('');
  const [savingSource, setSavingSource] = useState(false);

  // Test buy modal state (FR-SRC-09)
  const [testBuySource, setTestBuySource] = useState<Source | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [externalProdId, setExternalProdId] = useState('SP-GEMINI-1M');
  const [testingBuy, setTestingBuy] = useState(false);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const res = await api.get('/admin/sources');
      if (res.success && res.data) {
        setSources(res.data);
      }
    } catch {
      toast.error('Lỗi khi tải danh sách nguồn');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (sourceId: string) => {
    toast.info('Đang kiểm tra kết nối tới bot...');
    try {
      const res: any = await api.post(`/admin/sources/${sourceId}/test`);
      if (res.success) {
        toast.success(`Kết nối tốt! Độ trễ: ${res.latencyMs || 0}ms, Số dư: ${formatVnd(res.balance?.amount)}`);
        fetchSources();
      } else {
        toast.error(`Kết nối thất bại: ${res.error || res.error?.message}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối');
    }
  };

  const handleSync = async (sourceId: string) => {
    toast.info('Đang đồng bộ sản phẩm & số dư...');
    try {
      const res = await api.post(`/admin/sources/${sourceId}/sync`);
      if (res.success) {
        toast.success(res.message);
        fetchSources();
      } else {
        toast.error('Đồng bộ thất bại');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleLiveBuy = async (source: Source) => {
    const nextVal = !source.liveBuyEnabled;
    try {
      const res = await api.patch(`/admin/sources/${source.id}`, {
        liveBuyEnabled: nextVal,
      });
      if (res.success) {
        toast.success(
          nextVal
            ? `Đã BẬT mua thật cho nguồn ${source.name}`
            : `Đã TẮT mua thật cho nguồn ${source.name}`
        );
        fetchSources();
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSource(true);

    try {
      const res = await api.post('/admin/sources', {
        name: newName,
        adapterType: newAdapterType,
        baseUrl: newBaseUrl,
        credentials: {
          apiId: newApiId,
          apiSecret: newApiSecret,
        },
      });

      if (res.success) {
        toast.success('Đã thêm nguồn bot thành công!');
        setShowAddModal(false);
        setNewName('');
        setNewBaseUrl('');
        setNewApiId('');
        setNewApiSecret('');
        fetchSources();
      } else {
        toast.error(res.error?.message || 'Không thể tạo nguồn');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingSource(false);
    }
  };

  const handleExecuteTestBuy = async () => {
    if (!testBuySource) return;
    setTestingBuy(true);

    try {
      const res: any = await api.post(`/admin/sources/${testBuySource.id}/test-buy`, {
        externalProductId: externalProdId,
        confirmSourceName: confirmName,
      });

      if (res.success) {
        toast.success('Mua thử 1 đơn vị thành công! Kết quả đã ghi nhật ký.');
        setTestBuySource(null);
      } else {
        toast.error(`Mua thử thất bại: ${JSON.stringify(res.result || res.error)}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTestingBuy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Quản Lý Nguồn Bot Telegram (Sources)</h1>
          <p className="text-xs text-zinc-400">
            Cấu hình kết nối API bot, kiểm tra số dư, đồng bộ sản phẩm và công tắc mua thật
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-xs font-semibold text-white transition-all shadow-md shadow-purple-600/30"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm Nguồn Mới</span>
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {sources.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-purple-400">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{s.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="font-mono">{s.baseUrl}</span>
                      <span>•</span>
                      <span className="text-purple-400 font-semibold">{s.adapterType}</span>
                      <span>•</span>
                      <span className="text-zinc-500">Cred: {s.credentialsEncrypted}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      s.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : s.status === 'PAUSED'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </div>

              {/* Status and Balance strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl bg-zinc-950 p-4 border border-zinc-800 text-xs">
                <div>
                  <span className="text-zinc-500">Số dư hiện tại:</span>
                  <p
                    className={`font-extrabold text-sm mt-0.5 ${
                      s.balance < s.lowBalanceAlert ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatVnd(s.balance)}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Sản phẩm liên kết:</span>
                  <p className="font-bold text-white text-sm mt-0.5">{s.productCount} SP</p>
                </div>
                <div>
                  <span className="text-zinc-500">Đơn đã giao:</span>
                  <p className="font-bold text-white text-sm mt-0.5">{s.orderCount} đơn</p>
                </div>
                <div>
                  <span className="text-zinc-500">Đồng bộ cuối:</span>
                  <p className="font-medium text-zinc-400 text-xs mt-0.5">
                    {s.balanceSyncedAt ? formatDateTime(s.balanceSyncedAt) : 'Chưa sync'}
                  </p>
                </div>
              </div>

              {/* Controls and Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {/* FR-SRC-08: Live Buy Switch */}
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.liveBuyEnabled}
                      onChange={() => handleToggleLiveBuy(s)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                  <span className="text-xs font-semibold text-zinc-300">
                    {s.liveBuyEnabled ? 'Mua thật (Đang BẬT)' : 'Mua thật (Đang TẮT)'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* FR-SRC-07: Test Connection */}
                  <button
                    onClick={() => handleTestConnection(s.id)}
                    className="flex items-center gap-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors"
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    <span>Kiểm tra kết nối</span>
                  </button>

                  {/* FR-SRC-12: Sync */}
                  <button
                    onClick={() => handleSync(s.id)}
                    className="flex items-center gap-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Đồng bộ ngay</span>
                  </button>

                  {/* FR-SRC-09: Test Buy 1 Unit */}
                  <button
                    onClick={() => {
                      setTestBuySource(s);
                      setConfirmName('');
                    }}
                    className="flex items-center gap-1 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 px-3 py-1.5 text-xs font-semibold text-purple-300 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Mua thử 1 đơn vị</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Source Modal (FR-SRC-02, FR-SRC-03) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Thêm Nguồn Bot Mới</h3>

            <form onSubmit={handleCreateSource} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Tên nguồn bot:</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Sumistore Bot 1"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Loại adapter:</label>
                <select
                  value={newAdapterType}
                  onChange={(e) => setNewAdapterType(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="TELE_API">Tele API chuẩn (Sumistore HMAC)</option>
                  <option value="MOCK">Mock Adapter (Kiểm thử dev)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Base URL:</label>
                <input
                  type="url"
                  required
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder="https://api.sumistore.bot"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">API ID:</label>
                  <input
                    type="text"
                    required
                    value={newApiId}
                    onChange={(e) => setNewApiId(e.target.value)}
                    placeholder="TAPI-..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">API Secret (Khóa HMAC):</label>
                  <input
                    type="password"
                    required
                    value={newApiSecret}
                    onChange={(e) => setNewApiSecret(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={savingSource}
                  className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingSource}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {savingSource ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Lưu Nguồn</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Buy Confirmation Modal (FR-SRC-09) */}
      {testBuySource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Mua Thử 1 Đơn Vị</h3>
            <p className="text-xs text-zinc-300 mb-4">
              Lệnh mua thử này sẽ gọi trực tiếp tới bot <strong>{testBuySource.name}</strong> để kiểm tra format link phản hồi thật.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Mã sản phẩm nguồn (externalId):</label>
                <input
                  type="text"
                  value={externalProdId}
                  onChange={(e) => setExternalProdId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-white focus:border-purple-500 focus:outline-none font-mono"
                />
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <label className="block text-amber-300 font-medium mb-1">
                  Xác nhận an toàn (Gõ lại chính xác tên nguồn: <strong>{testBuySource.name}</strong>):
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Gõ lại tên nguồn để xác nhận..."
                  className="w-full rounded-lg border border-amber-500/40 bg-zinc-950 p-2.5 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setTestBuySource(null)}
                disabled={testingBuy}
                className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteTestBuy}
                disabled={testingBuy || confirmName.trim() !== testBuySource.name.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {testingBuy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Xác nhận Mua Thử</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
