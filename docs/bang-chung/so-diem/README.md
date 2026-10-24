# Bằng chứng: Sổ ⭐ của từng con + bố mẹ thưởng / trừ ⭐

Chụp trên hai dev server cục bộ chạy **cùng một bản sao dữ liệu** (PGlite):
`main` (ea7f0ee) ở cổng 3001 cho ảnh `*-truoc.png`, nhánh này ở cổng 3000 cho
ảnh `*-sau.png`. Chrome thật (Playwright, `channel: 'chrome'`), cỡ màn đặt bằng
device-metrics (`viewport` + `deviceScaleFactor` + `isMobile`/`hasTouch`), và mỗi
lượt in lại `innerWidth` để chắc cỡ đúng — xem `hit-test.txt`.

**Dữ liệu XẤU NHẤT** (AGENTS.md), dựng bằng chính API của app (`/api/children`,
`/api/thuong-diem`, `/api/tru-diem`) trước khi chụp: **5 con** (hơn 3), hai tên dài
("Nguyễn Hoàng Bảo Khang Minh Quân", "Trần Ngọc Phương Anh Thư"), ⭐ tới **bốn chữ
số** (1006), lý do thưởng dài 68 ký tự.

Nút "N" / "Rendering…" của `next dev` được ẩn trong ảnh và trong hit-test — nó chỉ
có ở máy dev, không phải giao diện app.

| Ảnh | Nội dung |
| --- | --- |
| `{iphone,ipad,macbook}-chon-con-{truoc,sau}.png` | Màn "Hôm nay con là ai?": viên ⭐ dưới tên giờ là nút riêng (có `›`) vào sổ ⭐ |
| `{iphone,ipad,macbook}-so-diem.png` | Sổ ⭐ của con tên dài: đầu sổ "Con có N ⭐", nút Đổi thưởng, từng dòng +/− theo ngày |
| `{iphone,ipad}-bome-thuong-{truoc,sau}.png` | Bố mẹ › Thưởng, ô đã mở: trước chỉ có trừ; sau có hai nút ➕ Thưởng ⭐ / ➖ Trừ ⭐ |
| `iphone-luong-1..3-*.png` | Luồng thật trên iPhone: bố mẹ gõ 5, chọn "Giúp bố mẹ việc nhà", bấm "Thưởng 5 ⭐ cho …" → 508 → 513 ⭐ → con mở sổ thấy dòng +5 ⭐ |
| `hit-test.txt` | Kết quả hit-test (`elementFromPoint` lưới 4×4 trên mỗi nút sau `scrollIntoView`) + `scrollWidth` so `innerWidth` cho mọi màn × mọi cỡ |

Ảnh điện thoại là **giả lập** — chưa có người xác nhận trên máy thật.
