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

Video con quay để nộp bài (`MediaRecorder`, vòng đời ở `lib/phienQuay.ts`) là
mp4 PHÂN MẢNH (`moov` không có mẫu, dữ liệu nằm trong `moof`/`mdat`) với
metadata `duration` không dùng được: Safari ghi `mvhd`/`tkhd`/`mdhd` = 0, Chrome ghi `mdhd` sai đơn vị.
Công cụ dựa vào metadata (như "Save Video" vào Photos trên iOS) cắt theo số sai
(issue #32). `lib/videoDuration.ts` sửa ngay sau khi `onstop` ghép xong Blob
(trong `chotPhien`) — đọc chú thích đầu file đó trước khi đụng vào luồng
quay/nộp video. Điều đắt giá nhất, ĐÃ ĐO TRỰC TIẾP trên Safari 26.6.2 macOS và
Safari 26.5/iOS 18.7 (báo cáo `data/btvn-video-safari-that` trong home firstmate): **Safari/AVFoundation
tính `duration` = max theo track của (`mdhd.duration` + tổng mẫu trong `trun`), và
BỎ QUA `mvhd`, `tkhd`, `mehd`, `mfra`.** Vì thế với mp4 phân mảnh `mdhd` PHẢI = 0 —
ghi thời lượng thật vào đó là Safari hiện GẤP ĐÔI (hai PR #37/#38 đi vòng qua
`tkhd`/`mehd` không có tác dụng vì Safari không đọc chúng). Chrome lấy
max(`mdhd`, tổng mẫu) nên không lộ. `mvhd`/`tkhd`/`mehd` vẫn được ghi đúng vì vô
hại với WebKit và có thể cần cho bộ nhập Photos (chưa kiểm). Chèn `mehd` đổi
kích thước tệp nên phải dịch mọi offset tuyệt đối; gặp hộp lạ là TỪ CHỐI, giữ
kết quả vá tại chỗ. Test `lib/videoDuration.test.ts` có bộ dựng mp4 phân mảnh
giả, bộ duyệt cây kiểm từng offset, và hàm mô phỏng phép tính của Safari.

Cùng luồng quay, issue #51 (MacBook Safari: "chỉ lưu một đoạn" + "thời lượng gấp
đôi") là MỘT nguyên nhân KHÁC metadata: camera **ngừng sinh khung giữa buổi** trong
khi track vẫn `live`, `MediaRecorder` vẫn chạy; phần sau mốc đứng CHƯA TỪNG được
ghi nên không bản vá hộp nào cứu được (đo trên 10 video production, báo cáo
`data/btvn-video-macbook-dieu-tra` trong home firstmate). Sửa ở LÚC QUAY:
`lib/phienQuay.ts` giữ toàn bộ vòng đời ghi (React chỉ vẽ) kèm bộ canh luồng —
`mute`/`ended` của track (tín hiệu từ camera, luôn có hiệu lực) + nhịp khung qua
`requestVideoFrameCallback` (tín hiệu PHỤ: chỉ giá trị khi khung xem trước đang
chiếu, và chỉ BẬT sau nhịp đầu tiên — máy có hàm rVFC mà không bao giờ bắn nhịp
thì hàng rào đó im, không được vứt mọi bản quay), ngưỡng và ba hàng rào chống
báo nhầm (tab ẩn, luồng chính nghẽn, khung xem trước không chiếu) ghi ở chú thích
đầu file; đứng thì tự dừng, KHÔNG lưu, báo con quay lại. Nút "quay bằng máy ảnh
của hệ điều hành" đã BỎ HẲN theo captain, nên mở camera thất bại PHẢI ra câu con
đọc được (`CAU_BAO_MO_CAMERA`, riêng trang mở bằng http là
`CAU_BAO_CHUA_AN_TOAN`) — đừng thêm lại đường `<input capture>`. Test
`lib/phienQuay.test.ts` dùng MediaRecorder/luồng/đồng hồ giả; cú đứng THẬT chưa
tái hiện được trên máy không camera.

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
`score_events` TRỪ `reward_redemptions` đã duyệt TRỪ `score_penalties` (bố mẹ trừ,
#43, `017_tru_diem.sql`) — DẤU là thuộc tính của BẢNG, mọi dòng đều dương, không có
dòng điểm âm nào, đừng thêm; công thức nằm MỘT chỗ: `SQL_SO_DU_CON` trong
`lib/sqlDiem.ts`, store và test cùng import; (3) CHECK của `score_events.kind` được
016 DROP rồi ADD lại đủ ba giá trị — migration nào thêm `kind` nữa phải liệt kê lại
ĐỦ, không chỉ thêm giá trị của mình. Test PGlite trong `lib/tinh-diem.test.ts` mô
phỏng lại đúng SQL của store — sửa một bên là phải sửa bên kia.

Trừ điểm (`truDiem` trong `lib/store.ts`): CHỈ trừ, không cộng tay (captain chốt);
lưu đúng số đã trừ mỗi lần, không lưu tổng. "Không âm" chặn hai tầng, tầng dữ liệu
là MỘT transaction `queryTx` (`lib/db.ts` — cách duy nhất trong repo chạy nhiều
câu trong một transaction; Neon HTTP không tương tác nên gói phải là danh sách cố
định): khoá `pg_advisory_xact_lock` theo con → `INSERT … SELECT` ghi
`LEAST(số nhận được, số dư tính tại chỗ)` và chỉ ghi khi số dư > 0 → đọc số dư.
Đừng kẹp `GREATEST(0, …)` trong SUM. **"Không âm" là luật của SỐ DƯ, không của
riêng một đường**: `duyetDoiThuong` cũng là một đường trừ
(dòng thành `'approved'`) nên chạy trong CÙNG khuôn đó — cùng khoá theo con, rồi
UPDATE có điều kiện số dư ≥ giá (`SQL_DUYET_DOI_THUONG`); thêm đường trừ thứ ba thì
lặp lại đúng khuôn này, đừng đọc số dư ở một câu rồi ghi ở câu sau. Phía màn hình
có **hai luật, một hàm thuần** (`trangThaiTruDiem` trong `lib/types.ts`): (1) **nút
làm đúng những gì nhãn của nó ghi** — `soGui` vừa là số in trên nhãn vừa là số gửi
lên, nên nhãn "Trừ hết 5 ⭐" trừ đúng 5 dù trong ô gõ 8 và dù con vừa kiếm thêm
thành 20 (gõ quá số đang hiện chỉ ĐỔI MẶT nút, không đổi giao thức); (2) **màn hình
không bao giờ tự từ chối** — số ⭐ nó đang giữ có thể cũ theo cả hai chiều, KỂ CẢ số
0, nên đừng khoá nút theo số đó; máy chủ mới kẹp `LEAST` và từ chối, và lý do từ
chối duy nhất là con không còn ⭐ nào. Lý do là thứ CON ĐỌC ở cửa hàng
(`LY_DO_TRU_GOI_Y`, `LY_DO_TRU_TRONG` trong `lib/types.ts`).

Nhiệm vụ hàng ngày (`daily_chores` + dòng `assignments` có `chore_id`, hai nhóm
`category`, sao/icon/`child_ids`): dòng của ngày được tạo LƯỜI bằng
`taoNhiemVuNgay` trong `lib/store.ts` — **năm nơi gọi**: đầu màn của con,
`progressUpcoming`, chi tiết con của bố mẹ, `saveSubmission`, và
`xuLySauKhiDoiHanChot` (nhánh bố mẹ đổi hạn chót của `PATCH
/api/assignments/:id`); không có cron. Câu `INSERT … SELECT` nằm ở
**`lib/sqlNhiemVu.ts`** — một bản duy nhất, `lib/store.ts` + `scripts/seed.mjs` +
ba tệp test PGlite đều import từ đó (tệp không import gì lúc chạy nên cả Next,
`node --test` và `node scripts/seed.mjs` đều nạp được); chỉ còn ba hằng số
`subject`/`source`/`duration` là seed/test truyền tay.

**Hàng rào "+10 của ngày mai" nằm ở MỘT hàm**: `taoNhiemVuNgayNeuChuaQua` — hai
đường mà bố mẹ tự chọn ngày (`saveSubmission` khi nhập bài, `xuLySauKhiDoiHanChot`
khi đổi hạn chót) đều gọi nó, đừng gọi `taoNhiemVuNgay` trực tiếp từ đó nữa.
`xuLySauKhiDoiHanChot` còn gọi `congDiemNgayNeuXong` cho **cả hai** ngày (cũ vừa
bớt một dòng, mới vừa nhận một dòng có thể đã 'done') — tiền lệ: mọi thao tác có
thể làm một ngày thành "xong hết" đều gọi hàm đó, và nó idempotent. Hàm
đó giữ cả hai chiều của cùng một luật, đọc chú thích ở đó trước khi định sửa:
`congDiemNgayNeuXong` không kiểm "ngày đó đã tới chưa", nên (a) ngày **từ hôm nay
trở đi** PHẢI có dòng nhiệm vụ `'todo'` — nó là thứ duy nhất chặn +10 cộng sớm một
ngày; (b) ngày **đã qua** thì KHÔNG được tạo — không còn gì phải gác, mà thêm một
dòng không ai tick được (màn của con liệt kê từ hôm nay) là khoá luôn +10 của ngày
đó. Best-effort (nuốt lỗi để không 500 một lần ghi đã thành công); ba nhánh đều có
test ở `lib/tinh-diem.test.ts`.

`subject` của dòng nhiệm vụ là `VIEC_NHA_SUBJECT` — **khoá phân loại, không phải
chữ hiện lên màn**, nên giữ nguyên tiếng Việt ở MỌI nhà kể cả nhà demo (cần dịch
thì dịch LÚC HIỆN THỊ, đừng dịch lúc ghi: ghi bản dịch vào đó thì một nhà có hai
giá trị cho cùng một thứ — seed ghi bản dịch, `taoNhiemVuNgay` của hôm sau ghi hằng
số). `stars`/`icon`/`content` CHÉP vào dòng lúc tạo (sửa cấu hình chỉ ảnh hưởng dòng
tạo sau, và **tắt công tắc chỉ ngăn dòng tạo SAU** — dòng của hôm nay đã tạo vẫn
hiện, vẫn tick được, vẫn ăn ⭐), riêng nhóm đọc LIVE qua `LEFT JOIN daily_chores`
trong `ASSIGNMENT_SELECT` — giống `sort_order`. Xoá nhiệm vụ là `archived_at`,
không DELETE (migration 014 giải thích vì sao).

**Một con số tóm tắt đếm đúng những dòng mà màn nó đại diện VẼ RA và cho TICK —
không hơn, không kém — và phải được lọc bằng CÙNG một hàm với màn đó, không viết
lại điều kiện bằng SQL hay JS riêng.** Hàm đó là `veTrenManCuaCon` /
`dongTrenManCuaCon` trong `lib/nhomNhiemVu.ts` (bài tập: từ hôm nay trở đi;
nhiệm vụ hàng ngày: chỉ hôm nay — đọc chú thích đầu file), dùng ở cả
`app/con/[childId]/page.tsx` lẫn `progressUpcoming` trong `lib/store.ts`.

Bất biến này áp cả **trong một màn**: tiến độ ở đầu mỗi nhóm đếm đúng tập mà
thân nhóm đó vẽ — nhóm bài tập tính cả bài "Ngày mai" (`nhomBaiTheoNoiGiao`),
nhóm nhiệm vụ chỉ tính hôm nay (`nhomNhiemVuHomNay`), cả hai qua cùng
`tienDoNhom`. Đếm lệch một bên là đầu nhóm tô xanh + "🎉 2/2 bài xong" trong khi
ngay dưới còn ba thẻ bài chưa làm.

**Phép thử về-0:** mở màn của con, tick hết mọi thứ đang thấy, thì mọi con số dẫn
tới màn đó (huy hiệu chọn tên, hai ô "Hoàn thành"/"Đang chờ", tiến độ nhóm) phải
về 0 hoặc "Xong hết"; còn một số nào khác 0 là có dòng đang được đếm mà không có
chỗ tick — **sửa bộ lọc, không sửa chữ**. (Buổi tối bố mẹ đã nhập bài cho hôm sau
thì huy hiệu đọc "1 việc" vì bài ngày mai CÓ vẽ và CÓ tick được — đó là đếm đúng,
không phải lỗi.)

Từ bất biến trên suy ra được cả hai điều mà trước đây phải liệt kê theo từng màn:
đếm gộp bài tập và nhiệm vụ (vì màn của con vẽ cả hai — đừng thêm lại trường kiểu
`homeworkTotal`/`homeworkTodo`), và bài đếm từ hôm nay trở đi còn nhiệm vụ chỉ
hôm nay (vì màn vẽ đúng như vậy). Hồi quy ghim ở `lib/nhomNhiemVu.test.ts`.

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

Đa ngôn ngữ (issue #46) — chi tiết ở mục "Đa ngôn ngữ" của `README.md`; ở đây chỉ
những điều phải biết TRƯỚC khi đụng vào mã:

- Chữ của app hiện theo **ngôn ngữ của nhà** (`families.ui_locale`), KHÔNG phải
  `assignments.lang` — cột đó là ngôn ngữ ĐỀ BÀI. Chữ bố mẹ tự gõ (đề bài, tên
  nhiệm vụ, phần thưởng) không dịch, kể cả tên nhà mặc định "Nhà mình" vì nhà mới
  luôn bắt đầu ở `vi`.
- **Mọi chữ mới trên màn hình phải qua `T(...)`** và phải có ở cả ba từ điển; khoá
  là CHÍNH câu tiếng Việt. Đọc chú thích đầu `lib/i18n/chu.ts` trước.
- Hàng rào của luật trên là `npm run lint` (`tsc --noEmit` + `npm run
  quet:chu-viet`), KHÔNG phải `npm test`. Luật nhận diện và các vị trí miễn trừ ghi
  ngay trên `boLiteralKhoaODungCho` / `MIEN_TRU` trong `scripts/quet-chu-viet.mjs`,
  hồi quy ở `lib/quet-chu-viet.test.ts`. Icon Material Symbols nhận ra bằng CHÍNH
  THẺ chứa nó, đừng đoán theo hình dạng chữ: `add` là tên icon thật, mà "xong"
  cũng vậy.
- Phép quét chỉ bắt chữ CHƯA dịch, không bắt chữ dịch rồi mà SAI NGHĨA: ô "Giọng
  đọc" từng dán nhãn "🇻🇳 đọc giọng Việt" cho một lựa chọn thực ra đọc bằng tiếng
  Nhật, và từng mượn khoá tên MÔN học ('Tiếng Việt' → '国語') làm tên NGÔN NGỮ. Tên
  + cờ của ngôn ngữ có khoá dịch RIÊNG (`TEN_NGON_NGU` / `CO_NGON_NGU` trong
  `lib/speech.ts`, chữ thường để ghép được vào câu "Máy chưa có giọng {giong}"), và
  hai lựa chọn của ô đó do `luaChonGiong` dựng — một bản cho cả ba màn.
- **Gắn máy sang nhà KHÁC thì gỡ luôn phiên bố mẹ**, và **nhập PIN demo thì KHÔNG
  gắn máy**. Hai luật này nằm trong `lib/auth.ts` chứ không ở từng route, vì mỗi
  luật có nhiều đường đi qua (`setDeviceFamily` + `attachFamilyLink`;
  `ganMaySauKhiNhapPin`). Thêm đường gắn máy hay đường nhập PIN thứ ba thì đi qua
  đúng hàm đó, đừng tự `cookies().set`. Link `/nha/<slug>` CỐ Ý nằm ngoài luật PIN
  demo — nó là đường duy nhất gắn hẳn một máy vào nhà demo.
- **Ba mã demo TRUNG TÍNH với bộ chặn mò mã** (`attemptPin`): không chạm bộ đếm
  theo bất kỳ hướng nào — không `recordSuccess`, không `recordFail`. Chúng là mã
  công khai mà lại tra ra một nhà thật, nên tính như một lần nhập đúng là chúng xoá
  bộ đếm và ai cũng dò được PIN của nhà THẬT không giới hạn (sai 4 lần → gõ 1111 →
  lặp lại). Thêm mã công khai nào nữa thì phải giữ đúng tính trung tính này.
- Dữ liệu ba nhà demo cũ dần theo ngày, phải chạy lại `npm run db:seed:demo` trước
  mỗi buổi demo (cố ý không thêm cron, không đặc biệt hoá đường đọc).
  `scripts/seed-demo.mjs` chạy trong `npm run build` nên nó nạp mọi `.ts` bằng
  `import()` ĐỘNG trong try/catch: import tĩnh được phân giải TRƯỚC khối bắt lỗi
  nên một bản Node không tự bỏ kiểu sẽ làm hỏng cả bản deploy.
- Test PGlite import thẳng `lib/store.ts` được nhờ `scripts/test-hook.mjs` (resolve
  import không đuôi, `npm test` nạp qua `--import`) + `BTVN_PGLITE_DIR=memory://`.

**Gỡ một hàng rào ra khỏi chỗ cũ thì phải nối nó vào chỗ mới TRONG CÙNG một lần
sửa** — đổi chỗ một hàng rào mà chưa lệnh nào gọi nó thì coi như đã bỏ hàng rào.
Tiền lệ là phép quét chữ Việt: nó chạy bằng `npm run lint`, hồi quy ở
`lib/quet-chu-viet.test.ts`.

Tài liệu có hai người đọc khác nhau: `README.md` cho người phát triển, còn
`HUONG-DAN-BO-ME.md` (kèm ảnh trong `huong-dan-anh/`) cho bố mẹ dùng app thật —
viết không thuật ngữ, chỉ gọi tên thứ hiện trên màn hình. Đổi luồng hay đổi chữ
trên màn của bố mẹ/con thì sửa cả tệp đó, đừng chỉ sửa README.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
