# GeminiHub — Hệ Thống Bán Link Kích Hoạt Gemini Tự Động

> **Tuân thủ đặc tả kỹ thuật SRS v1.0 (24/10/2026 - @DuyKR)**

GeminiHub là hệ thống bán lẻ link kích hoạt Google Gemini Advanced tự động lấy từ nhiều bot Telegram (như Sumistore) qua chuẩn HTTP API với cơ chế failover nguồn, quản lý số dư ví sổ cái bất biến (append-only ledger), công cụ tự động tính giá bán lại theo giá vốn và tích hợp cổng thanh toán VietQR / SePay.

---

## 🏗 Kiến Trúc Kỹ Thuật (Monorepo)

Hệ thống được tổ chức dạng Monorepo chia sẻ mã nguồn sạch sẽ:

```
GeminiHub/
├── apps/
│   ├── api/                       # Backend Fastify v5 + Prisma + BullMQ
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # 16 models chuẩn SRS mục 7.1
│   │   │   └── seed.ts            # Dữ liệu mẫu (Admin, Khách, Bot Mock, Sản phẩm)
│   │   ├── src/
│   │   │   ├── adapters/          # TeleApiAdapter (HMAC-SHA256), MockAdapter, factory
│   │   │   ├── modules/
│   │   │   │   ├── auth/          # JWT, refresh token rotation, argon2id
│   │   │   │   ├── wallet/        # Sổ cái ví, VietQR, SePay webhook
│   │   │   │   ├── pricing/       # Pricing Engine (cost-plus, làm tròn, biên lãi)
│   │   │   │   ├── order/         # Luồng mua 2 pha & failover tối đa 3 nguồn
│   │   │   │   └── admin/         # Dashboard, đối soát, bảo hành, kiểm toán
│   │   │   ├── jobs/              # Watcher đơn kẹt > 2 phút, ngắt mạch circuit breaker
│   │   │   └── server.ts          # REST API (/api/v1) & Swagger (/docs)
│   │   └── test/                  # Bộ kiểm thử đơn vị Vitest
│   │
│   └── web/                       # Frontend Next.js 15 (App Router) + TailwindCSS
│       ├── src/
│       │   ├── app/
│       │   │   ├── (public)/      # Trang chủ (/), Lịch sử (/orders), Nạp tiền (/topup), Ví (/wallet)
│       │   │   └── admin/         # Dashboard, Nguồn bot, Sản phẩm, Duyệt giá, Khiếu nại
│       │   ├── components/        # Navbar, Navbar balance badge, Dialogs
│       │   └── context/           # AuthContext (quản lý session & số dư tức thời)
│       └── package.json
│
├── packages/
│   └── shared/                    # DTOs, Enums, Zod Schemas dùng chung FE & BE
├── docker-compose.yml             # PostgreSQL 16 + Redis 7
└── README.md
```

---

## 🔒 Các Bất Biến & Cơ Chế Cốt Lõi

1. **Toàn vẹn số dư ví (NFR-01, NFR-02):**
   - Số dư ví luôn $\ge 0$. Trừ tiền bằng câu lệnh SQL có điều kiện: `UPDATE users SET balance = balance - :amount WHERE balance >= :amount`.
   - Bảng `WalletTransaction` (sổ cái) là **append-only** (chỉ thêm, không sửa, không xóa).
2. **Quy trình mua hàng 2 pha & Failover (Section 6.4 - 6.5):**
   - **Pha 1:** Kiểm tra điều kiện, trừ tiền ví $\rightarrow$ tạo đơn `PROCESSING`.
   - **Pha 2 (Gọi bot nguồn):**
     - `SUCCESS` $\rightarrow$ Lưu link (mã hóa AES-256-GCM), đơn `COMPLETED`, bật hẹn giờ bảo hành 5 phút.
     - `DEFINITE_FAIL` (Hết hàng / Thiếu số dư nguồn) $\rightarrow$ Thử nguồn kế tiếp (tối đa 3 nguồn). Nếu tất cả thất bại $\rightarrow$ Hoàn tiền ví $\rightarrow$ Đơn `FAILED`.
     - `UNKNOWN` (Timeout / Lỗi 5xx / Phản hồi không rõ) $\rightarrow$ **Không tự hoàn tiền**, chuyển đơn `NEEDS_REVIEW` để Admin đối soát, tránh rủi ro mất tiền.
   - Tiến trình giám sát tự động chuyển đơn `PROCESSING` quá 2 phút sang `NEEDS_REVIEW`.
3. **Bảo mật & Mã hóa (NFR-06, NFR-07):**
   - Mật khẩu băm bằng **Argon2id**.
   - API ID, khóa HMAC của bot nguồn và link kích hoạt được mã hóa bằng **AES-256-GCM** với khóa trong biến môi trường.
   - Giao diện Admin chỉ hiển thị dạng che (`TAPI-P7L3••••4F0Y`), không trả secret về client.
4. **Bộ định giá tự động (FR-PRICE):**
   - Công thức: `Giá = Giá vốn cơ sở × (1 + % Lãi) + Tiền cộng thêm`, làm tròn lên theo bước 1.000 đ.
   - Nếu giá tự tính thay đổi quá 20% sau khi đồng bộ, hệ thống giữ giá cũ và đánh dấu `Chờ duyệt giá` (FR-PRICE-06).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ

### 1. Khởi động PostgreSQL 16 & Redis 7
```bash
docker compose up -d
```

### 2. Cấu hình biến môi trường
Kiểm tra file `apps/api/.env`:
```env
DATABASE_URL="postgresql://geminihub:geminihub_secret_2026@localhost:5432/geminihub_db?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=4000
APP_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
JWT_SECRET="super-secret-jwt-key-change-in-production-2026"
COOKIE_SECRET="super-secret-cookie-key-change-in-production-2026"
WEB_ORIGIN="http://localhost:3000"
ALLOW_LIVE_BUY="false"
```

### 3. Cập nhật Database & Nạp dữ liệu mẫu (Seed)
```bash
# Đẩy schema vào DB
npm run db:push --workspace=@geminihub/api

# Nạp dữ liệu khởi tạo
npm run db:seed --workspace=@geminihub/api
```

### 4. Tài khoản mẫu được tạo sẵn:
- **Tài khoản Quản trị (Admin):**
  - Email: `admin@geminihub.vn`
  - Mật khẩu: `AdminPassword123`
  - Số dư: 5.000.000 đ
- **Tài khoản Khách hàng (User):**
  - Email: `khachhang@gmail.com`
  - Mật khẩu: `KhachHang123`
  - Số dư: 200.000 đ

### 5. Chạy ứng dụng
Mở 2 terminal:
```bash
# Terminal 1: Backend API (Fastify port 4000)
npm run dev:api

# Terminal 2: Frontend Web (Next.js port 3000)
npm run dev:web
```

- **Giao diện người dùng:** `http://localhost:3000`
- **Trang quản trị Admin:** `http://localhost:3000/admin`
- **Tài liệu Swagger API:** `http://localhost:4000/docs`
- **Kiểm tra Healthcheck:** `http://localhost:4000/health`

### 6. Chạy kiểm thử tự động
```bash
npm test
```
Toàn bộ 14 bài unit tests bao phủ Cryptography, Pricing Engine, và Source Adapters đều đạt chuẩn.

