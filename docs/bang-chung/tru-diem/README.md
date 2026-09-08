# Bằng chứng: Bố mẹ trừ ⭐ khi con chưa nghe lời (issue #43)

Chụp trên dev server cục bộ (PGlite, `npm run db:seed` rồi cộng tay Minh 12 ⭐ /
An 5 ⭐ / Bé Na 3 ⭐ bằng ba dòng `score_events`, rồi `next dev`), Chrome headless
qua `chrome-devtools-axi`. Màn bố mẹ ở 390×844 (điện thoại) và 1440×900 (Macbook),
màn của con ở 1180×820 (iPad ngang) và 1440×900. Bố mẹ đăng nhập bằng
`POST /api/pin` với PIN mặc định 1234. Mọi thao tác trong ảnh là thao tác thật
trên giao diện (bấm viên, gõ số, bấm chip, bấm nút) — trừ một lần gọi
`POST /api/tru-diem` từ console để giả "máy khác của bố/mẹ vừa trừ" (ảnh 06).

Hai ảnh động, mỗi khung là một thao tác (1 khung/giây):

- `bome-tru-diem.gif` — bố mẹ trừ điểm có lý do rồi đi tiếp qua đường "Trừ hết N" (ảnh 01→07).
- `con-thay-bi-tru.gif` — con mở màn chọn con → màn của An → cửa hàng thấy dòng bị trừ kèm lý do (ảnh 09, màn của An, 10).

| Ảnh | Nội dung |
| --- | --- |
| `01-bome-thuong-vien-sao-tung-con-dien-thoai.png` | Màn Thưởng: viên ⭐ từng con (Minh 12, An 5, Bé Na 3) nay có dấu ⊖ — bấm là mở ô trừ. Câu mở đầu nói thêm "bố mẹ trừ ⭐ được, nhưng không bao giờ xuống dưới 0". |
| `02-bome-mo-o-tru-minh-dien-thoai.png` | Bấm viên Minh: ô "Trừ … ⭐" (số, tự focus), sáu chip lý do gợi ý viết bằng lời nói được với con, ô lý do (không bắt buộc), nút "Trừ ⭐" khoá khi chưa gõ số. |
| `03-bome-go-3-chon-ly-do-dien-thoai.png` | Gõ 3, bấm chip "Không nghe lời" → ô lý do điền sẵn, nút đọc "Trừ 3 ⭐ của Minh". |
| `04-bome-da-tru-3-lich-su-dien-thoai.png` | Sau khi bấm: viên Minh 12 → 9 (số máy chủ trả về, không đợi tải lại), thông báo xanh "Đã trừ 3 ⭐ của Minh, còn 9 ⭐", mục **Đã trừ gần đây** có dòng "−3 ⭐ · Minh · Không nghe lời · 8/9/2026" — lưu đúng số đã trừ, không lưu tổng. |
| `05-bome-go-qua-so-nut-khoa-dien-thoai.png` | Tầng giao diện của "không âm": chọn An (5 ⭐), gõ 8 → ô đỏ, chữ "Con chỉ có 5 ⭐", nút "Trừ 8 ⭐ của An" bị khoá. |
| `06-bome-may-chu-tu-choi-moi-tru-het-3-dien-thoai.png` | Tầng dữ liệu của "không âm": gõ 4 (≤ 5 đang hiện) và chọn "Cãi bố mẹ"; trong lúc đó máy khác trừ An 2 ⭐ (gọi API từ console) → bấm "Trừ 4 ⭐ của An", máy chủ từ chối "An chỉ còn 3 ⭐, không trừ được 4 ⭐.", viên An cập nhật 3, nút đổi thành **"Trừ hết 3 ⭐"** — N là số máy chủ vừa tính, không phải 5 đang hiện lúc mở form. |
| `07-bome-sau-tru-het-an-0-sao-dien-thoai.png` | Bấm "Trừ hết 3 ⭐": An về 0, lịch sử có "−3 · An · Cãi bố mẹ" và "−2 · An · Không dọn đồ" (lần máy khác trừ) — mỗi lần một dòng đúng số đã trừ. |
| `08-bome-thuong-macbook.png` | Màn Thưởng ở 1440×900: thanh bên trái, cột hẹp `xl:max-w-lg`; lịch sử có dòng Bé Na −1 "Không ghi lý do" (bố mẹ để trống). |
| `09-chon-con-cung-so-sao-ipad.png` | Màn chọn con: Minh 9 / An 0 / Bé Na 2 — cùng một con số với viên trên màn bố mẹ và với bảng xếp hạng, vì tất cả đọc từ một hàm `soDiemTheoCon`. Huy hiệu "9 việc" không đổi: trừ điểm không đụng vào bài/nhiệm vụ. |
| `10-cua-hang-an-bo-me-da-tru-ipad.png` | Cửa hàng của An: "Con có 0 ⭐" và mục **"Bố mẹ đã trừ ⭐"**: "−3 ⭐ Cãi bố mẹ", "−2 ⭐ Không dọn đồ", kèm ngày — con thấy mình bị trừ và vì sao (quyết định 4). |
| `11-cua-hang-bena-khong-ly-do-ipad.png` | Bố mẹ để trống lý do: con thấy "−1 ⭐ Con hỏi bố mẹ vì sao nhé" (`LY_DO_TRU_TRONG`), không để trống. |
| `12-cua-hang-an-macbook.png` | Cửa hàng của An ở 1440×900. |

API kiểm bằng `fetch` từ trình duyệt đã đăng nhập PIN: `points: -3` / `0` / `"abc"`
→ 400 "Số ⭐ trừ phải là một số lớn hơn 0."; `truHet: true` khi An đang 0 → 400
"An không còn ⭐ nào để trừ." kèm `conLai: 0`, không ghi dòng nào; `points: 1` khi
0 → cùng 400; `childId` lạ → 404. `GET /api/tru-diem` trả đúng 4 dòng
`[bena 1 ''], [an 3 'Cãi bố mẹ'], [an 2 'Không dọn đồ'], [minh 3 'Không nghe lời']`.
