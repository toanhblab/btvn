'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Chia se video con da quay cho co giao lop tieng Anh.
 *
 * App KHONG tu gui Zalo — no chi mo BANG CHIA SE cua may. Bo me chon Zalo, chon
 * chat cua co, bam gui. Khong co SDK Zalo, khong goi API Zalo, khong deep link.
 *
 * Thu tu uu tien co y: gui TEP THAT truoc, vi co can video nam trong chat chu
 * khong phai mot duong lien ket phai bam ra trinh duyet moi xem duoc.
 *   1. tai video ve thanh File
 *   2. navigator.share({ files })          — tep that
 *   3. navigator.share({ url })            — duong lien ket
 *   4. chep duong lien ket vao bo nho tam  — may khong co bang chia se
 *
 * KHONG dung URL.createObjectURL o day, co y: khung xem lai phat thang tu URL da
 * luu, con chia se thi gui object File. Ba video 10 phut la ~250MB — tao them
 * blob URL cho chung la du lam iPad khung.
 */

export interface MucNop {
  id: string;
  icon: string;
  mon: string;
  noiDung: string;
  /** null = con chua quay video cho bai nay. */
  videoUrl: string | null;
  /** Ten tep gui cho co, vi du An-TiengAnh-2026-09-02.mp4. null khi chua co video. */
  tenTep: string | null;
}

export interface NhomNop {
  childId: string;
  tenCon: string;
  /** Lop nen cua thanh mau doc ben trai — mau rieng cua tung con. */
  thanhMau: string;
  mucs: MucNop[];
}

type MucCoVideo = MucNop & { videoUrl: string; tenTep: string };

const coVideo = (m: MucNop): m is MucCoVideo => m.videoUrl !== null && m.tenTep !== null;

const KEY_TAT_CA = 'tat-ca';

export default function ChiaSeVideo({ nhom, ngayVN }: { nhom: NhomNop[]; ngayVN: string }) {
  const tatCa = useMemo(() => nhom.flatMap((n) => n.mucs).filter(coVideo), [nhom]);

  const [dangChay, setDangChay] = useState<string | null>(null);
  const [bao, setBao] = useState<{ key: string; loi: boolean; text: string } | null>(null);
  /** Video da tai xong nhung Safari tu choi mo bang chia se — cho bo me cham them mot nhip. */
  const [choBam, setChoBam] = useState<{ key: string; files: File[] } | null>(null);
  const [nhieuTepOk, setNhieuTepOk] = useState(false);

  /**
   * "Chia se tat ca" chi hien khi may THAT SU gui duoc nhieu tep mot luot —
   * hien nut roi bao loi thi te hon la khong co nut. Hoi bang canShare voi dung
   * so tep va dung kieu MIME, dung File rong 1 byte lam mau.
   */
  const soVideo = tatCa.length;
  useEffect(() => {
    if (soVideo < 2) { setNhieuTepOk(false); return; }
    try {
      const mau = Array.from(
        { length: soVideo },
        (_, i) => new File([new Uint8Array(1)], `thu-${i}.mp4`, { type: 'video/mp4' })
      );
      setNhieuTepOk(typeof navigator.canShare === 'function' && navigator.canShare({ files: mau }));
    } catch {
      setNhieuTepOk(false);
    }
  }, [soVideo]);

  const tieuDe = (mucs: MucCoVideo[]) =>
    mucs.length === 1
      ? `Bài tiếng Anh ${ngayVN} — ${mucs[0].tenTep}`
      : `Bài tiếng Anh ${ngayVN} — ${mucs.length} video`;

  async function taiTep(m: MucCoVideo): Promise<File> {
    const res = await fetch(m.videoUrl);
    if (!res.ok) throw new Error(`Không tải được ${m.tenTep}`);
    const blob = await res.blob();
    return new File([blob], m.tenTep, { type: blob.type || 'video/mp4' });
  }

  /**
   * Buoc 2-3-4. Tach rieng khoi buoc tai de nut "Gửi ngay" goi thang duoc:
   * luc do khong con `await` nao dung truoc navigator.share nen cu cham cua bo me
   * van con hieu luc.
   */
  async function guiDi(key: string, files: File[] | null, mucs: MucCoVideo[]) {
    const lienKet = mucs.map((m) => new URL(m.videoUrl, location.origin).href);
    try {
      if (files && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
        await navigator.share({ files, title: tieuDe(mucs), text: tieuDe(mucs) });
        setChoBam(null);
        setBao(null);
        return;
      }
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: tieuDe(mucs), text: tieuDe(mucs), url: lienKet[0] });
        setChoBam(null);
        setBao({
          key,
          loi: false,
          text: 'Máy không gửi kèm được tệp nên chỉ chia sẻ đường liên kết video.',
        });
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error('không có bộ nhớ tạm');
      await navigator.clipboard.writeText(lienKet.join('\n'));
      setBao({
        key,
        loi: false,
        text: 'Máy này không có bảng chia sẻ. Đã chép đường liên kết video — mở Zalo, vào chat của cô rồi dán vào nhé.',
      });
    } catch (e) {
      // Bo me bam Huy tren bang chia se: navigator.share nem AbortError. Day la
      // y muon cua bo me, KHONG phai loi — khong bao gi ca.
      if (e instanceof DOMException && e.name === 'AbortError') { setChoBam(null); return; }

      // Safari doi navigator.share nam trong CUNG mot cu cham cua nguoi dung.
      // Tai xong mot video 10 phut (~82MB) thi cu cham do da het han, Safari nem
      // NotAllowedError. Tep da nam san trong tay roi nen chi can moi bo me cham
      // them mot nhip nua la gui duoc ngay — khong bat tai lai.
      if (files && e instanceof DOMException && e.name === 'NotAllowedError') {
        setChoBam({ key, files });
        setBao({ key, loi: false, text: 'Video đã tải xong. Bấm "Gửi ngay" để mở bảng chia sẻ.' });
        return;
      }
      setBao({ key, loi: true, text: 'Chưa chia sẻ được. Thử lại nhé.' });
    }
  }

  async function chiaSe(key: string, mucs: MucCoVideo[]) {
    if (dangChay) return;   // chan bam lan hai trong luc dang tai
    setBao(null);
    setChoBam(null);
    setDangChay(key);
    try {
      let files: File[] | null = null;
      try {
        files = await Promise.all(mucs.map(taiTep));
      } catch {
        files = null;       // tai hong -> tut xuong chia se duong lien ket
      }
      await guiDi(key, files, mucs);
    } finally {
      setDangChay(null);
    }
  }

  const nhanNut = (key: string) => (dangChay === key ? 'Đang tải video…' : 'Chia sẻ');

  /** Loi/mach bao cua rieng mot nut. Ham thuong, khong phai component: `key` la
      ten dat truoc cua React nen truyen vao component se bi nuot. */
  const khoiBao = (k: string) =>
    bao && bao.key === k ? (
      <p
        className={`text-p-body-sm mt-2 ${bao.loi ? 'text-error' : 'text-on-surface-variant'}`}
        role={bao.loi ? 'alert' : 'status'}
      >
        {bao.text}
      </p>
    ) : null;

  return (
    <>
      {nhieuTepOk && (
        <div className="mb-4">
          <button
            onClick={() => chiaSe(KEY_TAT_CA, tatCa)}
            disabled={dangChay !== null}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary
                       rounded-card min-h-p-tap h-12 text-p-body font-bold card-shadow
                       disabled:opacity-60"
          >
            <span className="material-symbols-outlined">ios_share</span>
            {dangChay === KEY_TAT_CA ? 'Đang tải video…' : `Chia sẻ tất cả (${soVideo} video)`}
          </button>
          {choBam?.key === KEY_TAT_CA && (
            <button
              onClick={() => guiDi(KEY_TAT_CA, choBam.files, tatCa)}
              className="w-full flex items-center justify-center gap-2 mt-2 bg-secondary-container
                         text-on-secondary rounded-card min-h-p-tap h-12 text-p-body font-bold"
            >
              <span className="material-symbols-outlined">send</span>
              Gửi ngay
            </button>
          )}
          {khoiBao(KEY_TAT_CA)}
        </div>
      )}

      <div className="flex flex-col gap-p-card xl:gap-6">
        {nhom.map((n) => (
          <section
            key={n.childId}
            className="bg-surface-container-lowest rounded-card card-shadow relative overflow-hidden
                       p-3 pl-4 xl:p-6 xl:pl-7"
          >
            <div className={`absolute left-0 inset-y-0 w-1 ${n.thanhMau}`} />
            <h2 className="text-p-headline-md text-on-surface mb-3">{n.tenCon}</h2>

            <div className="flex flex-col gap-p-card xl:gap-4">
              {n.mucs.map((m) => (
                <div
                  key={m.id}
                  className="border-t border-outline-variant/40 pt-3 first:border-0 first:pt-0
                             xl:flex xl:items-start xl:gap-6"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-p-label uppercase text-on-surface-variant mb-0.5">
                      {m.icon} {m.mon}
                    </p>
                    <p className="text-p-body text-on-surface">{m.noiDung}</p>
                  </div>

                  {coVideo(m) ? (
                    <div className="mt-2 xl:mt-0 xl:w-[320px] xl:shrink-0">
                      {/* preload="metadata": chi lay khung dau, khong keo ca 82MB
                          ve chi de bo me liec qua xem con quay dung bai chua */}
                      <video
                        src={m.videoUrl}
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full rounded-card bg-surface-container-highest aspect-video"
                      />
                      <button
                        onClick={() => chiaSe(m.id, [m])}
                        disabled={dangChay !== null}
                        className="w-full flex items-center justify-center gap-2 mt-2 bg-primary
                                   text-on-primary rounded-card min-h-p-tap h-12 text-p-body font-bold
                                   disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined">ios_share</span>
                        {nhanNut(m.id)}
                      </button>
                      {choBam?.key === m.id && (
                        <button
                          onClick={() => guiDi(m.id, choBam.files, [m])}
                          className="w-full flex items-center justify-center gap-2 mt-2
                                     bg-secondary-container text-on-secondary rounded-card
                                     min-h-p-tap h-12 text-p-body font-bold"
                        >
                          <span className="material-symbols-outlined">send</span>
                          Gửi ngay
                        </button>
                      )}
                      {khoiBao(m.id)}
                    </div>
                  ) : (
                    <p className="mt-2 flex items-center gap-1 text-p-body-sm text-on-surface-variant
                                  xl:mt-0 xl:w-[320px] xl:shrink-0">
                      <span className="material-symbols-outlined text-base">videocam_off</span>
                      Con chưa quay video
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
