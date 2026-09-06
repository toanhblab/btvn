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

Video con quay để nộp bài (`QuayVideo.tsx`, dùng `MediaRecorder`) luôn có metadata
`duration` SAI trong container (bug của trình duyệt, không phải lỗi ghép chunk) —
`<video>` trong trang vẫn phát đủ vì nó đọc dữ liệu thật khi tua, nhưng bất kỳ
công cụ nào DỰA VÀO metadata đó (như "Save Video" vào Photos trên iOS) sẽ cắt
theo con số sai (issue #32). `lib/videoDuration.ts` sửa lại ngay sau khi `onstop`
ghép xong Blob, theo hai tầng: (1) vá tại chỗ `mvhd`/`tkhd`/`mdhd` (mp4) và
`Segment>Info>Duration` (webm) bằng số giây THẬT — mỗi track một giá trị riêng
tính từ `moof>traf>trun`; (2) CHÈN thêm hộp `mvex>mehd` 16 byte vào mp4 phân
mảnh, vì Safari/AVFoundation thiếu hộp này sẽ cộng dồn hai track và hiện thời
lượng GẤP ĐÔI. Tầng 2 đổi kích thước tệp nên phải dịch mọi offset tuyệt đối
(`stco`/`co64`, `tfhd.base_data_offset`, `tfra.moof_offset`); nó duyệt cây hộp
theo danh sách trắng và gặp hộp lạ là TỪ CHỐI, giữ nguyên kết quả tầng 1 — thà
thiếu `mehd` còn hơn hỏng video. Đọc chú thích đầu file đó trước khi đụng vào
luồng quay/nộp video; test trong `lib/videoDuration.test.ts` có sẵn bộ dựng mp4
phân mảnh giả và bộ duyệt cây để kiểm từng offset.

Không có driver Safari trên máy nên không tự quay được video Safari để thử;
mẫu Safari THẬT lấy từ URL Vercel Blob public của video con đã nộp (đọc `src`
của `<video>` trên trang bài sau khi đăng nhập PIN, rồi `curl`) — tệp có mặt trẻ
em, phân tích xong phải xoá ngay. File Safari: `tfhd` flags `0x2001a`/`0x20038`
là `default-base-is-moof` (offset tương đối), không có `mfra`; file Chrome có
`mfra>tfra` (offset tuyệt đối) và `mvhd`/`tkhd` version 1.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
