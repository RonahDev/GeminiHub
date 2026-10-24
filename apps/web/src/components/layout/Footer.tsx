import React from 'react';
import Link from 'next/link';
import { Sparkles, ShieldCheck, Zap, Headphones, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-800/80 bg-zinc-950/80 py-12 text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-white">
                GeminiHub
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Hệ thống cung cấp liên kết kích hoạt Google Gemini Pro & Advanced tự động 24/7 với độ trễ cực thấp và bảo hành tức thì.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-3">
              Dịch vụ
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-white transition">
                  Gói Gemini Advanced
                </Link>
              </li>
              <li>
                <Link href="/topup" className="hover:text-white transition">
                  Nạp tiền VietQR tự động
                </Link>
              </li>
              <li>
                <Link href="/orders" className="hover:text-white transition">
                  Tra cứu bảo hành đơn hàng
                </Link>
              </li>
            </ul>
          </div>

          {/* Guarantees */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-3">
              Cam kết chất lượng
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Giao link ngay dưới 5 giây
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Bảo hành lỗi 1-đổi-1 tự động
              </li>
              <li className="flex items-center gap-2">
                <Headphones className="h-3.5 w-3.5 text-blue-400" />
                Hỗ trợ kỹ thuật 24/7
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-3">
              Chính sách
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="hover:text-white transition cursor-pointer">
                  Điều khoản sử dụng ngay
                </span>
              </li>
              <li>
                <span className="hover:text-white transition cursor-pointer">
                  Chính sách hoàn tiền tự động
                </span>
              </li>
              <li>
                <span className="hover:text-white transition cursor-pointer">
                  Bảo mật thông tin khách hàng
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} GeminiHub Enterprise. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with Clean Architecture & Enterprise Standards <Heart className="h-3 w-3 text-rose-500 fill-rose-500 inline" />
          </p>
        </div>
      </div>
    </footer>
  );
}

