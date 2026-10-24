'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { formatVnd } from '@/lib/utils';
import {
  Sparkles,
  Wallet,
  PlusCircle,
  ShoppingBag,
  History,
  ShieldAlert,
  User as UserIcon,
  LogOut,
  LogIn,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              GeminiHub
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            <Link
              href="/"
              className={`transition-colors hover:text-white ${
                pathname === '/' ? 'text-white' : 'text-zinc-400'
              }`}
            >
              Sản phẩm
            </Link>
            {user && (
              <>
                <Link
                  href="/orders"
                  className={`transition-colors hover:text-white ${
                    pathname.startsWith('/orders') ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  Lịch sử mua
                </Link>
                <Link
                  href="/wallet"
                  className={`transition-colors hover:text-white ${
                    pathname.startsWith('/wallet') ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  Biến động số dư
                </Link>
              </>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/60 text-purple-300 border border-purple-800/60 text-xs font-semibold hover:bg-purple-900/50 transition-colors"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-purple-400" />
                Trang Quản trị
              </Link>
            )}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* FR-WAL-01: Always show balance on header */}
              <div className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 p-1 pl-3">
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Số dư:</span>
                  <span className="font-semibold text-emerald-400 text-sm">
                    {formatVnd(user.balance)}
                  </span>
                </div>
                <Link
                  href="/topup"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm shadow-emerald-600/30"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Nạp tiền</span>
                </Link>
              </div>

              {/* User Dropdown / Profile */}
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
                  title="Hồ sơ & Đổi mật khẩu"
                >
                  <UserIcon className="h-4 w-4" />
                </Link>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="px-3.5 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 transition-all shadow-md shadow-indigo-600/20"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
