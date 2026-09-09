# Ảnh chụp ba nhà demo (issue #46)

Chụp từ `next dev` trên PGlite local sau `npm run db:seed && npm run db:seed:demo`,
cỡ 1440×900 (Macbook) trừ khi tên tệp ghi khác. Tiền tố tệp = ngôn ngữ của nhà:
`ja` = PIN 1111, `ko` = PIN 2222, `en` = PIN 3333, `vi` = nhà thật (PIN 1234).

Ảnh động `flow-doi-ngon-ngu-bang-pin.gif` **đã xoá**: nó quay ở commit dc30049, khi
nhập PIN demo còn gắn máy vào nhà demo, nên nó chiếu đúng cái hành vi sau đó đã bỏ
(và lời mô tả kèm theo cũng sai theo). Không giữ ảnh chiếu hành vi đã bỏ, kể cả khi
có chú thích đính chính — người xem tin vào khung hình chứ không đọc chú thích.

Luồng đúng ở bản hiện tại, nếu muốn quay lại:

- **Nhập PIN demo chỉ mở PHIÊN bố mẹ, không gắn máy.** Màn PIN → 1111 → phần bố mẹ
  và màn chọn con hiện tiếng Nhật. Hết phiên (đóng trình duyệt, hoặc không tick "Nhớ
  trên thiết bị này") thì máy trở lại nhà cũ — nên màn PIN quay về **tiếng Việt**,
  không phải tiếng Nhật. Gõ 1111 ở màn "Đây là máy của nhà nào?" thì app từ chối.
- **Đường duy nhất giữ máy ở nhà demo là mở link** `/nha/demo-ja`, `/nha/demo-ko`,
  `/nha/demo-en`. Đi demo thì nhảy nhà bằng ba link này.
- `*-bome-*.png` — màn của bố mẹ: tổng quan, thưởng (duyệt / trừ ⭐ / danh sách),
  nhiệm vụ hàng ngày, thêm bài, cài đặt, danh sách bài, chi tiết con.
  `ja-bome-dien-thoai.png`, `ja-bome-thuong-dien-thoai.png` ở cỡ điện thoại 430×932.
- `*-con-*.png` — màn của con: chọn tên, bài hôm nay, chi tiết bài, cửa hàng
  phần thưởng. `ko-con-ipad.png` ở cỡ iPad 1180×820.
