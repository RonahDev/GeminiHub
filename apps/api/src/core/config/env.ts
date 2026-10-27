import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  APP_ENCRYPTION_KEY: z.string().min(32, 'APP_ENCRYPTION_KEY must be at least 32 characters'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  SEPAY_API_KEY: z.string().optional(),
  ALLOW_LIVE_BUY: z.string().default('false'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
});

function parseEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    if (process.env.NODE_ENV === 'test') {
      return {
        NODE_ENV: 'test',
        PORT: 4000,
        HOST: '0.0.0.0',
        DATABASE_URL: 'postgresql://geminihub:geminihub_secret_2026@localhost:5432/geminihub_db',
        REDIS_URL: 'redis://localhost:6379',
        APP_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        JWT_SECRET: 'test-jwt-secret-key-2026',
        COOKIE_SECRET: 'test-cookie-secret-key-2026',
        WEB_ORIGIN: 'http://localhost:3000',
        ALLOW_LIVE_BUY: 'false',
        GOOGLE_CLIENT_ID: undefined,
      };
    }
    console.error('❌ Cấu hình biến môi trường không hợp lệ:');
    for (const error of result.error.errors) {
      console.error(`  - ${error.path.join('.')}: ${error.message}`);
    }
    throw new Error('Environment configuration validation failed');
  }
  return result.data;
}

export const env = parseEnv();
