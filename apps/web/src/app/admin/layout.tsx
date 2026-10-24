'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Bot,
  Package,
  ShoppingCart,
  ShieldAlert,
  Users,
  Sliders,
  FileText,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Đơn hàng & Xử lý kẹt', icon: ShoppingCart },
  { href: '/admin/sources', label: 'Nguồn bot Telegram', icon: Bot },
  { href: '/admin/products', label: 'Sản phẩm & Nguồn', icon: Package },
  { href: '/admin/pricing', label: 'Định giá & Duyệt giá', icon: Sliders },
  { href: '/admin/warranties', label: 'Ticket bảo hành', icon: ShieldAlert },
  { href: '/admin/users', label: 'Quản lý khách', icon: Users },
  { href: '/admin/audit-logs', label: 'Nhật ký kiểm toán', icon: FileText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push('/login?redirect=/admin');
    }
  }, [user, isAdmin, isLoading, router]);

  if (isLoading || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Admin Sidebar */}
      <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/60 p-4 hidden md:flex flex-col justify-between">
        <div className="space-y-6">
          <div className="px-3 py-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Về trang người dùng</span>
            </Link>
            <h2 className="text-lg font-black tracking-wider text-purple-400 uppercase">
              Admin Portal
            </h2>
            <p className="text-[11px] text-zinc-500">Quản trị hệ thống GeminiHub</p>
          </div>

          <nav className="space-y-1">
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800 text-[11px] text-zinc-500">
          <p>Tài khoản: <strong className="text-zinc-300">{user?.email}</strong></p>
          <p>Quyền: <span className="text-purple-400 font-bold">ADMINISTRATOR</span></p>
        </div>
      </aside>

      {/* Main Admin Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8">{children}</main>
    </div>
  );
}
