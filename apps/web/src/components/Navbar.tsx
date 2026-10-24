'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { formatVnd } from '@/lib/utils';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  Sparkles,
  Wallet,
  PlusCircle,
  ShoppingBag,
  ShieldAlert,
  User as UserIcon,
  LogOut,
  LogIn,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const headerRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);

      // Animate header background & border on scroll
      ScrollTrigger.create({
        start: 'top -20',
        end: 99999,
        toggleClass: {
          className: 'border-zinc-800/90 shadow-2xl shadow-indigo-950/20 bg-zinc-950/95',
          targets: headerRef.current,
        },
      });

      // Subtle initial entrance for navbar
      gsap.from(headerRef.current, {
        y: -30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      });
    },
    { scope: headerRef }
  );

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full border-b border-transparent bg-zinc-950/60 backdrop-blur-xl transition-all duration-300"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              ref={logoRef}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 group-hover:rotate-12 group-hover:scale-110 transition-all duration-300"
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              GeminiHub
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 text-xs font-semibold uppercase tracking-wider">
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
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/70 text-xs font-bold hover:bg-purple-900/60 transition-all shadow-sm shadow-purple-900/30"
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
              {/* Header Balance Display (FR-WAL-01) */}
              <div className="flex items-center gap-2 rounded-xl bg-zinc-900/90 border border-zinc-800 p-1 pl-3 shadow-inner">
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Số dư:</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {formatVnd(user.balance)}
                  </span>
                </div>
                <Link
                  href="/topup"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/30 hover:scale-105"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Nạp tiền</span>
                </Link>
              </div>

              {/* User Dropdown / Profile */}
              <div className="flex items-center gap-1">
                <Link
                  href="/profile"
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
                  title="Hồ sơ & Đổi mật khẩu"
                >
                  <UserIcon className="h-4 w-4" />
                </Link>
                <button
                  onClick={logout}
                  className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 transition-colors"
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
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-indigo-600/30 hover:scale-105"
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
