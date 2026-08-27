r

# PRD — Website quản lý bài tập về nhà (BTVN)

- **Phiên bản:** 0.1 (draft)
- **Ngày:** 2026-08-17
- **Người viết:** toannh
- **Trạng thái:** Chờ thống nhất phạm vi MVP

---

## 1. Bối cảnh & Vấn đề

Bài tập về nhà của các con được cô giáo giao rải rác trên nhiều kênh: Zalo (tin nhắn, ảnh chụp bảng/vở), ứng dụng quản lý của trường, nhóm Zalo của **lớp học thêm tiếng Anh**, đôi khi là ghi chú trong sổ liên lạc. Ba con học ba nơi khác nhau nên số kênh nhân lên theo từng con.

Hệ quả:

- Bố mẹ phải mở nhiều ứng dụng, đọc lại và diễn giải cho con.
- Không có một danh sách duy nhất "hôm nay con phải làm gì".
- Khó biết con đã làm xong bài nào, còn thiếu bài nào.
- Thông tin trôi theo dòng chat, hôm sau tìm lại rất khó.

## 2. Mục tiêu

**Mục tiêu chính:** Một nơi duy nhất để bố mẹ đưa bài tập vào (ảnh hoặc text), hệ thống tự tách thành danh sách bài tập rõ ràng, và con tự xem — tự tick hoàn thành.

**Không phải mục tiêu (giai đoạn này):**

- Không thay thế ứng dụng của trường, không tích hợp / crawl Zalo.
- Không chấm điểm, không dạy học, không giải bài cho con.
- Không dành cho lớp học / giáo viên. Đơn vị dùng là **một gia đình**.
- Không quản lý người dùng: nhiều gia đình dùng chung một bản deploy được (xem mục 4.5), nhưng không có tài khoản, không mời, không phân quyền trong nhà.

## 3. Người dùng

| Vai trò             | Ai                 | Việc chính                                                                                                         |
| -------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Phụ huynh** | Bố / mẹ          | Nhập bài tập (ảnh hoặc text), sửa lại kết quả tách bài, xem tiến độ của các con — mở bằng mã PIN |
| **Học sinh**  | 3 con (xem dưới) | Chọn mình, xem bài tập hôm nay, nghe/đọc đề, tick "đã làm xong" — không cần đăng nhập              |

**Cụ thể 3 con:**

| Con          | Tuổi | Lớp       | Khả năng đọc                                      | Ghi chú                                                                   |
| ------------ | ----- | ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| Sinh đôi A | 6     | Lớp 1     | Đang học đọc, đọc chậm                         | Người dùng chính                                                       |
| Sinh đôi B | 6     | Lớp 1     | Đang học đọc, đọc chậm                         | Học**cùng lớp** với A → thường **cùng một bài tập** |
| Con nhỏ     | 4     | Mẫu giáo | Chưa đọc được (cả tiếng Việt và tiếng Anh) | Có bài tập thật:**học thêm tiếng Anh**                        |

Hệ quả thiết kế (quan trọng, quyết định UI):

- **Không thể dựa vào chữ.** Con lớp 1 đọc chậm, con 4 tuổi chưa đọc được → mỗi bài tập cần **icon môn học to + ảnh gốc + nút đọc to thành tiếng**; chữ chỉ là phần phụ.
- **Chọn con bằng ảnh, không bằng tên.** Hai con sinh đôi không thể phân biệt qua tên viết ra khi các con còn chưa đọc thạo → dùng **ảnh thật của từng con, cỡ lớn**, kèm màu riêng cho mỗi con (ví dụ A xanh, B cam, con nhỏ vàng).
- **Không phải gõ gì cả** — kể cả PIN. Toàn bộ thao tác của con là bấm.
- **Bài tập có hai ngôn ngữ.** Bé 4 tuổi học thêm tiếng Anh → đề bài có thể là tiếng Anh (hoặc lẫn Việt–Anh). Mỗi bài tập cần biết mình là **tiếng Việt hay tiếng Anh** để đọc thành tiếng bằng đúng giọng; đọc chữ tiếng Anh bằng giọng Việt thì bé nghe không hiểu.
- Bé 4 tuổi chưa đọc được chữ nào → với bé, **nút 🔊 nghe đề gần như là cách duy nhất** để biết phải làm gì mà không cần bố mẹ. Đây là tính năng bắt buộc, không phải tính năng phụ.

## 4. Phạm vi MVP

### 4.1 Nhập bài tập (phụ huynh)

- Dán / gõ text bài tập.
- Upload 1 hoặc nhiều ảnh (ảnh chụp tin nhắn Zalo, ảnh chụp vở/bảng).
- Chọn: **con nào (chọn được nhiều con cùng lúc)**, môn học (tuỳ chọn), ngày phải hoàn thành (mặc định hôm nay).
- Vì hai con sinh đôi học cùng lớp: mặc định tick sẵn **cả hai bé lớp 1**, nhập một lần ra bài tập riêng cho từng bé (mỗi bé tick hoàn thành độc lập). Đây là trường hợp dùng nhiều nhất, không được để bố mẹ phải nhập hai lần.

### 4.2 Tự động tách bài tập

- Với ảnh: đọc chữ trong ảnh (OCR / AI vision) → ra text.
- Với text: tách thành từng bài riêng biệt (theo môn, theo số bài, theo dòng gạch đầu dòng…).
- Mỗi bài tập tách ra gồm: **môn học**, **nội dung/đề bài**, **ghi chú** (ví dụ "trang 34, bài 3"), **hạn hoàn thành**, **ngôn ngữ của đề (`vi` | `en`)**.
- Ngôn ngữ do AI tự nhận biết (đề của lớp tiếng Anh thường là tiếng Anh hoặc lẫn Việt–Anh) và phụ huynh sửa lại được. Trường này quyết định giọng đọc ở mục 4.3.
- Kết quả hiện ra ở dạng **bản nháp cho phụ huynh xem lại**: sửa nội dung, gộp, tách, xoá bài sai, rồi bấm "Lưu".
- Ảnh gốc được giữ lại và gắn vào bài tập để con có thể mở xem lại đề.

### 4.3 Màn hình của con

Thiết kế cho trẻ 4–6 tuổi, chưa đọc thạo, dùng iPad:

- **Cửa vào:** 3 ảnh tròn to (ảnh thật của từng con) → bấm vào ảnh mình.
- Danh sách **"Bài tập hôm nay"**: thẻ rất to, mỗi thẻ = 1 icon môn học (📖 Tiếng Việt, 🔢 Toán, 🔤 Tiếng Anh, 🎨 Vẽ…) + vài chữ + trạng thái.
- Mở một bài → ảnh gốc chiếm phần lớn màn hình (zoom được) + đề bài chữ to + **nút loa 🔊 "Nghe đề bài"**.
- Giọng đọc theo ngôn ngữ của bài: đề tiếng Việt đọc giọng `vi-VN`, đề tiếng Anh đọc giọng `en-US`. Bài lẫn hai thứ tiếng thì đọc từng đoạn theo đúng giọng của đoạn đó.
- Nút **"Đã làm xong"** rất to, có phản hồi vui (âm thanh / hiệu ứng nhỏ). Tick sai thì bỏ tick được.
- **Đồng hồ làm bài:** mỗi bài có thời lượng ước tính (AI ước 5–15 phút theo độ phức tạp, bố mẹ sửa được). Con bấm "Bắt đầu làm" → đếm ngược to rõ kèm vòng tiến độ đổi màu (xanh → vàng → đỏ nhạt) và 🚀 bay theo vòng; giọng nói nhắc mỗi 5 phút và ở phút cuối. Hết giờ chỉ có chuông dịu + lời động viên, đồng hồ đếm quá giờ màu xám — không phạt. Xong khi còn giờ thì bắn confetti + lời khen.
- Tiến độ dạng hình, không dạng số: 5 ô vuông, làm xong ô nào thì ô đó sáng lên (kèm chữ `3/5` cho bố mẹ nhìn).
- Vùng bấm tối thiểu ~64px cho ngón tay trẻ con; không có menu ẩn, không có cử chỉ swipe phức tạp.
- Nếu hôm nay không có bài: hiện màn hình khen "Hôm nay không có bài tập 🎉".

### 4.4 Màn hình của bố mẹ

- Xem **cả 3 con trên một màn hình**: mỗi con một hàng, hôm nay xong mấy bài / còn mấy bài.
- Xem theo con: hôm nay / tuần này, bài nào xong, bài nào chưa, bài nào quá hạn.
- Sửa hoặc xoá bài tập; sửa bài của một bé sinh đôi không ảnh hưởng bé kia.

### 4.5 Đăng nhập

Nguyên tắc: **không có tài khoản, không email, không mật khẩu.**

- **Các con: không cần đăng nhập.** Mở web là thấy ngay danh sách các con trong gia đình → bấm vào tên mình → vào màn hình bài tập của mình. Tick "đã làm xong" được luôn.
- **Phụ huynh: chỉ cần một mã PIN** (4 số, dùng chung cho cả bố và mẹ). PIN chỉ dùng để mở các chức năng của phụ huynh: thêm bài tập, sửa, xoá, xem tổng quan.
- PIN được nhớ trên **điện thoại của bố mẹ** để không phải nhập lại mỗi lần — nhưng **không nhớ trên iPad của các con** (iPad là thiết bị dùng chung, nếu nhớ PIN ở đó thì coi như không còn tác dụng).
- Đây là ứng dụng trong nhà nên PIN chỉ để **tránh con tự sửa/xoá bài tập của mình**, không nhằm mục đích bảo mật mạnh.

**Nhiều gia đình trên cùng một bản deploy.** Bố mẹ chia sẻ app cho bạn bè (cỡ mươi nhà), nên:

- Mã PIN vừa là mật khẩu vừa là **danh tính** của nhà: nhập PIN ra đúng một nhà. Vì vậy **hai nhà không được trùng PIN** — ai chọn trùng thì được yêu cầu chọn mã khác.
- Nhà mới **tự tạo lấy**: mở web → "Tạo nhà mới" → đặt tên nhà + chọn PIN → thêm hồ sơ các con. Không cần mời, không cần duyệt.
- Mỗi nhà chỉ thấy con và bài tập của mình. Biết id của nhà khác cũng không đọc/sửa được.
- **iPad của các con** được "gắn" vào một nhà đúng một lần, bằng link `/nha/<mã nhà>` (bố mẹ copy ở Cài đặt) hoặc nhập PIN một lần ở màn "Đây là máy của nhà nào?". Máy nhớ một năm; **việc gắn máy không mở phần của bố mẹ**, nên nhập PIN trên iPad ở màn này vẫn an toàn.

Đánh đổi đã chấp nhận: ai có link `/nha/<mã nhà>` đều mở được màn hình bài tập của các con nhà đó. Mã nhà là chuỗi ngẫu nhiên, không đoán được. Đổi PIN được ở Cài đặt, nhưng **không** đăng xuất các thiết bị khác.

## 5. Ngoài phạm vi MVP (để sau)

- Nhắc nhở tự động (thông báo/push, "8h tối rồi, còn 2 bài chưa xong").
- Upload ảnh bài con đã làm để bố mẹ kiểm tra.
- Thống kê dài hạn, streak, phần thưởng / huy hiệu.
- Chia sẻ với giáo viên, lớp học.
- Tài khoản thật (email/Google), lấy lại PIN khi quên, phân quyền trong nhà.
- Chặn dò PIN ở mức hạ tầng (hiện chỉ đếm số lần sai trong RAM của từng instance).
- Thời khoá biểu, lịch thi.
- App mobile native (MVP dùng web responsive).

## 6. Luồng sử dụng chính

**Phụ huynh nhập bài:**

1. Mở web → "Thêm bài tập" → nhập PIN (nếu thiết bị chưa nhớ).
2. Dán text hoặc upload ảnh chụp từ Zalo.
3. Chọn con + ngày.
4. Bấm "Tách bài tập" → chờ vài giây → xem danh sách bài tập hệ thống đề xuất.
5. Sửa lại nếu cần → "Lưu".

**Con làm bài:**

1. Mở web → bấm vào tên mình (không cần đăng nhập).
2. Thấy danh sách bài tập hôm nay.
3. Mở từng bài, đọc đề (kèm ảnh gốc).
4. Làm bài trong vở → quay lại tick "Đã làm xong".

## 7. Mô hình dữ liệu (sơ bộ)

- **Family**: id, tên, `parent_pin` (lưu dạng hash)
- **Child**: id, family_id, tên, **ảnh (bắt buộc — dùng để con tự nhận ra mình)**, **màu riêng**, lớp, thứ tự hiển thị
- **Submission** (lần nhập của phụ huynh): id, family_id, nội dung text gốc, danh sách ảnh, ngày nhập
  → một Submission có thể sinh ra bài tập cho **nhiều con** (trường hợp hai bé sinh đôi).
- **Assignment** (bài tập): id, submission_id, child_id, môn học, nội dung, ghi chú, **ngôn ngữ (`vi` | `en`)**, hạn hoàn thành, trạng thái (todo | done), thời điểm hoàn thành
  → mỗi con có **Assignment riêng** dù đề giống nhau, để tick độc lập.

## 8. Kỹ thuật & triển khai

| Hạng mục               | Chọn                                                                          | Lý do / lưu ý                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting                  | **Vercel** (`*.vercel.app`)                                            | Free tier đủ dùng cho 1 gia đình; deploy từ git                                                                                                                                                                        |
| App                      | Next.js (App Router) + API route                                               | Một codebase, chạy thẳng trên Vercel                                                                                                                                                                                     |
| Database                 | Postgres managed (Vercel Postgres / Neon / Supabase — free tier)              | Vercel không có ổ đĩa lưu lâu dài,**không dùng SQLite file**                                                                                                                                                 |
| Lưu ảnh                | Vercel Blob (hoặc Supabase Storage)                                           | Cũng vì lý do trên; lưu link vào DB                                                                                                                                                                                    |
| Tách bài từ ảnh/text | **Google AI Studio — Gemini API** (free tier, dùng API key)            | Gemini đọc ảnh + trả JSON có cấu trúc trong một lần gọi; đọc chữ Việt tốt, kể cả chữ viết tay                                                                                                             |
| Đọc đề thành tiếng | Web Speech API của iPad (`speechSynthesis`, giọng `vi-VN` và `en-US`) | Miễn phí, chạy ngay trên máy, không cần API. Cần**kiểm tra giọng `vi-VN` có sẵn trên iPad** — nếu iPad chưa tải giọng Việt thì phải bật trong Cài đặt, hoặc lùi về dùng TTS của Google |
| Trên iPad               | Web responsive + "Thêm vào màn hình chính" (PWA)                          | Con bấm icon như một app, không phải mở Safari và gõ link                                                                                                                                                            |

**Lưu ý về free tier cần biết trước:**

- API key của Google AI Studio chỉ để **ở server** (biến môi trường trên Vercel), không bao giờ đưa xuống trình duyệt.
- Free tier của Google AI Studio có **giới hạn số request/phút và /ngày** — với mức dùng vài lần/ngày của một gia đình thì thoải mái, nhưng code vẫn cần xử lý lỗi hết quota (báo "thử lại sau" + cho nhập tay).
- Free tier của Google AI Studio **có thể dùng dữ liệu gửi lên để cải thiện sản phẩm**. Ảnh chụp Zalo lớp có thể chứa tên/thông tin học sinh khác. Đã chấp nhận đánh đổi này; nếu muốn tránh, cân nhắc che tên trước khi upload hoặc chuyển sang tier trả phí sau.
- Hàm serverless trên Vercel có **giới hạn thời gian chạy** → gọi Gemini nên xử lý từng ảnh một, có timeout và cho thử lại.

## 9. Tiêu chí thành công

- Bố mẹ nhập xong một đợt bài tập trong **dưới 1 phút**.
- Kết quả tách bài **đúng ≥ 80%**, phần sai sửa nhanh bằng vài lần chỉnh.
- Nhập một lần ra bài cho **cả hai bé sinh đôi**, không phải làm hai lần.
- Hai bé lớp 1 **tự mở iPad, tự tìm mình, tự tick** được, không cần bố mẹ hướng dẫn lại mỗi lần.
- Gia đình dùng thật **liên tục trong 2 tuần** mà không quay lại cách cũ (đọc trực tiếp trên Zalo).

## 10. Yêu cầu phi chức năng

- Web responsive; thiết bị chính là **iPad (Safari)** cho các con và **điện thoại** cho bố mẹ → test trên đúng hai thiết bị này.
- Tiếng Việt toàn bộ giao diện. Chữ to (≥ 20px cho con), vùng bấm ≥ 64px.
- Tách bài xong trong khoảng **≤ 10 giây** cho một ảnh.
- Dữ liệu riêng tư theo từng gia đình; ảnh chụp có thể chứa tên và thông tin của học sinh khác → không public, không cho search engine index.
- Nhiều nhà dùng chung một DB: **mọi truy vấn phải lọc theo gia đình**, kể cả đường không cần PIN (con tick bài xong). Biết id của nhà khác không được phép đọc hay sửa gì.
- Vì app chạy trên `*.vercel.app` (internet công khai) và màn hình của con không có đăng nhập: đặt ở **đường dẫn khó đoán**, chặn index (`robots.txt` + `noindex`), không hiển thị gì ngoài ảnh/tên các con và bài tập.
- Ảnh bài tập lưu ở link **không đoán được** và không liệt kê được từ bên ngoài.
- PIN của phụ huynh lưu dạng hash; giới hạn số lần nhập sai để con không thử mò được. Cookie phiên có chữ ký, sửa tay không dùng được.
- `PIN_SECRET` là gốc của cả hash PIN lẫn chữ ký cookie → **đặt một lần rồi không đổi**: đổi nó là PIN của mọi nhà thành vô hiệu.
- Thay đổi lược đồ đi bằng migration có đánh số trong `migrations/`, chạy tự động ở bước build khi deploy; migration lỗi thì dừng deploy chứ không để code mới chạy trên DB cũ.
- Hoạt động ổn khi mạng chậm; nếu tách bài lỗi (kể cả do hết quota Gemini) thì vẫn cho phụ huynh nhập bài tập thủ công.

## 11. Đã chốt

- **3 con:** 2 bé sinh đôi 6 tuổi học **cùng lớp 1**, 1 bé 4 tuổi mẫu giáo.
- **Thiết bị của con:** iPad (dùng chung). Bố mẹ dùng điện thoại.
- **Hosting:** Vercel, tên miền `*.vercel.app`.
- **AI tách bài:** Google AI Studio / Gemini API, free tier, gửi ảnh ra ngoài — đã chấp nhận.
- **Đăng nhập:** con không cần đăng nhập; phụ huynh dùng một mã PIN dùng chung.
- **Chia sẻ cho bạn bè:** mỗi nhà tự tạo và tự chọn PIN, PIN không được trùng nhau; iPad của con gắn vào nhà bằng link riêng của nhà đó.
- **Bé 4 tuổi có bài tập thật** — học thêm tiếng Anh → cả 3 con đều là người dùng thật, đề bài có cả tiếng Việt và tiếng Anh, phải đọc thành tiếng đúng giọng.

## 12. Còn cần chốt

- Bài tập tiếng Anh của bé thường ở dạng gì: ảnh phiếu bài tập, hay **link video / file ghi âm** của trung tâm? Nếu có link/audio thì cần thêm chỗ dán link và nút phát — bé 4 tuổi chưa đọc, nghe là chính (hiện chưa có trong phạm vi MVP).
- Có cần xem lại bài tập của những ngày trước (lịch sử) không, hay chỉ cần "hôm nay" + "tuần này"?
- Môn học: cố định một danh sách ngắn (Toán, Tiếng Việt, Tiếng Anh, Vẽ, Khác) hay để Gemini tự đoán tên môn?
