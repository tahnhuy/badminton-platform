# Hướng dẫn setup SePay Bank Hub sandbox

Tài liệu này hướng dẫn lấy đủ thông tin để chạy luồng rút ví tự động trong dev/demo theo
[kế hoạch 12](../plans/12_rut-vi-tu-dong-sepay-bankhub.md).

## 0. Bank Hub khác gì SePay Payment Gateway?

| | SePay Payment Gateway | SePay Bank Hub |
| --- | --- | --- |
| Mục đích hiện tại | Nạp ví (VietQR + webhook) | Mô phỏng biến động số dư + liên kết tài khoản |
| Credentials | `merchant_id` / `secret_key` | `client_id` / `client_secret` |
| Base URL sandbox | `pgapi-sandbox.sepay.vn` | `bankhub-api-sandbox.sepay.vn` |
| Dùng cho payout demo | Không | **Có** |

Hai sản phẩm có bộ credentials riêng. Credentials Payment Gateway đang có trong `.env`
**không dùng được** cho Bank Hub.

## 1. Thông tin cần xin SePay

Liên hệ SePay ([hotline/Telegram/Facebook](https://sepay.vn/lien-he.html)) và yêu cầu:

1. Bật **Bank Hub sandbox** cho tài khoản của bạn.
2. Cấp `client_id` và `client_secret` của **sandbox**.
3. Cấp hoặc xác nhận `company_xid` sandbox.
4. Đăng ký **IPN biến động số dư** trỏ về URL public của bạn và cấp `API_KEY`
   (SePay gọi IPN với header `Authorization: Apikey {API_KEY}`).

Ghi chú:
- `client_id`/`client_secret` sandbox **khác** production.
- IPN biến động số dư **không** phải webhook sự kiện link/unlink. Webhook sự kiện dùng
  `X-Secret-Key`; IPN biến động số dư dùng `Authorization: Apikey ...`.
- Nếu SePay đã cấp sẵn `bank_account_xid` sandbox, có thể bỏ qua bước 4–5 bên dưới.

## 2. Biến môi trường

Thêm vào `backend/.env` (không commit file này):

```env
SEPAY_BANKHUB_ENABLED=true
SEPAY_BANKHUB_API_URL="https://bankhub-api-sandbox.sepay.vn"
SEPAY_BANKHUB_CLIENT_ID="<client_id sandbox>"
SEPAY_BANKHUB_CLIENT_SECRET="<client_secret sandbox>"
SEPAY_BANKHUB_COMPANY_XID="<company_xid>"
SEPAY_BANKHUB_BANK_ACCOUNT_XID="<bank_account_xid>"
SEPAY_BANKHUB_IPN_API_KEY="<api_key do SePay cấp>"
```

Quy ước khi code:
- `SEPAY_BANKHUB_ENABLED=true` + `NODE_ENV=production` → app phải **fail-fast**.
- Không log `client_secret`, access token, IPN API key.

## 3. Lấy access token

Token dùng Basic Auth, TTL ngắn; server phải cache và refresh.

```bash
export BANKHUB_BASE="https://bankhub-api-sandbox.sepay.vn"
export BANKHUB_CLIENT_ID="<client_id>"
export BANKHUB_CLIENT_SECRET="<client_secret>"

export BANKHUB_BASIC="$(printf '%s:%s' "$BANKHUB_CLIENT_ID" "$BANKHUB_CLIENT_SECRET" | base64 -w0)"

curl -sS -X POST "$BANKHUB_BASE/v1/token" \
  -H "Authorization: Basic $BANKHUB_BASIC" \
  | tee /tmp/bankhub-token.json
```

Kỳ vọng:

```json
{
  "code": 201,
  "access_token": "....",
  "ttl": 60000
}
```

Lưu token để dùng cho các bước sau:

```bash
export BANKHUB_TOKEN="$(node -e "console.log(require('/tmp/bankhub-token.json').access_token)")"
```

Nếu gặp `401`: kiểm tra đúng host sandbox, đúng cặp `client_id`/`client_secret`, và chuỗi
Basic Auth không có ký tự xuống dòng.

## 4. Tạo company (nếu chưa có)

Nếu SePay chưa cấp `company_xid`:

```bash
curl -sS -X POST "$BANKHUB_BASE/v1/company/create" \
  -H "Authorization: Bearer $BANKHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Badminton Platform Sandbox",
    "status": "Active"
  }'
```

Lấy `data.xid` trong response và gán:

```bash
export BANKHUB_COMPANY_XID="<data.xid>"
```

## 5. Liên kết tài khoản ngân hàng sandbox

### 5.1 Tạo link token

```bash
curl -sS -X POST "$BANKHUB_BASE/v1/link-token/create" \
  -H "Authorization: Bearer $BANKHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"company_xid\": \"$BANKHUB_COMPANY_XID\",
    \"purpose\": \"LINK_BANK_ACCOUNT\",
    \"completion_redirect_uri\": \"https://example.com/bankhub-done\",
    \"is_mobile_app\": 0,
    \"language\": \"vi\"
  }" | tee /tmp/bankhub-link.json
```

Lấy `hosted_link_url`:

```bash
export BANKHUB_LINK="$(node -e "console.log(require('/tmp/bankhub-link.json').hosted_link_url)")"
echo "$BANKHUB_LINK"
```

### 5.2 Mở Hosted Link và dùng tài khoản mẫu

Mở `hosted_link_url` trên browser, chọn ngân hàng và nhập thông tin tài khoản mẫu.
Ví dụ tài khoản MBBank cá nhân:

| Trường | Giá trị |
| --- | --- |
| Số điện thoại | `0000000001` |
| Tên thụ hưởng | `NGUYEN VAN A` |
| CMND/CCCD | `001234567890` |
| Số tài khoản | `0123456789` |
| OTP | `12345678` |

Ví dụ ACB cá nhân:

| Trường | Giá trị |
| --- | --- |
| Số điện thoại | `0000000007` |
| Tên thụ hưởng | `BUI VAN G` |
| CMND/CCCD | `045678901234` |
| Số tài khoản | `4567890123` |
| OTP | `456789` |

Danh sách đầy đủ: <https://developer.sepay.vn/vi/bankhub/thong-tin-sandbox>

Hoàn tất flow, chờ webhook `BANK_ACCOUNT_LINKED` hoặc kiểm tra ở bước 5.3.

### 5.3 Lấy `bank_account_xid`

```bash
curl -sS "$BANKHUB_BASE/v1/bank-account?company_xid=$BANKHUB_COMPANY_XID&per_page=20" \
  -H "Authorization: Bearer $BANKHUB_TOKEN" | tee /tmp/bankhub-accounts.json
```

Tìm tài khoản vừa liên kết và lấy `data[].xid`:

```bash
export BANKHUB_BANK_ACCOUNT_XID="<data[].xid>"
```

## 6. Cấu hình IPN biến động số dư

IPN này là nguồn chứng cứ chính khi payout. SePay cần gọi được URL public của bạn.

### 6.1 Mở tunnel

Ví dụ với cloudflared:

```bash
cloudflared tunnel --url http://localhost:3000
```

Hoặc ngrok:

```bash
ngrok http 3000
```

Giả sử URL public là `https://abc-xyz.trycloudflare.com`.

### 6.2 URL IPN

```
https://abc-xyz.trycloudflare.com/api/v1/payments/sepay-bankhub/ipn
```

Gửi URL này cho SePay để đăng ký IPN biến động số dư và nhận `API_KEY`.
SePay sẽ gọi:

```http
POST /api/v1/payments/sepay-bankhub/ipn
Authorization: Apikey <API_KEY>
Content-Type: application/json
```

Lưu ý:
- URL không được là `localhost`/IP nội bộ.
- Webhook **sự kiện** link/unlink (nếu cần) cấu hình riêng qua `POST /v1/webhook` với
  `X-Secret-Key`; không dùng key này cho IPN biến động số dư.

## 7. Test gửi lệnh chuyển tiền giả lập

Dùng Mock Transaction API với `transfer_type: "debit"`:

```bash
curl -sS -X POST "$BANKHUB_BASE/v1/transaction/create" \
  -H "Authorization: Bearer $BANKHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"bank_account_xid\": \"$BANKHUB_BANK_ACCOUNT_XID\",
    \"transfer_type\": \"debit\",
    \"amount\": 60000,
    \"transaction_content\": \"PAYOUT-123\"
  }" | tee /tmp/bankhub-simulate.json
```

Kỳ vọng response có `data.transaction_id` và `data.reference_number`.

Trong dashboard Bank Hub sandbox, vào **Transactions** để thấy giao dịch tương ứng.
Nếu IPN đã cấu hình đúng, endpoint của bạn sẽ nhận payload dạng:

```json
{
  "gateway": "MBBank",
  "transaction_date": "2026-11-18 10:30:00",
  "account_number": "0123456789",
  "bank_account_xid": "...",
  "va": null,
  "payment_code": null,
  "content": "PAYOUT-123",
  "transfer_type": "debit",
  "amount": 60000,
  "reference_code": "FT...",
  "accumulated": 0,
  "transaction_id": "a41c9e02-..."
}
```

## 8. Kiểm tra nhanh bằng webhook.site (tuỳ chọn)

Trước khi code IPN, có thể đăng ký IPN tạm trỏ về `https://webhook.site/<id>` để xem payload
thật. Sau khi xác nhận field (`transfer_type`, `content`, `transaction_id`), đổi về URL app.

## 9. Checklist trước khi chạy app

- [ ] Đã có `client_id`/`client_secret` **sandbox**.
- [ ] `POST /v1/token` trả `access_token`.
- [ ] Có `company_xid`.
- [ ] Đã liên kết bank account sandbox và có `bank_account_xid`.
- [ ] IPN URL public đã đăng ký với SePay.
- [ ] Có `SEPAY_BANKHUB_IPN_API_KEY`.
- [ ] `.env` đã điền đủ biến ở mục 2.
- [ ] App không chạy production khi bật Bank Hub.

## 10. Troubleshooting

| Lỗi | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| `401 Unauthenticated` khi lấy token | Sai host, sai client id/secret, Basic Auth sai | Dùng đúng `bankhub-api-sandbox.sepay.vn`; encode `client_id:client_secret` đúng |
| `401` khi gọi API nghiệp vụ | Token hết hạn | Lấy token mới; code phải refresh khi gần hết TTL |
| `400 Validation error` khi tạo link token | Thiếu `company_xid` hoặc purpose sai | Kiểm tra `company_xid`; `purpose=LINK_BANK_ACCOUNT` |
| `404` khi tạo link token | Company không tồn tại | Tạo company hoặc xin lại `company_xid` từ SePay |
| Không có `bank_account_xid` | Chưa hoàn tất Hosted Link | Làm lại bước 5; kiểm tra `GET /v1/bank-account` |
| Mock transaction `403` | Gọi production host hoặc không phải sandbox | Dùng đúng host sandbox và token sandbox |
| IPN không tới | URL localhost/nội bộ, tunnel tắt, chưa đăng ký IPN | Dùng cloudflared/ngrok; đăng ký lại URL với SePay |
| IPN tới nhưng `401` | Sai `API_KEY` hoặc thiếu header `Authorization: Apikey ...` | Đối chiếu key SePay cấp; log header (không log key) |
| IPN tới nhưng app báo 404 payout | `content` không chứa `PAYOUT-<id>` | Kiểm tra `transaction_content` khi simulate |
| Quá quota | Quá 500 giao dịch/ngày | Dùng tài khoản test riêng; xoá giao dịch test |

## 11. Bảo mật

- Không đưa `client_secret`, access token, IPN API key vào frontend hoặc repository.
- Không log header `Authorization`.
- So sánh IPN key bằng constant-time.
- Chỉ bật Bank Hub ở dev/demo; chặn production bằng fail-fast.
- Rotate credentials nếu nghi ngờ lộ.

## 12. Tài liệu SePay tham khảo

- Tổng quan Bank Hub: <https://developer.sepay.vn/vi/bankhub/tong-quan>
- Sandbox + tài khoản mẫu: <https://developer.sepay.vn/vi/bankhub/thong-tin-sandbox>
- Bắt đầu nhanh: <https://developer.sepay.vn/vi/bankhub/bat-dau-nhanh>
- Tạo access token: <https://developer.sepay.vn/vi/bankhub/api/tao-token>
- Tạo company: <https://developer.sepay.vn/vi/bankhub/api/cong-ty/tao-cong-ty>
- Tạo link token: <https://developer.sepay.vn/vi/bankhub/api/link-token/tao-link-token>
- Danh sách tài khoản: <https://developer.sepay.vn/vi/bankhub/api/tai-khoan-ngan-hang/danh-sach-tai-khoan>
- Mock Transaction API: <https://developer.sepay.vn/vi/bankhub/api/api-giao-dich/gia-lap-giao-dich>
- IPN biến động số dư: <https://developer.sepay.vn/vi/bankhub/thong-bao-bien-dong-so-du>
