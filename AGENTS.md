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

`lib/*.test.ts` chạy thẳng bằng `node --test` (xem script `test` trong
`package.json`), không qua Next/webpack — nên KHÔNG import trực tiếp
`lib/store.ts` (và các file `lib/*.ts` khác dùng import không đuôi kiểu
`from './db'`) từ một test: Node đòi đuôi `.ts` rõ ràng cho import tương đối,
`from './db'` sẽ ném "Cannot find module './db'". Cách các test hiện có xử lý:
test chạy PGlite thật (qua `chayMigrations` của `scripts/db.mjs`, một file
`.mjs` thường nên import được bình thường) và viết lại đúng câu SQL mà hàm cần
kiểm tra — xem `lib/nhiem-vu-mac-dinh-hoan-thanh.test.ts`. Sửa SQL ở
`lib/store.ts` thì phải sửa cả bản sao trong test cho khớp.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
