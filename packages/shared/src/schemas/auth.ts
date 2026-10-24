import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z
    .string()
    .min(8, 'Mật khẩu phải từ 8 ký tự')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Mật khẩu phải bao gồm cả chữ và số'),
});

export const LoginSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới phải từ 8 ký tự')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Mật khẩu mới phải bao gồm cả chữ và số'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Mã khôi phục không hợp lệ'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới phải từ 8 ký tự')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Mật khẩu mới phải bao gồm cả chữ và số'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

