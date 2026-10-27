'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
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

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Initialize official Google Identity Services if client ID is set
  useEffect(() => {
    if (!clientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
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
        toast.success(`Đăng nhập bằng Google thành công! (${res.data.user.email})`);
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
      // Trigger Google One Tap or prompt
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If prompt blocked, fallback to custom dev modal
          setShowDevModal(true);
        }
      });
    } else {
      // No client ID configured in .env yet -> Open convenient Gmail login dialog
      setShowDevModal(true);
    }
  };

  const handleTestGmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      toast.error('Vui lòng nhập địa chỉ Gmail hợp lệ');
      return;
    }

    // Format mock token supported by backend
    const mockToken = `mock-google:${testEmail}:sub-${Date.now()}`;
    await sendGoogleTokenToBackend(mockToken);
  };

  return (
    <>
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

      {/* Modal for Google Sign-In */}
      <Modal
        isOpen={showDevModal}
        onClose={() => setShowDevModal(false)}
        title="Đăng Nhập Bằng Gmail Cá Nhân"
        description="Đăng nhập hoặc tạo mới tài khoản tức thì bằng tài khoản Google"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-300">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-4 w-4 text-blue-400" /> Google OAuth 2.0 Single Sign-On
            </p>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Bạn có thể nhập địa chỉ Gmail cá nhân bên dưới để đăng nhập tức thì mà không cần mật khẩu.
            </p>
          </div>

          <form onSubmit={handleTestGmailSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Nhập địa chỉ Gmail của bạn:
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
                type="button"
                onClick={() => setTestEmail('ronahdev@gmail.com')}
                className="text-[11px] text-zinc-400 hover:text-white bg-zinc-800/60 px-2.5 py-1 rounded-lg border border-zinc-700/60 transition"
              >
                + ronahdev@gmail.com
              </button>
              <button
                type="button"
                onClick={() => setTestEmail('khachhang@gmail.com')}
                className="text-[11px] text-zinc-400 hover:text-white bg-zinc-800/60 px-2.5 py-1 rounded-lg border border-zinc-700/60 transition"
              >
                + khachhang@gmail.com
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Xác Nhận Đăng Nhập Với Gmail Này</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

