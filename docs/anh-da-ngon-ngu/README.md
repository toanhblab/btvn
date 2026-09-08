# Ảnh chụp ba nhà demo (issue #46)

Chụp từ `next dev` trên PGlite local sau `npm run db:seed && npm run db:seed:demo`,
cỡ 1440×900 (Macbook) trừ khi tên tệp ghi khác. Tiền tố tệp = ngôn ngữ của nhà:
`ja` = PIN 1111, `ko` = PIN 2222, `en` = PIN 3333, `vi` = nhà thật (PIN 1234).

- `flow-doi-ngon-ngu-bang-pin.gif` — luồng đổi ngôn ngữ **chỉ bằng nhập PIN**:
  màn PIN (tiếng Việt) → 1111 → tổng quan + màn chọn con tiếng Nhật → đóng phiên bố
  mẹ (`DELETE /api/pin`, tương đương đóng trình duyệt) → màn PIN (giờ đã tiếng Nhật,
  vì máy gắn với nhà Nhật) → 2222 → tiếng Hàn → 3333 → tiếng Anh. Khi đi demo, cách
  nhảy nhà nhanh nhất là mở `/nha/demo-ja`, `/nha/demo-ko`, `/nha/demo-en`. Mỗi khung một giây (`ffmpeg -framerate 1`, có palettegen/paletteuse).
- `*-bome-*.png` — màn của bố mẹ: tổng quan, thưởng (duyệt / trừ ⭐ / danh sách),
  nhiệm vụ hàng ngày, thêm bài, cài đặt, danh sách bài, chi tiết con.
  `ja-bome-dien-thoai.png`, `ja-bome-thuong-dien-thoai.png` ở cỡ điện thoại 430×932.
- `*-con-*.png` — màn của con: chọn tên, bài hôm nay, chi tiết bài, cửa hàng
  phần thưởng. `ko-con-ipad.png` ở cỡ iPad 1180×820.
