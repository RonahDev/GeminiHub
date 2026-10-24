import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';
import { SmoothScroll } from '@/components/SmoothScroll';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'GeminiHub - Bán Link Kích Hoạt Gemini Tự Động',
  description:
    'Hệ thống mua bán link kích hoạt tài khoản Google Gemini Advanced tự động, giao link tức thời, bảo hành chu đáo.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
        <AuthProvider>
          <SmoothScroll>
            <div className="flex-1 flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-1">{children}</main>
              <footer className="border-t border-zinc-800/80 bg-zinc-950/60 py-8 text-center text-xs text-zinc-500">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p>© 2026 GeminiHub. Bảo lưu mọi quyền.</p>
                  <div className="flex items-center gap-6 text-zinc-400">
                    <span>Hỗ trợ bảo hành 5 phút</span>
                    <span>Tự động 24/7</span>
                    <span>Thanh toán VietQR SePay</span>
                  </div>
                </div>
              </footer>
            </div>
            <Toaster richColors position="top-right" theme="dark" />
          </SmoothScroll>
        </AuthProvider>
      </body>
    </html>
  );
}
