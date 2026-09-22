# Bằng chứng — Tách bài theo cuốn sách + khai sách của các con (issue #64)

Chụp ngày 2026-09-16 trên `next dev` + PGlite local (`npm run db:seed`, PIN 1234),
Chrome điều khiển bằng `chrome-devtools-axi`. Cỡ điện thoại đặt bằng
`emulate --viewport "390x844x3,mobile,touch"` và kiểm lại `innerWidth === 390`
trước khi chụp (AGENTS.md); Macbook 1440×900. Máy dev không có `NOUS_API_KEY`
nên mọi lần tách ở đây đi **đường lùi tách thô** — phần AI được kiểm bằng fetch
giả trong `lib/tach-theo-sach.test.ts` (lời nhắc gửi lên đúng như mong đợi).

Ba ảnh Macbook 10–12 chụp ngày 2026-09-17, cách làm y như trên: `npm run db:seed`
(PIN 1234) → `next dev` → `chrome-devtools-axi` mở qua `http://localhost:<cổng>`
(không dùng `127.0.0.1`), đăng nhập bố mẹ bằng `POST /api/pin`, khai bốn cuốn
sách qua `POST /api/sach`, `emulate --viewport "1440x900x1"` rồi **kiểm lại
`eval "() => innerWidth"` ra đúng `1440`** và `documentElement.scrollWidth >
innerWidth` = `false` trước khi chụp. Hit-test chạy trong trang
(`scrollIntoView` + `elementFromPoint` trên lưới 5×5 trong `getBoundingClientRect()`).

## Còn thiếu: xác nhận trên iPhone THẬT

Mọi ảnh cỡ điện thoại trong thư mục này là **ảnh GIẢ LẬP**: Chrome trên máy dev
với `emulate --viewport "390x844x3,mobile,touch"` (device-metrics override, có
dpr và cảm ứng), kiểm lại bằng `eval "() => innerWidth"` ra đúng `390` trước khi
chụp. Không tấm nào được chụp trên điện thoại thật.

Theo luật của dự án (AGENTS.md, tiền lệ PR #58) ảnh giả lập **CHƯA ĐỦ** để đóng
việc đụng giao diện điện thoại. Vẫn còn một bước phải làm bằng tay trước khi gộp
PR và đóng issue #64: captain mở trên iPhone THẬT

- màn **Sách của các con** (`/bome/sach`) — khai một cuốn, sửa tên, chọn môn,
  chọn "Sách của", bỏ một cuốn;
- chip **✂️ Tách bài này** và **Gộp với bài trên** ở màn **Kiểm tra lại**.

| Tệp | Nội dung |
| --- | --- |
| `01-bome-sach-chua-khai-dien-thoai.png` | Màn **Sách của các con** khi nhà chưa khai cuốn nào: câu giải thích + ô thêm mới. |
| `02-bome-sach-bon-cuon-dien-thoai.png` | Bốn cuốn đã khai: tên, môn, "Sách của" (Poth Math chỉ Minh + An; Bé tập tô chỉ Bé Na). Không tràn ngang ở 390px. |
| `03-bome-sach-them-moi-dien-thoai.png` | Ô thêm mới: tên, môn, "Sách của", nút **Thêm sách** — hit-test 25/25 điểm trúng nút. |
| `04-bome-cai-dat-the-dan-dien-thoai.png` | Thẻ dẫn mới ở **Cài đặt**: "Khai sách, vở, nguồn bài tập · 4 cuốn". |
| `05-bome-them-dong-dan-sach-dien-thoai.png` | Dòng dẫn dưới ô dán nội dung ở **Thêm bài**: máy gộp theo cuốn sách, link khai sách. |
| `06-api-extract-duong-lui-khong-AI.txt` | `POST /api/extract` cùng một nội dung, `childIds` khác nhau → danh sách sách khác → kết quả gộp khác. Giao cho Minh: hai dòng Poth Math thành **một** bài Toán; giao cho Bé Na (không có sách đó): tách như cũ. |
| `07-kiem-tra-lai-truoc-khi-tach-dien-thoai.png` | **Kiểm tra lại** với một thẻ AI gộp nhầm hai việc ("Làm bài toán trang 41, 42, 43. Vẽ một bức tranh…"); chip **✂️ Tách bài này** hit-test 25/25. |
| `08-kiem-tra-lai-sau-khi-tach-dien-thoai.png` | Sau khi đặt con trỏ trước "Vẽ" và bấm Tách: 2 thẻ → 3 thẻ, thẻ mới giữ môn / giọng / thời lượng / ghi chú. |
| `09-bome-sach-macbook.png` | Màn Sách của các con ở 1440×900 (cột hẹp `xl:max-w-lg`, chưa có bản Macbook riêng). |
| `10-bome-cai-dat-macbook.png` | **Cài đặt** ở 1440×900: thẻ dẫn "Sách của các con · Khai sách, vở, nguồn bài tập — 4 cuốn" nằm trong cột phải, hit-test 25/25. |
| `11-bome-them-macbook.png` | **Thêm bài** ở 1440×900: dòng dẫn dưới ô dán nội dung, link "Khai sách của các con" hit-test 25/25. |
| `12-kiem-tra-lai-macbook.png` | **Kiểm tra lại** ở 1440×900 (ảnh cả trang): hàng chip của mỗi thẻ nằm gọn trên một dòng, không tràn ngang. Cùng một nội dung dán vào, hai dòng Poth Math ra **một** thẻ (ghi chú "Poth Math"), thẻ Vở ô ly và thẻ vẽ tranh tách riêng. Hit-test 5 chip (3 × "✂️ Tách bài này", 2 × "+ Gộp với bài trên") đều 25/25 điểm. |

Bộ kiểm tự động: `lib/tach-theo-sach.test.ts` (prompt có luật gộp theo sách kể
cả khi không có sách; khối sách có chặn trên; fetch giả; `splitByRule` gộp / không
gộp; giới hạn cố ý) và `lib/sach.test.ts` (migration 021, lọc theo nhà và theo
con, đánh dấu bỏ, route cần PIN, **nhà chưa khai sách cho ra đúng kết quả cũ**).
