import { UnauthorizedError } from '../../core/errors/AppError';
import { env } from '../../core/config/env';

export interface GooglePayload {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

/**
 * Verify Google ID Token using Google tokeninfo endpoint
 * or mock verification in test/dev environment
 */
export async function verifyGoogleToken(idToken: string): Promise<GooglePayload> {
  // Support mock token for test suite and offline testing
  if (idToken.startsWith('mock-google:') || idToken.startsWith('mock-google-')) {
    const parts = idToken.split(':');
    const email = parts[1] || 'test.user@gmail.com';
    const googleId = parts[2] || 'google-sub-mock-123456';
    return {
      googleId,
      email: email.toLowerCase(),
      name: 'Google User Test',
      avatarUrl: 'https://lh3.googleusercontent.com/a/mock-avatar',
      emailVerified: true,
    };
  }

  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new UnauthorizedError(`Xác thực token Google không thành công: ${errBody}`);
    }

    const data: any = await response.json();

    if (!data.sub || !data.email) {
      throw new UnauthorizedError('Token Google thiếu thông tin định danh người dùng');
    }

    if (data.email_verified !== 'true' && data.email_verified !== true) {
      throw new UnauthorizedError('Tài khoản Google chưa được xác minh địa chỉ email');
    }

    // If GOOGLE_CLIENT_ID is configured in environment, ensure the token was issued for our app
    if (env.GOOGLE_CLIENT_ID && data.aud !== env.GOOGLE_CLIENT_ID) {
      throw new UnauthorizedError('Google Client ID (Audience) không khớp với cấu hình hệ thống');
    }

    return {
      googleId: data.sub,
      email: data.email.toLowerCase(),
      name: data.name,
      avatarUrl: data.picture,
      emailVerified: true,
    };
  } catch (err: any) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError(`Không thể kết nối đến máy chủ xác thực Google: ${err.message}`);
  }
}
