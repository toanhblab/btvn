# Bằng chứng chạy thật — trừ ⭐ (issue #43), commit bcd612f

Dev server thật (`next dev`, Next 16 + PGlite, `npm run db:seed` rồi cộng tay
Minh 12 ⭐ / An 5 ⭐ / Bé Na 3 ⭐), Chrome qua `chrome-devtools-axi`, đăng nhập
PIN bố mẹ 1234. Màn bố mẹ 390×844 và 1440×900, màn của con 1180×820.
Ảnh 13–16 chụp trên **máy chủ chạy `TZ=UTC`** (giống hàm Vercel).

| Ảnh | Cho thấy |
| --- | --- |
| `01-bome-thuong-vien-sao.png` | Viên ⭐ từng con có dấu ⊖ — chỗ trừ điểm nằm ngay màn Thưởng của bố mẹ. |
| `02-bome-mo-o-tru-chip-goi-y.png` | Ô "Trừ … ⭐" (quyết định 1: gõ SỐ MUỐN TRỪ), 6 chip gợi ý một chạm, ô lý do không bắt buộc, placeholder "Vì sao? (không bắt buộc — con sẽ đọc dòng này)" (quyết định 3 + 4). |
| `03-bome-go-3-chon-ly-do.png` | Gõ 3, bấm chip "Không nghe lời" → nút đọc **"Trừ 3 ⭐ của Minh"**. |
| `04-bome-da-tru-3.png` | Sau khi bấm: Minh 12 → 9, băng xanh "Đã trừ 3 ⭐ của Minh, còn 9 ⭐", mục **Đã trừ gần đây** có dòng "−3 ⭐ · Minh · Không nghe lời". |
| `05-bome-go-8-nut-tru-het-5.png` | An đang hiện 5 ⭐, gõ 8 → cảnh báo "Con chỉ có 5 ⭐" và nút đổi mặt thành **"Trừ hết 5 ⭐"** (bấm được, không khoá). |
| `06-bome-tru-het-may-chu-kep-ve-0.png` | Trong lúc đó "máy khác" trừ An 2 ⭐ (POST /api/tru-diem) nên An thật ra còn 3; bấm "Trừ hết 5 ⭐" → máy chủ ghi LEAST(5, 3) = **3**, "Đã trừ 3 ⭐ của An, còn 0 ⭐" — **không âm** và **không quá số trên nhãn**. |
| `07-bome-an-0-sao-nut-van-bam-duoc.png` | An đang 0 ⭐, gõ 2 → nút "Trừ 2 ⭐ của An" vẫn bấm được (màn không tự từ chối). |
| `08-bome-may-chu-tu-choi-khi-con-het-sao.png` | Bấm → máy chủ từ chối: "An không còn ⭐ nào để trừ." (lý do từ chối duy nhất). |
| `09-bome-thuong-macbook.png` | 1440×900: thanh bên trái, lịch sử 4 dòng, dòng Bé Na "Không ghi lý do". |
| `10-con-an-cua-hang-thay-bi-tru.png` | **Quyết định 4**: cửa hàng của An hiện "Con có 0 ⭐" và mục **"Bố mẹ đã trừ ⭐"** — "−3 ⭐ Cãi bố mẹ", "−2 ⭐ Không dọn đồ" kèm ngày. |
| `11-con-bena-tru-khong-ly-do.png` | Bố mẹ để trống lý do → con đọc "Con hỏi bố mẹ vì sao nhé", không để trống. |
| `12-con-chon-ten-cung-so-sao.png` | Màn chọn con + bảng xếp hạng đọc cùng số ⭐ sau khi trừ; huy hiệu "9 việc" không đổi (trừ ⭐ không đụng bài/nhiệm vụ). |
| `13-con-an-cua-hang-server-TZ-UTC.png` | Cùng màn ở trên nhưng **máy chủ TZ=UTC**: hai dòng trừ tạo lúc 17:29Z ngày 8/9 (= 00:29 sáng 9/9 giờ nhà) vẫn đọc **9/9/2026**, không lùi thành 8/9. |
| `14-bome-da-tru-gan-day-server-TZ-UTC.png` | Mục "Đã trừ gần đây" của bố mẹ, cũng máy chủ TZ=UTC: cả 4 dòng 9/9/2026. |
| `15-bome-sau-khi-duyet-minh-ve-0.png` | Sau khi duyệt đổi thưởng 10 ⭐: Minh về 0 — cùng một số dư, hai đường trừ. |
| `16-bome-da-xu-ly-gan-day-ngay-nha.png` | "Đã xử lý gần đây" (decidedAt) cũng theo giờ nhà: 9/9/2026. |
| `bome-tru-diem.gif` | Ảnh 01 → 08 nối lại, mỗi khung một thao tác. |

Tệp chữ:

- `db-score-penalties.txt` — dữ liệu đã lưu: **mỗi lần bấm một dòng, đúng số đã trừ lần đó** (−3, −2, −3, −1), không lưu tổng; số dư của cả 3 con ≥ 0; không có dòng điểm âm nào trong `score_events`.
- `api-tru-diem.txt` — `POST /api/tru-diem`: `points` âm/0/"abc"/thiếu đều 400 (**không có đường cộng tay** — quyết định 5); con hết ⭐ → 400 kèm `conLai`.
- `api-duyet-va-so-du.txt` — hai bố mẹ cùng bấm Duyệt: bên sau nhận **409 "Yêu cầu này đã được xử lý rồi."** (không phải "chưa đủ điểm"); duyệt xong trừ tiếp thì bị từ chối vì số dư 0.
- `tz-truoc-sau.txt` — cùng một mốc `2026-09-08T17:29:29.900Z` dưới `TZ=UTC`: cách cũ ra 8/9/2026, `ngayNha` ra 9/9/2026.
