# NTSM Canvas API

Backend API cho hệ thống bán bản quyền App chạy trên Gemini Canvas.

## Kiến trúc

```
Canvas JSX (UI) → Vercel API → Firebase Firestore
                                  ├── app_licenses (quản lý key)
                                  ├── app_prompts  (prompts bí mật)
                                  └── app_products (danh sách sản phẩm)
```

## Setup

### 1. Tạo Firebase Service Account
1. Vào [Firebase Console](https://console.firebase.google.com/project/ntsmprotoan/settings/serviceaccounts/adminsdk)
2. Click **"Generate new private key"**
3. Tải file JSON về

### 2. Deploy lên Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 3. Cấu hình Environment Variables trên Vercel
- `FIREBASE_SERVICE_ACCOUNT`: Paste toàn bộ nội dung file JSON service account

### 4. Tạo dữ liệu mẫu trong Firestore

**Collection `app_licenses`** (Document ID = mã kích hoạt):
```json
{
  "productId": "chuyenword",
  "deviceId": null,
  "status": "active",
  "createdAt": "2026-05-07T00:00:00Z",
  "expiresAt": "2027-05-07T00:00:00Z",
  "activatedAt": null,
  "buyerEmail": "test@example.com",
  "buyerName": "Test User"
}
```

**Collection `app_prompts`** (Document ID = productId):
```json
{
  "baseRules": "YÊU CẦU ĐẶC BIỆT CHUNG...",
  "cleanMode": "LÀM SẠCH ĐỀ THI...",
  "similarMode": "TẠO ĐỀ TƯƠNG TỰ...",
  "answerMode": "HƯỚNG DẪN CHẤM...",
  "imageOriginal": "Dùng ảnh gốc...",
  "imageSvg": "Tái tạo SVG...",
  "imagePollinations": "Ảnh AI Pollinations...",
  "imageAi": "Ảnh AI Nano..."
}
```

## API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/validate` | POST | Validate license + bind DeviceID |
| `/api/prompts` | POST | Lấy prompts cho license hợp lệ |

## Mở rộng cho module mới
Mỗi module mới chỉ cần:
1. Thêm document mới vào `app_products`
2. Thêm document mới vào `app_prompts` (cùng productId)
3. Tạo license keys mới với productId tương ứng
4. API endpoints dùng chung, không cần sửa code backend
