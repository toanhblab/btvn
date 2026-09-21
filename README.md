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
3. Xem **mã nhà** ở **Cài đặt** (trên máy tính thì nó nằm sẵn ở đầu thanh bên
   trái, ngay dưới tên nhà), rồi mở link `/nha/<mã nhà>` một lần trên máy của các
   con.

Cách phân biệt nhà:

| Thứ | Việc |
| --- | --- |
| Mã PIN | Danh tính + mật khẩu của nhà. **Hai nhà không được trùng** — chọn trùng thì app báo chọn mã khác. |
| Cookie `btvn_parent` | Phiên của bố mẹ, mở được `/bome`. Mặc định hết khi đóng trình duyệt. |
| Cookie `btvn_nha` | "Máy này là của nhà nào", chỉ để màn của con biết hiện danh sách con nào. Sống một năm, **không** mở được gì của bố mẹ. |
| Link `/nha/<mã nhà>` | Gắn một máy vào một nhà. Mã nhà là chuỗi ngẫu nhiên (cột `families.slug`). |

Cài thành app trên màn hình chính (issue #70): `app/api/manifest/route.ts` + `app/icon.png`
/ `app/apple-icon.png` / `public/icons/` (nguồn `icon.svg`, dựng PNG bằng
`qlmanage -t -s <cỡ>`) và `appleWebApp` trong `app/layout.tsx`. **Không có service
worker**, cố ý — xem chú thích đầu `app/api/manifest/route.ts`. `start_url` là
`/nha/<mã nhà>` của nhà đang mở vì app cài trên iOS có kho cookie riêng với Safari;
mã nhà đi qua query của `<link rel="manifest">` (ghép ở `app/layout.tsx`) vì trình
duyệt tải bản kê khai không kèm cookie. Muốn bỏ tính năng thì xoá các tệp đó, thẻ
`<link rel="manifest">` + `<meta apple-mobile-web-app-capable>` và hai khoá
`appleWebApp` / `themeColor` — không có gì nằm lại trên máy người dùng ngoài biểu
tượng họ tự xoá.

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
không còn "Hôm nay" nào: bài của hôm qua đã seed sẵn 'done' nên biến mất, còn bài
của "hôm nay" tụt xuống thành mấy nhóm bài quá hạn chưa xong (issue #55) — vẫn
hiện, nhưng không còn giống một ngày thật để đem đi demo. Cố ý không thêm cron và cố ý
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
| `ZALO_INTAKE_SECRET` | Ba cửa `/api/nhan-bai-zalo*` trả **503** cho mọi request, tức **bài từ Zalo không vào được** | Tự đặt, ≥24 ký tự; nạp cùng chuỗi đó vào Keychain của zalo-agent — xem "Bài từ Zalo" |
| `DON_VIDEO_CHAY_THAT` | Việc dọn video **chỉ chạy thử**: liệt kê ra log, không xoá gì | Đặt `1` để bật xoá thật — xem "Dọn video quá hạn" |
| `DON_VIDEO_MAX_MOI_LUOT` | Tối đa 20 tệp mỗi lượt | Hạ xuống được, không nâng lên được; đặt mà không phải số nguyên dương thì `/api/don-video` trả **400 và không dọn gì** (đọc không ra thì từ chối, không lùi về trần mặc định) |

`PIN_SECRET` là gốc của cả hash PIN lẫn chữ ký cookie: **đặt một lần rồi không
đổi nữa**. Đổi nó là PIN của mọi nhà thành vô hiệu (hash trong DB không khớp
nữa) và mọi thiết bị bị đăng xuất.

Đổi `DATABASE_URL` là chuyển hẳn sang Neon, không phải sửa dòng code nào —
các migration chạy được trên cả hai.

## Bài từ Zalo

Cô giáo đăng bài tập lên nhóm Zalo của lớp. `zalo-agent` (kho riêng
`toanhblab/zalo-agent`, chạy trên Mac mini ở nhà) đọc tin cùng tệp kèm rồi gọi
vào btvn. btvn lưu **nguyên văn** tin, chạy bộ tách bài sẵn có, và tạo bài
**NHÁP** cho từng con của nguồn. Bố mẹ đọc, sửa nếu cần, bấm **Duyệt** —
lúc đó con mới thấy bài. Captain chốt 2026-09-20: *"cần bố mẹ duyệt"*.

Lược đồ và lý do từng bảng ở `migrations/021_nhan_bai_tu_zalo.sql`; phần thuần
(đọc gói tin, luật hạn nộp, luật tệp) ở `lib/zalo.ts`; phần chạm CSDL và kho
tệp ở `lib/nhanBaiZalo.ts`.

### Ba cửa cho máy, không cho người

Cả ba dùng `Authorization: Bearer <ZALO_INTAKE_SECRET>` (biến **riêng**,
không dùng chung `CRON_SECRET`: hai bên gọi là hai hệ khác nhau, lộ một khoá
không được kéo theo cái kia). Chuỗi trả về là chuỗi **máy đọc**, không qua lớp
dịch — cùng tinh thần với `/api/don-video`.

```bash
KHOA=... ; URL=http://localhost:3000

# 1. Nguồn đang bật, để zalo-agent biết quét nhóm nào (kèm `gioi_han` của cửa nhận)
curl -s "$URL/api/nhan-bai-zalo/cau-hinh" -H "Authorization: Bearer $KHOA"

# 2. Có tệp kèm thì xin vé rồi tải THẲNG lên kho, TRƯỚC khi gửi tin.
#    Thân gói vé đúng giao thức @vercel/blob/client; đường dẫn bắt buộc nằm dưới
#    zalo/<nguon_id>/<yyyy-mm-dd>/ và `ma_tin` đã nhận rồi thì trả 409 ngay.
#    CẢ BỐN tham số đều BẮT BUỘC: thiếu `tin_gui_luc` hay `tep_gui_luc` là 422.
curl -s -X POST "$URL/api/nhan-bai-zalo/tep-token?nguon_id=nzl_cambridge&ma_tin=bb_msg_id_1\
&tin_gui_luc=2026-09-18T20:03:17%2B07:00&tep_gui_luc=2026-09-18T20:03:21%2B07:00" \
  -H "Authorization: Bearer $KHOA" -H 'Content-Type: application/json' \
  -d '{"type":"blob.generate-client-token",
       "payload":{"pathname":"zalo/nzl_cambridge/2026-09-18/video-mau.mp4",
                  "callbackUrl":"'"$URL"'/api/nhan-bai-zalo/tep-token",
                  "clientPayload":null,"multipart":false}}'

# 3. Một tin giao bài — `dinh_kem` chỉ mang URL tệp đã nằm trên kho
curl -s -X POST "$URL/api/nhan-bai-zalo" \
  -H "Authorization: Bearer $KHOA" -H 'Content-Type: application/json' \
  -d '{"nguon_id":"nzl_cambridge","ma_tin":"bb_msg_id_1","gui_luc":"2026-09-18T20:03:17+07:00",
       "nguoi_gui":"Thu Huyền","nhom_zalo":"Cambridge 1.27 - Smart Kids Education",
       "ma_nhom":"g6948518348545773767",
       "ngay_hoc_so":40,"ngay_trong_tin":"2026-09-18","nguyen_van":"Cô Huyền thân gửi …",
       "nhan_dien":{"luat":true,"jev_xac_suat":0.96},
       "dinh_kem":[{"ten":"video-mau.mp4","loai":"video/mp4","kich_thuoc":2284512,
                    "gui_luc":"2026-09-18T20:03:21+07:00",
                    "url":"https://<kho>.public.blob.vercel-storage.com/zalo/nzl_cambridge/2026-09-18/video-mau-abc123.mp4"}]}'
```

Máy dev **chưa bật Blob** thì bước 2 là `POST` multipart (`file=@…`) vào cùng
đường đó và trả `{ "url": "/api/tep/<tên>" }` — đúng khuôn chế độ 2 của
`lib/upload-route.ts`; cửa nhận tin chấp nhận dạng URL đó **chỉ khi** máy chủ
thật sự chưa có `BLOB_READ_WRITE_TOKEN`.

Mã trả về — **hợp đồng**, đổi là đổi cả hai bên. Mã lỗi luôn nằm ở trường
**`loi`** của thân JSON, ở **cả ba** cửa và kể cả những mã do thân chung
`xuLyTaiTep` sinh ra (`tenTruongLoi`): agent đọc log bằng đúng một khoá. Hai
route tải tệp của người (`/api/upload-media`, `/api/nop-video`) vẫn trả `error`
kèm câu đã dịch — giao diện bố mẹ/con đọc trường đó.

| Mã | Khi nào |
| --- | --- |
| `201` | Xong. `{ bai_zalo_id, so_bai_nhap, con: [{ id, ten }], tep_bo_qua: [{ ten, ly_do }] }` |
| `400` | Gói hỏng: **thiếu trường bắt buộc** (`nguon_id` / `ma_tin` / `nguyen_van`) — chỉ ba mã này, không còn mã nào liên quan tới tệp |
| `401` | Thiếu hoặc sai khoá — **không nói là cái nào** |
| `404` | `nguon_id` không có, nguồn đang tắt, hoặc nguồn chưa gắn con nào |
| `409` | `ma_tin` đã có cho nguồn đó — **không tạo gì**. zalo-agent chạy lại mỗi 30 phút nên đây là đường bình thường, không phải lỗi |
| `422` | **Chỉ cửa vé**: `thieu-gio-gui` (thiếu **hoặc không đọc được** `tin_gui_luc` / `tep_gui_luc`) hoặc `ngoai-cua-so` (tệp gửi ngoài `cua_so_dinh_kem_phut` của nguồn) — không phát vé, để agent khỏi tải lên thứ cửa nhận tin sẽ bỏ |
| `503` | Máy chủ **chưa đặt `ZALO_INTAKE_SECRET`** |

`POST /api/nhan-bai-zalo/tep-token?nguon_id=&ma_tin=&tin_gui_luc=&tep_gui_luc=`
dùng **cùng khoá** đó, và thêm `501 kho-khong-doc-duoc` khi máy chủ có
`BLOB_READ_WRITE_TOKEN` nhưng **không rút được mã kho** từ nó: lúc đó cửa nhận
tin từ chối mọi url Blob, nên ký vé chỉ để agent đẩy tệp lên kho rồi bước sau bỏ
sạch với `ngoai-kho` và 409 khoá vĩnh viễn. Cả hai cửa hỏi **cùng một hàm**
(`trangThaiKhoZalo`), không chép lại điều kiện. **Cả bốn tham số đều bắt buộc** — `tin_gui_luc` là giờ gửi
của TIN, `tep_gui_luc` là giờ gửi của chính tệp sắp tải lên (ISO 8601, nhớ
percent-encode dấu `+` của múi giờ thành `%2B`). Mốc **không đọc được** cũng là
`422 thieu-gio-gui`, không phải "cứ cho qua": quên `%2B` thì `URLSearchParams`
đổi dấu `+` thành khoảng trắng và mốc thành vô nghĩa, mà thân gói tin (JSON) lại
đúng — cho qua ở đây là tệp lên kho rồi mới bị cửa nhận tin bỏ.

Cửa vé thêm `400 sai-duong-dan` (đường dẫn ra ngoài `zalo/<nguon_id>/<ngày>/`) và
`422` (`thieu-gio-gui` / `ngoai-cua-so`); còn lại nó trả lời **đúng như cửa nhận
tin**: `404` khi nguồn không có / đang tắt / chưa gắn con, `409 trung-ma-tin` khi
tin đã nhận rồi.

**Hai cửa phải từ chối đúng cùng một tập tệp**, nên mỗi luật chỉ có **một** bản:
`moCuaNhanTin` gác nguồn và `ma_tin`, `kiemCuaSoDinhKem` gác giờ (cửa vé gọi qua
`kiemCuaSoChoVe`, chỉ thêm đúng điều kiện "phải khai hai mốc **đánh giá được**").
Lệch một điều kiện là agent tải xong cả bộ tệp rồi mới bị từ chối ở bước sau, và
mớ tệp đó không dòng `dinh_kem` nào trỏ tới nên không `han_xoa`, không lượt dọn
nào thu hồi được — trên một kho 1GB đã dùng 219MB.

Bất biến là **một chiều**: vé `200` ⇒ cửa nhận tin không bỏ tệp đó vì lý do giờ.
Cửa vé **chặt hơn** ở đúng một chỗ, và đó là chủ ý: mốc hỏng thì cửa vé từ chối,
còn cửa nhận tin vẫn nhận tệp của một tin không có mốc đọc được — biến "không
biết giờ" thành "bỏ hết tệp" ở đó là mất video của cô vì một mốc thời gian hỏng.
Hỏng theo chiều này chỉ bắt agent sửa lời khai; hỏng theo chiều kia mới sinh tệp
mồ côi. Đừng "sửa lại cho cân".

Phép kiểm khoá của cửa vé nằm ở **bước xin vé**, không ở đầu route: sự kiện
`blob.upload-completed` do máy chủ của Vercel Blob gọi về `callbackUrl` mang
`x-vercel-signature` chứ **không** mang `Authorization: Bearer`, và
`handleUpload` tự kiểm chữ ký đó (đúng khuôn `/api/upload-media` và
`/api/nop-video`). Chặn nó bằng 401 thì tệp lên kho xong vẫn báo lỗi về cho bên
tải, và agent gửi lại mỗi 30 phút mãi mãi. Riêng `503` vẫn ở đầu route — đó là
lỗi của bản deploy, ai gọi cũng phải biết.

`503` cố ý **khác** `401`: gộp hai cái vào nhau thì một bản deploy thiếu biến
sẽ báo "sai khoá" và người ta đi soi Keychain trong khi lỗi nằm ở Vercel.

**Không bao giờ 500 tay không.** Bản gốc của tin được ghi vào `bai_tu_zalo`
*trước* khi gọi bộ tách bài, nên bộ tách hỏng (hết quota, mạng lỗi) vẫn còn
nguyên văn cho bố mẹ đọc và ít nhất một bài nháp thô để sửa. Thứ tự là hợp
đồng: **409 trước, lưu sau, tách sau cùng**. Và 409 đi trước cả việc **tải
tệp**: zalo-agent quét lại mỗi 30 phút, không chặn từ đầu thì mỗi lượt lại ghi
thêm một bản của cả bộ tệp mà không dòng `dinh_kem` nào trỏ tới — tức không
`han_xoa`, không lượt dọn nào thu hồi được. Rào chống đua thật vẫn là chỉ mục
`UNIQUE (nguon_id, ma_tin)` + `ON CONFLICT DO NOTHING`, không phải phép
`SELECT` ngắn mạch đó.

**Một tệp lạ không làm hỏng cả tin.** Tệp sai loại (cô đính kèm một tờ `.docx`),
agent tự khai quá 25MB, thiếu `url`, `url` không phải tệp của kho mình / sai họ
`zalo/<nguồn>/`, hay kho báo không có tệp đó — thì **bỏ riêng tệp đó** và ghi vào
`tep_bo_qua` (`[{ ten, ly_do, chi_tiet? }]`, `ly_do` ∈ `loai-khong-nhan` /
`qua-nang` / `tep-hong` / `url-khong-nhan` / `khong-thay-trong-kho` /
`ngoai-cua-so` / `thieu-gio-gui` / `ngoai-kho` / `qua-nhieu-tep`) — tin vẫn
vào, bố mẹ vẫn có bài để duyệt, và mục chờ duyệt **hiện** danh sách tệp bị bỏ để
họ không tưởng là cô quên gửi. Trước đây cả gói trả 400, mà agent gửi lại mỗi 30
phút nên một tờ `.docx` là khoá vĩnh viễn tin giao bài đó. Cột
`bai_tu_zalo.tep_bo_qua` (migration 022) giữ danh sách; thân `201` trả cùng danh
sách đó và máy chủ ghi một dòng `console.warn`.

### Bài NHÁP nằm trong chính bảng `assignments`

Để bố mẹ sửa bài nháp bằng **đúng** đường sửa bài đã có (`PATCH
/api/assignments/:id`, màn `/bome/bai/<id>`) chứ không phải một bộ CRUD thứ
hai. Cột `trang_thai_duyet` mặc định `'that'` nên mọi dòng cũ và mọi câu
`INSERT` cũ không phải sửa một chữ.

Đổi lại, **mọi câu ĐỌC `assignments` phải nói rõ nó muốn gì**. Hàng rào là
`CHI_BAI_THAT` trong `lib/store.ts` (mặc định loại dòng nháp, nơi gọi phải xin
rõ mới thấy) — cùng khuôn với `includeChores` của issue #36. Cái dễ bỏ sót
nhất: dòng nháp `'todo'` **không được** đếm vào `congDiemNgayNeuXong`, không
thì một tin của cô lúc 20h mà bố mẹ chưa kịp duyệt sẽ âm thầm khoá mất +10 của
cả ngày. Hồi quy ghim ở `lib/nhan-bai-zalo.test.ts`.

### Tệp kèm

**Tệp không đi trong thân request.** Vercel chặn thân request ở **4,5MB**, mà
chính gói mẫu thật của scout (hai video 2,18MB + 1,29MB → ~4,63MB sau base64)
đã vượt: nền tảng trả 413 **trước khi** hàm chạy, nên không hàng rào nào trong
mã chạy — không dòng `bai_tu_zalo`, không bài nháp, không `tep_bo_qua`, không
log, và agent gửi lại mỗi 30 phút mãi mãi. Đây đúng là lý do `lib/media.ts` đã
chọn đường tải thẳng cho video con nộp, nên bài từ Zalo đi cùng khuôn đó:
`POST /api/nhan-bai-zalo/tep-token` phát vé (thân chung `xuLyTaiTep` với
`/api/upload-media` và `/api/nop-video`), agent tải thẳng lên Blob, rồi gói tin
chỉ mang `url`.

Chỉ ảnh / âm thanh / video / pdf, tối đa **25MB mỗi tệp**, tối đa 10 tệp một
gói — và **quá 10 tệp KHÔNG làm hỏng cả tin**: mười tệp đầu (sau khi đã loại
tệp sai loại / thiếu `url` / quá nặng) vào bình thường, phần dư báo trong
`tep_bo_qua` với `ly_do: 'qua-nhieu-tep'`. Một tin cô gửi 12 tấm ảnh là tin
**hợp lệ** có nhiều tệp hơn mức app xử, không phải gói sai; mà từ khi tệp được
tải lên **trước** qua vé thì một `400` ở đây còn tệ hơn — agent đẩy hết 12 tệp
lên kho rồi mới biết, không dòng `dinh_kem` nào trỏ tới chúng nên không
`han_xoa`, và 30 phút sau nó tải lại cả 12 tệp rồi lại ăn `400`. Cả `gioi_han` của `GET cau-hinh` nói đủ những điều đó **cộng cách tải**, để
zalo-agent biết **trước** thay vì gửi lên rồi đọc `tep_bo_qua`:

```json
{ "loai_tep": ["image/*", "audio/*", "video/*", "application/pdf"],
  "toi_da_mb": 25, "toi_da_tep_moi_goi": 10,
  "cach_tai": "blob-client-token", "duong_token": "/api/nhan-bai-zalo/tep-token" }
```

`url` là **đầu vào từ bên ngoài** nên cửa nhận chốt nó hai tầng, và cả hai đều
cần: `phanLoaiUrlBlobZalo` (lib/zalo.ts) đòi tệp phải nằm trên **kho Blob của
chính mình** — ghim theo mã kho rút từ `BLOB_READ_WRITE_TOKEN`
(`vercel_blob_rw_<maKho>_…`, xem `maKhoBlob`), vì
`*.blob.vercel-storage.com` là tên miền **chung** của mọi kho Vercel Blob chứ
không phải của riêng mình; url của kho khác bị bỏ với lý do `ngoai-kho`, và token
sai khuôn thì coi như **không có kho hợp lệ** nên mọi url Blob đều bị từ chối
(đọc không ra nghĩa là từ chối, cùng tinh thần với `tranNguoiDat`). Rồi đúng họ
`zalo/<nguon_id>/<yyyy-mm-dd>/` với **đúng một** đoạn tên cuối — chặn tệp của lớp khác, chặn `nop-bai/` của video con nộp, chặn địa chỉ
ngoài mà trình duyệt bố mẹ sẽ tải về khi mở mục chờ duyệt. Rồi `head()` hỏi lại
kho: tệp có thật không, và nặng bao nhiêu — **số byte ghi vào CSDL lấy từ kho,
không lấy từ `kich_thuoc` agent khai**. Cửa phát vé chốt đường dẫn bằng **đúng**
hàm đó (`laDuongDanTepZalo`), nên không có kẽ "xin vé cho một đường dẫn rồi gửi
lên một đường dẫn khác". Lên Vercel Blob dưới `zalo/<nguồn>/<ngày>/` — tiền tố **riêng**, không
chạm `nop-bai/` của video con nộp, nên một lượt dọn video không bao giờ đụng
vào chúng (`laUrlVideoConNop` trong `lib/donVideo.ts` chỉ nhận `nop-bai/`).
Dev chưa bật Blob thì bước tải là multipart vào cùng đường vé, ghi `.data/uploads`
và trả `/api/tep/<tên>` — cùng khuôn với hai đường tải tệp đã có. Cửa nhận tin
chấp nhận dạng URL đó **chỉ khi** máy chủ thật sự chưa có `BLOB_READ_WRITE_TOKEN`,
để trên Vercel không có lối vòng qua phần kiểm tiền tố.

**Việc dọn thật chưa có.** Mỗi tệp được ghi sẵn `han_xoa` (30 ngày kể từ **ngày
nhận**, không phải `ngay_trong_tin` — cùng bậc với video con nộp, vốn đo từ lúc
tệp vào kho) trong `bai_tu_zalo.dinh_kem`, nhưng `lib/donVideo.ts` cố ý chỉ đi
theo `assignments.submitted_video_url` và chỉ nhận thư mục `nop-bai/` — nới cái đó
ra là tháo hàng rào 3 của một đường xoá không lùi được. Dọn tệp Zalo là một
lượt quét **khác**, việc sau.

### Cấu hình nguồn

btvn là **nguồn sự thật duy nhất**: zalo-agent đọc lại
`GET /api/nhan-bai-zalo/cau-hinh` mỗi lần chạy, nên thêm một lớp mới chỉ cần
gõ ở màn bố mẹ (**Cài đặt → Nhóm Zalo của lớp**, hoặc `/bome/zalo`), không
phải sửa mã hay deploy bên nào. Captain nhấn mạnh 2026-09-21: nhóm, con, cô
giáo **phải config được**, không ghi cứng.

**Ba nhà demo bị loại khỏi cửa này**, bằng đúng hàng rào 9 của `lib/donVideo.ts`
(`family_id NOT LIKE 'fam\_demo\_%'`). `scripts/seed-demo.mjs` chạy trong
`npm run build` và seed mỗi nhà demo hai nguồn mang **đúng tên nhóm và tên cô
của lớp thật** — mà tên nhóm là khoá duy nhất zalo-agent đối chiếu được. Không
lọc thì một tin của cô ra bốn nguồn không phân biệt nổi: hoặc agent gửi bài (và
tệp có mặt các cháu) vào cả ba nhà ai cũng mở được bằng PIN demo, hoặc nó chọn
một nguồn và nhà **thật** không bao giờ nhận được bài. Lọc ở `cauHinhChoAgent`
chứ không ở chỗ seed (`dang_bat = FALSE`): công tắc bật/tắt nằm ngay trên màn
bố mẹ của nhà demo, ai bật lên là hở lại — và nhờ vậy màn bố mẹ **vẫn** thấy hai
nguồn mẫu khi captain đi demo, chỉ cửa dành cho **máy** là không.

`ma_nhom` (mã nhóm của Zalo, `g694851…`) bố mẹ **không phải gõ**: họ khai bằng
**tên** nhóm, còn mã thì zalo-agent gửi kèm trong gói tin và btvn **điền vào chỗ
trống** — `WHERE ma_nhom IS NULL`, không bao giờ ghi đè, vì một nguồn đã có mã mà
bị ghi đè là mọi tin sau đó chạy sang nhầm nhóm mà không ai thấy. Thẻ nguồn ở
màn bố mẹ hiện mã đó (chỉ đọc); "chưa có" kéo dài là dấu hiệu máy ở nhà chưa vào
được nhóm.

`mau_nhan_dien` là danh sách chuỗi **không dấu** zalo-agent đối chiếu với tin
(mặc định `["bai tap ve nha", "ngay hoc thu"]`, đo trên 686 tin thật). Bỏ dấu
và hạ chữ thường ngay lúc ghi (`docMauNhanDien` dùng chung `boDau` của
`lib/media.ts`) — một mẫu gõ có dấu sẽ **không bao giờ khớp mà không báo gì**.

`cua_so_dinh_kem_phut` (mặc định 90) là khoảng sau tin mà tệp gửi trong đó
được coi là tệp của bài: video mẫu tới sau tin 4 giây, còn tệp nhận xét từng
bé tới sau ~4 tiếng — cửa sổ 90 phút tách đúng hai loại. Cửa sổ được kiểm ở
**cả hai phía**: zalo-agent lọc trước (nó là bên duy nhất nhìn thấy dòng thời
gian của Zalo), rồi btvn kiểm lại bằng `kiemCuaSoDinhKem` (lib/zalo.ts) — cửa
vé trả `422` để agent khỏi tải lên, cửa nhận tin bỏ riêng tệp đó vào
`tep_bo_qua` với lý do `ngoai-cua-so`. Ba biên có chủ ý, ghi ở chú thích của
hàm đó: tin **không có** `gui_luc` thì bỏ qua phép kiểm và nhận tệp (đừng biến
"không biết" thành "bỏ hết"); tệp không có `gui_luc` thì `thieu-gio-gui`; tệp
gửi **trước** tin cũng là ngoài cửa sổ.

**Không có nút xoá nguồn**, có ý: một nguồn đã nhận bài là cha của những dòng
giữ nguyên văn tin của cô — bản sao duy nhất của chúng. Muốn dừng thì **tắt**.

### Cờ nhận diện

zalo-agent nhận diện tin giao bài bằng hai lớp (luật, rồi model Jev chấm xác
suất) và gửi kèm `nhan_dien: { luat, jev_xac_suat }`. btvn chỉ **lưu** và
**hiện** một cờ nhỏ ở mục chờ duyệt ("Luật khớp" / "Jev cho là giao bài (xx%),
luật không khớp — soi kỹ" / "Chưa qua Jev"); **không có logic nào đọc nó**,
vì mọi sai lệch đã dừng ở bước bố mẹ duyệt rồi. Thiếu trường thì không hiện cờ.

## Dọn video quá hạn

Kho tệp Vercel Blob của gói Hobby chỉ có **1 GB** và app trước giờ không xoá tệp
nào. Một cron mỗi ngày (`vercel.json` → `/api/don-video`, `0 19 * * *` UTC ≈ 2 giờ
sáng giờ VN) dọn bớt video con nộp. Luật và chín hàng rào an toàn ghi ở đầu
`lib/donVideo.ts`; đọc chỗ đó trước khi sửa.

**Luật:** xoá một video khi **cả hai** đúng — đã quá `SO_NGAY_GIU_VIDEO` (5) ngày
kể từ `submitted_video_at`, **và** không nằm trong `SO_VIDEO_MOI_NHAT_GIU_LAI` (3)
video mới nhất **của chính đứa con đó**. Hai hằng số ở `lib/donVideo.ts`, mỗi cái
một chỗ duy nhất. Phần dung lượng **do việc nộp bài sinh ra** có trần đoán được:
số con × 3 × cỡ video. Đó **không** phải trần của cả kho tệp — lượt dọn chỉ đi theo
`assignments.submitted_video_url`, nên hai đường sinh tệp mồ côi vẫn phình chậm: con
bấm "Quay video khác" sau khi đã nộp, và xoá bài bằng `DELETE /api/assignments/:id`.
Cả hai có từ trước lần giao này; việc riêng `btvn-quet-tep-mo-coi` theo dõi.

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
`assignments` và **trước** khi gọi `del()`. Vì gỡ URL đi trước, một cú `del()`
hỏng để lại tệp **không còn ai trỏ tới** — nên mỗi lượt đọc lại dòng sổ cái
`deleted_at IS NULL` và dọn nốt trước khi chọn việc mới (`donSoCaiMoCoi`). Phần
dọn nốt ăn **cùng một trần** với phần chọn việc mới, và nếu nó vẫn hỏng thì cả
lượt **dừng ngay** — kho đang từ chối xoá thì gỡ thêm URL chỉ làm đống tồn lớn
dần mà không thu về byte nào. Bảng `video_cleanup_runs` có chỉ mục
UNIQUE từng phần trên `(run_date) WHERE che_do = 'that'` — đó là hàng rào 7,
chống cron gọi trùng một lượt, và nó nằm ở CSDL chứ không ở code.

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
                nào, mấy ⭐, nhóm), sách của các con (trang riêng: khai sách /
                vở / nguồn bài tập làm ngữ cảnh cho AI tách bài theo cuốn),
                bài từ Zalo (zalo/: duyệt tin cô giao + khai nhóm Zalo của lớp)
app/api/        children, assignments, pin, families (tạo nhà/đổi tên),
                nha (gắn máy), extract (Nous Portal, nhận childIds để lấy sách
                của đúng nhóm con), upload (ảnh đề bài),
                upload-media (tệp bố mẹ đính kèm), nop-video (video con nộp),
                viec-nha (cấu hình nhiệm vụ hàng ngày của bố mẹ, cần PIN),
                sach (sách của các con, cần PIN),
                phan-thuong (bố mẹ đặt phần thưởng, cần PIN), tru-diem (bố mẹ
                trừ ⭐ của con, cần PIN), doi-thuong (con xin đổi — không cần
                PIN; bố mẹ duyệt — cần PIN), tep (đọc tệp đã ghi ở
                .data/uploads khi dev), don-video (cron dọn video quá hạn, xác
                thực bằng CRON_SECRET), nhan-bai-zalo + nhan-bai-zalo/cau-hinh
                + nhan-bai-zalo/tep-token (ba cửa cho zalo-agent, xác thực bằng
                ZALO_INTAKE_SECRET — KHÔNG đi qua PIN/cookie), nguon-zalo (bố mẹ
                khai nhóm, cần PIN), bai-zalo (bố mẹ duyệt / bỏ một tin, cần PIN)
app/_components/ BanPhimPin — bàn phím số dùng chung cho 4 chỗ nhập PIN
lib/i18n/       lớp dịch: ngonNgu (bộ ngôn ngữ + PIN demo), chu (T), en/ja/ko (từ
                điển, khoá = câu tiếng Việt), server (chu()), client (useT)
lib/            db (Neon|PGlite), store (truy vấn theo familyId), auth (PIN +
                cookie có chữ ký), pin (PIN_LEN dùng cả hai phía), diem (luật
                tính điểm, hàm thuần), nhomNhiemVu (dòng nào nằm trên màn của
                con + hai nhóm nhiệm vụ), sqlNhiemVu (câu SQL tạo dòng nhiệm vụ
                của ngày, dùng chung với seed và test), sqlDiem (câu SQL số dư ⭐
                + trừ điểm + duyệt đổi thưởng, dùng chung với test), ngay (mốc
                ngày + múi giờ nhà), donVideo (luật + hàng rào dọn video quá
                hạn), media + upload-route (giới hạn tệp, tên/URL tệp, thân
                chung ba route tải lên), zalo (hợp đồng gói tin từ Zalo — hàm
                thuần, không import gì lúc chạy), nhanBaiZalo (nguồn + tin +
                duyệt), xacThucZalo (khoá của ba cửa nhận bài), avatar, ai,
                types
proxy.ts        chặn /bome/* khi chưa nhập PIN
migrations/     từng bước thay đổi lược đồ, chạy theo thứ tự tên tệp (bám PRD mục 7)
scripts/        db.mjs (kết nối + bộ chạy migration), migrate.mjs (CLI, chạy khi
                build), seed.mjs (dữ liệu mẫu để dev — xoá sạch trước khi nạp),
                seed-demo.mjs + demo-data.mjs (ba nhà demo, chạy khi build —
                nạp `.ts` bằng import() động để lỗi demo không hỏng build),
                quet-chu-viet.mjs (`npm run quet:chu-viet`, quét mã nguồn),
                don-video.mjs (gọi tay một lượt dọn video qua chính route của
                cron, mặc định chạy thử), du-lieu-xau-nhat.mjs (bôi DB dev
                thành dữ liệu XẤU NHẤT — 4 con, tên dài, ⭐ ba chữ số — trước
                khi chụp ảnh bố cục), test-hook.mjs (node --test resolve
                import không đuôi)
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

**Tách theo cuốn sách, không theo dòng (issue #64).** Captain phản ánh "Toán trang
41, 42, 43 sách Poth Math" bị tách thành ba bài. Nguyên tắc nằm trong `PROMPT` của
`lib/ai.ts`: **một cuốn sách / vở / phiếu = một bài**, số trang / số bài đi vào
`note` (và nhắc gọn trong `content`); hai cuốn khác nhau thì hai bài kể cả cùng môn;
việc không gắn cuốn nào (quay video, vẽ, thể dục) mỗi việc một bài. Luật này **không
phụ thuộc** nhà đã khai sách hay chưa — nhà chưa khai gì thì lời nhắc y như trước,
chỉ khác luật gộp. Ví dụ "Ex 1, Ex 2, Ex 3" trong prompt cũng đổi theo: một phiếu =
một bài, không còn tách ra ba mục.

**Sách của các con** (bảng `books`, migration 021) là ngữ cảnh thêm cho AI: bố mẹ
khai tên sách / vở / phiếu ở **Cài đặt → "Sách của các con"** (`/bome/sach`, cũng có
dòng dẫn ngay dưới ô dán nội dung ở màn Thêm bài), mỗi cuốn có môn (tuỳ chọn, là
**khoá** trong `SUBJECTS`, hiện bằng `T(...)`) và "sách của" (cả nhà hay từng con —
`child_ids`, cùng khuôn `daily_chores`; hai bé sinh đôi dùng chung sách nên treo vào
**nhà**, không nhân bản theo từng con). Màn Thêm bài gửi `childIds` lên `POST
/api/extract`; route lấy `listBooks(familyId, { childIds })` — sách cả nhà + sách
của đúng nhóm con đó — rồi ghép khối "SÁCH / VỞ / NGUỒN BÀI TẬP BỐ MẸ ĐÃ KHAI" sau
prompt (`khoiSachChoAI`), chặn trên `MAX_SACH_TRONG_PROMPT` = 30 cuốn, tên cắt ở
`MAX_CHU_TEN_SACH` = 60. AI dùng danh sách để nhận tên sách viết tắt / sai chính tả
và đoán môn; prompt nói rõ **không bịa bài từ danh sách**. Bỏ một cuốn là **đánh dấu
bỏ** (`archived_at`, không DELETE — lý do ở đầu migration 021): biến khỏi màn cài
đặt và khỏi lời nhắc; bài đã giao không mất gì vì tên sách đã nằm trong `note`.
Bảng sách chỉ đọc được qua route có PIN; không đọc được bảng (thiếu migration) thì
`/api/extract` coi như chưa khai, không chặn tách bài. Xoá một con thì id đó bị gỡ
khỏi `child_ids` của sách (như nhiệm vụ hàng ngày).

**Hai cuốn đang dùng không được trùng tên** (không phân biệt hoa/thường, bỏ khoảng
trắng thừa). Phép kiểm trong mã (`bookTrungTen`) chỉ để trả câu "Nhà mình đã có cuốn
này rồi."; hàng rào thật là **chỉ mục duy nhất một phần** `books_family_name_uniq`
(migration 022, `WHERE archived_at IS NULL` nên bỏ rồi khai lại vẫn được) — cùng tiền
lệ với `score_events` và `video_cleanups`. Hai lần thêm chen nhau (bấm Enter hai nhịp,
hai máy cùng mở màn sách) thì cái sau vẫn ra 400 quen thuộc chứ không sinh dòng thứ
hai: hai dòng giống hệt nhau thì bố mẹ không phân biệt được, cùng chiếm chỗ trong lời
nhắc AI, và từ đó không đổi tên dòng nào được nữa. Tên đi vào chỉ mục phải qua
`lamSachTenSach` (NFC + gom khoảng trắng) vì Postgres không chuẩn hoá Unicode hộ.

**Đường lùi tách thô** (`splitByRule`) theo cùng nguyên tắc ở mức nó làm được:
tách theo dòng như cũ rồi **gộp các dòng liền nhau cùng cuốn**. Bảng điều kiện đầy
đủ nằm ở chú thích `cungCuon` (`lib/ai.ts`) — mỗi dòng của bảng có một bài kiểm
hành vi trong `lib/tach-theo-sach.test.ts`; tóm tắt:

- **Cả hai dòng nhắc một cuốn đã khai**: gộp khi **cùng một cuốn** *và* **môn không
  chọi nhau** *và* không bên nào là việc độc lập. Cùng một quyển vở không có nghĩa
  là cùng một môn — *"Vở ô ly: chép bài toán trang 3"* và *"Vở ô ly: viết chính tả
  trang 4"* ra **hai** thẻ. Nhưng **"Khác" nghĩa là chưa đoán ra môn, không phải
  môn khác**: *"Vở ô ly trang 4"* không lộ môn nào cả nên nó gộp vào dòng cùng cuốn,
  và thẻ gộp mang **môn đã biết** (dòng "Khác" đứng trước hay sau đều vậy). Bằng
  chứng "cùng cuốn" chỉ bỏ qua đúng một thứ: **ngôn ngữ** đoán được (*"Poth Math
  tr. 44"* không dấu nên bị đoán là tiếng Anh). Nhánh này không đòi dấu hiệu trang
  — tên cuốn đã là mốc.
- **Nhận tên cuốn theo TỪ, không theo chuỗi con** (`sachTrongDong`): tên sách phải
  là một chuỗi từ liền nhau trong dòng. Bỏ dấu là để nhận ra chữ cô gõ không dấu
  (*"tieng viet tap 1"*), nhưng bỏ dấu rồi thì hai từ khác nhau có thể thành một —
  cuốn *"Toán"* và chữ *"toàn"* đều ra `toan` — nên một từ chỉ khớp khi **đúng
  nguyên dạng có dấu**, hoặc khi **chính nó không có dấu nào**. Vì thế *"đọc toàn bộ
  câu chuyện"* không bị gán cuốn *"Toán"*. Bỏ sót một cách nhắc lỏng lẻo chỉ là
  không gộp được; gán nhầm cuốn là con lấy sai quyển ra làm. Phép so chịu được
  **dòng bài tập** viết không dấu, nhưng **không** chịu được **tên sách bố mẹ khai**
  thiếu dấu (khai *"Vo o ly"* thì không khớp dòng *"Vở ô ly trang 4"*) —
  `HUONG-DAN-BO-ME.md` nhắc bố mẹ gõ tên có dấu như trên bìa; **màn khai sách chưa
  có dòng nhắc đó**, thêm thì thêm ở `app/bome/(khung)/sach/`. Hai bên đều ép về
  **NFC** trước khi so: chữ dán từ Zalo / bàn phím tiếng Việt thường là NFD, nhìn
  giống hệt mà `===` trả false.
- **Không dòng nào nhắc cuốn nào**: gộp khi cùng môn (khác "Khác"), **cả hai** đều
  chỉ trang / số bài (`DAU_HIEU_TRANG`: "trang 41", "tr. 5", "bài 3", "page 12",
  "Ex 2"…) và cùng ngôn ngữ đoán được.
- **Một dòng có tên sách, dòng kia không** → không gộp.

Bài gộp phải quay video nếu **một** trong các dòng đòi ("đọc to"), và đọc giọng Việt
nếu có dòng tiếng Việt. Dòng nhắc cuốn đã khai lấy
môn của cuốn và ghi tên cuốn vào `note`. Hai chỗ đi theo đúng luật của đường AI:
(1) **việc độc lập không bị nuốt** — dòng đòi quay / đọc to mà không chỉ trang nào
(`viecDocLap`) giữ bài riêng kể cả khi nhắc đúng cuốn đang gộp, vì prompt cũng để
mỗi việc như vậy ra một bài; (2) **thời lượng cộng theo số dòng đã gộp** — mỗi dòng
tính `DURATION_DEFAULT` rồi `clampDuration` (trần 60), nên ba trang gộp làm một thẻ
ra 30 phút chứ không phải 10.
**Giới hạn cố ý:** không có AI thì không biết "Toán trang 30" và "Toán trang 12" là
một hay hai cuốn khi cô không ghi tên — coi là một; một dòng có tên sách, dòng sau
chỉ ghi trang thì **không** gộp. Cả hai chiều đều sửa được một chạm ở màn Kiểm tra
lại: "Gộp với bài trên" có từ trước, **"✂️ Tách bài này"** thêm ở lần này — cắt tại
con trỏ trong ô đề bài (bố mẹ chạm vào chỗ muốn cắt rồi bấm), con trỏ ở đầu / cuối
thì thẻ mới để trống; thẻ mới chép môn / ghi chú / giọng / thời lượng, tệp đính kèm
ở lại thẻ gốc (`lib/banNhap.ts`, hai hàm thuần). Chiều gộp giữ **đủ
của cả hai thẻ**: đề bài nối lại, **ghi chú ghép bằng " · "** (trùng nhau thì một
lần, cả hai trống thì `null`), tệp lấy hợp, cờ video là HOẶC. Ghi chú là chỗ ghi
tên sách + số trang, mà từ khi AI đã tự gộp các dòng cùng một cuốn thì hai thẻ bố
mẹ gộp tay thường là **hai cuốn khác nhau** — bỏ một bên là bỏ hẳn một quyển con
phải lấy ra.

**Thời lượng khi gộp / tách:** sai theo hướng **thừa** còn hơn sai theo hướng
**thiếu** — thiếu thì đồng hồ ở màn của con reo giữa chừng và con mất +1 "xong sớm"
cho một bài nó làm đúng hạn, còn thừa thì chỉ là đồng hồ còn dư giờ. Vì thế **gộp
thì cộng** hai số, còn **tách thì chép** nguyên số sang cả hai nửa, không chia tỉ
lệ: không biết con trỏ cắt vào chỗ nặng hay nhẹ, mà chép là sai theo hướng thừa.
Bố mẹ sửa lại số phút ngay tại dòng đó.

**Cờ 🎥 đi ngược chiều với thời lượng**, đừng lấy nhầm: thừa giờ thì vô hại, còn
thừa cờ là con **mất hẳn nút "Đã làm xong"** (màn của con chỉ cho nộp bằng video)
cho tới khi bố mẹ vào bỏ tick. Nên **gộp thì HOẶC** hai cờ, còn **tách thì không
chép** cờ sang cả hai nửa — cờ được **chia** theo chữ của từng nửa, bằng
`coDauHieuVideo` (`lib/dauHieuVideo.ts` — cùng một lưới với đường lùi tách thô, một
bản duy nhất cho cả máy chủ lẫn màn Kiểm tra lại).

**Thứ bậc, đừng sửa một vế mà quên vế kia:** lưới khớp chữ đó **cố ý hẹp hơn** danh
sách dấu hiệu trong `PROMPT` của AI (nó bỏ "kể lại … cho bố mẹ nghe", "thuyết
trình", "hát"), nên nó chỉ đủ thẩm quyền **thu hẹp** một cờ **đang bật**, không bao
giờ đủ để **tự bật** một cờ đang tắt. Cụ thể: thẻ **tắt** cờ (AI đã quyết, hoặc bố
mẹ vừa bỏ tick) thì **cả hai nửa đều tắt**, không đọc lại chữ; thẻ **bật** cờ thì
nửa nào dính dấu hiệu giữ cờ (cả hai dính thì cả hai giữ), **không nửa nào** dính
thì giữ ở **nửa đầu** và bỏ ở nửa sau. Nhờ vậy thẻ gộp vì một nửa "đọc to" tách ra
thì nửa trang giấy hết cờ, mà quyết định bố mẹ đã bấm thì không bị lật lại sau lưng.

Hai **trần khác nhau**, đừng dùng lẫn: ước lượng do **máy** sinh ra (AI và
`gopDong` của đường lùi) kẹp ở `clampDuration`, trần 60; số **bố mẹ tự gõ** ở màn
Kiểm tra lại đi theo trần của chính ô nhập, `sanitizeDuration` = 180, nên "Gộp với
bài trên" cộng 45 + 30 ra **75** chứ không phải 60 — kẹp về 60 ở đó chính là tự làm
thiếu. Cả hai phép cộng đều không hạ xuống thấp hơn số đang có trên một trong hai
thẻ.

Hồi quy: `lib/tach-theo-sach.test.ts` (prompt, khối
sách, fetch giả, splitByRule), `lib/banNhap.test.ts` (gộp / tách),
`lib/sach.test.ts` (PGlite + route: lọc theo nhà,
theo con, đánh dấu bỏ, và ca **nhà chưa khai sách** cho ra đúng `splitByRule(text)`
cũ).

**Giọng đọc.** Mỗi bài có trường `lang` (`vi`/`en`) quyết định giọng đọc thành
tiếng. Bé 4 tuổi chưa đọc được chữ nào nên nút 🔊 gần như là cách duy nhất để
biết phải làm gì — đọc đề tiếng Anh bằng giọng Việt thì bé nghe không hiểu.
Bố mẹ sửa được trường này ở màn "Kiểm tra lại".

**Đồng hồ làm bài.** Mỗi bài có `duration_minutes` — AI ước 5–60 phút theo độ
phức tạp (kẹp trong khoảng đó bằng `clampDuration`), bố mẹ sửa được ở màn "Kiểm
tra lại" / "Sửa bài tập" / "Nhập tay" (sửa tay thì được ra ngoài khoảng, tối đa
180 phút). Trần của AI là 60 chứ không phải 15 vì từ issue #64 **một cuốn sách là
một bài**: ba trang toán ~8 phút mỗi trang là một thẻ ~24 phút thật, nên lời nhắc
bắt AI **cộng** ước lượng của từng phần cho toàn bộ bài đã gộp — kẹp về 15 thì
chuông reo giữa chừng và +1 "xong sớm" thành không thể đạt được đúng ở những bài
mà luật gộp vừa làm to ra. Ở màn của
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
🎥 "Đã nộp video" / "Đã nộp, video đã dọn" / "Chờ quay video" ở màn chi tiết theo
con và phát lại video trong màn "Sửa bài tập". **Ba** trạng thái chứ không hai:
video đã bị dọn (xem "Dọn video quá hạn") thì URL bị gỡ nhưng mốc nộp còn — mọi
chỗ hỏi trạng thái video đều đi qua `trangThaiVideo` trong `lib/types.ts`, đừng
tự viết lại điều kiện bằng `submittedVideoUrl`.

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
nhưng không vẽ — tick được là ⭐ trước một ngày; bài tập ngày mai cũng không hiện
trên màn của con từ issue #62, bố mẹ vẫn thấy ở màn của mình),
mỗi dòng có icon + chip "⭐ N"; con bấm là tick ngay tại chỗ (không mở màn chi
tiết bài), tick xong hiện chip "+N ⭐". Xong hết cả bài lẫn nhiệm
vụ mới sang màn khen "Giỏi quá!". Badge ở màn chọn-con nói **"N việc"** = **đúng
những gì màn của con đang vẽ và cho tick**: bài tập của hôm nay + mọi bài
**chưa xong** của ngày đã qua (issue #55) + nhiệm vụ của hôm nay, đếm gộp; bài có
hạn từ ngày mai trở đi không vẽ nên không đếm (issue #62). Nên tối bố mẹ đã nhập
bài cho hôm sau, con tick xong hết việc hôm nay là badge đọc "Xong hết 🎉" — bài
ngày mai sáng mai mới hiện. "Chưa có bài" chỉ khi không có gì cả. Cùng một bộ lọc dùng cho hai ô "Hoàn thành" / "Đang chờ" ở màn
tổng quan của bố mẹ (khối "Việc con đang thấy trên máy"; ô "Quá hạn" thì loại
nhiệm vụ ra, xem đoạn dưới) — xem `lib/nhomNhiemVu.ts` và bất biến ở AGENTS.md.

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
tách tạm theo dòng (rồi gộp các dòng liền nhau cùng cuốn — xem **Tách theo cuốn
sách**) kèm cảnh báo, và luôn có đường "Nhập tay từng bài".

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
5. Muốn bài từ Zalo chạy: đặt `ZALO_INTAKE_SECRET` trên Vercel rồi Redeploy, và
   nạp **cùng chuỗi đó** vào Keychain `com.toanhblab.zalo-agent` account
   `btvn-intake-secret` trên Mac mini. Thiếu biến thì ba cửa
   `/api/nhan-bai-zalo*` trả 503 và zalo-agent báo ngay, không âm thầm hỏng.
