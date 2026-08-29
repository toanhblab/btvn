# BTVN — Bài tập về nhà

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
npm run db:seed      # tạo bảng + 1 nhà + 3 con + bài tập mẫu, PIN mặc định 1234
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

Mọi truy vấn trong `lib/store.ts` đều nhận `familyId` và tự lọc theo nó — kể cả
đường con tick bài xong và con nộp video (hai việc duy nhất không cần PIN, cùng
xác thực bằng cookie thiết bị). Biết id con hay id bài
của nhà khác cũng không đọc/sửa được gì.

## Migration

Mọi thay đổi lược đồ nằm trong [migrations/](migrations/), mỗi thay đổi một tệp
`.sql` đánh số tăng dần:

```
migrations/001_khoi_tao.sql        5 bảng đầu tiên
migrations/002_moi_nha_mot_pin.sql unique index "mỗi nhà một PIN"
```

**Vercel tự chạy mỗi lần deploy** — `build` là `node scripts/migrate.mjs && next
build`, nên push code lên GitHub là migration chạy trước khi build. Migration lỗi
thì build dừng, không deploy code mới lên DB cũ.

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
  - Nếu để cờ này **vĩnh viễn** thì migration THÊM CỘT sau này sẽ **làm vỡ preview**:
    code mới deploy lên nhưng gặp schema cũ, thiếu cột nó cần.
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

`PIN_SECRET` là gốc của cả hash PIN lẫn chữ ký cookie: **đặt một lần rồi không
đổi nữa**. Đổi nó là PIN của mọi nhà thành vô hiệu (hash trong DB không khớp
nữa) và mọi thiết bị bị đăng xuất.

Đổi `DATABASE_URL` là chuyển hẳn sang Neon, không phải sửa dòng code nào —
các migration chạy được trên cả hai.

## Cấu trúc

```
app/vao/        chọn nhà cho máy chưa gắn nhà nào (nhập PIN / tạo nhà mới)
app/nha/[slug]/ link gắn iPad vào một nhà (route handler, đặt cookie rồi redirect)
app/con/        4 màn của trẻ: chọn con → bài hôm nay → chi tiết → chúc mừng
app/bome/       màn của bố mẹ: PIN, tạo nhà, tổng quan, thêm bài, kiểm tra lại,
                nhập tay, sửa bài, thêm con, chi tiết theo con, danh sách, cài đặt
app/api/        children, assignments, pin, families (tạo nhà/đổi tên),
                nha (gắn máy), extract (Nous Portal), upload (ảnh đề bài),
                upload-media (tệp bố mẹ đính kèm), nop-video (video con nộp),
                tep (đọc tệp đã ghi ở .data/uploads khi dev)
app/_components/ BanPhimPin — bàn phím số dùng chung cho 4 chỗ nhập PIN
lib/            db (Neon|PGlite), store (truy vấn theo familyId), auth (PIN +
                cookie có chữ ký), pin (PIN_LEN dùng cả hai phía), media +
                upload-route (giới hạn tệp, tên/URL tệp, thân chung hai route
                tải lên), avatar, ai, types
proxy.ts        chặn /bome/* khi chưa nhập PIN
migrations/     từng bước thay đổi lược đồ, chạy theo thứ tự tên tệp (bám PRD mục 7)
scripts/        db.mjs (kết nối + bộ chạy migration), migrate.mjs (CLI, chạy khi
                build), seed.mjs (dữ liệu mẫu để dev — xoá sạch trước khi nạp)
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
thật** của `HW_SOURCES` nên tự nhận nguồn mới. Nhãn hiển thị đổi tự do; **mã định danh lưu
trong DB thì không** (`primary_school`, `english_class`, `other`).

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
không kẹt mãi ở trạng thái quá giờ.

**Nộp bài bằng video.** Bài kiểu "đọc to", "đọc thuộc lòng", "quay video gửi cô",
thể dục/biểu diễn có trường `requires_video` — AI tự bật khi tách bài, bố mẹ
bật/tắt lại được bằng chip 🎥 ở màn "Kiểm tra lại" / "Nhập tay" và ô tick 🎥 ở
màn "Sửa bài tập". Ở màn của con, bài gắn cờ hiện khung quay ngay trong trang (`MediaRecorder`, mp4 trên
Safari và webm trên Chrome cũ) kèm xem trước và quay lại; máy không quay được
trong trang hoặc con từ chối quyền camera thì có đường lui mở máy quay của hệ
điều hành (`capture="user"`). Quay tối đa 3 phút (`MAX_QUAY_GIAY`), máy tự dừng
khi hết giờ. **Gửi video chính là "đã làm xong"** — bài gắn cờ không có nút tick
riêng và server cũng chặn tick xong khi chưa có video. Mỗi bài giữ **một video
mới nhất** (quay lại là thay URL, không giữ lịch sử). Video đi qua route riêng
`/api/nop-video` (xác thực bằng cookie thiết bị vì con không có PIN, chỉ nhận
video, trần 250MB vì máy quay của iPad ghi ~60MB/phút). Bố mẹ thấy badge
🎥 "Đã nộp video" / "Chờ quay video" ở màn chi tiết theo con và phát lại video
trong màn "Sửa bài tập".

**Không bao giờ để bố mẹ bị kẹt.** AI hỏng, hết quota hay chưa có key thì vẫn
tách tạm theo dòng kèm cảnh báo, và luôn có đường "Nhập tay từng bài".

**PIN trên iPad.** Ô "Nhớ trên thiết bị này" mặc định **không** tick. iPad là máy
dùng chung của các con — nhớ PIN ở đó thì PIN mất tác dụng. Trót tick rồi thì
vào Cài đặt → "Quên PIN trên thiết bị này".

**Riêng tư.** App chạy trên internet công khai còn màn của con không đăng nhập,
nên toàn site đặt `noindex`, và mỗi gia đình có `slug` ngẫu nhiên làm đường dẫn
khó đoán.

**Đổi PIN không đăng xuất máy khác.** Cookie phiên ký theo id của nhà, không theo
PIN. Muốn đóng phần bố mẹ trên một máy thì vào Cài đặt trên đúng máy đó bấm "Quên
PIN trên thiết bị này" — nút đó **giữ** phần màn hình của con, đúng cho iPad dùng
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
