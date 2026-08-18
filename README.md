# BTVN — Bài tập về nhà

Một chỗ duy nhất để bố mẹ đưa bài tập vào, và các con tự xem — tự tick hoàn thành.
Xem [PRD.md](PRD.md) để biết bối cảnh và phạm vi.

Hai phần trong cùng một app:

| Phần | Đường dẫn | Thiết bị | Đăng nhập |
| --- | --- | --- | --- |
| Của các con | `/con` | iPad (nằm ngang) | Không cần |
| Của bố mẹ | `/bome` | Điện thoại | Một mã PIN dùng chung |

## Chạy thử

```bash
npm install
npm run db:seed      # tạo bảng + 3 con + bài tập mẫu, PIN mặc định 1234
npm run dev
```

Mở http://localhost:3000 → vào thẳng màn chọn con. Nút "Bố mẹ" ở góc dưới phải
dẫn sang phần của bố mẹ.

Đổi PIN khi seed: `PARENT_PIN=8520 npm run db:seed`

## Biến môi trường

Chưa có biến nào thì app vẫn chạy đầy đủ bằng dữ liệu local — chỉ phần đọc ảnh
bằng AI là chưa hoạt động. Đặt vào `.env.local`:

| Biến | Chưa có thì sao | Lấy ở đâu |
| --- | --- | --- |
| `DATABASE_URL` | Dùng PGlite lưu ở `.data/pg` trên máy | Vercel → Storage → Neon |
| `BLOB_READ_WRITE_TOKEN` | Ảnh nhúng thẳng vào trang, chỉ hợp để thử | Vercel → Storage → Blob |
| `NOUS_API_KEY` | Tách bài tạm theo dòng, có cảnh báo rõ cho bố mẹ | portal.nousresearch.com |
| `NOUS_MODEL` | Dùng `qwen/qwen3-vl-32b-instruct` — **phải là model có vision** | Danh sách ở `/v1/models` |
| `PIN_SECRET` | Dùng chuỗi mặc định — **phải đổi trước khi deploy** | Tự đặt |

Đổi `DATABASE_URL` là chuyển hẳn sang Neon, không phải sửa dòng code nào —
`schema.sql` chạy được trên cả hai.

## Cấu trúc

```
app/con/        4 màn của trẻ: chọn con → bài hôm nay → chi tiết → chúc mừng
app/bome/       7 màn của bố mẹ: PIN, tổng quan, thêm bài, kiểm tra lại,
                nhập tay, chi tiết theo con, danh sách, cài đặt
app/api/        children, assignments, pin, extract (Nous Portal), upload (Blob)
lib/            db (Neon|PGlite), store (truy vấn), auth (PIN), ai, types
proxy.ts        chặn /bome/* khi chưa nhập PIN
schema.sql      5 bảng, bám PRD mục 7
stitch/         bản Stitch gốc của phần trẻ (đối chiếu)
stitch-parent/  bản Stitch gốc của phần bố mẹ + design system
legacy-static/  bản HTML/JS thuần đầu tiên của phần trẻ, giữ để tham chiếu
```

## Vài điểm đáng lưu ý

**Hai bé sinh đôi.** Nhập một lần ra bài **riêng cho từng bé** — cùng đề nhưng
mỗi bé một bản ghi, tick độc lập, xoá bài của bé này không ảnh hưởng bé kia.
Màn "Thêm bài tập" tick sẵn cả hai bé lớp 1 vì đây là trường hợp dùng nhiều nhất.

**Giọng đọc.** Mỗi bài có trường `lang` (`vi`/`en`) quyết định giọng đọc thành
tiếng. Bé 4 tuổi chưa đọc được chữ nào nên nút 🔊 gần như là cách duy nhất để
biết phải làm gì — đọc đề tiếng Anh bằng giọng Việt thì bé nghe không hiểu.
Bố mẹ sửa được trường này ở màn "Kiểm tra lại".

**Không bao giờ để bố mẹ bị kẹt.** AI hỏng, hết quota hay chưa có key thì vẫn
tách tạm theo dòng kèm cảnh báo, và luôn có đường "Nhập tay từng bài".

**PIN trên iPad.** Ô "Nhớ trên thiết bị này" mặc định **không** tick. iPad là máy
dùng chung của các con — nhớ PIN ở đó thì PIN mất tác dụng. Trót tick rồi thì
vào Cài đặt → "Quên PIN trên thiết bị này".

**Riêng tư.** App chạy trên internet công khai còn màn của con không đăng nhập,
nên toàn site đặt `noindex`, và mỗi gia đình có `slug` ngẫu nhiên làm đường dẫn
khó đoán.

## Trước khi deploy

1. Đặt các biến môi trường trên Vercel, đặc biệt `PIN_SECRET`.
2. Chạy `schema.sql` trên Neon, rồi seed lại với PIN thật.
3. Kiểm tra trên **iPad thật** (giọng `vi-VN` có sẵn không, vùng bấm có vừa
   ngón tay trẻ con không) và **điện thoại thật**. Không thay thế được bằng máy tính.
