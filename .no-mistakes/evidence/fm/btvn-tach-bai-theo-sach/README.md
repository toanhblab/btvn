# Bằng chứng kiểm thử — issue #64 (tách bài theo CUỐN SÁCH + màn khai sách)

Chạy ngày 2026-09-17 trên `next dev` + PGlite local (`npm run db:migrate` →
`npm run db:seed`, PIN 1234), Chrome lái bằng `chrome-devtools-axi`, mở qua
`http://localhost:<cổng>` (không dùng `127.0.0.1`). Cỡ điện thoại đặt bằng
`emulate --viewport "390x844x3,mobile,touch"` và kiểm lại `eval "() => innerWidth"`
= 390 trước mỗi tấm; Macbook 1440×900; iPad 1180×820.

## Vế 1 — một cuốn sách là MỘT bài

| Tệp | Nội dung |
| --- | --- |
| `13-vi-du-issue-64.json` | Đúng ví dụ trong issue: "làm bài tập toán trang 41, 42, 43 ở sách poth math" → **1 bài**. Cô viết thành BA DÒNG cùng cuốn cũng vẫn **1 bài**. Thêm một việc khác thì việc đó vẫn tách riêng (không gộp bừa). |
| `12-api-extract-duong-lui.json` | Cùng tin nhắn 5 dòng: giao cho Minh + An → **3 bài**; giao cho Bé Na (Poth Math không phải sách của Na) → 4 bài. Danh sách sách theo con đổi kết quả. |
| `04-them-bai-dan-tin-nhan-390.png` | Bố mẹ dán tin nhắn 5 dòng của cô ở màn **Thêm bài** (390px). |
| `05-kiem-tra-lai-gop-theo-sach-390.png` | **Kiểm tra lại**: "3 bài cho Minh và An". Thẻ đầu gộp hai dòng Poth Math thành một, ghi chú "Poth Math". |
| `06-kiem-tra-lai-ca-trang-390.png` | Ảnh cả trang: 3 thẻ (Poth Math gộp · Tiếng Việt tập 1 gộp, cần quay video · bài vẽ riêng). |
| `08-man-con-mot-the-poth-math-ipad.png` | **Màn của con** (iPad 1180×820) sau khi lưu: đúng MỘT thẻ Toán "trang 41, 42, 43 … Poth Math tr. 44", ghi chú "Poth Math". |
| `14-trang-thai-da-luu.txt` | Dòng đã ghi vào CSDL (GET /api/assignments) — một dòng cho cả cuốn. |

## Vế 2 — bố mẹ khai sách, danh sách thành ngữ cảnh cho AI

| Tệp | Nội dung |
| --- | --- |
| `01-sach-chua-khai-390.png` | `/bome/sach` khi nhà chưa khai cuốn nào. |
| `02-sach-khai-poth-math-390.png` | Khai "Poth Math", môn Toán, "Sách của" Minh + An — điền ngay trên màn. |
| `03-sach-bon-cuon-390.png` | Bốn cuốn đã khai, mỗi cuốn có môn và danh sách con. |
| `10-bome-sach-macbook-1440.png` | Cùng màn ở 1440×900 (thanh bên trái 260px). |
| `11-loi-nhac-gui-len-AI.txt` | **Lời nhắc THỰC SỰ GỬI ĐI**, bắt tại điểm cuối HTTP: khối "SÁCH / VỞ / NGUỒN BÀI TẬP BỐ MẸ ĐÃ KHAI" có trong thân yêu cầu. Giao cho Minh + An thì có Poth Math; cùng nội dung giao cho Bé Na thì Poth Math biến mất, Bé tập tô xuất hiện. |
| `09-kiem-tra-lai-duong-AI-390.png` | Màn **Kiểm tra lại** khi đi ĐƯỜNG AI (`NOUS_BASE_URL` trỏ vào máy chủ giả): băng đỏ "tách tạm" biến mất, còn lời nhắc "AI đọc hộ…". |

## Hai chiều sửa tay ở màn Kiểm tra lại

| Tệp | Nội dung |
| --- | --- |
| `07-kiem-tra-lai-sau-khi-tach-390.png` | Đặt con trỏ trước "Poth Math tr. 44" rồi bấm **✂️ Tách bài này** → 3 thẻ thành 4. Gộp lại bằng "+ Gộp với bài trên" thì về đúng 3 thẻ như cũ. |
| `15-hit-test.txt` | Hit-test trong trang cho mọi chip ✂️ / Gộp / Lưu ở 390px và mọi nút của `/bome/sach` ở 390px + 1440px — 25/25 điểm, không tràn ngang. |

Cờ 🎥 khi tách (luật đã chốt ở vòng soát 5) quan sát được trên màn:
thẻ Poth Math đang TẮT cờ → tách ra cả hai nửa vẫn tắt; thẻ Tiếng Việt tập 1 đang
BẬT cờ → tách trước "trang 11" thì chỉ nửa có "đọc to" giữ cờ, nửa đầu thành
"Không cần video".

## Còn thiếu: xác nhận trên iPhone THẬT

Mọi ảnh 390px ở đây là **giả lập** bằng device-metrics override của Chrome. Theo
AGENTS.md (tiền lệ PR #58) việc đụng giao diện điện thoại vẫn cần captain mở
`/bome/sach` và hàng chip ở **Kiểm tra lại** trên iPhone thật trước khi đóng việc.
