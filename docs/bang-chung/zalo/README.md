# Bằng chứng: cửa nhận bài từ Zalo + màn duyệt của bố mẹ

> **Ảnh trong pack này được chụp ở BA thời điểm khác nhau — đọc nhãn từng tấm.**
> Sáu tấm `*-zalo-4-tach-hong`, `*-zalo-5-sua-bai-nhap`,
> `*-zalo-6-ten-khuyet-va-ngoai-kho` là MỚI NHẤT (`next dev -p 3190`, xem mục
> "Vòng sửa cuối" ở dưới). Hai tấm `*-zalo-3-nguon-zalo.png` chụp ở vòng sửa
> trước đó, sau khi thêm dòng **"Mã nhóm"** và sau khi tệp không còn đi trong
> thân request. Những tấm còn lại (`*-bome-tong-quan`, `*-cai-dat`,
> `zalo-1-nguyen-van`, `zalo-2-bai-nhap`, `luong-duyet-390.gif`) là **ảnh của
> lượt chụp ĐẦU** và chưa được chụp lại.
>
> Nói thẳng những gì ảnh CŨ không có, thay vì để chúng đứng dưới một nhãn "mới":
> `zalo-1-nguyen-van` và `zalo-2-bai-nhap` chụp TRƯỚC khi có khối "Tách bài chưa
> xong" + nút "Tách lại", và trước hai lý do bỏ tệp `ngoai-cua-so` /
> `thieu-gio-gui`. Ba tấm số 4/5/6 ở dưới chụp đúng những trạng thái đó.
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

## Vòng sửa cuối: tách hỏng, tên khuyết, tệp ngoài kho

Chụp/đo 2026-09-21 trên `next dev -p 3190` **của chính worktree này** (máy này
còn một `next dev` khác ở cổng 3100 thuộc bản checkout khác — ảnh chụp từ nó sẽ
không phải mã của nhánh này). Dữ liệu là **dữ liệu xấu nhất**
(`node scripts/du-lieu-xau-nhat.mjs`: 4 con, tên dài, ⭐ ba chữ số), nạp xong thì
khởi động lại dev. Cỡ điện thoại dùng
`emulate --viewport "390x844x3,mobile,touch"` và `innerWidth` được kiểm lại là
**390** trước mỗi lượt chụp (`resize` cho ra 500px — lỗi #56 lọt qua đúng vì thế).

Ba tin được đưa vào qua **đúng cửa nhận thật** (`POST /api/nhan-bai-zalo`):

| `ma_tin` | Trạng thái dựng ra |
| --- | --- |
| `chup_ok` | tin bình thường, 20 bài nháp cho 4 con |
| `chup_tach_hong` | `ket_qua_tach.trang_thai = 'loi'`, 0 bài nháp |
| `chup_ngoai_kho` | `nguoi_gui` và `nhom_zalo` RỖNG, tệp trỏ sang kho Blob khác |

Tin thứ ba đi thẳng qua cửa nhận và trả về đúng hợp đồng — tin vẫn vào, chỉ tệp
bị bỏ:

```json
{ "bai_zalo_id": "bzl_0b53d0dc450a419c", "so_bai_nhap": 8,
  "tep_bo_qua": [{ "ten": "video-mau.mp4", "ly_do": "ngoai-kho",
    "chi_tiet": "https://kholakhac.public.blob.vercel-storage.com/zalo/nzl_cambridge/2026-09-18/video-mau.mp4" }] }
```

Ảnh:

| Tấm | Màn | Cỡ |
| --- | --- | --- |
| `sau-390-zalo-4-tach-hong.png` | `/bome/zalo`, tin tách hỏng | 390×844 |
| `sau-1440-zalo-4-tach-hong.png` | `/bome/zalo`, tin tách hỏng | 1440×900 |
| `sau-390-zalo-5-sua-bai-nhap.png` | `/bome/bai/<id>` của một bài NHÁP | 390×844 |
| `sau-1440-zalo-5-sua-bai-nhap.png` | `/bome/bai/<id>` của một bài NHÁP | 1440×900 |
| `sau-390-zalo-6-ten-khuyet-va-ngoai-kho.png` | `/bome/zalo`, cả ba tin | 390×844 |
| `sau-1440-zalo-6-ten-khuyet-va-ngoai-kho.png` | `/bome/zalo`, cả ba tin | 1440×900 |

Đo TRONG TRANG, không nhìn ảnh mà kết luận (`document.body.innerText`):

| Điều phải đúng | 390 | 1440 |
| --- | --- | --- |
| Có "Tách bài chưa xong" + "Tách lại" | ✓ | ✓ |
| Số lần hiện "Không còn bài nào trong tin này…" | **0** | **0** |
| Có "(không đọc được tên nhóm)" | ✓ | — |
| Có "(không đọc được tên người gửi)" | ✓ | — |
| Có "tệp không nằm trong kho tệp của app này" | ✓ | — |
| Tràn ngang (`scrollWidth > innerWidth`) | không | không |

Hàng thứ hai là chính cái lỗi vòng này sửa: trước đó màn vừa mời bố mẹ bấm
"Tách lại" vừa bảo họ bấm "Không phải bài" — mà nút sau đặt `trang_thai = 'bo'`
và từ đó mọi lượt quét lại của zalo-agent bị `trung-ma-tin` chặn, tức tin của cô
không bao giờ vào lại được.

Màn `/bome/bai/<id>` của một bài nháp: banner **"Bài này đang chờ duyệt, con chưa
thấy."** hiện, và **cả hai** đường quay lại trong trang (mũi tên và điều hướng
sau khi Lưu) trỏ về `/bome/zalo` — đo bằng cách đọc `href` của mọi `<a>`: chỉ có
`["/bome/zalo", "/bome/zalo"]`, không còn `/bome/con/<childId>` (màn đó lọc bỏ
dòng nháp nên bố mẹ rơi vào ngõ cụt).

Hit-test lại `/bome/zalo` với cả ba tin (lưới 3×3 mỗi phần tử):

| Cỡ | Phần tử bấm được đủ điểm | Tràn ngang |
| --- | --- | --- |
| 390×844 | **115 / 116** | không |
| 1440×900 | **117 / 117** | không |

Phần tử duy nhất không đủ điểm ở 390 là mục **"Trang chủ"** trên thanh điều
hướng dưới (5/9), và thứ che nó là `<nextjs-portal>` — huy hiệu dev tools của
`next dev`, **chỉ có ở dev, không có trên bản deploy**. Lượt đo này CỐ Ý không gỡ
nó ra để con số nói đúng những gì trình duyệt thấy; xem mục hit-test ở trên, nơi
lượt đo trước gỡ nó và được 25/25.
