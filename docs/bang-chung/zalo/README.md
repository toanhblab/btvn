# Bằng chứng: cửa nhận bài từ Zalo + màn duyệt của bố mẹ

> **Chụp lại 2026-09-21, vòng sửa sau review.** Hai tấm `*-zalo-3-nguon-zalo.png`
> và toàn bộ bảng hit-test ở dưới được chụp/đo LẠI trên cây mã hiện tại
> (`next dev -p 3177`), sau hai thay đổi đụng màn này: dòng **"Mã nhóm"** trên
> thẻ nguồn, và việc tệp không còn đi trong thân request. Những tấm còn lại
> (`*-bome-tong-quan`, `*-cai-dat`, `zalo-1-nguyen-van`, `zalo-2-bai-nhap`,
> `luong-duyet-390.gif`) **không đụng tới** ở vòng này: phần màn chúng chụp
> không đổi — khối "tệp cô gửi không vào được" chỉ hiện khi CÓ tệp bị bỏ, và
> lượt chụp lại này không có tệp nào bị bỏ.
>
> Lượt chụp lại đi qua **đúng hợp đồng mới**, không phải đường cũ: hai tệp được
> tải lên trước bằng `POST /api/nhan-bai-zalo/tep-token?nguon_id=…&ma_tin=…`
> (chế độ dev multipart → `/api/tep/<tên>`), rồi gói tin gửi lên chỉ mang `url`.
> Kết quả: `201 {"so_bai_nhap":20,"con":[…2 con…],"tep_bo_qua":[]}`, và màn chờ
> duyệt dựng đúng **2 thẻ `<video>`** trỏ vào hai URL đó.

Chụp lần đầu 2026-09-21 trên `next dev` cục bộ (`-H 0.0.0.0 -p 3100`), DB dev
(PGlite), `ZALO_INTAKE_SECRET` là khoá giả. Máy dev **chưa có
`NOUS_API_KEY`** nên bộ tách bài chạy đường lui `splitByRule` (tách thô theo
dòng, `confidence` 0.3) — trên bản thật có khoá AI thì danh sách bài gọn hơn
nhiều. Đây là đường lui đã có sẵn của `/api/extract`, không phải hành vi riêng
của cửa nhận này.

## Dữ liệu dùng để chụp

Dữ liệu seed mặc định là trạng thái DỄ NHẤT nên **không chụp trên đó**
(AGENTS.md). Đã chạy `node scripts/du-lieu-xau-nhat.mjs` để có:

- **4 con** (nhiều hơn 3 — hàng chip "Con học lớp này" và bảng xếp hạng chỉ vỡ
  khi đủ thẻ để tràn, issue #63)
- **tên con dài**: "Nguyễn Hoàng Minh Khôi", "Nguyễn Hoàng Gia Khánh"…
- **⭐ ba chữ số**: 420 / 370 / 150 / 110
- **tin dài thật**: nguyên văn 853 chữ của cô Thu Huyền (ngày học thứ 40)
- **2 tệp thật**: hai video mẫu của cô, 2.18 MB và 1.29 MB
- **2 con nhận bài** từ nguồn "Cambridge 1.27"

## Cỡ điện thoại — `emulate`, KHÔNG phải `resize`

`chrome-devtools-axi resize 390 844` cho ra `innerWidth = 500` (cửa sổ Chrome
có đáy 500px) nên mọi lỗi chen chỗ biến mất — lỗi #56 lọt qua đúng vì thế. Ở
đây dùng `emulate --viewport "390x844x3,mobile,touch"` và kiểm lại
`innerWidth` trước mỗi tấm: **390, dpr 3**.

## Ảnh

| Tệp | Là gì |
| --- | --- |
| `truoc-390-bome-tong-quan.png` | TRƯỚC — Trang chủ bố mẹ, 390px. Chụp với đúng ba tệp màn bị đụng lấy lại từ `main` (`git checkout 49dd9ec -- …`), **trên CÙNG một DB đã có 20 dòng nháp**. Không có thẻ "1 tin cô giao bài", và ô "Đang chờ" vẫn là **27** — bằng đúng số của ảnh SAU. |
| `sau-390-bome-tong-quan.png` | SAU — thêm thẻ "1 tin cô giao bài, chờ duyệt"; "Đang chờ" vẫn 27. |
| `truoc-1440-bome-tong-quan.png` / `sau-1440-bome-tong-quan.png` | Cùng cặp đó ở cỡ Macbook 1440×900. |
| `truoc-390-cai-dat.png` / `sau-390-cai-dat.png` | Cài đặt, 390px — thêm lối vào cố định "Nhóm Zalo của lớp" (Trang chủ chỉ hiện thẻ khi CÓ tin chờ). |
| `sau-390-zalo-1-nguyen-van.png` | Màn mới `/bome/zalo`: tên nhóm, tên cô, ngày giờ gửi, "ngày học thứ 40", cờ "Luật khớp", nguyên văn tin giữ xuống dòng + nút "Xem cả tin (853 chữ)", hai video phát được. |
| `sau-390-zalo-2-bai-nhap.png` | Bài nháp theo từng con, sửa tại chỗ / "Sửa kỹ" / bỏ từng bài. |
| `sau-390-zalo-3-nguon-zalo.png` | Mục "Nhóm Zalo": hai nguồn, chọn con (4 chip, tên dài), cửa sổ nhận tệp, **"Mã nhóm: g6948518348545773767"** — máy ở nhà tự điền khi nhận bài — lần nhận gần nhất, công tắc bật/tắt. |
| `sau-1440-zalo-*.png` | Ba mục đó ở cỡ Macbook 1440×900. Riêng `-3-nguon-zalo` thấy **cả hai trạng thái** của dòng mã nhóm: nguồn đã nhận bài hiện mã thật, nguồn chưa nhận hiện "Mã nhóm: chưa có (máy ở nhà tự điền khi nhận bài lần đầu)". |
| `luong-duyet-390.gif` | Luồng duyệt: Trang chủ → `/bome/zalo` → mở cả tin → bấm Duyệt → mục biến mất → màn chọn con → bài của cô hiện trên màn của con. |

Màn `/bome/zalo` **chưa từng có trên `main`** nên không có ảnh TRƯỚC cho nó.

GIF ghép bằng Pillow (bảng màu thích ứng, 128 màu) chứ không phải
`ffmpeg palettegen/paletteuse`: máy này không có `ffmpeg` và không cài được
trong phiên làm việc. Ảnh nguồn là `f1.png`…`f7.png` chụp bằng
`chrome-devtools-axi screenshot` ở đúng cỡ 390×844.

## Hit-test trong trang

"Nhìn ảnh thấy nút" không chứng minh được nút bấm được. Với MỖI
`button / a / input / textarea / [role=switch]`: `scrollIntoView` rồi
`document.elementFromPoint` trên lưới 5×5 điểm bên trong
`getBoundingClientRect()`, đếm điểm trả về chính phần tử đó.

| Màn | Cỡ | Điểm trúng | Tràn ngang |
| --- | --- | --- | --- |
| `/bome` | 390×844 | **325 / 325** (13 phần tử) | không |
| `/bome/zalo` | 390×844 | **2150 / 2150** (86 phần tử) | không |
| `/bome/cai-dat` | 390×844 | **400 / 400** (16 phần tử) | không |
| `/bome` | 1440×900 | **575 / 575** (23 phần tử) | không |
| `/bome/zalo` | 1440×900 | **2175 / 2175** (87 phần tử) | không |
| `/bome/cai-dat` | 1440×900 | **400 / 400** (16 phần tử) | không |

Hai hàng `/bome/zalo` được **đo lại** ở vòng sửa sau review (cây mã hiện tại,
`innerWidth` kiểm lại là 390 và 1440): vẫn **2150 / 2150** và **2175 / 2175**,
không tràn ngang, không phần tử nào dưới 25/25. Số không đổi vì dòng "Mã nhóm"
mới là một `<p>` chỉ đọc, không phải phần tử bấm được — nhưng phải đo lại mới
biết nó không đè lên nút nào.

Phép đo gỡ `<nextjs-portal>` (huy hiệu của `next dev` ở góc dưới trái) trước
khi chạy: nó là một lớp phủ THẬT nhưng chỉ có ở dev, và nó ăn mất 9 điểm của
mục "Trang chủ" trên thanh điều hướng dưới.
