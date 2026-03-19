# MarkSave — Lưu nội dung web thành Markdown

Chrome Extension cho phép click chuột phải để lưu nội dung web (hoặc toàn trang) thành file `.md` vào thư mục trên máy tính của bạn.

## Tính năng

- Click chuột phải → chọn thư mục → lưu ngay, không cần thao tác thêm
- Hỗ trợ lưu **đoạn văn bản đã bôi đen** hoặc **toàn bộ nội dung trang**
- Cấu hình nhiều thư mục, chuyển đổi thư mục lưu ngay trên menu
- Tự động thêm YAML frontmatter (tiêu đề, URL nguồn, ngày lưu)
- Template tên file tùy chỉnh: `{title}`, `{date}`, `{domain}`, `{time}`

---

## Cài đặt

### Yêu cầu
- Google Chrome phiên bản **86 trở lên**
- Hệ điều hành: **Windows**, **macOS**, hoặc **Linux** (File System Access API không hỗ trợ Android)

---

### Bước 1 — Tải source code

**Cách A: Clone bằng Git**
```bash
git clone https://github.com/tien243/marksave-extension.git
```

**Cách B: Tải ZIP**

Vào [trang GitHub](https://github.com/tien243/marksave-extension) → nhấn nút **Code** → **Download ZIP** → giải nén ra thư mục bất kỳ.

---

### Bước 2 — Mở trang quản lý Extension

Trên thanh địa chỉ Chrome, gõ:
```
chrome://extensions
```
Nhấn **Enter**.

---

### Bước 3 — Bật chế độ Developer

Góc trên bên phải, bật công tắc **Developer mode**.

![Developer mode](https://i.imgur.com/placeholder.png)

---

### Bước 4 — Load Extension

Nhấn nút **Load unpacked** → chọn thư mục **`dist`** bên trong thư mục vừa tải về.

> ⚠️ Chọn đúng thư mục `dist/`, không phải thư mục gốc `marksave-extension/`.

---

### Bước 5 — Cấu hình thư mục lưu

1. Click vào icon **MarkSave** trên thanh công cụ Chrome
2. Nhấn **Mở Cài đặt**
3. Trong trang Cài đặt, nhấn **+ Thêm thư mục**
4. Chọn thư mục trên máy tính muốn lưu file Markdown
5. Nhấn **Lưu cài đặt**

> 💡 Bước cấu hình chỉ cần làm **một lần duy nhất**.

---

## Sử dụng

### Lưu đoạn văn bản đã chọn
1. Bôi đen nội dung muốn lưu trên trang web
2. Click chuột phải → **Lưu selection thành Markdown** → chọn thư mục

### Lưu toàn bộ trang
1. Click chuột phải vào vùng trống trên trang → **Lưu trang thành Markdown** → chọn thư mục

File `.md` sẽ được tạo ngay trong thư mục bạn đã chọn.

---

## Build từ source (tuỳ chọn)

Nếu muốn tự build thay vì dùng thư mục `dist/` có sẵn:

```bash
cd marksave-extension
npm install
npm run build
```

Sau đó load thư mục `dist/` vào Chrome như Bước 4.

---

## Lưu ý

- Sau khi **khởi động lại Chrome**, extension có thể yêu cầu cấp lại quyền truy cập thư mục. Vào **Cài đặt → Cấp quyền** để xác nhận lại.
- Extension không upload dữ liệu lên bất kỳ server nào — mọi thứ chạy hoàn toàn cục bộ trên máy.
