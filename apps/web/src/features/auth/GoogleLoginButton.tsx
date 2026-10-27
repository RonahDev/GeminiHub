'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleLoginButtonProps {
  buttonText?: string;
  className?: string;
}

export function GoogleLoginButton({
  buttonText = 'Tiếp tục với Google',
  className = '',
}: GoogleLoginButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || '/';
  const { login } = useAuth();

  const [loading, setLoading] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Initialize official Google Identity Services (GSI) when Client ID is configured
  useEffect(() => {
    if (!clientId) return;

    let isMounted = true;
    const scriptId = 'google-gsi-client-script';

    const initializeGsi = () => {
      if (window.google?.accounts?.id && isMounted) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnContainerRef.current) {
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'rectangular',
            width: 384,
            text: 'continue_with',
            logo_alignment: 'left',
          });
        }
      }
    };

    if (window.google?.accounts?.id) {
      initializeGsi();
      return;
    }

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGsi;
      document.body.appendChild(script);
    }

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response?.credential) {
      toast.error('Không nhận được token xác thực từ Google');
      return;
    }
    await sendGoogleTokenToBackend(response.credential);
  };

  const sendGoogleTokenToBackend = async (credential: string) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/google', { credential });
      if (res.success && res.data) {
        login(res.data.accessToken, res.data.user);
        toast.success(`Đăng nhập Google thành công! (${res.data.user.email})`);
        setShowDevModal(false);
        router.push(redirect);
      } else {
        toast.error(res.error?.message || 'Đăng nhập Google không thành công');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (clientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If One Tap dismissed or blocked, open dev helper
          setShowDevModal(true);
        }
      });
    } else {
      // Client ID is not provided in .env yet
      setShowDevModal(true);
    }
  };

  const handleTestGmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      toast.error('Vui lòng nhập địa chỉ Gmail hợp lệ');
      return;
    }

    // Format mock token supported by backend verifyGoogleToken
    const mockToken = `mock-google:${testEmail}:sub-google-${Date.now()}`;
    await sendGoogleTokenToBackend(mockToken);
  };

  return (
    <>
      {/* If official client ID is configured and rendered */}
      {clientId ? (
        <div className="w-full flex justify-center my-1">
          <div ref={googleBtnContainerRef} className="w-full" />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 py-3 text-xs font-semibold text-zinc-100 shadow-md transition-all hover:border-zinc-500 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 ${className}`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{buttonText}</span>
        </button>
      )}

      {/* Modal for Google Setup or Direct Gmail Auth */}
      <Modal
        isOpen={showDevModal}
        onClose={() => setShowDevModal(false)}
        title="Đăng Nhập Tự Động Bằng Google"
        description="Đăng nhập hoặc tự động tạo tài khoản mới bằng Gmail"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-300">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-4 w-4 text-blue-400" /> Cơ chế tự động của Google SSO
            </p>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Hệ thống sẽ tự động lấy <strong>địa chỉ Gmail</strong> và thông tin định danh Google của bạn. Nếu bạn chưa có tài khoản, hệ thống sẽ <strong>tự động đăng ký mới ngay lập tức</strong> mà không cần mật khẩu.
            </p>
          </div>

          <form onSubmit={handleTestGmailSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Nhập địa chỉ Gmail của bạn để kiểm thử tự động:
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="vidu@gmail.com"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white pl-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-xs font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Đăng Nhập / Đăng Ký Tức Thì'}
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200/90 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Để hiển thị Pop-up chọn tài khoản chính thức từ Google:</span>
            </div>
            <p className="text-zinc-400 leading-normal">
              Chỉ cần cấu hình <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-300">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> trong file <code className="bg-zinc-800 px-1 py-0.5 rounded text-white">apps/web/.env.local</code>. Khi có Client ID, nút Google sẽ tự động bật cửa sổ tài khoản Google của bạn trên trình duyệt!
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
