# BTVN — Bài tập về nhà

> **Bạn là bố mẹ muốn dùng app?** Đọc [HUONG-DAN-BO-ME.md](HUONG-DAN-BO-ME.md)
> — hướng dẫn từng bước bằng tiếng Việt, không có thuật ngữ kỹ thuật.
> Phần dưới đây dành cho người phát triển.

Một chỗ duy nhất để bố mẹ đưa bài tập vào, và các con tự xem — tự tick hoàn thành.
Xem [PRD.md](PRD.md) để biết bối cảnh và phạm vi.

Hai phần trong cùng một app:

| Phần | Đường dẫn | Thiết bị | Đăng nhập |
| --- | --- | --- | --- |
| Của các con | `/con` | iPad (nằm ngang) | Không cần |
| Của bố mẹ | `/bome` | Điện thoại | Một mã PIN dùng chung |

**Nhiều gia đình dùng chung một bản deploy.** Mã PIN vừa là mật khẩu vừa là danh
tính của nhà: nhập PIN ra đúng một nhà, nên hai nhà không được trùng PIN. Xem
[Nhiều gia đình](#nhiều-gia-đình) bên dưới.

## Chạy thử

```bash
npm install
npm run db:seed      # tạo bảng + 1 nhà + 3 con + bài tập mẫu + 5 nhiệm vụ hàng ngày + 4 phần thưởng mẫu, PIN mặc định 1234
npm run db:seed:demo # (tuỳ chọn) thêm 3 nhà demo tiếng Nhật / Hàn / Anh — PIN 1111 / 2222 / 3333
npm run dev
```

Mở http://localhost:3000 → vào thẳng màn chọn con. Nút "Bố mẹ" ở góc dưới phải
dẫn sang phần của bố mẹ.

Đổi PIN khi seed: `PARENT_PIN=8520 npm run db:seed`

`db:seed` **xoá sạch mọi gia đình** rồi nạp lại dữ liệu mẫu — chỉ dùng khi dev.
Nó tự chặn lại nếu thấy `DATABASE_URL` (muốn xoá thật thì
`npm run db:seed -- --force`). Với DB thật thì dùng migration, xem bên dưới.

## Nhiều gia đình

Bố mẹ chia sẻ app cho bạn bè, mỗi nhà tự tạo hồ sơ của mình:

1. Mở web → **"Tạo nhà mới"** → đặt tên nhà, chọn mã PIN 4 số (nhập hai lần).
2. Thêm hồ sơ các con (tên, ảnh, lớp, màu riêng). Chưa có ảnh thì để tạm chữ cái
   đầu, thay ảnh thật sau.
3. Vào **Cài đặt → Link cho iPad của các con**, copy link `/nha/<mã nhà>` rồi mở
   một lần trên máy của các con.

Cách phân biệt nhà:

| Thứ | Việc |
| --- | --- |
| Mã PIN | Danh tính + mật khẩu của nhà. **Hai nhà không được trùng** — chọn trùng thì app báo chọn mã khác. |
| Cookie `btvn_parent` | Phiên của bố mẹ, mở được `/bome`. Mặc định hết khi đóng trình duyệt. |
| Cookie `btvn_nha` | "Máy này là của nhà nào", chỉ để màn của con biết hiện danh sách con nào. Sống một năm, **không** mở được gì của bố mẹ. |
| Link `/nha/<mã nhà>` | Gắn một máy vào một nhà. Mã nhà là chuỗi ngẫu nhiên (cột `families.slug`). |

Không có link thì trên iPad mở web → "Đây là máy của nhà nào?" → nhập PIN một
lần. Đường này **chỉ** gắn máy vào nhà, không mở phần bố mẹ, nên nhập PIN ở đây
trên iPad của các con vẫn an toàn.

## Đa ngôn ngữ (issue #46)

Chữ của app (nút, tiêu đề, thông báo) hiện theo **ngôn ngữ của nhà** — cột
`families.ui_locale` (`vi` | `en` | `ja` | `ko`, migration 018), mặc định tiếng Việt
cho mọi nhà đang có. Máy nhập PIN nhà nào thì thấy chữ của nhà đó; **không có nút
đổi ngôn ngữ**, và **không dịch chữ bố mẹ tự gõ** (đề bài, tên nhiệm vụ, tên phần
thưởng). Đừng nhầm với `assignments.lang`: cột đó là ngôn ngữ của *đề bài* (chọn
giọng đọc), có từ migration 001.

Tiếng Nhật, Hàn, Anh tồn tại để **demo cho khách hàng**: ba nhà demo với dữ liệu
mẫu đầy đủ (con, bài hôm qua/hôm nay/mai, nhiệm vụ cả hai nhóm, phần thưởng,
lịch sử ⭐, một yêu cầu chờ duyệt, một lần bị trừ ⭐):

| PIN | Ngôn ngữ | Link iPad |
| --- | --- | --- |
| `1111` | 日本語 | `/nha/demo-ja` |
| `2222` | 한국어 | `/nha/demo-ko` |
| `3333` | English | `/nha/demo-en` |

Nhảy giữa ba nhà demo (và về nhà thật) bằng cách mở link `/nha/<slug>` tương ứng:
mở một lần là máy gắn sang nhà đó và vào thẳng màn chọn con, không phải nhập gì
(`app/nha/[slug]/route.ts`).

Gắn máy sang **nhà khác** thì phiên bố mẹ đang mở bị gỡ, không chỉ đổi cookie thiết
bị. Bắt buộc phải thế: `viewingFamilyId` ưu tiên `btvn_parent`, nên nếu giữ phiên cũ
thì sang nhà B xong màn của con vẫn hiện nhà A — mà màn nhập PIN tự chuyển hướng đi
khi đã có phiên, và nút "Quên PIN trên thiết bị này" đã bỏ (issue #17), nên sẽ không
còn đường nào đổi nhà trong app. Gắn **lại chính nhà đang ở** thì giữ nguyên phiên.

Luật nằm trong `lib/auth.ts`, không ở từng route, vì có hai đường gắn máy:
`setDeviceFamily` (POST `/api/nha`, màn "Đây là máy của nhà nào?") và
`attachFamilyLink` (link `/nha/<slug>` — cần bản riêng vì đặt cookie trên một
response redirect đã tạo sẵn). `signIn` cũng đi qua `setDeviceFamily`, không tự đặt
cookie thiết bị. Hồi quy cho cả hai ở `lib/nha-link.test.ts`.

Đường về nhà thật chắc chắn nhất là mở lại link `/nha/<slug>` của nhà đó —
`attachFamilyLink` gỡ phiên bố mẹ của nhà khác. Màn `/vao` KHÔNG tới được khi đang
có phiên bố mẹ (`/bome/pin`, `/bome/tao-nha` và `/` đều chuyển hướng đi), nên đi
demo thì **lưu sẵn link của nhà thật vào dấu trang trước**.

Riêng **PIN demo thì chỉ mở phiên bố mẹ, không gắn máy**: gắn máy kéo dài một năm,
mà ba mã 1111/2222/3333 ai cũng biết và hay được nhập ngay trên máy nhà thật — hết
phiên là `viewingFamilyId` rơi về cookie thiết bị và màn của con sẽ hiện nhà demo.
PIN thật giữ nguyên hành vi cũ (mở phiên và gắn máy).

Ba mã PIN này **giữ chỗ vĩnh viễn** (`PIN_DEMO` trong `lib/i18n/ngonNgu.ts`):
tạo nhà / đổi PIN trùng bị từ chối ngay. Nhà demo dùng PIN dễ đoán nên chỉ chứa
dữ liệu mẫu, và `lib/nha-demo.test.ts` khẳng định không có đường nào từ nhà demo
nhìn sang nhà khác.

`npm run db:seed:demo` (`scripts/seed-demo.mjs`) nạp / nạp lại ba nhà này — chạy
được trên DB thật đang có nhà, chạy lại bao nhiêu lần cũng không sinh bản trùng
(id cố định, bên trong nhà demo xoá-nạp lại trong một transaction, chỉ lọc theo
`family_id` của nhà demo). Nó nằm trong `npm run build` sau migrate nên mỗi lần
deploy bản demo lại mới theo ngày hôm đó; lỗi ở bước này không làm hỏng build.
Nếu PIN demo đang là của một nhà thật (đăng ký trước khi giữ chỗ) thì nhà demo đó
bị bỏ qua và in cảnh báo.

**Chạy lại `npm run db:seed:demo` ngay trước mỗi buổi demo.** Ngày của dữ liệu mẫu
(hôm qua / hôm nay / mai) tính theo lúc CHẠY, mà lệnh này chỉ tự chạy lúc build —
nên vài ngày sau lần deploy, mọi bài của nhà demo đã thành quá khứ và màn của con
không còn thẻ bài nào (nó lọc từ hôm nay trở đi). Cố ý không thêm cron và cố ý
không đặc biệt hoá đường đọc cho nhà demo: một lệnh chạy tay trước buổi demo là đủ,
và nó chạy được bất cứ lúc nào trên DB đang chạy mà không đụng nhà thật
(`DATABASE_URL=... npm run db:seed:demo`; `lib/nha-demo.test.ts` chụp nhà thật
trước/sau để khẳng định).

Lớp dịch ở `lib/i18n/`: khoá là **chính câu tiếng Việt** trong mã nguồn —
`T('Hôm nay con là ai?')` — nên không phải đặt tên khoá; `en.ts` là danh sách khoá
(TypeScript báo lỗi khi gọi câu chưa có), `ja.ts`/`ko.ts` là `Record<Key, string>`
(thiếu câu nào cũng báo lỗi). Server component / route: `const T = await chu()`
(`lib/i18n/server.ts`); client component: `const T = useT()` (`lib/i18n/client.tsx`);
hàm thuần nhận `T` làm tham số. Tham số dạng `{n}`.

Hai lớp bảo vệ, chạy bằng hai lệnh khác nhau: `npm test` (`lib/i18n.test.ts`) kiểm
**hành vi** — ba từ điển đủ khoá, không rỗng, giữ đúng tham số, `dich`/`dienTham`
chạy đúng; còn `npm run quet:chu-viet` (`scripts/quet-chu-viet.mjs`) **quét mã
nguồn** mọi tệp giao diện để không còn câu tiếng Việt nào nằm ngoài `T(...)`. Phép
quét đứng riêng vì bằng chứng của nó là ký tự trong mã nguồn chứ không phải app
chạy ra gì — đó là việc của một bước kiểm mã nguồn, không phải của bộ kiểm thử.
Danh sách miễn trừ ở `MIEN_TRU` trong tệp đó, mỗi mục kèm một dòng lý do. Bản thân
logic của phép quét (nhận diện, miễn trừ) có hồi quy riêng ở
`lib/quet-chu-viet.test.ts` — nó gọi thẳng `kiemTep(...)` với chuỗi dựng sẵn, nên
chạy trong `npm test` mà không cần quét cả cây.

Phép quét chỉ bỏ qua literal nằm **ngay sau `T(`**, không bỏ qua mọi literal trùng
khoá dịch: một câu đã có trong từ điển mà dùng THÔ (`setError('Mã PIN không đúng.')`,
thiếu `T`) vẫn biên dịch được nên phải bị bắt. Vì thế các **bảng khai báo** khoá
(`SUBJECTS`, `THU`, `TABS`…) đi vào `MIEN_TRU` hoặc được nhận ra qua kiểu khai báo
`Key` của chính hằng số đó.

Ba phép đo, vì đo theo dấu thôi thì không đủ — "xong", "Giao cho", "Quay xong"
không có dấu nào: (1) còn dấu tiếng Việt ngoài `T(...)`; (2) trong `app/**`, đoạn
chữ tràn trong JSX (`>Chữ<`, và `{n} chữ</span>`); (3) trong `app/**`, giá trị
chuỗi của `placeholder`/`aria-label`/`title`/`alt`. Hai phép sau báo oan nhiều hơn
— đó là chủ ý, cái nào oan thật thì thêm vào `MIEN_TRU` kèm lý do.

Phép quét chạy trong `npm run lint` (`tsc --noEmit` + `npm run quet:chu-viet`), nên
không phải nhớ gọi tay.

Mọi truy vấn trong `lib/store.ts` đều nhận `familyId` và tự lọc theo nó — kể cả
đường con tick bài xong (việc nhà cũng đi đúng đường này), con nộp video và con
xin đổi thưởng (ba việc duy nhất không cần PIN, cùng xác thực bằng cookie thiết
bị). Biết id con hay id bài của nhà khác cũng không đọc/sửa được gì.

## Migration

Mọi thay đổi lược đồ nằm trong [migrations/](migrations/), mỗi thay đổi một tệp
`.sql` đánh số tăng dần:

```
migrations/001_khoi_tao.sql        5 bảng đầu tiên
migrations/002_moi_nha_mot_pin.sql unique index "mỗi nhà một PIN"
```

**Vercel tự chạy mỗi lần deploy** — `build` là `node scripts/migrate.mjs && node
scripts/seed-demo.mjs && next build`, nên push code lên GitHub là migration chạy
trước khi build. Migration lỗi thì build dừng, không deploy code mới lên DB cũ.
(Bước `seed-demo` nạp lại ba nhà demo và **không** làm hỏng build nếu lỗi — xem
mục [Đa ngôn ngữ](#đa-ngôn-ngữ-issue-46).)

Chạy tay khi cần: `npm run db:migrate` (không có `DATABASE_URL` thì chạy trên DB
local).

Thêm một thay đổi lược đồ:

1. Tạo tệp mới `migrations/003_....sql`. **Đừng sửa tệp đã chạy** — nó đã chạy ở
   DB thật rồi, sửa cũng không ai chạy lại.
2. Viết câu lệnh dạng chạy lại được (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
3. `npm run db:migrate` để thử ở máy, rồi commit cả tệp .sql lẫn code dùng nó.

Cách hoạt động:

- Bảng `_migrations` ghi tên các tệp đã chạy; tệp đã có trong đó thì bỏ qua.
- Mỗi tệp chạy trong **một transaction**, và dòng ghi vào `_migrations` nằm trong
  cùng transaction đó — nên không có chuyện chạy nửa vời rồi vẫn bị coi là xong.
  Vì vậy đừng viết `CREATE INDEX CONCURRENTLY` (không chạy được trong transaction)
  và đừng viết thân hàm `$$ ... $$` (bộ tách câu lệnh cắt ở dấu `;`).
- Deploy preview dùng chung `DATABASE_URL` với production thì migration sẽ được áp
  lên DB thật ngay khi build preview. Với các thay đổi thêm bảng/thêm cột thì
  không sao; muốn tránh thì cho preview một DB riêng. Nhưng câu "không sao" đó
  **chỉ đúng với thêm bảng/thêm cột**: migration ĐỔI DỮ LIỆU (như
  `011_nguon_khac.sql`, câu `UPDATE` gom bài cũ sang nguồn `Khác`) không nằm trong
  đó — nó sửa thẳng dữ liệu thật ngay lúc build preview, trước cả khi PR được duyệt.
  Đó là lý do lần này phải dùng `SKIP_MIGRATIONS=1`.
- Cần deploy gấp mà không muốn chạy migration: đặt `SKIP_MIGRATIONS=1`. Đây là
  **cách chữa tạm**, không phải cấu hình để yên:
  - Đặt được cho `011_nguon_khac.sql` vì tệp đó **không thêm cột** — preview vẫn
    chạy đúng với schema cũ.
  - Để cờ này lâu là **vỡ preview** ngay khi có migration thêm bảng/thêm cột: code
    mới deploy lên nhưng gặp schema cũ, thiếu thứ nó cần. Đã xảy ra thật với
    `012_nhiem_vu_moi_ngay.sql` (hai bảng mới): preview còn cờ này thì màn "Nhiệm
    vụ mỗi ngày" và màn khen của con lỗi dù mã đúng. Chữa: chạy migration lên DB
    thật một lần (`DATABASE_URL=... npm run db:migrate`) rồi bỏ cờ.
  - Cách dùng lâu dài là cho preview một DB riêng, đúng như gạch đầu dòng ngay trên
    đã khuyên.

## Biến môi trường

Chưa có biến nào thì app vẫn chạy đầy đủ bằng dữ liệu local — chỉ phần đọc ảnh
bằng AI là chưa hoạt động. Đặt vào `.env.local`:

| Biến | Chưa có thì sao | Lấy ở đâu |
| --- | --- | --- |
| `DATABASE_URL` | Dùng PGlite lưu ở `.data/pg` trên máy | Vercel → Storage → Neon |
| `BLOB_READ_WRITE_TOKEN` | Ảnh nhúng thẳng vào trang, video/tệp đính kèm ghi vào `.data/uploads` — chỉ chạy khi dev, deploy mà thiếu là con **không nộp video được** | Vercel → Storage → Blob |
| `NOUS_API_KEY` | Tách bài tạm theo dòng, có cảnh báo rõ cho bố mẹ | portal.nousresearch.com |
| `NOUS_MODEL` | Dùng `qwen/qwen3-vl-32b-instruct` — **phải là model có vision** | Danh sách ở `/v1/models` |
| `PIN_SECRET` | Dùng chuỗi mặc định — **phải đổi trước khi deploy** | Tự đặt |
| `BTVN_PGLITE_DIR` | PGlite ở `.data/pg` | Chỉ để test / thử trên DB tạm (`memory://` = trong RAM) |
| `CRON_SECRET` | `/api/don-video` trả 401 cho mọi request, tức **việc dọn video không chạy** | Tự đặt, ≥16 ký tự; Vercel tự gửi nó trong header `Authorization` khi gọi cron |
| `DON_VIDEO_CHAY_THAT` | Việc dọn video **chỉ chạy thử**: liệt kê ra log, không xoá gì | Đặt `1` để bật xoá thật — xem "Dọn video quá hạn" |
| `DON_VIDEO_MAX_MOI_LUOT` | Tối đa 20 tệp mỗi lượt | Hạ xuống được, không nâng lên được |

`PIN_SECRET` là gốc của cả hash PIN lẫn chữ ký cookie: **đặt một lần rồi không
đổi nữa**. Đổi nó là PIN của mọi nhà thành vô hiệu (hash trong DB không khớp
nữa) và mọi thiết bị bị đăng xuất.

Đổi `DATABASE_URL` là chuyển hẳn sang Neon, không phải sửa dòng code nào —
các migration chạy được trên cả hai.

## Dọn video quá hạn

Kho tệp Vercel Blob của gói Hobby chỉ có **1 GB** và app trước giờ không xoá tệp
nào. Một cron mỗi ngày (`vercel.json` → `/api/don-video`, `0 19 * * *` UTC ≈ 2 giờ
sáng giờ VN) dọn bớt video con nộp. Luật và bảy hàng rào an toàn ghi ở đầu
`lib/donVideo.ts`; đọc chỗ đó trước khi sửa.

**Luật:** xoá một video khi **cả hai** đúng — đã quá `SO_NGAY_GIU_VIDEO` (5) ngày
kể từ `submitted_video_at`, **và** không nằm trong `SO_VIDEO_MOI_NHAT_GIU_LAI` (3)
video mới nhất **của chính đứa con đó**. Hai hằng số ở `lib/donVideo.ts`, mỗi cái
một chỗ duy nhất. Trần dung lượng suy ra được: số con × 3 × cỡ video.

**Bật xoá thật lần đầu** (mặc định là chạy thử, deploy xong vẫn chưa xoá gì):

```bash
# 1. Xem trước bằng chế độ chạy thử — không xoá gì, kể cả khi đã bật biến ở dưới
BTVN_URL=https://<app> CRON_SECRET=<secret> node scripts/don-video.mjs --max 5

# 2. Đọc danh sách. Ưng thì đặt DON_VIDEO_CHAY_THAT=1 (và DON_VIDEO_MAX_MOI_LUOT=5
#    cho lượt đầu) trên Vercel rồi Redeploy.
# 3. Chạy thật, vẫn bằng tay:
BTVN_URL=https://<app> CRON_SECRET=<secret> node scripts/don-video.mjs --that --max 5
```

`--that` chỉ **bỏ** tham số ép chạy thử; nó không tự bật được xoá thật — quyền đó
nằm ở biến môi trường trên máy chủ. Hai khoá, hai nơi.

**Xoá tệp trên kho không lùi được.** Đường lùi duy nhất là sổ cái `video_cleanups`
(migration 019): mỗi tệp một dòng, ghi **cùng lúc** với lúc gỡ URL khỏi
`assignments` và **trước** khi gọi `del()`. Bảng `video_cleanup_runs` có chỉ mục
UNIQUE từng phần trên `(run_date) WHERE che_do = 'that'` — đó là hàng rào chống
cron gọi trùng một lượt, và nó nằm ở CSDL chứ không ở code.

Bố mẹ thấy việc này chạy hay không ở **Cài đặt → "Dọn video cũ"**.

## Cấu trúc

```
app/vao/        chọn nhà cho máy chưa gắn nhà nào (nhập PIN / tạo nhà mới)
app/nha/[slug]/ link gắn iPad vào một nhà (route handler, đặt cookie rồi redirect)
app/con/        5 màn của trẻ: chọn con → bài hôm nay → chi tiết → chúc mừng,
                và cửa hàng phần thưởng (thuong/)
app/bome/       màn của bố mẹ: PIN, tạo nhà, tổng quan, thêm bài, kiểm tra lại,
                nhập tay, sửa bài, thêm con, chi tiết theo con, danh sách,
                thưởng (duyệt đổi thưởng + danh sách phần thưởng + trừ ⭐ của
                con), cài đặt, nhiệm vụ hàng ngày (trang riêng: giao cho con
                nào, mấy ⭐, nhóm)
app/api/        children, assignments, pin, families (tạo nhà/đổi tên),
                nha (gắn máy), extract (Nous Portal), upload (ảnh đề bài),
                upload-media (tệp bố mẹ đính kèm), nop-video (video con nộp),
                viec-nha (cấu hình nhiệm vụ hàng ngày của bố mẹ, cần PIN),
                phan-thuong (bố mẹ đặt phần thưởng, cần PIN), tru-diem (bố mẹ
                trừ ⭐ của con, cần PIN), doi-thuong (con xin đổi — không cần
                PIN; bố mẹ duyệt — cần PIN), tep (đọc tệp đã ghi ở
                .data/uploads khi dev)
app/_components/ BanPhimPin — bàn phím số dùng chung cho 4 chỗ nhập PIN
lib/i18n/       lớp dịch: ngonNgu (bộ ngôn ngữ + PIN demo), chu (T), en/ja/ko (từ
                điển, khoá = câu tiếng Việt), server (chu()), client (useT)
lib/            db (Neon|PGlite), store (truy vấn theo familyId), auth (PIN +
                cookie có chữ ký), pin (PIN_LEN dùng cả hai phía), diem (luật
                tính điểm, hàm thuần), nhomNhiemVu (dòng nào nằm trên màn của
                con + hai nhóm nhiệm vụ), sqlNhiemVu (câu SQL tạo dòng nhiệm vụ
                của ngày, dùng chung với seed và test), sqlDiem (câu SQL số dư ⭐
                + trừ điểm + duyệt đổi thưởng, dùng chung với test), ngay (mốc
                ngày + múi giờ nhà), media + upload-route (giới hạn tệp, tên/URL
                tệp, thân chung hai route tải lên), avatar, ai, types
proxy.ts        chặn /bome/* khi chưa nhập PIN
migrations/     từng bước thay đổi lược đồ, chạy theo thứ tự tên tệp (bám PRD mục 7)
scripts/        db.mjs (kết nối + bộ chạy migration), migrate.mjs (CLI, chạy khi
                build), seed.mjs (dữ liệu mẫu để dev — xoá sạch trước khi nạp),
                seed-demo.mjs + demo-data.mjs (ba nhà demo, chạy khi build —
                nạp `.ts` bằng import() động để lỗi demo không hỏng build),
                quet-chu-viet.mjs (`npm run quet:chu-viet`, quét mã nguồn),
                test-hook.mjs (node --test resolve import không đuôi)
stitch/         bản Stitch gốc của phần trẻ (đối chiếu)
stitch-parent/  bản Stitch gốc của phần bố mẹ + design system
legacy-static/  bản HTML/JS thuần đầu tiên của phần trẻ, giữ để tham chiếu
```

## Vài điểm đáng lưu ý

**Hai bé sinh đôi.** Nhập một lần ra bài **riêng cho từng bé** — cùng đề nhưng
mỗi bé một bản ghi, tick độc lập, xoá bài của bé này không ảnh hưởng bé kia.
Màn "Thêm bài tập" tick sẵn cả hai bé lớp 1 vì đây là trường hợp dùng nhiều nhất.

**Bài đến từ ba nơi.** Trường **Nguyễn Siêu**, lớp tiếng Anh **Smartkid**, và
**Khác** cho những nơi còn lại. Mỗi bài có trường `source` (nơi giao); màn của con
nhóm bài theo nơi giao, mỗi nhóm có tiến độ riêng — để con làm xong hết một loại
rồi mới sang loại kia; nhóm rỗng thì không hiện. Bố mẹ chọn nơi giao khi thêm bài
(mặc định "Tự đoán": đề tiếng Anh xếp vào Smartkid) và sửa lại được sau khi lưu.

Thêm nguồn mới thì nối vào **cả** union `HwSource` **và** bảng `HW_SOURCES` trong
`lib/types.ts` (thiếu một bên là TypeScript báo lỗi ngay, không hỏng âm thầm) —
không cần migration (DB không có `CHECK`), và `hwSourceOf` lọc theo **tập khoá
thật** của `HW_SOURCES` nên tự nhận nguồn mới. Nhãn hiển thị đổi tự do; **mã
định danh lưu trong DB thì không** (`primary_school`, `english_class`, `other`).

`inferSource` (`lib/ai.ts`) **cố ý** chỉ đoán ra hai nguồn, không bao giờ đoán
"Khác" — đó là lựa chọn của con người, máy đoán ra thì bố mẹ mất dấu bài thật sự
đến từ đâu.

**Giọng đọc.** Mỗi bài có trường `lang` (`vi`/`en`) quyết định giọng đọc thành
tiếng. Bé 4 tuổi chưa đọc được chữ nào nên nút 🔊 gần như là cách duy nhất để
biết phải làm gì — đọc đề tiếng Anh bằng giọng Việt thì bé nghe không hiểu.
Bố mẹ sửa được trường này ở màn "Kiểm tra lại".

**Đồng hồ làm bài.** Mỗi bài có `duration_minutes` — AI ước 5–15 phút theo độ
phức tạp (kẹp trong khoảng đó), bố mẹ sửa được ở màn "Kiểm tra lại" / "Sửa bài
tập" / "Nhập tay" (sửa tay thì được ra ngoài khoảng, tối đa 180 phút). Ở màn của
con, bấm "Bắt đầu làm" là đếm ngược: vòng tiến độ đổi màu xanh → vàng → đỏ nhạt,
giọng nói nhắc mỗi 5 phút và phút cuối, hết giờ chuông dịu + đếm quá giờ màu xám
(không phạt), xong khi còn giờ thì confetti + lời khen. Mốc bắt đầu lưu trong
`localStorage` theo id bài nên lỡ reload giờ không trôi; quá giờ hơn một tiếng
thì mốc hết hiệu lực và nút "Bắt đầu làm" hiện lại, để bài con bỏ dở hôm trước
không kẹt mãi ở trạng thái quá giờ. Lúc con tick xong, máy con gửi mốc đó lên
kèm (`assignments.started_at`) để máy chủ xét "xong sớm" và cộng điểm (mục
**Điểm thưởng** ở dưới).

Con bấm nhầm "Bắt đầu làm" thì bố mẹ xoá mốc đó bằng nút nhỏ **"Bố mẹ đặt lại
giờ"** ngay dưới đồng hồ (`DatLaiGio.tsx`): nhập mã PIN của nhà là bài quay về
trạng thái chưa bấm. Nút phải nằm **trên chính máy của con** vì mốc của bài đang
làm chỉ có trong `localStorage` của máy đó (máy chủ chỉ nhận một bản lúc con tick
xong, để làm bằng chứng tính điểm) — một nút đặt lại đặt ở phần `/bome` sẽ không
với tới được iPad của con. PIN ở đây chỉ được *kiểm tra* qua
`POST /api/pin/kiem-tra`, không đặt cookie `btvn_parent`, để máy dùng chung của
các con không vô tình mở được phần bố mẹ (PRD 4.5).

**Nộp bài bằng video.** Bài kiểu "đọc to", "đọc thuộc lòng", "quay video gửi cô",
thể dục/biểu diễn có trường `requires_video` — AI tự bật khi tách bài, bố mẹ
bật/tắt lại được bằng chip 🎥 ở màn "Kiểm tra lại" / "Nhập tay" và ô tick 🎥 ở
màn "Sửa bài tập". Ở màn của con, bài gắn cờ hiện khung quay ngay trong trang (`MediaRecorder`, mp4 trên
Safari và webm trên Chrome cũ) kèm xem trước và quay lại. Đây là đường quay
**duy nhất**: nút "quay bằng máy ảnh của hệ điều hành" đã bỏ (#51, con luôn dùng
iPad hoặc MacBook có camera), nên mở camera thất bại thì app phải nói rõ cho con
phải làm gì: quyền bị từ chối, không có camera, camera đang bị ứng dụng khác dùng,
và một câu chung cho các lỗi còn lại (`CAU_BAO_MO_CAMERA` trong `lib/phienQuay.ts`
— chỉ `NotReadableError` mới là "đang bận"; `AbortError` không nói gì về việc máy
bị ứng dụng khác chiếm nên đi vào câu chung). Quay tối đa 10 phút
(`MAX_QUAY_GIAY`), máy tự dừng khi hết giờ. Vòng đời ghi nằm ở
`lib/phienQuay.ts` kèm **bộ canh luồng đứng** (#51: trên MacBook Safari camera
có thể ngừng sinh khung giữa buổi trong khi `MediaRecorder` vẫn chạy — phần sau
mốc đứng không bao giờ được ghi, không vá metadata nào cứu được): app theo dõi
khung có còn tới khung xem trước không (`requestVideoFrameCallback`) và sự kiện
`mute`/`ended` của track; đứng quá 4 giây thì tự dừng, **không lưu**, báo con
mở máy quay quay lại. Hai tín hiệu đó **không ngang nhau**: `mute`/`ended` đến
từ chính track của camera nên luôn có hiệu lực, còn nhịp khung chỉ đo *khung xem
trước* có chiếu được không — con cuộn khung ra khỏi vùng nhìn giữa buổi quay, hay
khung bị dừng (`play()` bị từ chối, hoặc WebKit tự treo media nên `pause` bắn ra
giữa buổi — app nghe `pause` để chạy lại và báo con chạm vào khung), là nhịp im
lặng dù camera vẫn chạy. Vì thế bộ đếm khung tạm ngưng khi khung xem trước không
chiếu (cùng với hai hàng rào cũ: tab ẩn và luồng chính bị nghẽn), để không vứt
mất một bản quay tốt. Hàng rào khung cũng chỉ **bật sau nhịp đầu tiên**:
`hoTroNhipKhung()` chỉ biết trình duyệt *có* hàm rVFC, không biết nó có bắn cho
luồng xem trước hay không — máy không bao giờ bắn nhịp thì hàng rào đó im hẳn
(lùi về `mute`/`ended`) chứ không vứt mọi bản quay của mọi máy; cú đứng giữa
buổi vẫn bắt được vì nhịp đã chạy trước đó.

Mở camera thất bại còn một ca tách riêng: trang mở bằng **http** trên mạng trong
nhà thì `navigator.mediaDevices` không tồn tại, nên app nói đúng việc phải làm
(mở lại bằng địa chỉ https) thay vì báo trình duyệt cũ — `allowedDevOrigins`
trong `next.config.ts` đi qua đúng đường này.

**Gửi video chính là "đã làm xong"** — bài gắn cờ không có nút tick riêng và
server cũng chặn tick xong khi chưa có video. Mỗi bài giữ **một video mới nhất**
(quay lại là thay URL, không giữ lịch sử). Video đi qua route riêng
`/api/nop-video` (xác thực bằng cookie thiết bị vì con không có PIN, chỉ nhận
video, trần 250MB vì máy quay của iPad ghi ~60MB/phút). Bố mẹ thấy badge
🎥 "Đã nộp video" / "Chờ quay video" ở màn chi tiết theo con và phát lại video
trong màn "Sửa bài tập".

**Quét mã QR trên tờ bài tập.** Nhiều tờ bài tập giấy in mã QR dẫn tới đoạn nghe
của nhà xuất bản. Màn chi tiết bài của con có nút **"Quét mã QR"** mở khung quét
bằng máy ảnh của máy (`QuetQR.tsx`): ưu tiên máy ảnh **sau** (`facingMode: ideal
'environment'` — iPad soi tờ giấy), laptop chỉ có máy ảnh trước thì trình duyệt
tự lấy cái đang có. Giải mã **ngay trên máy** bằng `jsqr` (thuần JavaScript, nạp
động lúc con bấm nút, không kèm worker/wasm phải cấu hình đường dẫn) — khung hình
đi `<video>` → `<canvas>` → jsQR trong cùng một tab, **nội dung mã không rời khỏi
máy**. Không dùng `BarcodeDetector` của trình duyệt vì Safari trên iPadOS chưa có.

Quét xong thì hiện luôn cho con thấy: đuôi tệp là **audio/video** thì phát ngay
trong ứng dụng (đồng hồ làm bài vẫn chạy, con không phải rời màn); là **liên kết
thường** thì hỏi trước rồi mới mở tab mới; là **chữ** thì hiện nguyên văn. Phát
không được (nhà xuất bản chặn) thì tự lui về hỏi mở trang.

**Máy ảnh tắt hẳn** khi đọc được mã, khi con bấm "Đóng", và khi rời màn — kể cả
khi luồng `getUserMedia` mới về sau lúc đã đóng (để luồng chạy ngầm trên iPad là
tốn pin và đèn máy ảnh sáng mãi). Không mở được máy ảnh thì có đường lui **chụp
ảnh mã** (`capture="environment"`) rồi đọc trên ảnh.

**Nhiệm vụ hàng ngày.** Mỗi nhiệm vụ là **dòng bài tập thật** trong bảng
`assignments`, cột `chore_id` là dấu hiệu duy nhất nhận ra chúng; cấu hình nằm ở
`daily_chores`. Có **hai nhóm** (cột `category`): **"Sau khi học xong"** — dọn dẹp,
chuẩn bị đồ dùng (ba việc mặc định nạp sẵn cho mọi nhà: cất sách vở vào ba lô /
tắt đèn học / soạn sách vở cho ngày mai, mỗi việc 1 ⭐) — và **"Việc nhà hàng
ngày"** — việc nhà của con. Mỗi nhiệm vụ có tên, icon một emoji, **số ⭐ (1–10)**,
nhóm và **"giao cho"** (mặc định cả nhà, hoặc chọn từng con — `child_ids`, NULL =
cả nhà). Nhiệm vụ hiện **mỗi ngày, kể cả cuối tuần và ngày không có bài**: dòng của
ngày được **tạo lười khi mở màn** (`taoNhiemVuNgay` — một câu `INSERT … SELECT …
ON CONFLICT DO NOTHING`, gọi ở màn của con, màn chọn-con, chi tiết con của bố mẹ,
lúc bố mẹ giao bài và lúc bố mẹ đổi hạn chót một bài sang ngày khác), không cần
cron. Hai lời gọi sau cùng còn **gác điểm +10**: dòng nhiệm vụ `todo` của ngày đó
là thứ chặn "+10 một ngày xong hết" cộng sớm khi con làm xong bài của ngày mai
ngay tối nay. Trên màn của con chúng xếp thành **hai nhóm
riêng cuối cùng** và **chỉ hiện việc của hôm nay** (dòng của ngày mai vẫn tạo sẵn
nhưng không vẽ — tick được là ⭐ trước một ngày; bài tập ngày mai thì vẫn hiện),
mỗi dòng có icon + chip "⭐ N"; con bấm là tick ngay tại chỗ (không mở màn chi
tiết bài), tick xong hiện chip "+N ⭐". Xong hết cả bài lẫn nhiệm
vụ mới sang màn khen "Giỏi quá!". Badge ở màn chọn-con nói **"N việc"** = **đúng
những gì màn của con đang vẽ và cho tick**: bài tập từ hôm nay trở đi + nhiệm vụ
của hôm nay, đếm gộp hai loại. Nên tối bố mẹ đã nhập bài cho hôm sau, con tick
xong hết việc hôm nay thì badge đọc "1 việc" (bài ngày mai) chứ chưa phải "Xong
hết 🎉" — muốn "Xong hết 🎉" thì làm luôn bài ngày mai. "Chưa có bài" chỉ khi
không có gì cả. Cùng một bộ lọc dùng cho hai ô "Hoàn thành" / "Đang chờ" ở màn
tổng quan của bố mẹ (khối "Việc từ hôm nay trở đi"; ô "Quá hạn" thì loại nhiệm vụ
ra, xem đoạn dưới) — xem `lib/nhomNhiemVu.ts` và bất biến ở AGENTS.md.

**Một danh sách chung cả nhà**, bố mẹ sửa ở trang riêng **Cài đặt → "Nhiệm vụ hàng
ngày"** (cũng vào được từ dòng dẫn trên màn Thưởng): đổi chữ / icon / sao / nhóm /
giao cho, đổi thứ tự bằng hai nút mũi tên, bật/tắt, xoá. Mọi thay đổi chỉ ảnh
hưởng những dòng **tạo sau đó** — tên/icon/sao đã chép sang dòng bài lúc tạo (riêng
nhóm đọc live nên đổi nhóm là dòng hôm nay đổi chỗ theo). Xoá là **đánh dấu bỏ**
(không khôi phục được): nhiệm vụ biến mất khỏi cài đặt và không tạo cho ngày nào
nữa, nhưng những ngày đã tạo giữ nguyên, kể cả các lần con đã tick và ⭐ đã cộng.
Bố mẹ xem "Nhiệm vụ hàng ngày — 2/5 xong" ở màn chi tiết theo con; ô "Quá hạn" ở
màn tổng quan và tiến độ bài tập ở hai màn của bố mẹ **không** đếm nhiệm vụ
(`listAssignments` mặc định loại chúng), còn Hoàn thành / Đang chờ thì có. Vì nhiệm
vụ là bài tập thật, nút **"Xoá tất cả bài tập và việc nhà"** xoá luôn cả lịch sử.

**Điểm thưởng.** Xong hết một ngày (cả bài tập **lẫn** nhiệm vụ của ngày đó) được
**+10 điểm**, cộng một lần cho mỗi con mỗi ngày — ngày đó phải **có ít nhất một
bài tập**, nên cuối tuần chỉ có nhiệm vụ thì con chỉ được ⭐ của từng nhiệm vụ; mỗi bài xong sớm hơn thời lượng
dự kiến của chính bài đó được **+1**; mỗi **nhiệm vụ hàng ngày** tick xong được
thêm **đúng số ⭐ của nó** (cộng thêm, không thay +10; cộng một lần cho mỗi dòng —
bỏ tick không rút, tick lại không cộng lại; dòng việc nhà cũ tạo trước khi có sao
thì mãi không có sao, không hồi tố). Luật đầy đủ — "sớm" đo bằng mốc con bấm
"Bắt đầu làm", và ngày trước `families.score_since` **không** được tính (không
hồi tố) — ở chú thích đầu `lib/diem.ts`,
[migrations/015_tinh_diem_doi_thuong.sql](migrations/015_tinh_diem_doi_thuong.sql) và
[migrations/016_nhiem_vu_hang_ngay_thuong_sao.sql](migrations/016_nhiem_vu_hang_ngay_thuong_sao.sql).
Con thấy số ⭐ của **mình và của anh chị em** ngay ở màn chọn con, kèm **bảng xếp
hạng** cả nhà (bố mẹ chốt để cả nhà cùng thấy); +1 hiện ở tấm "Giỏi quá!" của
từng bài, "+N ⭐" hiện ngay trên dòng nhiệm vụ vừa tick, +10 hiện ở màn khen cuối
ngày. Bố mẹ thấy điểm từng con ở màn tổng quan.

**Đổi thưởng.** Phần thưởng là **một danh sách chung cả nhà** (như nhiệm vụ): bố
mẹ đặt tên, icon và giá ⭐ ở màn **Thưởng**, bật/tắt hoặc xoá được; con thấy đúng
danh sách đó ở 🎁 **"Đổi thưởng"**, bấm rồi hỏi lại một lần trước khi gửi. **Bố
mẹ duyệt thì điểm mới bị trừ** — từ chối thì con giữ nguyên điểm và xin lại được,
mỗi con chỉ có **một** yêu cầu chờ cùng lúc. Số dư = tổng điểm cộng **trừ** các
lần đổi đã duyệt **trừ** các lần bố mẹ trừ (dưới); không có dòng điểm âm nào, và
con bỏ tick hay bố mẹ xoá bài cũng không làm con mất điểm đã kiếm.

**Trừ điểm (issue #43).** Con chưa nghe lời thì bố mẹ trừ ⭐ ngay ở màn **Thưởng**:
bấm viên ⭐ của con, **gõ số ⭐ muốn trừ** (không gõ "tổng mới"), ghi lý do — không
bắt buộc, có chip gợi ý viết bằng lời nói được với con vì **con sẽ đọc dòng đó** ở
cửa hàng ("Bố mẹ đã trừ ⭐": −3 ⭐ · Cãi bố mẹ; để trống thì con thấy "Con hỏi bố mẹ
vì sao nhé"). Chỉ trừ, **không có đường cộng tay**. Số dư không bao giờ âm, dựa trên
hai luật ở **một hàm thuần** `trangThaiTruDiem` (`lib/types.ts`) + `SQL_TRU_DIEM`:

1. **Nút làm đúng những gì nhãn của nó ghi.** `soGui` vừa là con số in trên nhãn vừa
   là con số gửi lên (`{ points: soGui }` — một dạng thân duy nhất cho cả hai mặt
   nút). Gõ quá số đang hiện thì nút đổi mặt thành **"Trừ hết N ⭐"** với N = số đang
   hiện, và bấm là trừ **đúng N** — ô còn gõ 8 mà nhãn ghi 5 thì trừ 5, kể cả khi con
   vừa kiếm thêm thành 20.
2. **Màn hình không bao giờ tự từ chối, máy chủ mới từ chối.** Số ⭐ màn đang giữ có
   thể đã cũ theo cả hai chiều, kể cả số 0, nên gõ được số hợp lệ là bấm được. Máy
   chủ ghi `LEAST(số nhận được, số dư lúc chạy câu)` — con còn ít hơn nhãn thì trừ hết
   chỗ còn — và chỉ từ chối khi con **không còn ⭐ nào** (400 kèm `conLai` để màn sửa
   lại viên ⭐ ngay).

Mỗi lần trừ là **một dòng `score_penalties`** lưu đúng số đã trừ + lý
do + thời điểm (bảng riêng, không phải dòng âm trong `score_events`, không phải đổi
thưởng giả — lý do ở [migrations/017_tru_diem.sql](migrations/017_tru_diem.sql));
kiểm-và-ghi chạy trong **một transaction có khoá theo con** (`queryTx` trong
`lib/db.ts`, SQL ở `lib/sqlDiem.ts`) nên hai request cùng lúc không đẩy số dư xuống
âm. **Cả hai đường trừ ⭐ xếp hàng ở cùng một khoá đó**: `duyetDoiThuong` cũng chạy
trong transaction ấy với `SQL_DUYET_DOI_THUONG` (UPDATE có điều kiện số dư ≥ giá),
vì "không âm" là luật của số dư chứ không của riêng một đường — đọc số dư ở một câu
rồi UPDATE ở câu sau là đúng chỗ để bố mẹ A bấm Duyệt và bố mẹ B bấm Trừ ⭐ đan vào
nhau. Cũng vì hai bố mẹ có thể bấm Duyệt cùng lúc, nhánh duyệt đọc **trạng thái**
dòng (`SQL_TRANG_THAI_DOI_THUONG`) để phân biệt "đã xử lý rồi" (409) với "chưa đủ
điểm" (400): sau khi bên kia duyệt xong thì giá đã bị trừ, nên số dư gần như luôn nhỏ
hơn giá và nếu chỉ đọc số dư thì app sẽ mời bố mẹ đi từ chối một thứ đã cho rồi. Trừ
điểm không đụng vào ba luật cộng.

**Không bao giờ để bố mẹ bị kẹt.** AI hỏng, hết quota hay chưa có key thì vẫn
tách tạm theo dòng kèm cảnh báo, và luôn có đường "Nhập tay từng bài".

**PIN trên iPad.** Ô "Nhớ trên thiết bị này" mặc định **không** tick. iPad là máy
dùng chung của các con — nhớ PIN ở đó thì PIN mất tác dụng. Không tick thì phiên bố
mẹ hết ngay khi đóng trình duyệt. Trót tick rồi thì xoá dữ liệu site của trình duyệt
trên đúng máy đó: nút "Quên PIN trên thiết bị này" đã bỏ theo yêu cầu của captain ở
issue #17 và **không được thêm lại** (đường `DELETE /api/pin` vẫn còn nhưng không
giao diện nào gọi).

**Riêng tư.** App chạy trên internet công khai còn màn của con không đăng nhập,
nên toàn site đặt `noindex`, và mỗi gia đình có `slug` ngẫu nhiên làm đường dẫn
khó đoán.

**Đổi PIN không đăng xuất máy khác.** Cookie phiên ký theo id của nhà, không theo
PIN. Vì không còn nút "Quên PIN trên thiết bị này" (issue #17), cách đóng phần bố mẹ
trên một máy là đóng trình duyệt (khi chưa tick "Nhớ") hoặc xoá dữ liệu site. Màn
hình của con không phụ thuộc phiên bố mẹ nên vẫn mở lên là chạy — đúng cho iPad dùng
chung.

## Trước khi deploy

1. Đặt các biến môi trường trên Vercel, đặc biệt `PIN_SECRET` (đặt một lần, đừng đổi).
2. `DATABASE_URL` phải thấy được **lúc build** (Vercel: tick cả Production và
   Preview) — migration chạy trong bước build. Thiếu nó thì build dừng kèm lời
   nhắc, không âm thầm bỏ qua.
3. Đừng chạy `db:seed` trên DB thật — nó xoá mọi gia đình.
4. Kiểm tra trên **iPad thật** (giọng `vi-VN` có sẵn không, vùng bấm có vừa
   ngón tay trẻ con không, quay video trong trang có ra mp4 và phát lại được
   không) và **điện thoại thật**. Không thay thế được bằng máy tính.
