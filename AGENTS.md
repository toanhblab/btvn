<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Bốn ngữ cảnh màn hình, bốn bộ thiết kế

App có bốn bộ thiết kế Stitch đã lưu trong repo (`code/` là HTML kèm lớp Tailwind,
`images/` là ảnh dựng sẵn — xem cả hai):

| Thư mục | Người dùng | Thiết bị |
| --- | --- | --- |
| `stitch/` | con | iPad ngang |
| `stitch-parent/` | bố mẹ | điện thoại |
| `stitch-macbook/` | con | Macbook |
| `stitch-parent-macbook/` | bố mẹ | Macbook |

Bốn bộ dùng **chung 47 màu và chung phông Quicksand**; chỉ thang chữ/spacing khác
nhau. `app/globals.css` là nơi duy nhất khai báo token, với hai tiền tố:
`k-*` cho màn của con, `p-*` cho màn của bố mẹ. **Không thêm tiền tố thứ ba** —
đọc khối chú thích lớn ngay sau `@theme` trong `app/globals.css` trước khi định
thêm token: nó giải thích vì sao ngữ cảnh Macbook là điểm ngắt `xl:` (1280px) và
vì sao hai thang `k-*` / `p-*` tự giãn ra ở đó thay vì sinh ra bộ token trùng lặp.

Một chỗ dễ vấp khi giãn thang `p-*`: `k-*` chỉ dùng trong `app/con/**` nên đặt
thẳng ở `:root` được, còn `p-*` thì **không** — `BanPhimPin`, `ChonNha` và hộp
"Bố mẹ đặt lại giờ" nằm ngay trong màn của con cũng dùng `p-*`. Nên `p-*` giãn ra
trong lớp `.parent-scope`, do `app/bome/(khung)/layout.tsx` đặt.

Hai cái bẫy đã trả giá để biết, cùng ghi ở khối chú thích đó:

- **Đừng tự đặt tên điểm ngắt trong `@theme`.** Tailwind v4 xếp mọi điểm ngắt tự
  định nghĩa RA TRƯỚC nhóm mặc định, nên `pc:grid-cols-3` (1280px) bị
  `md:grid-cols-2` (768px) đè — im lặng, rất khó lần ra. Dùng `xl:` có sẵn.
- **Mọi icon Material Symbols đang bị ghim 24px.** Bảng mẫu của Google ship
  `.material-symbols-outlined { font-size: 24px }` KHÔNG nằm trong `@layer`, nên
  nó đè mọi lớp `text-*` của Tailwind (ở `@layer utilities`). Lỗi này có ở cả
  màn con và màn bố mẹ; `text-4xl` trên icon là CSS chết.

Khung của bố mẹ (`app/bome/(khung)/layout.tsx`): dưới 1280px là cột hẹp + thanh
điều hướng dưới (`ThanhDuoi`), từ 1280px là thanh bên trái 260px (`ThanhBen`).
Màn nào của bố mẹ **chưa có bản thiết kế Macbook** thì giữ `xl:max-w-lg xl:mx-auto`
trên `<main>` để không bị kéo giãn ra cả 1180px — đừng bỏ lớp đó khi chưa dựng
bản Macbook cho màn ấy.

Kiểm bố cục ở nhiều cỡ màn: có sẵn ảnh chụp đối chiếu trong
`stitch-macbook/kiem-tra/` (màn của con) và `stitch-parent-macbook/kiem-tra/`
(màn của bố mẹ) — `macbook-*` ở 1440×900, `ipad-*` ở 1180×820.

Lái trình duyệt vào `next dev` thì mở bằng **`http://localhost:<cổng>`**, đừng
dùng `127.0.0.1`. Next 16 chặn "cross-origin dev request" nên mọi tệp
`/_next/static/**` trả 403 khi host là `127.0.0.1`: trang vẫn dựng xong ở phía
máy chủ và chụp ảnh vẫn đẹp, nhưng React KHÔNG hydrate — mọi `useEffect`, mọi
nút của component khách đều chết lặng, không báo lỗi gì. Bằng chứng nằm ở nhật
ký `next dev` ("Blocked cross-origin request to Next.js dev resource").

Video con quay để nộp bài (`QuayVideo.tsx`, dùng `MediaRecorder`) là mp4 PHÂN MẢNH
(`moov` không có mẫu, dữ liệu nằm trong `moof`/`mdat`) với metadata `duration`
không dùng được: Safari ghi `mvhd`/`tkhd`/`mdhd` = 0, Chrome ghi `mdhd` sai đơn vị.
Công cụ dựa vào metadata (như "Save Video" vào Photos trên iOS) cắt theo số sai
(issue #32). `lib/videoDuration.ts` sửa ngay sau khi `onstop` ghép xong Blob —
đọc chú thích đầu file đó trước khi đụng vào luồng quay/nộp video. Điều đắt
giá nhất, ĐÃ ĐO TRỰC TIẾP trên Safari 26.6.2 macOS và Safari 26.5/iOS 18.7
(báo cáo `data/btvn-video-safari-that` trong home firstmate): **Safari/AVFoundation
tính `duration` = max theo track của (`mdhd.duration` + tổng mẫu trong `trun`), và
BỎ QUA `mvhd`, `tkhd`, `mehd`, `mfra`.** Vì thế với mp4 phân mảnh `mdhd` PHẢI = 0 —
ghi thời lượng thật vào đó là Safari hiện GẤP ĐÔI (hai PR #37/#38 đi vòng qua
`tkhd`/`mehd` không có tác dụng vì Safari không đọc chúng). Chrome lấy
max(`mdhd`, tổng mẫu) nên không lộ. `mvhd`/`tkhd`/`mehd` vẫn được ghi đúng vì vô
hại với WebKit và có thể cần cho bộ nhập Photos (chưa kiểm). Chèn `mehd` đổi
kích thước tệp nên phải dịch mọi offset tuyệt đối; gặp hộp lạ là TỪ CHỐI, giữ
kết quả vá tại chỗ. Test `lib/videoDuration.test.ts` có bộ dựng mp4 phân mảnh
giả, bộ duyệt cây kiểm từng offset, và hàm mô phỏng phép tính của Safari.

Điểm thưởng (+10 một ngày xong hết, +1 mỗi bài xong sớm hơn `duration_minutes`,
+`stars` mỗi dòng nhiệm vụ hàng ngày tick xong, đổi thưởng có bố mẹ duyệt): luật
là hàm thuần trong `lib/diem.ts` (đọc chú thích đầu file trước — nó giải thích vì
sao "xong sớm" đo bằng mốc con bấm "Bắt đầu làm" của đồng hồ sẵn có và giới hạn
của cách đó), SQL cộng điểm ở `ghiDiemSauKhiXong` + `congDiemNgayNeuXong` trong
`lib/store.ts` (đường con tick KHÔNG phải chỗ duy nhất gọi: route xoá bài / đổi
ngày của bố mẹ gọi hàm sau), lược đồ + lý do ở `migrations/015_tinh_diem_doi_thuong.sql`
và `016_nhiem_vu_hang_ngay_thuong_sao.sql`. Ba điều dễ vấp: (1) "cộng một lần"
KHÔNG nằm trong code mà nằm ở BA unique index partial của `score_events` +
`ON CONFLICT ... RETURNING` — đổi luật thì sửa index trước; (2) số dư = tổng
`score_events` TRỪ `reward_redemptions` đã duyệt, không có dòng điểm âm nào, đừng
thêm; (3) CHECK của `score_events.kind` được 016 DROP rồi ADD lại đủ ba giá trị —
migration nào thêm `kind` nữa phải liệt kê lại ĐỦ, không chỉ thêm giá trị của mình.
Test PGlite trong `lib/tinh-diem.test.ts` mô phỏng lại đúng SQL của store — sửa
một bên là phải sửa bên kia.

Nhiệm vụ hàng ngày (`daily_chores` + dòng `assignments` có `chore_id`, hai nhóm
`category`, sao/icon/`child_ids`): dòng của ngày được tạo LƯỜI bằng
`taoNhiemVuNgay` trong `lib/store.ts` — gọi ở đầu màn của con, `progressUpcoming`,
chi tiết con của bố mẹ và `saveSubmission`; không có cron. Câu `INSERT … SELECT`
đó được NHÂN BẢN ở `scripts/seed.mjs`, `lib/nhiem-vu-hang-ngay.test.ts` và
`lib/nhiem-vu-mac-dinh-hoan-thanh.test.ts` (node không import được TS) — đổi một
chỗ là đổi cả bốn. `stars`/`icon`/`content` CHÉP vào dòng lúc tạo (sửa cấu hình
chỉ ảnh hưởng dòng tạo sau), riêng nhóm đọc LIVE qua `LEFT JOIN daily_chores`
trong `ASSIGNMENT_SELECT` — giống `sort_order`. Xoá nhiệm vụ là `archived_at`,
không DELETE (migration 014 giải thích vì sao).

**Một con số tóm tắt đếm đúng những dòng mà màn nó đại diện VẼ RA và cho TICK —
không hơn, không kém — và phải được lọc bằng CÙNG một hàm với màn đó, không viết
lại điều kiện bằng SQL hay JS riêng.** Hàm đó là `veTrenManCuaCon` /
`dongTrenManCuaCon` trong `lib/nhomNhiemVu.ts` (bài tập: từ hôm nay trở đi;
nhiệm vụ hàng ngày: chỉ hôm nay — đọc chú thích đầu file), dùng ở cả
`app/con/[childId]/page.tsx` lẫn `progressUpcoming` trong `lib/store.ts`.

**Phép thử về-0:** mở màn của con, tick hết mọi thứ đang thấy, thì mọi con số dẫn
tới màn đó (huy hiệu chọn tên, hai ô "Hoàn thành"/"Đang chờ", tiến độ nhóm) phải
về 0 hoặc "Xong hết"; còn một số nào khác 0 là có dòng đang được đếm mà không có
chỗ tick — **sửa bộ lọc, không sửa chữ**. (Buổi tối bố mẹ đã nhập bài cho hôm sau
thì huy hiệu đọc "1 việc" vì bài ngày mai CÓ vẽ và CÓ tick được — đó là đếm đúng,
không phải lỗi.)

Sáu vòng sửa liên tiếp của #42 đều cùng một dạng lỗi: một con số được định nghĩa
bằng bộ lọc riêng viết lại tại chỗ thay vì suy ra từ danh sách nó tóm tắt. Từ bất
biến trên suy ra được cả hai điều mà trước đây phải liệt kê theo từng màn: đếm gộp
bài tập và nhiệm vụ (vì màn của con vẽ cả hai — đừng thêm lại trường kiểu
`homeworkTotal`/`homeworkTodo`), và bài đếm từ hôm nay trở đi còn nhiệm vụ chỉ
hôm nay (vì màn vẽ đúng như vậy).

Hai ngoại lệ CÓ Ý: badge "Quá hạn" (nhiệm vụ hôm qua không phải bài quá hạn) và
hộp "Nhiệm vụ hàng ngày" ở màn chi tiết con của bố mẹ (tách khỏi tiến độ bài tập,
chỉ tính HÔM NAY). Cả hai KHÔNG phải con số dẫn tới màn của con nên không chịu
phép thử về-0. Muốn thêm một con số mới thì phải trả lời được: **nó tóm tắt màn
nào, dùng hàm lọc nào của màn đó** — không trả lời được thì chưa được thêm.

Máy này đã bật Safari > Develop > Allow Remote Automation: `safaridriver -p <cổng
riêng>` + WebDriver W3C lái được Safari thật để đo `video.duration` (phục vụ tệp
qua server HTTP có `Range`, Safari không phát nếu thiếu 206). Quay mẫu bằng Safari
không cần quyền camera: `canvas.captureStream()` + `AudioContext`, click qua
WebDriver làm user gesture. Mẫu Safari THẬT của con lấy từ URL Vercel Blob (đọc
`src` của `<video>` trên trang bài sau khi đăng nhập PIN, rồi `curl`) — tệp có mặt
trẻ em, phân tích xong phải xoá ngay. File Safari: `tfhd` flags `0x2001a`/`0x20038`
là `default-base-is-moof` (offset tương đối), một `moof`, không `mfra`, AAC; file
Chrome có nhiều `moof`, `mfra>tfra` (offset tuyệt đối), Opus, `mvhd`/`tkhd` version 1.

Tài liệu có hai người đọc khác nhau: `README.md` cho người phát triển, còn
`HUONG-DAN-BO-ME.md` (kèm ảnh trong `huong-dan-anh/`) cho bố mẹ dùng app thật —
viết không thuật ngữ, chỉ gọi tên thứ hiện trên màn hình. Đổi luồng hay đổi chữ
trên màn của bố mẹ/con thì sửa cả tệp đó, đừng chỉ sửa README.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
