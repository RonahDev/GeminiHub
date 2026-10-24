import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SmoothScroll } from '@/components/animations/SmoothScroll';
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
              <Footer />
            </div>
            <Toaster richColors position="top-right" theme="dark" />
          </SmoothScroll>
        </AuthProvider>
      </body>
    </html>
  );
}
