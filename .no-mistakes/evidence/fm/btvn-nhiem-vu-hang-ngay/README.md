# Bằng chứng chạy thật — "Nhiệm vụ hàng ngày có thưởng sao" (issue #42)

Chạy trên `next dev` cục bộ (PGlite, `npm run db:seed` rồi `npx next dev -p 3457`),
Chrome headless qua `chrome-devtools-axi`, mở bằng `http://localhost:3457` (không
dùng `127.0.0.1`, xem AGENTS.md). Màn của con chụp ở viewport rộng 1200px (nhánh
bố cục iPad ngang, dưới 1280px); màn bố mẹ chụp ở 500×844 (nhánh cột hẹp + thanh
điều hướng dưới) và 1440×900 (nhánh Macbook, thanh bên 260px). Bố mẹ đăng nhập
bằng `POST /api/pin` với PIN mặc định 1234.

| Ảnh / tệp | Chứng minh điều gì |
| --- | --- |
| `01-con-chon-ten-huy-hieu-viec.png` | Màn chọn con: huy hiệu "9 việc / 9 việc / 5 việc" đếm gộp bài + nhiệm vụ đúng bằng những gì màn của con vẽ ra. Câu nhắc luật đã sửa: "Ngày nào **có bài tập** mà làm xong hết cả bài lẫn nhiệm vụ thì được thêm 10 ⭐". |
| `02-con-minh-hai-nhom-nhiem-vu.png` | Q1 — màn của Minh có HAI nhóm riêng "🎒 Sau khi học xong" (3 việc mặc định, 1 ⭐ mỗi việc — Q3) và "🏠 Việc nhà hàng ngày" (Đánh răng 2 ⭐, Đọc sách 3 ⭐); mỗi dòng có icon + chip ⭐ (Q7). |
| `03-con-minh-tick-nhiem-vu-chip-cong-sao.png` | Q4 + Q5 — con tick "Đánh răng buổi tối" ngay tại chỗ, không hỏi PIN: chip "+2 ⭐" hiện trên dòng, tổng ⭐ ở đầu trang 0 → 2, tiến độ nhóm 1/2. |
| `04-nhom-bai-dem-ca-bai-ngay-mai.png` | Bố mẹ nhập bài cho NGÀY MAI (tình huống thường ngày), con làm xong 3 bài hôm nay: đầu nhóm "Nguyễn Siêu" đọc **3/4 bài xong**, KHÔNG tô xanh, KHÔNG 🎉 — trong khi thẻ bài dưới tiêu đề "Ngày mai" còn nguyên. Đây là bất biến "tập đếm == tập vẽ" trong một màn. |
| `05-con-bena-khong-co-bai-van-co-nhiem-vu.png` | Q2 — Bé Na hôm nay không có bài tập nào mà vẫn có nhiệm vụ hàng ngày. "Đọc sách 15 phút" (chỉ giao Minh + An) không hiện với em; nhóm bài Smartkid đọc "0/1 bài xong" cho thẻ bài "Ngày mai". |
| `06-con-bena-xong-het-nhiem-vu-5-sao.png` | Tick hết 4 nhiệm vụ hôm nay → màn khen: "Con làm hết **nhiệm vụ** hôm nay rồi", **5 ⭐** (1+1+1+2) và **không** có dòng "+10" vì ngày đó không có bài tập thật (đúng Q5, đúng câu chữ đã sửa). |
| `07-con-chon-ten-sau-khi-tick-het.png` | Phép thử về-0 cho Bé Na: sau khi tick hết mọi thứ đang thấy của hôm nay, huy hiệu còn "1 việc" — đúng một thẻ bài ngày mai mà màn của em CÓ vẽ và CÓ tick được; ⭐ của em 5. |
| `08-bome-trang-nhiem-vu-hang-ngay-dien-thoai.png` | Q8 — trang riêng `/bome/nhiem-vu-hang-ngay`: mỗi thẻ có icon + tên + số ⭐, chip nhóm, hàng chip "Giao cho" (Cả nhà / từng con), hai mũi tên thứ tự, công tắc, nút xoá. Thanh dưới vẫn đúng 5 tab (không có tab thứ 6). |
| `09-bome-hop-thoai-xoa-nhiem-vu-chu-moi.png` | Hộp thoại xoá với câu chữ đã sửa ở vòng này: "app thôi tạo việc này cho những ngày chưa tạo, còn ngày đã tạo rồi thì con vẫn thấy và vẫn tick được — hôm nay, và cả ngày mai nếu bố mẹ đã giao bài cho ngày mai." |
| `10-bome-tat-cong-tac-doc-sach.png` | Bố mẹ tắt công tắc "Đọc sách 15 phút" → thẻ đọc "Đang tắt". |
| `11-con-minh-tick-nhiem-vu-da-tat-van-duoc-3-sao.png` | Kiểm chính câu chữ trên: sau khi TẮT, dòng "Đọc sách 15 phút ⭐ 3" của hôm nay vẫn còn trên màn của Minh và vẫn tick được — chip "+3 ⭐", tổng ⭐ 2 → 5, nhóm "🎉 2/2 việc xong". |
| `12-con-minh-bo-tick-khong-bi-rut-sao.png` | Q6 — bỏ tick dòng vừa xong: dòng về "chưa xong", nhóm về 1/2, nhưng tổng ⭐ **vẫn là 5**, không bị rút. |
| `13-bome-cai-dat-dong-dan-nhiem-vu.png` | Q8 — Cài đặt thu về một dòng dẫn "Cài nhiệm vụ hàng ngày · 5 nhiệm vụ · giao cho con nào, mấy ⭐, thuộc nhóm nào". |
| `14-bome-thuong-cau-mo-dau-va-dong-dan.png` | Màn Thưởng: câu mở đầu đã sửa ("Ngày **có bài tập** mà xong hết cả bài lẫn nhiệm vụ: +10 ⭐ (ngày không có bài thì chỉ được ⭐ của từng nhiệm vụ)" + "Mỗi nhiệm vụ hàng ngày tick xong: thêm đúng số ⭐ của nhiệm vụ đó") và dòng dẫn thứ hai sang trang cài nhiệm vụ. |
| `15-bome-chi-tiet-con-hop-nhiem-vu.png` | Chi tiết con của bố mẹ: hộp "NHIỆM VỤ HÀNG NGÀY 1/5 xong", mỗi dòng icon + huy hiệu nhóm (🎒/🏠) + số ⭐; tiến độ bài tập "3/4 bài đã xong" đếm riêng, không trộn nhiệm vụ. |
| `16-bome-nhiem-vu-hang-ngay-macbook-1440x900.png` | Bố cục Macbook thật ở 1440×900: thanh bên trái 260px, `<main>` giữ cột hẹp 512px (`xl:max-w-lg`) vì màn này chưa có bản thiết kế Macbook. Không có tab nào sáng khi đang ở `/bome/nhiem-vu-hang-ngay` (đo bằng màu chữ: mọi mục `rgb(66,71,84)`; vào `/bome/nhiem-vu` thì mục đó thành `rgb(255,255,255)`). |
| `17-con-minh-xong-het-cong-10-tong-18-sao.png` | Q5 đầy-đủ — Minh làm nốt bài tiếng Anh + các nhiệm vụ còn lại của hôm nay: màn khen nói "Con làm hết **bài và nhiệm vụ** hôm nay rồi", "🏆 Hôm nay con được 10 điểm!", tổng **18 ⭐**. Số 18 đúng bằng 5 (đã có) + 1 + 1 + 1 + **0 cho "Đọc sách" vì đã cộng một lần trước đó** + 10 → chứng minh luôn "tick lại không cộng lần hai". |
| `18-con-chon-ten-phep-thu-ve-0.png` | Phép thử về-0 cho Minh: huy hiệu còn "1 việc" (đúng thẻ bài ngày mai), An chưa làm gì nên vẫn "9 việc". |
| `19-con-minh-sau-khi-xong-het-hom-nay.png` | Cùng một màn, ba nhóm đã xong tô xanh + 🎉 ("🎉 1/1 bài xong", "🎉 3/3 việc xong", "🎉 2/2 việc xong") nhưng nhóm "Nguyễn Siêu" vẫn đọc **3/4 bài xong** vì còn thẻ bài "Ngày mai" — đầu nhóm không bao giờ nói xong khi thân nhóm còn thẻ chưa làm. |
| `20-con-minh-doi-nhom-dong-hom-nay-doi-cho-ngay.png` | Bố mẹ đổi nhóm "Đánh răng buổi tối" sang "Sau khi học xong" → dòng của HÔM NAY trên màn của con đổi chỗ ngay (nhóm đầu 4/4, nhóm sau 1/1), đúng như câu chữ "riêng đổi nhóm thì dòng của hôm nay đổi chỗ theo ngay". |
| `21-ket-qua-test-nhiem-vu-hang-ngay.txt` | Output đầy đủ của 5 tệp test liên quan (65 test, PGlite thật qua bộ chạy migration của dự án): migration 016, tạo lười dòng của ngày, lọc theo `child_ids`, chép `stars`/`icon`, luật điểm ⭐/+10/+1, đường đổi hạn chót, và các bất biến của `lib/nhomNhiemVu.ts`. |
| `22-trang-thai-db-va-luat-diem.txt` | Trạng thái DB THẬT sau các bước trên trình duyệt: Bé Na 4 dòng `task_done` = 5 ⭐ và **không** có dòng `day_complete`; Minh 5 dòng `task_done` (8 ⭐) + 1 dòng `day_complete` (10 ⭐) = 18 ⭐; **0** dòng điểm âm; cấu hình `daily_chores` (⭐/icon/nhóm/`child_ids`/bật-tắt); và phần cuối chạy chính `SQL_TAO_NHIEM_VU_NGAY` của sản phẩm cho một ngày CHƯA tạo để thấy nhiệm vụ đang tắt không sinh dòng mới, trong khi dòng hôm nay/ngày mai đã tạo vẫn nguyên. |
