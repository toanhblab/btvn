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
const max = so('--max');
if (max !== null && Number.isFinite(max) && max > 0) q.set('max', String(max));

const url = `${goc}/api/don-video${q.size ? `?${q}` : ''}`;
console.log(`→ ${url}`);

const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
const data = await res.json().catch(() => null);
if (!data) {
  console.error(`✗ May chu tra ${res.status}, khong doc duoc JSON.`);
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
    `  ${data.cheDo === 'that' ? (xong ? '✓' : '·') : '·'} ${m.submittedVideoAt.slice(0, 16).replace('T', ' ')}` +
    `  con=${m.childId}  thu ${m.hang}  ${m.bytes === null ? '?' : mb(m.bytes)}`
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
