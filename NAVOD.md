# HƯỚNG DẪN TRIỂN KHAI — Web objednávka VOPH

Hướng dẫn từng bước cho người chưa từng dùng GitHub. Làm theo thứ tự 1 → 6.

---

## Tổng quan hệ thống

- **GitHub Pages** — chứa web (miễn phí, không cần server).
- **GitHub Actions** — mỗi đêm 2:15 tự cập nhật từ file Levior đã commit trong repo, 2:30 tự tải feed từ voph.cz — cả hai cùng ghi vào `products.json`.
- **Google Apps Script** — nhận đơn hàng, gửi email xác nhận (PDF) cho khách + email kèm file Excel cho info@voph.cz (miễn phí, tối đa ~100 email/ngày).
- **Subdomain** — ví dụ `objednavky.voph.cz` trỏ về GitHub Pages.

---

## Bước 1 — Tạo tài khoản + repo GitHub

1. Vào **github.com** → *Sign up* (nếu chưa có tài khoản).
2. Bấm nút **+** (góc phải trên) → **New repository**.
3. Repository name: `objednavky` · chọn **Public** · bấm **Create repository**.

## Bước 2 — Tải các file của web lên

1. Trong repo mới, bấm **uploading an existing file** (hoặc *Add file → Upload files*).
2. Kéo thả TOÀN BỘ các file của dự án này:
   - `index.html`, `Objednavka.dc.html`, `support.js`
   - `config.js`, `products.json`, `products.js`, `tags.json`, `prices.json`, `groups.json`, `packs.json`
   > Đơn giản nhất: tải toàn bộ dự án về (nút Download) rồi kéo thả **tất cả** file/thư mục lên — thừa còn hơn thiếu.
   - `translate-vi.js`, `order-xlsx.js`, `xlsx-import.js`
   - thư mục `scripts/` (file `update-feed.mjs`)
3. Bấm **Commit changes**.
4. Riêng file workflow phải tạo đúng đường dẫn: *Add file → Create new file*, gõ tên
   `.github/workflows/update-feed.yml` (GitHub tự tạo thư mục khi gõ dấu `/`),
   dán nội dung file `update-feed.yml` trong dự án này → **Commit changes**.

## Bước 3 — Bật GitHub Pages

1. Trong repo: **Settings → Pages**.
2. Mục *Build and deployment* → Source: **Deploy from a branch** → Branch: **main** / **(root)** → **Save**.
3. Đợi ~2 phút, web chạy tại `https://TÊN-CỦA-BẠN.github.io/objednavky/`.
   Mở thử — phải thấy danh sách sản phẩm.

## Bước 4 — Kiểm tra GitHub Actions (feed tự động)

1. Trong repo: tab **Actions** → nếu hỏi thì bấm **Enable workflows**.
2. Chọn workflow **Aktualizace feedu** → bấm **Run workflow** để chạy thử ngay.
3. Chạy xong (dấu ✓ xanh) → file `products.json` đã được cập nhật từ feed.
   Từ nay mỗi đêm 2:30 (giờ Séc) sẽ tự chạy, không cần làm gì thêm.
   > Lưu ý: nếu repo không có commit nào trong 60 ngày, GitHub tự tắt cron —
   > sẽ có email nhắc, chỉ cần bấm *Enable* lại.

## Bước 5 — Email tự động (Google Apps Script)

1. Vào **script.google.com** (đăng nhập Gmail — nên dùng Gmail của công ty).
2. **New project** → xoá code mẫu → dán toàn bộ nội dung file `apps-script/Code.gs`.
3. Đặt tên project (VD "VOPH objednavky") → 💾 Save.
4. Chạy thử: chọn hàm **testEmail** → **Run** → cấp quyền khi được hỏi
   (Advanced → Go to … → Allow). Kiểm tra hộp thư — phải nhận được email test có PDF.
5. **Deploy → New deployment** → ⚙️ chọn **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - **Deploy** → copy **Web app URL** (dạng `https://script.google.com/macros/s/…/exec`).
6. Mở file `config.js` trong repo GitHub (bấm vào file → ✏️ Edit), dán URL vào:
   ```js
   appsScriptUrl: "https://script.google.com/macros/s/…/exec",
   ```
   → **Commit changes**.
7. Từ giờ khi khách bấm *Odeslat*: khách nhận email xác nhận + PDF,
   info@voph.cz nhận đơn kèm file Excel.
   > Nếu sau này sửa Code.gs, phải **Deploy → Manage deployments → ✏️ → New version**
   > thì thay đổi mới có hiệu lực (URL giữ nguyên).

## Bước 6 — Subdomain objednavky.voph.cz

1. Vào trang quản trị DNS của tên miền voph.cz (nơi mua domain — VD Wedos, Forpsi…).
2. Thêm bản ghi **CNAME**:
   - Name/Host: `objednavky`
   - Value/Target: `TÊN-CỦA-BẠN.github.io`
   - TTL: mặc định.
3. Trong repo GitHub: **Settings → Pages** → *Custom domain*: gõ `objednavky.voph.cz` → **Save**.
4. Đợi DNS lan truyền (vài phút đến vài giờ). Khi GitHub báo ✓, tick **Enforce HTTPS**.
5. Xong — web chạy tại **https://objednavky.mujoneshop.cz**.

---

## Vận hành hằng ngày

- **Không cần làm gì** — feed tự cập nhật mỗi đêm, đơn hàng tự gửi email.
- Sửa email nhận đơn / đơn tối thiểu: sửa `config.js` trên GitHub → Commit.
- **Quản trị (admin):** mở file **`admin.html`** trực tiếp trên máy tính của bạn (nháy đúp là mở trong trình duyệt) — **KHÔNG upload file này lên GitHub**, nhờ đó khách tuyệt đối không thể vào admin. Trang admin tự tải dữ liệu từ web, cho import giá/nhãn/danh mục và tải ra file JSON để upload lên GitHub.
- **Giá bán (prodejní cena netto):** feed voph.cz KHÔNG ghi đè giá — mở `admin.html` → khối *Prodejní ceny* → Import .xlsx/.csv (cột A = EAN, B = giá netto) → **Stáhnout prices.json** → upload ghi đè `prices.json` trên GitHub.
- **Khuyến mãi / nhãn (akce, sleva, bestseller, výprodej):** mở `admin.html` → khối *Akce & štítky* → Import file .xlsx/.csv (cột A = EAN, B = loại nhãn, C = giá khuyến mãi s DPH). Có thể lọc, sửa giá, bật/tắt, xóa từng nhãn. Sau đó bấm **Stáhnout tags.json** và upload ghi đè `tags.json` lên GitHub.
- **Nhóm hàng (groups.json):** file `groups.json` lưu danh mục **2 cấp** cho mọi mặt hàng, dạng `{"_order":[...], "items":{"EAN":["cấp 1","cấp 2"]}}`. Web **chỉ hiện cấp 1**, sắp xếp đúng theo thứ tự trong `_order`; cấp 2 chỉ lưu trong file để dùng sau. Muốn đổi thứ tự nhóm trên web → sửa mảng `_order`. Muốn đổi nhóm từng mặt hàng → `admin.html` → khối *Nhóm hàng* → **Stáhnout groups.json** → upload ghi đè.
- **Počet ks v balení (packs.json):** lấy từ file `data k2.xlsx` (cột D *Počet ks v bal*, cột O *Jednotka*), dạng `{"items":{"EAN":[số ks, đơn vị]}}`. File này **luôn thắng** số lượng đóng gói lấy từ feed nhà cung cấp — vì feed hay ghi số lượng cả thùng (vd. bit 1000 ks) chứ không phải cách bán thực tế. Web hiện `balení 12 ks` khi > 1, và hiện `jednotka: metr` khi đơn vị khác `ks`. Muốn cập nhật: chạy lại từ `data k2.xlsx` rồi upload ghi đè `packs.json`. Feed đêm không đụng tới file này.
- **Danh mục hàng (products.json):** nguồn chuẩn là **`cenik b2bdmoc.xlsx`** (export ERP: A mã voph, B EAN, C tên, D giá bán netto, E nhà cung cấp, F mã nhà sản xuất, G số ks/hộp). Khi có ceník mới: đặt file vào gốc repo rồi chạy tay `node scripts/build-catalog.mjs`. Script nối mã NSX vào cuối tên, giữ nguyên ảnh và nhóm của hàng đã có, và **giữ lại** hàng đang bán mà ceník không còn.
- **Giá bán — tự động 4:15 mỗi ngày** (`scripts/update-prices.mjs`): lấy theo feed voph.cz. Mặt hàng không có trong feed thì **giữ nguyên giá cũ**.
- **Tồn kho — tự động 4:25 mỗi ngày** (`scripts/update-stock.mjs`): lấy theo feed voph.cz. Mặt hàng không có trong feed thì **về 0** (web hiện "7-14 ngày").
- **Ảnh và số ks/hộp:** chỉ gán MỘT LẦN lúc chạy `build-catalog.mjs`, sau đó không tự đổi. Muốn bổ sung ảnh: điền vào sheet *Bez obrázku* của file `katalog cenik kontrola.xlsx` rồi báo để nạp lại.
- Cập nhật feed ngay lập tức: tab **Actions → Run workflow**.
- **Feed Levior (mỗi đêm 2:15):** GitHub Actions không đọc được file trên máy tính cá nhân — cần **commit file `levior-feed.xlsx` vào gốc repo mỗi ngày** (đúng tên này, đúng bố cục cột như bản mẫu "levior all.xlsx": C tên, F số lượng/hộp, G đơn vị, I EAN, K nhóm hàng, N tồn kho, O ảnh, R DPH%, AF giá mua netto). Workflow tự đọc file này lúc 2:15, chỉ lấy mặt hàng còn tồn kho (N > 0), gộp vào `products.json`. Chưa commit file thì bước này tự bỏ qua, không lỗi.
- **Giá bán khi hàng Levior chưa có giá:** tự tính = giá mua netto (cột AF) × (1 + % marže theo bảng): <20 Kč → 55%, 20–50 → 50%, 50–100 → 40%, 100–200 → 35%, 200–400 → 30%, ≥400 → 25%. Hàng đã có giá (đặt tay qua `admin.html`) thì giữ nguyên, feed không ghi đè.
- **Quét mã vạch bằng camera**: chạy tốt trên Chrome/Edge Android; cần HTTPS (GitHub Pages + subdomain đã bật HTTPS là đủ). Safari/iPhone hiện chưa hỗ trợ — web sẽ hiện thông báo và khách vẫn tìm tay bình thường.
- Khách cũng luôn nhận dữ liệu mới nhất vì web tự tải feed khi mở trang
  (tắt bằng `feedAutoDefault: false` trong `config.js` nếu muốn chỉ dùng products.json).

## Sự cố thường gặp

| Vấn đề | Cách xử lý |
|---|---|
| Web trắng trơn | Đợi 2 phút sau khi bật Pages; kiểm tra Settings → Pages có link xanh |
| Không có sản phẩm | Chạy Actions → Run workflow; xem log lỗi nếu ✗ đỏ |
| Không nhận được email | Kiểm tra Spam; chạy lại testEmail trong Apps Script; kiểm tra URL trong config.js |
| Hết quota email (100/ngày) | Nâng cấp Google Workspace (1500/ngày) hoặc đổi giải pháp gửi mail |
| Subdomain không chạy | Kiểm tra bản ghi CNAME; đợi DNS; thử https://dnschecker.org |
