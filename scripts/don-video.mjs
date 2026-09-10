/**
 * Goi tay mot luot don video va in bao cao ra man hinh cho de doc.
 *
 *   BTVN_URL=https://... CRON_SECRET=... node scripts/don-video.mjs
 *   BTVN_URL=... CRON_SECRET=... node scripts/don-video.mjs --max 5
 *   BTVN_URL=... CRON_SECRET=... node scripts/don-video.mjs --that --max 5
 *
 * Script nay KHONG tu noi vao CSDL hay kho tep: no goi CHINH route ma cron goi
 * (`GET /api/don-video`). Co y — lan chay tay va lan cron chay dung mot duong
 * ma, nen khong the co chuyen "chay tay thi dung, cron thi khac".
 *
 * MAC DINH LA CHAY THU: khong co `--that` thi script them `?thu=1`, tuc route
 * chi liet ke, khong xoa gi, KE CA khi may chu da bat DON_VIDEO_CHAY_THAT=1.
 * Do la cach captain xem truoc danh sach truoc khi gat.
 *
 * `--that` chi BO tham so ep chay thu, no KHONG tu bat duoc xoa that: quyen do
 * nam o bien moi truong DON_VIDEO_CHAY_THAT tren may chu. Hai khoa, hai noi.
 */

const args = process.argv.slice(2);
const co = (ten) => args.includes(ten);
const so = (ten) => {
  const i = args.indexOf(ten);
  return i === -1 ? null : Number(args[i + 1]);
};

const goc = (process.env.BTVN_URL ?? '').replace(/\/+$/, '');
const secret = process.env.CRON_SECRET ?? '';
if (!goc || !secret) {
  console.error('✗ Can BTVN_URL va CRON_SECRET.');
  console.error('  Vi du: BTVN_URL=https://btvn.example.com CRON_SECRET=... node scripts/don-video.mjs');
  process.exit(1);
}

const q = new URLSearchParams();
if (!co('--that')) q.set('thu', '1');

// `--max` hong thi DUNG HAN o day, khong bo qua no.
//
// Bo qua la huong sai nguy hiem nhat co the co tren duong xoa khong lui duoc:
// khong co `max=` tren dia chi thi may chu lay MAX_MOI_LUOT_MAC_DINH — tuc TRAN
// RONG NHAT. Nguoi go `--max 5` roi go nham mot ky tu ('--max 5x', '--max five',
// hay vo tinh de trong) se xoa toi 20 tep trong khi tin la minh vua cho phep 5,
// va hang rao 7 (mot luot that moi ngay) khien khong co lan thu hai de nhan ra.
// Xin hep ma duoc rong la dieu KHONG BAO GIO duoc phep xay ra.
const i = args.indexOf('--max');
if (i !== -1) {
  const tho = args[i + 1];
  const max = Number(tho);
  if (tho === undefined || tho.startsWith('--') || !Number.isInteger(max) || max <= 0) {
    console.error(`✗ --max phai la so nguyen duong. Nhan duoc: ${tho === undefined ? '(khong co gi)' : tho}`);
    console.error('  Khong goi may chu, khong xoa gi ca.');
    process.exit(1);
  }
  q.set('max', String(max));
}

const url = `${goc}/api/don-video${q.size ? `?${q}` : ''}`;
console.log(`→ ${url}`);

const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
const data = await res.json().catch(() => null);
if (!data) {
  console.error(`✗ May chu tra ${res.status}, khong doc duoc JSON.`);
  process.exit(1);
}

// Than tra ve co the KHONG phai bao cao: route tra `{ error: 'unauthorized' }`
// cho MOI lan goi khi CRON_SECRET thieu hay khong khop, va nen tang co the tra
// mot than JSON khac han (404 khi chua deploy, trang loi cua Vercel). Than do
// van la JSON hop le nen phep kiem o tren cho no di qua, roi `data.ungVien.some`
// o duoi nga bang mot vet ngan xep Node khong he nhac den 401.
//
// Nhan ra bang CHINH hinh dang bao cao chu khong bang ma trang thai: mot luot
// chay hong tra 500 nhung VAN kem bao cao day du, va luc do bao cao la thu dang
// doc nhat — nhanh `data.loi` o cuoi tep nay in no ra.
if (!Array.isArray(data.ungVien)) {
  console.error(`✗ May chu tra ${res.status}${data.error ? `: ${data.error}` : ''}`);
  if (!data.error) console.error('  Than tra ve khong phai bao cao don video.');
  if (res.status === 401) console.error('  Kiem lai CRON_SECRET: bien o day phai trung voi bien tren may chu.');
  process.exit(1);
}

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

if (data.boQua === 'da-chay-hom-nay') {
  console.log('↷ Hom nay da co mot luot xoa that roi — chi muc UNIQUE chan chay trung.');
  process.exit(0);
}
if (data.boQua === 'chua-bat-kho-tep') {
  console.error('✗ Xin xoa that nhung may chu khong co BLOB_READ_WRITE_TOKEN. Khong lam gi ca.');
  process.exit(1);
}

console.log(`\nChe do: ${data.cheDo === 'that' ? 'XOA THAT' : 'chay thu (khong xoa gi)'}`);
console.log(`Luot:   ${data.runId}`);

for (const c of data.canhBao ?? []) console.log(`!  canh bao: ${c}`);

// Chua hoi duoc kho thi KHONG in "0.0 MB" — khong biet la khong biet, dung bia 0.
const chuaBietCo = data.ungVien.some((m) => m.bytes === null);
const tongCo = chuaBietCo ? 'chua ro dung luong' : mb(data.soBytes);
// Che do that thi dem so tep THAT SU mat — ca phan don not so cai cua luot truoc
// — chu KHONG dem ung vien: ung vien nao thua cuoc dua "con vua quay lai" thi
// khong bi xoa, no nam o boSot. Dem ung vien la in ra mot con so lon hon so tep
// that su mat, va lech ca voi tong dung luong in ngay ben canh.
const soTep = data.cheDo === 'that'
  ? data.daXoa.length + (data.daXoaLai?.length ?? 0)
  : data.ungVien.length;
console.log(`\n${data.cheDo === 'that' ? 'Da xoa' : 'SE xoa'}: ${soTep} tep, ${tongCo}`);
for (const m of data.ungVien) {
  const xong = data.daXoa.includes(m.assignmentId);
  console.log(
    // `nguon` la thu duy nhat trong danh sach nay phan biet duoc video PHAI GUI
    // CHO CO (english_class) voi bai thuong — doc danh sach truoc lan xoa that
    // dau tien thi do la cot dang nhin nhat.
    `  ${data.cheDo === 'that' ? (xong ? '✓' : '·') : '·'} ${m.submittedVideoAt.slice(0, 16).replace('T', ' ')}` +
    `  con=${m.childId}  thu ${m.hang}  ${m.source}  ${m.bytes === null ? '?' : mb(m.bytes)}`
  );
  console.log(`      ${m.url}`);
}

// So cai con so tu luot truoc (del() hong giua chung): luot nay don not.
if (data.daXoaLai?.length) {
  console.log(`\nDon not so cai con so tu luot truoc: ${data.daXoaLai.length} tep`);
  for (const id of data.daXoaLai) console.log(`  ✓ ${id}`);
}

if (data.boSot.length) {
  console.log(`\nBo qua: ${data.boSot.length} dong`);
  for (const b of data.boSot) console.log(`  · ${b.vi}  ${b.assignmentId}  ${b.url}`);
}

if (data.loi) {
  console.error(`\n✗ Loi giua chung: ${data.loi}`);
  process.exit(1);
}
console.log('');
