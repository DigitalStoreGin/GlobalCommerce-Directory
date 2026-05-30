# 🔥 Hướng dẫn triển khai Firebase — GlobalCommerce Intelligence

## Tổng quan thay đổi

| Module       | Trước (v3)              | Sau (v4 Firebase)                   |
|--------------|-------------------------|-------------------------------------|
| `auth.js`    | localStorage + SHA-256  | Firebase Authentication             |
| `favorites.js` | localStorage          | Firestore (real-time sync)          |
| `index.html` | Username/password form  | Email/password form                 |
| `main.css`   | Không thay đổi          | +3 dòng CSS cho "Quên mật khẩu"    |
| `app.js`     | Sync reads/writes       | Async writes, sync reads (cache)    |

---

## BƯỚC 1 — Tạo Firebase Project

1. Truy cập **https://console.firebase.google.com**
2. Nhấn **"Add project"** → nhập tên project (ví dụ: `globalcommerce-db`)
3. Tắt Google Analytics (không cần thiết) → **Create project**
4. Chờ project được tạo → nhấn **Continue**

---

## BƯỚC 2 — Bật Firebase Authentication

1. Trong Firebase Console, vào **Authentication** (menu trái)
2. Nhấn **"Get started"**
3. Chọn tab **"Sign-in method"**
4. Nhấn **"Email/Password"** → bật toggle **"Enable"** → **Save**

> ✅ Bật **Email/Password** là đủ. Không cần bật "Email link" (passwordless).

---

## BƯỚC 3 — Tạo Firestore Database

1. Trong Firebase Console, vào **Firestore Database** (menu trái)
2. Nhấn **"Create database"**
3. Chọn **"Start in production mode"** (rules sẽ được cấu hình ở bước sau)
4. Chọn **vị trí server** phù hợp:
   - `europe-west1` (Belgium) — gần nhất nếu users chủ yếu ở EU
   - `asia-southeast1` (Singapore) — nếu users ở Đông Nam Á
   - `us-central1` — mặc định chung
5. Nhấn **"Enable"**

---

## BƯỚC 4 — Cấu hình Firestore Security Rules

1. Trong **Firestore Database** → tab **"Rules"**
2. Xóa toàn bộ nội dung cũ
3. Dán nội dung từ file `firestore.rules` (đã có trong package)
4. Nhấn **"Publish"**

**Nội dung rules:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /favorites/{favId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## BƯỚC 5 — Đăng ký Web App & Lấy Config

1. Trong Firebase Console → **Project Settings** (icon ⚙️ trên menu trái)
2. Chọn tab **"General"** → kéo xuống phần **"Your apps"**
3. Nhấn icon **`</>`** (Web app)
4. Nhập tên app: `GlobalCommerce Web`
5. **KHÔNG** check "Also set up Firebase Hosting" (bạn dùng GitHub Pages)
6. Nhấn **"Register app"**
7. Copy object `firebaseConfig` hiển thị — ví dụ:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "globalcommerce-db.firebaseapp.com",
  projectId: "globalcommerce-db",
  storageBucket: "globalcommerce-db.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefabcdef"
};
```

---

## BƯỚC 6 — Cập nhật `firebase-config.js`

Mở file `firebase-config.js` và thay thế các giá trị placeholder bằng config thực của bạn:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSyXXXXXXXXXXXXXXXXXXXXXX",  // ← thay bằng key thật
  authDomain:        "globalcommerce-db.firebaseapp.com",
  projectId:         "globalcommerce-db",
  storageBucket:     "globalcommerce-db.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdefabcdef"
};
```

> ⚠️ **Lưu ý bảo mật**: Firebase API key trong web app là công khai theo thiết kế — nó chỉ xác định project của bạn. Bảo mật thực sự nằm ở **Firestore Security Rules** đã cấu hình ở Bước 4.

---

## BƯỚC 7 — Cấu hình Authorized Domains

1. Vào **Authentication** → tab **"Settings"** → **"Authorized domains"**
2. Nhấn **"Add domain"**
3. Thêm domain GitHub Pages của bạn: `yourusername.github.io`
4. Nếu dùng custom domain, thêm cả domain đó

> Nếu bỏ qua bước này, Firebase sẽ chặn đăng nhập từ GitHub Pages với lỗi `auth/unauthorized-domain`.

---

## BƯỚC 8 — Upload lên GitHub Pages

```bash
# Đảm bảo upload đủ các file sau:
index.html          ← đã cập nhật (form dùng email)
main.css            ← đã cập nhật (CSS cho forgot password)
app.js              ← đã cập nhật (async Firebase operations)
auth.js             ← ĐÃ VIẾT LẠI (Firebase Auth)
favorites.js        ← ĐÃ VIẾT LẠI (Firestore)
firebase-config.js  ← MỚI (điền config của bạn vào trước khi upload)
theme.js            ← không thay đổi
europe.js           ← không thay đổi
asia.js             ← không thay đổi
americas.js         ← không thay đổi
africa_me.js        ← không thay đổi
oceania.js          ← không thay đổi
digital.js          ← không thay đổi
```

> ⚠️ **KHÔNG upload** `firestore.rules` — file này chỉ dùng để paste vào Firebase Console.

---

## BƯỚC 9 — Kiểm tra sau khi deploy

1. Mở website trên GitHub Pages
2. Mở DevTools (F12) → Console — không có lỗi đỏ Firebase
3. Nhấn **"Đăng ký"** với email thật
4. Sau khi đăng ký, mở **Incognito tab** → đăng nhập lại
5. Thêm 1-2 sàn vào yêu thích
6. Mở tab bình thường → yêu thích phải xuất hiện ✅
7. Thử trên điện thoại — data phải sync ✅

---

## Kiểm tra Firebase Console

- **Authentication → Users**: xem danh sách tài khoản đã đăng ký
- **Firestore → Data**: xem `users/{uid}/favorites` của từng user

---

## Spark Plan — Giới hạn miễn phí (đủ cho 10–50 users)

| Tài nguyên             | Giới hạn Spark (miễn phí)  |
|------------------------|----------------------------|
| Firestore reads/ngày   | 50.000                      |
| Firestore writes/ngày  | 20.000                      |
| Firestore deletes/ngày | 20.000                      |
| Auth users             | Không giới hạn              |
| Lưu trữ Firestore      | 1 GiB                       |

50 users × 200 reads/ngày = 10.000 reads → **an toàn trong Spark Plan** ✅

---

## Xử lý sự cố thường gặp

### `auth/unauthorized-domain`
→ Chưa thêm domain vào **Authentication → Settings → Authorized domains** (xem Bước 7)

### `FirebaseError: Missing or insufficient permissions`
→ Firestore rules chưa được publish (xem Bước 4)

### `Firebase: Error (auth/invalid-api-key)`
→ `firebase-config.js` chưa điền đúng config (xem Bước 6)

### Stars không lưu sau khi nhấn
→ Kiểm tra Console có lỗi Firebase không; thường do rules hoặc chưa đăng nhập

### Data cũ từ localStorage không mất
→ Bình thường — localStorage của v3 vẫn còn nhưng không được đọc nữa. User cần nhập lại JSON export nếu muốn chuyển data cũ.

---

## Chuyển dữ liệu cũ từ localStorage

Nếu user đã có dữ liệu trong v3 (localStorage):

1. **Trước khi deploy**, mở website v3 cũ
2. Vào **Yêu thích** → nhấn **"Xuất JSON"** → tải file về
3. Sau khi deploy v4 Firebase, đăng nhập tài khoản mới
4. Vào **Yêu thích** → nhấn **"Nhập JSON"** → chọn file vừa tải

---

*Tạo bởi GlobalCommerce Intelligence · Firebase Migration v4.0*
