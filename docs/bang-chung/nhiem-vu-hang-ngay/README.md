# Bằng chứng: Nhiệm vụ hàng ngày có thưởng sao (issue #42)

Chụp trên dev server cục bộ (PGlite, `npm run db:seed` rồi `next dev`), Chrome
headless qua `chrome-devtools-axi`. Màn của con ở 1180×820 (iPad ngang), màn bố
mẹ ở 390×844 (điện thoại) và 1440×900 (Macbook). Bố mẹ đăng nhập bằng
`POST /api/pin` với PIN mặc định 1234.

| Ảnh | Nội dung |
| --- | --- |
| `01-chon-con-badge-viec-ipad.png` | Màn chọn con sau khi `progressUpcoming` tạo lười dòng hôm nay. Huy hiệu đếm GỘP bài tập và nhiệm vụ: cả ba con "9 việc" — Minh/An 4 bài hôm nay + 5 nhiệm vụ, Bé Na 4 nhiệm vụ hôm nay + (1 bài + 4 nhiệm vụ) của ngày mai. Câu nhắc luật ở bảng xếp hạng nói cả nhiệm vụ. |
| `02-con-minh-hai-nhom-nhiem-vu-ipad.png` | Cuối trang của Minh: hai nhóm riêng "🎒 Sau khi học xong" (3 việc mặc định, 1 ⭐) và "🏠 Việc nhà hàng ngày" (Đánh răng 2 ⭐, Đọc sách 3 ⭐), mỗi dòng có icon + chip ⭐. |
| `03-con-minh-tick-nhiem-vu-chip-cong-2-sao-ipad.png` | Tick "Đánh răng buổi tối" → chip "+2 ⭐" trên dòng, tiến độ nhóm 1/2. |
| `04-con-bena-khong-co-bai-chi-co-nhiem-vu-ipad.png` | Bé Na hôm nay không có bài (chỉ có bài ngày mai) nhưng vẫn có nhiệm vụ hôm nay; Bé Na không được giao "Đọc sách" nên không thấy. Hai nhóm nhiệm vụ chỉ VẼ việc của hôm nay — "Sau khi học xong 0/3 việc xong" và "Việc nhà hàng ngày 0/1", không còn tiêu đề "Ngày mai" trong hai nhóm này (dòng của ngày mai vẫn tạo sẵn trong DB nhưng không vẽ, để con không tick trước ăn ⭐ sớm một ngày); riêng bài tập ngày mai VẪN hiện dưới "Ngày mai" trong nhóm Smartkid, nhóm đó không có bài hôm nay nên không có chip tiến độ. Tick hết việc hôm nay của một nhóm thì chip đọc "🎉 3/3 việc xong" và nền chuyển xanh (kiểm trực tiếp trên dev server). |
| `05-con-bena-xong-het-nhiem-vu-ipad.png` | Tick hết 4 nhiệm vụ → /xong nói "Con làm hết **nhiệm vụ** hôm nay rồi", 5 ⭐ (1+1+1+2), không +10 vì không có bài thật (Q5). |
| `06-bome-nhiem-vu-hang-ngay-dien-thoai.png` | Trang riêng `/bome/nhiem-vu-hang-ngay`: mỗi thẻ icon + tên + sao, chip nhóm, chip "Giao cho", mũi tên thứ tự, bật/tắt, xoá. |
| `07-bome-nhiem-vu-hang-ngay-them-moi-giao-cho-dien-thoai.png` | Thẻ "Đọc sách" giao cho Minh + An; ô thêm mới với hàng icon gợi ý, chip nhóm, chip giao cho. |
| `08-bome-cai-dat-the-dan-dien-thoai.png` | Cài đặt: thẻ "Nhiệm vụ mỗi ngày" cũ thu về dòng dẫn "Cài nhiệm vụ hàng ngày · 5 nhiệm vụ". |
| `09-bome-thuong-dong-dan-dien-thoai.png` | Thưởng: câu mở đầu nói thêm sao nhiệm vụ + dòng dẫn sang trang cài nhiệm vụ; điểm Minh 2 ⭐, Bé Na 5 ⭐. |
| `10-bome-chi-tiet-con-minh-hop-nhiem-vu-dien-thoai.png` | Chi tiết con: hộp "Nhiệm vụ hàng ngày 1/5 xong", mỗi dòng icon + nhóm + ⭐; tiến độ bài tập vẫn 0/4 (không đếm nhiệm vụ). |
| `11-bome-nhiem-vu-hang-ngay-macbook.png` | Trang cài nhiệm vụ ở 1440×900: thanh bên trái, cột hẹp `xl:max-w-lg` (chưa có bản Macbook). |

Sổ điểm trong DB sau các ảnh trên (`SELECT … FROM score_events`): 5 dòng, tất cả
`kind = 'task_done'` — Minh: 2 (Đánh răng); Bé Na: 1 + 1 + 1 + 2. Không có dòng
`day_complete` vì chưa con nào xong hết bài thật.

API cấu hình (gọi từ trình duyệt đã đăng nhập): `childIds: []` → 400 "Chưa giao
cho ai"; id con nhà khác → 400; `stars: 0` / `11` → 400; POST hợp lệ với icon hai
emoji + `stars: '4'` + `childIds` trùng → lưu icon một emoji, 4 ⭐, `["bena"]`;
PATCH đổi nhóm / về cả nhà / sao → đúng; DELETE rồi PATCH lại → 404.
