/**
 * Dau hieu mot de bai doi con QUAY VIDEO, tach rieng khoi lib/ai.ts vi HAI ben
 * dung chung: duong lui tach tho o may chu (splitByRule), va phep TACH mot the o
 * man Kiem tra lai (lib/banNhap.ts) — ma banNhap chay trong component khach, con
 * lib/ai.ts doc process.env va giu ca PROMPT o muc module nen khong keo xuong
 * trinh duyet duoc. Tep nay khong import gi, khong doc bien moi truong.
 *
 * MOT ban duy nhat cua luoi nay: viet regex thu hai o cho khac la hai duong nhan
 * khac nhau cho cung mot cau chu.
 */

/**
 * Luoi THO nhan ra bai phai QUAY VIDEO. Chi dung khi KHONG co cau tra loi nao
 * khac de dua vao: duong lui tach tho theo dong (splitByRule), va mot nua the
 * vua bi bo me cat ra (tachBanNhap) — chu de bai cua nua do la thu duy nhat noi
 * len viec do co phai quay video khong. Khi da goi duoc AI thi truong
 * canQuayVideo cua no la quyet dinh cuoi cung, KHONG OR them regex nay vao:
 * regex bat nham ("viết đoạn văn kể lại...") se chan con tick xong bai. KHONG
 * bat tu "video" tran: "xem video cô gửi" la XEM, khong phai quay.
 *
 * DUNG "dong bo" danh sach nay voi danh sach trigger trong PROMPT cua lib/ai.ts.
 * Hai ben CO Y lech nhau: prompt con co "kể lại ... cho bố mẹ nghe", "thuyết
 * trình", "hát" nhung o day khong co. Tieng Viet khong dong lai duoc bang mot
 * danh sach tu khoa — "kể lại" nam trong ca bai NOI ("kể lại cho bố mẹ nghe")
 * lan bai VIET ("viết đoạn văn kể lại ... vào vở"), va gan co sai vao bai viet
 * la XOA han nut "Đã làm xong" cua con cho tới khi bo me vao /bome bo tick.
 *
 * Nen o duong nay THIEU co la lua chon co chu y, khong phai lo: moi bai tach
 * theo dong deu mang confidence 0.3 nen man Kiem tra lai luon dan canh bao
 * "Tách tạm, chưa qua AI", va bo me bat chip 🎥 ngay tai do bang mot lan bam.
 * Bom them tu khoa vao day de "cho du" la doi cai gia dat hon cai duoc.
 *
 * Ngoai le duy nhat: khi co giao GHI THANG chu "video/clip/phim" sau mot dong tu
 * nop bai thi khong con gi phai doan, nen nhanh do nhan ca chu dem o giua ("quay
 * 1 video...", "quay lại video...", "nộp video...").
 *
 * Cac ca duoi day la hop dong cua regex nay, doi regex thi doi tay lai het:
 *   PHAI bat: "Quay 1 video kể lại câu chuyện" | "Quay một video thuyết trình"
 *             "Quay lại video bài hát" | "Quay 2 videos đọc bài"
 *             "Nộp video đọc bài" | "quay video gửi cô"
 *             "Đọc to bài thơ" | "Đọc thuộc lòng" | "Tập thể dục" | "Biểu diễn"
 *   KHONG duoc bat: "Viết đoạn văn kể lại câu chuyện Cây khế vào vở"
 *                   "Chép lời bài hát Bụi phấn vào vở"
 *                   "Xem video bài giảng rồi làm bài tập"
 *                   "Xem video cô gửi" | "Đọc toàn bộ câu chuyện" | "Đọc toán trang 5"
 *                   "Xem lại group video của lớp rồi viết vào vở"
 *                   "Bố mẹ backup video bài giảng cho con xem"
 *                   "Cô gửi video bài giảng, con xem rồi làm bài tập vào vở"
 *                   "Cô giáo gửi video cho bố mẹ tham khảo"
 *                   "Con xem ít nhất 1 tập phim hoạt hình trong link film cô gửi
 *                    trong nhóm riêng."
 *
 * Ba ca cuoi la ly do dong tu "gửi" DA BI BO khoi nhom dong tu — DUNG them lai.
 * Trong tin nhan cua co giao, "gửi" gan chu "video" thi nguoi gui thuong la CO
 * chu khong phai con ("cô gửi video bài giảng"), va ca hai huong va — neo nguoi
 * gui (cô|thầy) hay negative lookbehind chan chu ngu — deu vo tren bien the that
 * ("Cô giáo gửi", "Cô chủ nhiệm gửi", "Cô Lan gửi", "Giáo viên gửi", "Nhà trường
 * gửi"). Sot co thi bo me bat lai bang chip 🎥 khi duyet; bat oan thi XOA han nut
 * "Đã làm xong" cua con. Chieu "Con gửi video cho cô" van bat duoc qua "quay" /
 * "nộp" — hai chu gan nhu luon co mat trong de kieu do.
 *
 * Hai ca "group video" / "backup video" la ly do co (?<![a-zA-ZÀ-ỹ]) truoc nhom
 * dong tu: khong co bien trai thi "up" bat duoc phan duoi cua "gro-up" /
 * "back-up". splitByRule chi chay o may chu (app/api/extract) nen lookbehind
 * khong lien quan Safari cu.
 */
export const VIDEO_HINT =
  /(?<![a-zA-ZÀ-ỹ])(quay|nộp|upload|up)\s*(lại\s*)?(\d+|một|hai|ba)?\s*(video|clip|phim)|đọc\s+to(?![a-zA-ZÀ-ỹ])|đọc\s+thuộc|thuộc\s+lòng|tập\s+thể\s+dục|biểu\s+diễn|read\s+aloud|recite|record\s+(a\s+)?video/i;

/** De bai nay co dau hieu phai quay video khong? */
export const coDauHieuVideo = (text: string): boolean => VIDEO_HINT.test(text);
