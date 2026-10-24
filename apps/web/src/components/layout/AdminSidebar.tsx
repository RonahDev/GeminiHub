'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Sparkles,
} from 'lucide-react';

export const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Đơn hàng & Xử lý kẹt', icon: ShoppingCart },
  { href: '/admin/sources', label: 'Nguồn bot Telegram', icon: Bot },
  { href: '/admin/products', label: 'Sản phẩm & Nguồn', icon: Package },
  { href: '/admin/pricing', label: 'Định giá & Duyệt giá', icon: Sliders },
  { href: '/admin/warranties', label: 'Ticket bảo hành', icon: ShieldAlert },
  { href: '/admin/users', label: 'Quản lý khách', icon: Users },
  { href: '/admin/audit-logs', label: 'Nhật ký kiểm toán', icon: FileText },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/60 p-4 hidden md:flex flex-col justify-between">
      <div className="space-y-6">
        <div className="px-3 py-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Về trang bán hàng
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">
                GeminiHub
              </span>
              <span className="text-[10px] text-purple-400 font-semibold uppercase">
                Admin Panel
              </span>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? 'text-purple-400' : 'text-zinc-500'}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 text-xs">
        <div className="text-zinc-400 text-[11px]">Đang đăng nhập:</div>
        <div className="font-semibold text-white truncate mt-0.5">{user?.email}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
            {user?.role}
          </span>
        </div>
      </div>
    </aside>
  );
}
