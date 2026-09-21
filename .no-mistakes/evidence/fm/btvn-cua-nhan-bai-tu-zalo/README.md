# Bằng chứng bước TEST — cửa nhận bài từ Zalo + màn duyệt của bố mẹ

Chạy 2026-09-21 trên `next dev -p 3260` của chính worktree này (`localhost`, KHÔNG
dùng `127.0.0.1` — Next 16 chặn cross-origin dev request thì React không hydrate),
DB dev PGlite, `ZALO_INTAKE_SECRET` là khoá giả. Máy dev chưa có `NOUS_API_KEY`
nên bộ tách bài chạy đường lui `splitByRule` (tách thô theo dòng) — đó là đường
lui sẵn có của `/api/extract`, không phải hành vi riêng của cửa nhận.

Dữ liệu là **dữ liệu xấu nhất** theo AGENTS.md (`node scripts/du-lieu-xau-nhat.mjs`):
4 con, tên dài ("Nguyễn Hoàng Minh Khôi"…), ⭐ ba chữ số (420/370/150/110).
Cỡ điện thoại dùng `emulate --viewport "390x844x3,mobile,touch"` và `innerWidth`
được kiểm lại là **390** trước khi chụp (`resize` cho ra 500px — lỗi #56).

## Tệp

| Tệp | Cho thấy |
| --- | --- |
| `15-zalo-agent-transcript.txt` | Toàn bộ hợp đồng máy-gọi chạy thật bằng `curl`: 401 khi thiếu/sai khoá · `GET cau-hinh` trả hai nguồn + con của từng nguồn + `gioi_han` · xin vé rồi **tải tệp thẳng lên kho** (chế độ dev multipart → `/api/tep/<hex>`) · vé bị từ chối 422 khi tệp gửi ngoài cửa sổ 90 phút và khi thiếu mốc giờ · `POST` gói tin trả **201** kèm `tep_bo_qua` (một `.docx` + một url kho lạ bị bỏ RIÊNG, tin vẫn vào) · quét lại cùng `ma_tin` → **409 ở cả cửa vé lẫn cửa nhận** · gói **12 ảnh** → 201, giữ 10 tệp đầu, 2 tệp dư vào `tep_bo_qua` với lý do `qua-nhieu-tep` (không còn 400 cả gói) |
| `16-trang-thai-csdl-sau-khi-nhan.txt` | Trạng thái CSDL sau khi nhận: bài sinh ra là `trang_thai_duyet = 'nhap'` cho **cả hai con** của nguồn; `nhan_dien` lưu nguyên; và **`han_xoa` = 2026-10-21 = NGÀY NHẬN + 30** cho tin mà cô gõ ngày `2026-06-01` — tức hạn xoá đếm từ lúc tệp vào kho, không từ ngày trong tin (nếu đếm từ ngày trong tin thì tệp đã hết hạn ngay lúc ghi) |
| `01-390-bome-tong-quan.png` | Trang chủ bố mẹ, 390px — thẻ "2 tin cô giao bài, chờ duyệt / Duyệt thì các con mới thấy bài" |
| `02-390-zalo-cho-duyet.png`, `03-…-ca-trang.jpeg` | `/bome/zalo` ở 390px: tên nhóm, tên cô, **ngày giờ gửi**, "ngày học thứ 40", cờ **"Luật khớp"**, nguyên văn tin giữ xuống dòng + "Xem cả tin (849 chữ)", hai tệp cô gửi (video phát được, ảnh xem được), khối đỏ "2 tệp cô gửi không vào được" kèm lý do đọc được, rồi bài nháp theo từng con |
| `05-390-nut-duyet-mot-cham.png` | Nút duyệt MỘT CHẠM: "Duyệt 20 bài cho các con", cạnh nút "Không phải bài" |
| `06-390-sau-khi-duyet-con-tin-thu-hai.png`, `07-…-ca-trang.jpeg` | Sau khi bấm Duyệt: mục đó biến mất, còn lại tin thứ hai — và tin này hiện mặt cờ khác: **"Jev cho là giao bài (81%), luật không khớp — soi kỹ"** |
| `04-390-man-con-truoc-khi-duyet.png` | Màn của con TRƯỚC khi duyệt: `0/9 xong hôm nay`, không có bài nào của cô (nháp không hiện cho con) |
| `08-390-man-con-sau-khi-duyet.png` | Cùng màn đó SAU khi duyệt: `0/19 xong hôm nay`, danh sách có bài của cô kèm "Có video, ảnh cô gửi" |
| `11-1440-zalo-cho-duyet.png`, `12-…-ca-trang.jpeg` | Cùng màn ở cỡ Macbook 1440×900 (thanh bên trái 260px), video chạy được (`0:00 / 0:03`), ảnh worksheet hiện |
| `13-1440-nguon-zalo.png`, `14-390-nguon-zalo.png` | Mục "Nhóm Zalo": hai nguồn, tên cô, chip chọn con của từng lớp, cửa sổ nhận tệp 90 phút, **Mã nhóm** (`g6948…` do máy ở nhà tự điền; nguồn chưa nhận bài ghi "chưa có"), **Nhận bài gần nhất**, công tắc bật/tắt, nút "Thêm nhóm Zalo" |

## Hit-test trong trang (việc này đụng bố cục)

`el.scrollIntoView()` rồi `document.elementFromPoint()` trên lưới 3×3 điểm trong
`getBoundingClientRect()` của MỌI `button / a / input / textarea / [role=switch]`,
sau khi gỡ `<nextjs-portal>` (huy hiệu dev, không có trên bản deploy):

| Màn | Cỡ | Phần tử | Điểm trúng | Tràn ngang |
| --- | --- | --- | --- | --- |
| `/bome/zalo` | 390×844 | 80 | **720 / 720** | không |
| `/bome/zalo` | 1440×900 | 81 | **729 / 729** | không |

## Điều KHÔNG chứng minh được ở đây

- **Máy thật**: mọi ảnh là giả lập Chrome. Việc đụng giao diện điện thoại vẫn cần
  người xác nhận trên máy thật trước khi đóng việc (luật của dự án, tiền lệ PR #58).
- **Vercel Blob thật**: máy dev không có `BLOB_READ_WRITE_TOKEN` nên luồng tệp chạy
  đường lui dev (multipart → `.data/uploads` → `/api/tep/<hex>`). Vì thế phép ghim
  đường dẫn `zalo/<nguon>/<ngày>/` của cửa vé chỉ được chạy ở test đơn vị
  (`lib/nhan-bai-zalo.test.ts`, `lib/zalo.test.ts`), không chạy được qua HTTP ở đây:
  nhánh cấp vé trả 501 `chua-bat-vercel-blob` trước khi tới phép kiểm đường dẫn.
- Bài nháp của tin có `ngay_trong_tin` = hôm nay có hạn nộp **ngày mai**, nên sau
  khi duyệt màn của con chưa hiện chúng — đúng luật #62 (bài từ ngày mai không vẽ),
  không phải lỗi.
