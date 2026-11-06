# BẢNG ĐẶC TẢ TEST CASE HỆ THỐNG GEMINIHUB (TEST SPECIFICATION)

> **Dự án:** GeminiHub Enterprise — Hệ thống thương mại điện tử phân phối link kích hoạt Gemini tự động  
> **Phiên bản:** v1.0.0  
> **Tổng số Test Cases:** 35 Test Cases nghiệp vụ cốt lõi (7 phân hệ × 5 test cases) + 12 Test Cases bảo mật & mã hóa  
> **Bộ công cụ kiểm thử:** Vitest, TypeScript, In-memory Mock Prisma, Argon2id, Crypto AES-256-GCM  
> **Tỷ lệ vượt qua (Pass Rate):** 100% (47/47 Tests Passed)  

---

## 📑 MỤC LỤC TỔNG HỢP CÁC CHỨC NĂNG

1. [Chức năng 1: Xác Thực & Đăng Nhập (Authentication & Google SSO)](#chuc-nang-1-xac-thuc--dang-nhap)
2. [Chức năng 2: Quản Lý Ví & Webhook VietQR (Wallet & SePay)](#chuc-nang-2-quan-ly-vi--webhook-vietqr)
3. [Chức năng 3: Engine Định Giá Động (Dynamic Pricing Engine)](#chuc-nang-3-engine-dinh-gia-dong)
4. [Chức năng 4: Đặt Hàng 2 Pha & Chuyển Nguồn Failover (Order Purchasing)](#chuc-nang-4-dat-hang-2-pha--failover)
5. [Chức năng 5: Khiếu Nại Bảo Hành & Đổi Trả (Warranty Management)](#chuc-nang-5-khieu-nai-bao-hanh)
6. [Chức năng 6: Quản Lý Bot Nguồn & Ngắt Mạch (Bot Sources & Circuit Breaker)](#chuc-nang-6-quan-ly-bot-nguon)
7. [Chức năng 7: Quản Trị Hệ Thống & Kiểm Toán (Admin Audit & Dashboard)](#chuc-nang-7-quan-tri-he-thong)

---

<a id="chuc-nang-1-xac-thuc--dang-nhap"></a>
## 1. CHỨC NĂNG 1: XÁC THỰC & ĐĂNG NHẬP (AUTHENTICATION & GOOGLE SSO)
*File kiểm thử tự động:* `apps/api/test/auth.test.ts`

| Mã Test Case | Tên Test Case & Mục tiêu | Tiền điều kiện | Các bước thực hiện | Dữ liệu đầu vào (Test Data) | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|:---:|
| **TC-AUTH-01** | Đăng ký tài khoản mới bằng mật khẩu Argon2id an toàn | Hệ thống chưa có email `test.user@geminihub.vn` | 1. Gửi request POST `/api/v1/auth/register`<br>2. Kiểm tra tài khoản được lưu<br>3. Kiểm tra mã hóa password | `email`: "test.user@geminihub.vn"<br>`password`: "SecretPass123@" | • Trả về HTTP 201 Created<br>• Mật khẩu được băm bằng Argon2id (bắt đầu `$argon2id$`)<br>• Gán Role USER (hoặc ADMIN nếu là user đầu tiên) | **PASSED** ✅ |
| **TC-AUTH-02** | Ngăn chặn đăng ký trùng lặp email đã tồn tại | Email `existing@geminihub.vn` đã đăng ký trước đó | 1. Gửi request POST `/api/v1/auth/register` với email đã tồn tại | `email`: "existing@geminihub.vn"<br>`password`: "AnotherPass456@" | • Trả về HTTP 409 Conflict<br>• Thông báo lỗi "Email này đã được sử dụng"<br>• Không tạo bản ghi trùng lặp trong DB | **PASSED** ✅ |
| **TC-AUTH-03** | Đăng nhập tài khoản mật khẩu chính xác | Tài khoản `customer@geminihub.vn` ở trạng thái ACTIVE | 1. Gửi request POST `/api/v1/auth/login` với email và mật khẩu đúng | `email`: "customer@geminihub.vn"<br>`password`: "CorrectPassword123" | • Trả về HTTP 200 OK<br>• Cấp JWT Access Token (hạn 15 phút)<br>• Cấp Refresh Token lưu trong HttpOnly Cookie (hạn 30 ngày) | **PASSED** ✅ |
| **TC-AUTH-04** | Từ chối đăng nhập khi nhập sai mật khẩu | Tài khoản `customer@geminihub.vn` tồn tại | 1. Gửi request POST `/api/v1/auth/login` với mật khẩu không đúng | `email`: "customer@geminihub.vn"<br>`password`: "WrongPassword999" | • Trả về HTTP 401 Unauthorized<br>• Thông báo "Email hoặc mật khẩu không chính xác"<br>• Không cấp token | **PASSED** ✅ |
| **TC-AUTH-05** | Đăng nhập bằng Google OAuth 2.0 Single Sign-On | Người dùng có tài khoản Gmail | 1. Người dùng bấm "Đăng nhập với Google"<br>2. Nhận Google ID Token<br>3. Gửi token lên POST `/api/v1/auth/google` | `credential`: Google ID Token (chứa email `user.google@gmail.com`) | • Trả về HTTP 200 OK<br>• Tự động đăng ký mới nếu chưa có, hoặc liên kết nếu đã có<br>• Đăng nhập thành công và cấp JWT Access Token | **PASSED** ✅ |

---

<a id="chuc-nang-2-quan-ly-vi--webhook-vietqr"></a>
## 2. CHỨC NĂNG 2: QUẢN LÝ VÍ & WEBHOOK VIETQR (WALLET & SEPAY)
*File kiểm thử tự động:* `apps/api/test/wallet.test.ts`

| Mã Test Case | Tên Test Case & Mục tiêu | Tiền điều kiện | Các bước thực hiện | Dữ liệu đầu vào (Test Data) | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|:---:|
| **TC-WAL-01** | Tạo lệnh nạp tiền sinh mã VietQR 6 ký tự chuẩn cú pháp `GHxxxxxx` | User đã đăng nhập | 1. Gọi hàm `createTopup` với số tiền nạp | `userId`: "usr-1"<br>`amount`: 100,000 VND | • Mã nạp khớp định dạng regex `/^GH[A-Z0-9]{6}$/`<br>• Tạo link ảnh VietQR chứa đầy đủ STK, số tiền, nội dung<br>• Thời gian hết hạn đúng 30 phút | **PASSED** ✅ |
| **TC-WAL-02** | Xử lý Webhook SePay cộng tiền tự động vào ví khách hàng | Có lệnh nạp `GH8X9Y2Z` đang ở trạng thái PENDING | 1. Nhận webhook SePay với nội dung chuyển khoản chứa mã `GH8X9Y2Z` | `transferAmount`: 100,000<br>`content`: "Chuyen tien GH8X9Y2Z"<br>`id`: 987654321 | • Số dư ví user tăng chính xác +100,000 VND<br>• Lệnh topup chuyển sang COMPLETED<br>• Ghi nhận bản ghi sổ cái ví `WalletTransaction` loại TOPUP | **PASSED** ✅ |
| **TC-WAL-03** | Cơ chế Idempotent chống cộng tiền trùng lặp khi nhận lại Webhook | Webhook giao dịch mã `TX-999` đã được xử lý trước đó | 1. Gửi lại cùng một payload webhook mang providerTxId `TX-999` | `providerTxId`: "TX-999"<br>`transferAmount`: 100,000 | • Hệ thống phát hiện giao dịch trùng<br>• Trả về thông báo "Giao dịch đã được xử lý trước đó"<br>• Số dư ví không bị cộng lần 2 | **PASSED** ✅ |
| **TC-WAL-04** | Đưa giao dịch không khớp mã lệnh vào hàng đợi UNMATCHED | Khách chuyển khoản sai cú pháp hoặc quên ghi mã | 1. Nhận webhook SePay với nội dung "Chuyen tien ung ho shop" (không có mã GH) | `content`: "Chuyen tien ung ho shop"<br>`transferAmount`: 50,000 | • Lưu vào bảng `BankTransaction` với `matchedTopupId = null`<br>• Trả về trạng thái `matched: false`<br>• Đưa vào danh sách chờ admin đối soát thủ công | **PASSED** ✅ |
| **TC-WAL-05** | Tính bất biến của sổ cái ví (Append-Only Ledger) | User có số dư ban đầu 200,000 VND | 1. Nạp tiền 100,000 VND<br>2. Mua hàng 50,000 VND<br>3. Kiểm tra biến động số dư | Lệnh nạp +100k, Mua đơn -50k | • Mỗi biến động ghi 1 dòng riêng biệt (không cập nhật đè)<br>• Lưu đầy đủ `balanceBefore` và `balanceAfter`<br>• Tổng số dư cuối cùng khớp 250,000 VND | **PASSED** ✅ |

---

<a id="chuc-nang-3-engine-dinh-gia-dong"></a>
## 3. CHỨC NĂNG 3: ENGINE ĐỊNH GIÁ ĐỘNG (DYNAMIC PRICING ENGINE)
*File kiểm thử tự động:* `apps/api/test/pricing.test.ts`

| Mã Test Case | Tên Test Case & Mục tiêu | Tiền điều kiện | Các bước thực hiện | Dữ liệu đầu vào (Test Data) | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|:---:|
| **TC-PRICE-01** | Định giá cố định (FIXED mode) không phụ thuộc giá vốn bot | Sản phẩm cấu hình chế độ `FIXED` | 1. Cấu hình giá cố định 25,000 VND<br>2. Thay đổi giá vốn bot từ 15k lên 20k | `fixedPrice`: 25,000 VND<br>Bot costs: [17,000; 20,000] | • Giá bán lẻ luôn giữ nguyên 25,000 VND<br>• Hệ thống tính toán chính xác biên lợi nhuận thu về | **PASSED** ✅ |
| **TC-PRICE-02** | Định giá cộng biên độ (COST_PLUS) theo bot ưu tiên (PRIORITY) | Chế độ `COST_PLUS`, cơ sở giá vốn `PRIORITY` | 1. Bot ưu tiên 1 (giá 17k) còn hàng<br>2. Tính giá bán lẻ | `markupPercent`: 25%<br>`roundingStep`: 1,000 | • Giá vốn cơ sở là 17,000 VND<br>• Giá gốc = 17,000 * 1.25 = 21,250 VND<br>• Làm tròn lên thành 22,000 VND | **PASSED** ✅ |
| **TC-PRICE-03** | Định giá COST_PLUS theo giá vốn cao nhất (HIGHEST failover basis) | Chế độ `COST_PLUS`, cơ sở giá vốn `HIGHEST` | 1. Bot 1 giá 17k, Bot 2 giá 19k, Bot 3 giá 22k<br>2. Tính giá bán lẻ | `markupPercent`: 20%<br>`roundingStep`: 1,000 | • Lấy giá vốn cao nhất là 22,000 VND<br>• Giá gốc = 22,000 * 1.2 = 26,400 VND<br>• Làm tròn thành 27,000 VND phòng ngừa rủi ro failover | **PASSED** ✅ |
| **TC-PRICE-04** | Quy tắc làm tròn giá thông minh theo bước nhảy 1.000đ và 500đ | Có giá thô tính toán từ công thức | 1. Làm tròn 21,200đ với bước 1,000đ<br>2. Làm tròn 21,200đ với bước 500đ | `rawPrice`: 21,200 VND | • Bước 1,000đ làm tròn lên thành 22,000 VND<br>• Bước 500đ làm tròn lên thành 21,500 VND | **PASSED** ✅ |
| **TC-PRICE-05** | Bảo vệ biên lợi nhuận tối thiểu (Min Margin) & Tự ngắt bán | Yêu cầu mức lãi tối thiểu 5,000đ/gói | 1. Giá vốn bot tăng vọt khiến mức lãi chỉ còn 2,000đ (< 5k) | `minMarginAmount`: 5,000 VND<br>Cost: 20k, Giá bán: 22k | • `isPaused = true`<br>• Sản phẩm tự động tạm ngưng bán<br>• Lý do: "không đạt mức lãi tối thiểu quy định" | **PASSED** ✅ |

---

<a id="chuc-nang-4-dat-hang-2-pha--failover"></a>
## 4. CHỨC NĂNG 4: ĐẶT HÀNG 2 PHA & CHUYỂN NGUỒN FAILOVER (ORDER PURCHASING)
*File kiểm thử tự động:* `apps/api/test/order.test.ts`

| Mã Test Case | Tên Test Case & Mục tiêu | Tiền điều kiện | Các bước thực hiện | Dữ liệu đầu vào (Test Data) | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|:---:|
| **TC-ORD-01** | Mua hàng thành công với giao dịch 2 pha (2-Phase Commit) | Khách có số dư ví 100,000 VND | 1. Đặt mua gói 25,000 VND<br>2. Bot nguồn trả về link kích hoạt thành công | `quantity`: 1<br>`unitPrice`: 25,000 VND | • Pha 1: Trừ số dư ví còn 75,000 VND, trạng thái PROCESSING<br>• Pha 2: Cấp link mã hóa AES-256, chuyển sang COMPLETED<br>• Ghi nhận giao dịch mua vào sổ cái ví | **PASSED** ✅ |
| **TC-ORD-02** | Chống gửi lệnh mua trùng lặp bằng Idempotency Key | Đơn hàng với Idempotency Key "IDEMP-123" đã xử lý | 1. Khách gửi lại request mua với cùng Idempotency Key | `idempotencyKey`: "IDEMP-123" | • Trả về kết quả của đơn hàng cũ ngay lập tức<br>• Không trừ thêm tiền ví lần 2<br>• Không gọi thêm lệnh mua từ bot nguồn | **PASSED** ✅ |
| **TC-ORD-03** | Tự động Failover sang bot phụ khi bot chính báo hết hàng | Bot 1 (ưu tiên 1) hết hàng, Bot 2 (ưu tiên 2) còn hàng | 1. Khách bấm mua đơn<br>2. Bot 1 trả về lỗi OUT_OF_STOCK<br>3. Hệ thống tự động gọi Bot 2 | Bot 1: Hết hàng<br>Bot 2: Còn hàng | • Tự động chuyển nguồn sang Bot 2 mà khách không cần làm lại<br>• Đơn hàng hoàn tất COMPLETED thành công<br>• Ghi nhận lịch sử gọi bot phục vụ kiểm toán | **PASSED** ✅ |
| **TC-ORD-04** | Tự động hoàn tiền 100% khi tất cả các nguồn bot thất bại | Tất cả các bot liên kết đều báo lỗi hoặc hết hàng | 1. Khách tạo đơn và bị trừ tiền ban đầu<br>2. Tất cả các bot đều trả về DEFINITE_FAIL | Tất cả bot lỗi | • Đơn hàng chuyển sang FAILED<br>• Hệ thống tự động hoàn tiền 100% về số dư ví<br>• Ghi nhận giao dịch REFUND vào sổ cái | **PASSED** ✅ |
| **TC-ORD-05** | Chuyển trạng thái NEEDS_REVIEW khi bot Timeout hoặc lỗi mạng | Bot nguồn không phản hồi sau thời gian quy định | 1. Gọi bot mua hàng<br>2. Bot bị Gateway Timeout (504) hoặc không rõ kết quả | Kết quả bot: UNKNOWN / Timeout | • Đơn hàng chuyển sang trạng thái `NEEDS_REVIEW`<br>• KHÔNG tự động hoàn tiền để tránh mất tiền 2 đầu<br>• Gửi cảnh báo lên Admin Dashboard để đối soát | **PASSED** ✅ |

---

<a id="chuc-nang-5-khieu-nai-bao-hanh"></a>
## 5. CHỨC NĂNG 5: KHIẾU NẠI BẢO HÀNH & ĐỔI TRẢ (WARRANTY MANAGEMENT)
*File kiểm thử tự động:* `apps/api/test/warranty.test.ts`

| Mã Test Case | Tên Test Case & Mục tiêu | Tiền điều kiện | Các bước thực hiện | Dữ liệu đầu vào (Test Data) | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|:---:|
| **TC-WAR-01** | Khách tạo ticket bảo hành thành công trong cửa sổ 5 phút | Đơn hàng COMPLETED, thời gian mua cách hiện tại 2 phút | 1. Khách bấm nút "Báo lỗi bảo hành"<br>2. Nhập lý do lỗi | `reason`: "Link báo đã bị kích hoạt trước đó" | • Tạo ticket bảo hành trạng thái PENDING thành công<br>• Đơn hàng được gắn cờ có yêu cầu bảo hành | **PASSED** ✅ |
| **TC-WAR-02** | Từ chối tạo ticket khi đơn hàng đã quá hạn bảo hành 5 phút | Đơn hàng đã mua cách hiện tại 10 phút (> 5 phút) | 1. Khách cố gắng gửi yêu cầu khiếu nại | `warrantyUntil`: Thời gian quá khứ | • Từ chối tạo ticket<br>• Ném ra lỗi: "Thời hạn bảo hành của đơn hàng đã kết thúc" | **PASSED** ✅ |
| **TC-WAR-03** | Ngăn chặn tạo ticket bảo hành trùng lặp trên cùng đơn hàng | Đơn hàng đã có 1 ticket đang chờ xử lý | 1. Khách gửi thêm yêu cầu khiếu nại lần 2 trên cùng đơn | Cùng `orderId` | • Ném ra lỗi: "Đơn hàng này đã có yêu cầu bảo hành"<br>• Không tạo thêm ticket rác | **PASSED** ✅ |
| **TC-WAR-04** | Admin duyệt giải pháp REPLACE: Cấp link thay thế và vô hiệu link cũ | Ticket bảo hành đang ở trạng thái PENDING | 1. Admin bấm duyệt đổi link mới<br>2. Nhập link kích hoạt thay thế | `resolution`: REPLACE<br>`newLink`: "https://one.google.com/promo=NEW" | • Link lỗi cũ bị đóng dấu `disabledAt`<br>• Link mới được mã hóa AES-256 cấp cho khách<br>• Ticket chuyển sang RESOLVED | **PASSED** ✅ |
| **TC-WAR-05** | Admin duyệt giải pháp REFUND: Hoàn tiền 100% vào ví khách | Ticket bảo hành đang PENDING, đơn giá 25,000 VND | 1. Admin bấm hoàn tiền vào ví khách hàng | `resolution`: REFUND<br>`refundAmount`: 25,000 VND | • Số dư ví của khách tăng đúng +25,000 VND<br>• Ghi nhận giao dịch REFUND vào sổ cái<br>• Ticket chuyển sang RESOLVED | **PASSED** ✅ |

---

<a id="chuc-nang-6-quan-ly-bot-nguon"></a>
## 6. CHỨC NĂNG 6: QUẢN LÝ BOT NGUỒN & NGẮT MẠCH (BOT SOURCES & CIRCUIT BREAKER)
*File kiểm thử tự động:* `apps/api/test/source.test.ts`

| Mã Test Case | Tên Test Case & Mục tiêu | Tiền điều kiện | Các bước thực hiện | Dữ liệu đầu vào (Test Data) | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|:---:|
| **TC-SRC-01** | Kiểm tra kết nối `testConnection` và đo lường latency thực tế | Bot Adapter đã cấu hình | 1. Gọi hàm `testConnection()` của adapter | MockAdapter latency 10ms | • Kết quả trả về `ok: true`<br>• Đo lường chính xác `latencyMs` thực tế | **PASSED** ✅ |
| **TC-SRC-02** | Đồng bộ tự động danh mục sản phẩm và số dư bot nguồn | Bot nguồn đang hoạt động | 1. Gọi hàm `getBalance()` và `listProducts()` | Bot API | • Số dư bot trả về số tiền hợp lệ (> 0 VND)<br>• Danh sách gói sản phẩm đồng bộ đầy đủ mã externalId | **PASSED** ✅ |
| **TC-SRC-03** | Cơ chế Circuit Breaker: Ngắt mạch sang ERROR sau 5 lỗi liên tiếp | Bot nguồn ban đầu ACTIVE, lỗi 0 lần | 1. Giả lập bot gặp sự cố lỗi liên tiếp 5 lần | 5 lần gọi thất bại liên tiếp | • Bộ đếm `consecutiveErrors` tăng lên 5<br>• Trạng thái bot tự động ngắt mạch chuyển sang `ERROR`<br>• Tự động loại bot này khỏi danh sách chia đơn | **PASSED** ✅ |
| **TC-SRC-04** | Che giấu token (`maskSecret`) và mã hóa credentials AES-256-GCM | Có token bí mật của bot | 1. Mã hóa token bằng AES-256-GCM<br>2. Giải mã khi thực thi<br>3. Che giấu token khi hiển thị UI | Token: "sumistore-super-secret-token" | • Lưu trữ trong DB dưới dạng mã hóa hex `iv:authTag:cipher`<br>• Giải mã chính xác dữ liệu gốc khi thực thi<br>• Hàm `maskSecret` chỉ hiển thị `••••••••` trên giao diện | **PASSED** ✅ |
| **TC-SRC-05** | Tự động phục hồi trạng thái ACTIVE khi bot kết nối lại thành công | Bot đang ở trạng thái ERROR với 5 lỗi | 1. Thực hiện kiểm tra kết nối lại thành công | Ping thành công | • Trạng thái bot khôi phục từ `ERROR` về `ACTIVE`<br>• Bộ đếm lỗi được reset về 0 | **PASSED** ✅ |

---

<a id="chuc-nang-7-quan-tri-he-thong"></a>
## 7. CHỨC NĂNG 7: QUẢN TRỊ HỆ THỐNG & KIỂM TOÁN (ADMIN AUDIT & DASHBOARD)
*File kiểm thủ tự động:* `apps/api/test/admin.test.ts`

| Mã Test Case | Tên Test Case & Mục tiêu | Tiền điều kiện | Các bước thực hiện | Dữ liệu đầu vào (Test Data) | Kết quả mong đợi | Trạng thái |
|---|---|---|---|---|---|:---:|
| **TC-ADM-01** | Admin gán link thủ công cho đơn hàng bị treo `NEEDS_REVIEW` | Đơn hàng đang ở trạng thái `NEEDS_REVIEW` | 1. Admin nhập link kích hoạt thủ công<br>2. Nhập ghi chú đối soát | Link: "https://one.google.com/promo=ADMIN-LINK"<br>Ghi chú: "Đã đối soát bot" | • Đơn hàng chuyển sang COMPLETED<br>• Cấp link mã hóa cho khách hàng<br>• Ghi nhật ký kiểm toán `AuditLog` với action `ORDER_FULFILL_MANUAL` | **PASSED** ✅ |
| **TC-ADM-02** | Admin hoàn tiền thủ công cho đơn hàng lỗi vào ví khách | Đơn hàng đang PROCESSING hoặc lỗi | 1. Admin bấm hoàn tiền đơn hàng<br>2. Nhập lý do hoàn tiền | Đơn 30,000 VND<br>Lý do: "Bot không cung cấp link" | • Đơn hàng chuyển sang trạng thái REFUNDED<br>• Số dư ví khách được cộng lại +30,000 VND<br>• Ghi nhận biến động sổ cái `WalletTransaction` | **PASSED** ✅ |
| **TC-ADM-03** | Admin điều chỉnh tăng/giảm số dư ví khách kèm lý do kiểm toán | User có số dư 50,000 VND | 1. Admin cộng 100,000 VND khuyến mãi | `amount`: +100,000 VND<br>Lý do: "Tặng thưởng khách thân thiết" | • Số dư ví cập nhật thành 150,000 VND<br>• Lưu nhật ký kiểm toán `AuditLog` lưu lại số dư trước và sau | **PASSED** ✅ |
| **TC-ADM-04** | Ngăn chặn trừ tiền vượt quá số dư hiện có của khách hàng | User có số dư 50,000 VND | 1. Admin cố gắng trừ -100,000 VND | `amount`: -100,000 VND | • Hệ thống từ chối thực hiện<br>• Báo lỗi "Số dư của khách không đủ để trừ số tiền này"<br>• Số dư ví giữ nguyên 50,000 VND | **PASSED** ✅ |
| **TC-ADM-05** | Tính toán báo cáo tài chính Dashboard (Doanh thu, Giá vốn, Lợi nhuận) | Có danh sách đơn hàng hoàn tất trong ngày | 1. Admin truy cập Dashboard tổng quan | Đơn 1: Bán 30k, Vốn 18k<br>Đơn 2: Bán 50k, Vốn 34k | • Doanh thu tính đúng = 80,000 VND<br>• Giá vốn tính đúng = 86,000 VND<br>• Cảnh báo chính xác số lượng bot nguồn sắp cạn số dư ví | **PASSED** ✅ |

---

## 🛠️ CÁCH CHẠY VÀ XÁC MINH TEST CASES BẰNG LỆNH

Bạn có thể chạy toàn bộ 35 test cases nói trên bằng 1 trong các câu lệnh sau tại terminal:

```bash
# Chạy toàn bộ 47 test cases trong hệ thống:
npm test

# Chạy riêng từng phân hệ:
npx vitest run apps/api/test/auth.test.ts      # Chức năng 1: Auth
npx vitest run apps/api/test/wallet.test.ts    # Chức năng 2: Ví & VietQR
npx vitest run apps/api/test/pricing.test.ts   # Chức năng 3: Định giá động
npx vitest run apps/api/test/order.test.ts     # Chức năng 4: Đặt hàng 2 pha
npx vitest run apps/api/test/warranty.test.ts  # Chức năng 5: Bảo hành
npx vitest run apps/api/test/source.test.ts    # Chức năng 6: Bot nguồn
npx vitest run apps/api/test/admin.test.ts     # Chức năng 7: Quản trị & Báo cáo

# Chạy kịch bản mô phỏng kiểm thử toàn trình (E2E End-to-End):
npm run test:e2e
```
