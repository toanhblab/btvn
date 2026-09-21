'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MucChoDuyet } from '@/lib/nhanBaiZalo';
import type { Assignment, Child } from '@/lib/types';
import { MEDIA_ICON } from '@/lib/media';
import { gioNha } from '@/lib/ngay';
import { matCoNhanDien, type LyDoBoTep, type TepBoQua, type TepZaloDaLuu } from '@/lib/zalo';
import { useT } from '@/lib/i18n/client';

/** Nguyen van dai hon thi thu gon lai, bo me bam "Xem cả tin" moi mo het. */
const CHU_THU_GON = 320;

/**
 * NGUYEN VAN tin cua co.
 *
 * `whitespace-pre-wrap` la bat buoc chu khong phai trang tri: tin cua co la mot
 * danh sach xuong dong ("* Phần Jolly Phonics:" roi "1." "2."), do thang ra
 * mot doan lien la bo me khong con doi chieu duoc voi danh sach bai da tach —
 * ma doi chieu chinh la viec captain yeu cau man nay lam.
 *
 * Thu gon bang DO DAI chu khong bang `line-clamp`: bo me can biet tin con dai
 * bao nhieu (nut ghi ro so chu con lai), va `line-clamp` tren mot khoi
 * pre-wrap cho ra so dong khac nhau giua dien thoai va Macbook.
 */
function NguyenVan({ chu }: { chu: string }) {
  const T = useT();
  const [mo, setMo] = useState(false);
  const dai = chu.length > CHU_THU_GON;
  const hien = mo || !dai ? chu : `${chu.slice(0, CHU_THU_GON).trimEnd()}…`;
  return (
    <div className="bg-surface-container rounded-card p-3">
      <p className="text-p-body-sm text-on-surface whitespace-pre-wrap break-words">{hien}</p>
      {dai && (
        <button
          type="button"
          onClick={() => setMo(!mo)}
          className="mt-2 min-h-9 text-p-body-sm font-bold text-primary"
        >
          {mo ? T('Thu gọn tin') : T('Xem cả tin ({n} chữ)', { n: chu.length })}
        </button>
      )}
    </div>
  );
}

/**
 * Tep co gui kem. Anh xem duoc ngay, am thanh va video phat duoc ngay — bo me
 * phai NGHE/XEM truoc khi duyet thi moi biet co gui dung tep hay khong. `pdf`
 * (va tep khong phat duoc) thi chi la mot duong dan mo tab moi.
 *
 * `preload="metadata"`: mot muc co the co hai video vai MB, tai truoc het la
 * bo me mo man Zalo tren 4G la ngon vai chuc MB ma chua bam gi.
 */
function TepKem({ tep }: { tep: TepZaloDaLuu[] }) {
  const T = useT();
  if (tep.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-p-label uppercase text-on-surface-variant">
        {T('Tệp cô gửi kèm ({n})', { n: tep.length })}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tep.map((t) => (
          <div key={t.url} className="bg-surface-container-low rounded-card p-2">
            <p className="flex items-center gap-1.5 text-p-body-sm text-on-surface-variant mb-1.5 min-w-0">
              <span className="material-symbols-outlined text-base shrink-0">
                {t.kind === 'pdf' ? 'description' : MEDIA_ICON[t.kind]}
              </span>
              <span className="truncate">{t.ten}</span>
            </p>
            {t.kind === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.url} alt={t.ten} className="w-full rounded-lg max-h-64 object-contain bg-surface-container" />
            )}
            {t.kind === 'video' && (
              <video src={t.url} controls playsInline preload="metadata" className="w-full rounded-lg max-h-64 bg-black" />
            )}
            {t.kind === 'audio' && (
              <audio src={t.url} controls preload="metadata" className="w-full" />
            )}
            {t.kind === 'pdf' && (
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 min-h-9 text-p-body-sm font-bold text-primary"
              >
                {T('Mở tệp')}
                <span className="material-symbols-outlined text-base">open_in_new</span>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Tep cua co KHONG vao duoc, kem ly do doc duoc.
 *
 * Phai HIEN chu khong duoc bo im lang: bo me doi chieu nguyen van tin ("con xem
 * video mẫu của cô") voi bo tep ngay ben canh, nen mot tep thieu ma khong noi
 * gi thi ho tuong co quen gui — trong khi that ra app da tu bo no. Ly do luu
 * duoi dang MA (cua nhan la cua cho may, than 201 khong qua lop dich); cau chu
 * chon o day.
 */
function LyDoBoTepChu({ ly_do }: { ly_do: LyDoBoTep }) {
  const T = useT();
  const chu: Record<LyDoBoTep, string> = {
    'loai-khong-nhan': T('loại tệp app không nhận'),
    'qua-nang': T('tệp nặng quá'),
    'tep-hong': T('tệp hỏng'),
    'url-khong-nhan': T('tệp không nằm trong kho của app'),
    'khong-thay-trong-kho': T('kho tệp không tìm thấy tệp này'),
  };
  return <>{chu[ly_do]}</>;
}

function TepBiBo({ tep }: { tep: TepBoQua[] }) {
  const T = useT();
  if (tep.length === 0) return null;
  return (
    <div className="bg-error-container rounded-card p-3 flex flex-col gap-1">
      <p className="text-p-body-sm text-on-error-container font-bold">
        {T('{n} tệp cô gửi không vào được', { n: tep.length })}
      </p>
      <ul className="flex flex-col gap-0.5">
        {tep.map((t, i) => (
          <li key={`${t.ten}:${i}`} className="text-p-body-sm text-on-error-container break-words">
            {t.ten} — <LyDoBoTepChu ly_do={t.ly_do} />
          </li>
        ))}
      </ul>
      <p className="text-p-label text-on-error-container">
        {T('Tin của cô vẫn vào đủ. Cần tệp này thì mở Zalo tải về rồi bấm "Sửa kỹ" để đính kèm.')}
      </p>
    </div>
  );
}

/**
 * So DONG cho o sua de bai — tinh TU CHINH NOI DUNG, khong de cung `rows={2}`.
 *
 * De bai cua co dai ngan rat khac nhau ("Phần Jolly Phonics:" vs mot doan ba
 * dong): mot o hai dong cung cho tat ca thi de dai bi cat GIUA MOT DONG CHU,
 * nhin y nhu chu bi hong — ma day dung la man bo me phai DOC de doi chieu voi
 * nguyen van tin. Uoc ~34 ky tu mot dong o be ngang 390px, cong so lan xuong
 * dong san co, kep trong [2, 7] de mot de bai dai khong day ca danh sach dai ra.
 *
 * Ham THUAN va khong doc gi cua trinh duyet: may chu va may bo me phai ra cung
 * mot so, khong thi React bao hydration mismatch.
 */
function soDongCho(chu: string): number {
  const xuongDong = (chu.match(/\n/g) ?? []).length;
  return Math.min(7, Math.max(2, Math.ceil(chu.length / 34) + xuongDong));
}

/**
 * Mot bai nhap: de bai sua NGAY TAI CHO (luu khi roi o, nhu man Nhiệm vụ hàng
 * ngày), con doi mon / han / giong doc / tep dinh kem thi bam "Sửa kỹ" sang
 * chinh man sua bai da co (/bome/bai/<id>) — khong dung mot man sua thu hai
 * cho ban nhap.
 */
function BaiNhap({
  bai,
  busy,
  onSua,
  onXoa,
}: {
  bai: Assignment;
  busy: boolean;
  onSua: (content: string) => void;
  onXoa: () => void;
}) {
  const T = useT();
  return (
    <div className="bg-surface-container-lowest rounded-card card-shadow p-2 flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <span className="text-xl shrink-0 pt-1.5" aria-hidden>{bai.icon}</span>
        <textarea
          defaultValue={bai.content}
          key={`${bai.id}:${bai.content}`}
          rows={soDongCho(bai.content)}
          aria-label={T('Đề bài')}
          onBlur={(e) => {
            const moi = e.target.value.trim();
            if (!moi || moi === bai.content) { e.target.value = bai.content; return; }
            onSua(moi);
          }}
          className="flex-1 min-w-0 rounded-lg border border-outline-variant px-2 py-1.5
                     text-p-body-sm bg-surface-container-lowest resize-y"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-p-label uppercase text-on-surface-variant">{bai.subject}</span>
        {bai.note && <span className="text-p-label text-on-surface-variant truncate">· {bai.note}</span>}
        {bai.requiresVideo && <span className="text-p-label">🎥</span>}
        <span className="flex-1" />
        <Link
          href={`/bome/bai/${bai.id}`}
          className="min-h-9 px-2 flex items-center text-p-body-sm font-bold text-primary"
        >
          {T('Sửa kỹ')}
        </Link>
        <button
          type="button"
          onClick={onXoa}
          disabled={busy}
          aria-label={T('Bỏ bài "{name}"', { name: bai.content })}
          className="min-h-9 w-9 flex items-center justify-center rounded-lg text-on-surface-variant
                     hover:text-error disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-xl">delete</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Muc "Bài cô vừa giao, chờ duyệt" — hop dong chot voi captain: moi muc hien
 * TEN NHOM, TEN CO, NGAY GIO GUI, NGUYEN VAN tin, tep kem, va danh sach bai
 * nhap theo tung con; mot nut Duyet cho ca muc, mot nut "Không phải bài".
 *
 * Giu state o day (nhu PhanThuong / NhiemVuHangNgay) thay vi router.refresh
 * sau moi lan bam: bo me sua lien tay vai bai roi moi bam Duyet, refresh giua
 * chung la mat cho cuon va dong nguyen van dang mo.
 *
 * Nut DUYET goi router.refresh() SAU khi muc bien mat: bai vua thanh that nen
 * ba o tinh trang o trang chu va the cua tung con phai dem lai ngay — khong
 * refresh thi bo me bam sang trang chu thay so cu va tuong duyet khong an.
 */
export default function ChoDuyet({
  initial,
  cacCon,
}: {
  initial: MucChoDuyet[];
  cacCon: Child[];
}) {
  const T = useT();
  const router = useRouter();
  const [muc, setMuc] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [hoiBo, setHoiBo] = useState<string | null>(null);
  const [error, setError] = useState('');

  const tenCon = new Map(cacCon.map((c) => [c.id, c]));

  async function goi(url: string, init: RequestInit) {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? T('Không lưu được'));
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : T('Không lưu được. Thử lại nhé.'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function xuLyMuc(baiZaloId: string, hanhDong: 'duyet' | 'bo') {
    const data = await goi(`/api/bai-zalo/${baiZaloId}`, {
      method: 'POST',
      body: JSON.stringify({ hanhDong }),
    });
    if (!data) return;
    setMuc((ms) => ms.filter((m) => m.bai.id !== baiZaloId));
    setHoiBo(null);
    router.refresh();
  }

  async function suaBai(baiZaloId: string, id: string, content: string) {
    const data = await goi(`/api/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
    if (!data?.assignment) return;
    setMuc((ms) =>
      ms.map((m) =>
        m.bai.id === baiZaloId
          ? { ...m, baiNhap: m.baiNhap.map((b) => (b.id === id ? data.assignment : b)) }
          : m
      )
    );
  }

  async function xoaBai(baiZaloId: string, id: string) {
    const data = await goi(`/api/assignments/${id}`, { method: 'DELETE' });
    if (!data) return;
    setMuc((ms) =>
      ms.map((m) =>
        m.bai.id === baiZaloId ? { ...m, baiNhap: m.baiNhap.filter((b) => b.id !== id) } : m
      )
    );
  }

  if (muc.length === 0) {
    return (
      <p className="bg-surface-container-lowest rounded-card card-shadow p-4 text-p-body-sm
                    text-on-surface-variant">
        {T('Chưa có tin nào chờ duyệt. Cô đăng bài lên nhóm Zalo thì bài sẽ hiện ở đây.')}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-p-card">
        {muc.map((m) => {
          const theoCon = cacCon
            .map((c) => ({ con: c, bai: m.baiNhap.filter((b) => b.childId === c.id) }))
            .filter((x) => x.bai.length > 0);
          const co = matCoNhanDien(m.bai.nhanDien);
          return (
            <section key={m.bai.id} className="bg-surface-container-low rounded-card p-3 flex flex-col gap-3">
              {/* Ai gui, o dau, luc nao — ba thu bo me can de tin ai tin nay */}
              <header className="flex flex-col gap-0.5">
                <p className="text-p-body text-on-surface font-bold break-words">
                  {m.bai.nhomZalo || m.nguon.tenNhom}
                </p>
                <p className="text-p-body-sm text-on-surface-variant break-words">
                  {T('Cô {ten}', { ten: m.bai.nguoiGui || m.nguon.tenCo })}
                  {m.bai.guiLuc ? ` · ${gioNha(m.bai.guiLuc)}` : ''}
                  {m.bai.ngayHocSo !== null ? ` · ${T('ngày học thứ {n}', { n: m.bai.ngayHocSo })}` : ''}
                </p>
                {co && (
                  <p
                    className={`text-p-label mt-1 px-2 py-1 rounded-full self-start ${
                      co === 'luat-khop'
                        ? 'bg-primary-fixed text-on-primary-fixed'
                        : 'bg-tertiary-fixed text-on-tertiary-fixed'
                    }`}
                  >
                    {co === 'luat-khop'
                      ? T('Luật khớp')
                      : co === 'jev-doan'
                        ? T('Jev cho là giao bài ({n}%), luật không khớp — soi kỹ', {
                            n: Math.round((m.bai.nhanDien?.jev_xac_suat ?? 0) * 100),
                          })
                        : T('Chưa qua Jev')}
                  </p>
                )}
              </header>

              <NguyenVan chu={m.bai.nguyenVan} />
              <TepKem tep={m.bai.dinhKem} />
              <TepBiBo tep={m.bai.tepBoQua} />

              {/* Bai da tach, theo tung con */}
              {theoCon.length === 0 ? (
                <p className="text-p-body-sm text-error">
                  {T('Không còn bài nào trong tin này. Bấm "Không phải bài" để bỏ.')}
                </p>
              ) : (
                theoCon.map(({ con, bai }) => (
                  <div key={con.id} className="flex flex-col gap-1.5">
                    <p className="flex items-center gap-1.5 text-p-label uppercase text-on-surface-variant">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={con.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                      {con.name} · {T('{n} bài', { n: bai.length })} · {T('hạn {date}', { date: bai[0].dueDate })}
                    </p>
                    {bai.map((b) => (
                      <BaiNhap
                        key={b.id}
                        bai={b}
                        busy={busy}
                        onSua={(content) => suaBai(m.bai.id, b.id, content)}
                        onXoa={() => xoaBai(m.bai.id, b.id)}
                      />
                    ))}
                  </div>
                ))
              )}

              {/* Hai nut ket thuc muc */}
              {hoiBo === m.bai.id ? (
                <div className="bg-error-container rounded-card p-3">
                  <p className="text-p-body-sm text-on-error-container mb-3">
                    {T('Bỏ tin này thì {n} bài nháp bị xoá và các con không bao giờ thấy chúng. Nguyên văn tin vẫn được giữ để máy ở nhà không đưa lại tin này nữa.', { n: m.baiNhap.length })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHoiBo(null)}
                      disabled={busy}
                      className="flex-1 rounded-card min-h-p-tap bg-surface-container-lowest text-on-surface
                                 text-p-body-sm font-bold disabled:opacity-60"
                    >
                      {T('Thôi, giữ lại')}
                    </button>
                    <button
                      onClick={() => xuLyMuc(m.bai.id, 'bo')}
                      disabled={busy}
                      className="flex-1 rounded-card min-h-p-tap bg-error text-white text-p-body-sm font-bold
                                 disabled:opacity-60"
                    >
                      {T('Bỏ tin này')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setHoiBo(m.bai.id); setError(''); }}
                    disabled={busy}
                    className="rounded-card min-h-p-tap px-4 bg-surface-container-lowest text-on-surface-variant
                               text-p-body-sm font-bold disabled:opacity-60"
                  >
                    {T('Không phải bài')}
                  </button>
                  <button
                    onClick={() => xuLyMuc(m.bai.id, 'duyet')}
                    disabled={busy || m.baiNhap.length === 0}
                    className="flex-1 rounded-card min-h-p-tap px-4 bg-primary text-on-primary
                               text-p-body font-bold card-shadow disabled:opacity-40
                               flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-xl">check_circle</span>
                    {T('Duyệt {n} bài cho các con', { n: m.baiNhap.length })}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {error && (
        <p className="text-p-body text-error bg-error-container rounded-card p-3 mt-3">{error}</p>
      )}
    </>
  );
}
