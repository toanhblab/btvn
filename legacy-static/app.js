/* BTVN — man hinh cho tre.
   JS thuan, khong framework. Trang thai da-lam-xong luu o localStorage. */

'use strict';

const STORE_KEY = 'btvn:done';

let DATA = null;          // noi dung data.json sau khi da chuan hoa ngay
let confettiStop = null;  // ham dung confetti cua man "xong het"

/* ---------------- Tien ich ---------------- */

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Ngay hom nay theo gio dia phuong, dang YYYY-MM-DD (khong dung toISOString vi no la UTC). */
function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Du lieu mau dung "today"/"yesterday"/"tomorrow" de khong bi cu di theo thoi gian.
    Du lieu that dung ngay ISO binh thuong va di thang qua day. */
function resolveDate(v) {
  if (v === 'today') return todayISO(0);
  if (v === 'yesterday') return todayISO(-1);
  if (v === 'tomorrow') return todayISO(1);
  return v;
}

/* ---------------- Trang thai da lam xong ---------------- */

function loadDone() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};   // localStorage hong hoac bi tat -> coi nhu chua lam bai nao
  }
}

function isDone(id) {
  return Boolean(loadDone()[id]);
}

function setDone(id, done) {
  const all = loadDone();
  if (done) all[id] = new Date().toISOString();
  else delete all[id];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    /* Safari rieng tu co the chan ghi — van cho tre bam tiep, chi la khong nho duoc */
  }
}

/* ---------------- Truy van du lieu ---------------- */

const childById = (id) => DATA.children.find((c) => c.id === id);

/** Bai tap cua mot con trong hom nay, giu nguyen thu tu trong data.json. */
function todayAssignments(childId) {
  const today = todayISO();
  return DATA.assignments.filter((a) => a.childId === childId && a.dueDate === today);
}

function remainingCount(childId) {
  return todayAssignments(childId).filter((a) => !isDone(a.id)).length;
}

/* ---------------- Doc de bai (Web Speech API) ---------------- */

function voiceFor(lang) {
  const want = lang === 'en' ? 'en' : 'vi';
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith(want + '-'))
      || voices.find((v) => v.lang.toLowerCase().startsWith(want))
      || null;
}

function speak(text, lang) {
  if (!('speechSynthesis' in window)) return false;
  speechSynthesis.cancel();                 // tre hay bam lien tuc -> chan doc chong nhau
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'en' ? 'en-US' : 'vi-VN';
  u.rate = 0.85;                            // cham lai cho tre nghe kip
  const v = voiceFor(lang);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
  return true;
}

/** Bao cho bo me biet iPad thieu giong, thay vi bam nut ma khong co gi xay ra. */
function speechWarning(lang) {
  if (!('speechSynthesis' in window)) return 'Thiết bị này không đọc được đề bài.';
  if (!voiceFor(lang)) {
    return lang === 'en'
      ? 'Máy chưa có giọng tiếng Anh. Bố mẹ vào Cài đặt → Trợ năng → Nội dung đọc để tải thêm giọng.'
      : 'Máy chưa có giọng tiếng Việt. Bố mẹ vào Cài đặt → Trợ năng → Nội dung đọc để tải giọng vi-VN.';
  }
  return '';
}

/* ---------------- Chuyen man ---------------- */

const VIEWS = ['view-picker', 'view-list', 'view-detail', 'view-empty', 'view-done'];

function show(viewId) {
  if (confettiStop) { confettiStop(); confettiStop = null; }
  speechSynthesis?.cancel();

  for (const id of VIEWS) {
    const el = document.getElementById(id);
    el.hidden = id !== viewId;
    if (id === viewId) {
      el.classList.remove('view-enter');
      void el.offsetWidth;              // ep trinh duyet chay lai animation
      el.classList.add('view-enter');
    }
  }
  window.scrollTo(0, 0);
}

const go = (hash) => { window.location.hash = hash; };

/* ---------------- Man 1: chon con ---------------- */

// Dung ten class day du thay vi ghep chuoi, de sau nay chuyen sang Tailwind co build khong mat style.
const COLOR = {
  primary:   { ring: 'border-primary',            name: 'text-primary'   },
  secondary: { ring: 'border-secondary-container', name: 'text-secondary' },
  tertiary:  { ring: 'border-tertiary-container',  name: 'text-tertiary'  }
};

function renderPicker() {
  const wrap = $('#picker-list');
  const kids = [...DATA.children].sort((a, b) => a.order - b.order);

  wrap.innerHTML = kids.map((c) => {
    const left = remainingCount(c.id);
    const col = COLOR[c.color] || COLOR.primary;
    // Badge phai phan anh so bai con lai — ban Stitch hardcode "Xong het" cho ca 3 con.
    const badge = left === 0
      ? '<span class="bg-success text-white">Xong hết 🎉</span>'
      : `<span class="bg-secondary-container text-white">${left} bài</span>`;

    return `
      <button class="avatar-hover-effect group relative flex flex-col items-center transition-all duration-300 ease-out
                     focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-8 focus:ring-offset-background
                     rounded-3xl p-2" data-child="${esc(c.id)}">
        <div class="relative mb-5">
          <div class="w-[200px] h-[200px] rounded-full bg-surface-container-lowest border-[8px] ${col.ring}
                      shadow-[0_12px_24px_rgba(0,0,0,0.08)] overflow-hidden transition-transform duration-300 group-hover:scale-105">
            <img src="${esc(c.avatar)}" alt="" class="w-full h-full object-cover">
          </div>
          <div class="absolute -top-2 -right-2 font-label-bold text-label-bold px-4 py-2 rounded-full shadow-md
                      border-4 border-surface-container-lowest transform rotate-6
                      group-hover:rotate-12 transition-transform duration-300
                      [&>span]:block [&>span]:px-0 [&>span]:rounded-full">${badge}</div>
        </div>
        <div class="bg-surface-container-lowest px-8 py-3 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)]
                    border-b-4 border-surface-container-high transition-transform duration-200
                    group-active:translate-y-1 group-active:border-b-0">
          <span class="font-headline-lg text-headline-lg ${col.name} block">${esc(c.name)}</span>
        </div>
      </button>`;
  }).join('');

  wrap.querySelectorAll('[data-child]').forEach((btn) => {
    btn.addEventListener('click', () => go(`#/con/${btn.dataset.child}`));
  });
}

/* ---------------- Man 2: danh sach bai hom nay ---------------- */

function renderList(child) {
  const items = todayAssignments(child.id);
  const doneCount = items.filter((a) => isDone(a.id)).length;

  $('#list-avatar').src = child.avatar;
  $('#list-title').textContent = `Bài tập hôm nay của ${child.name}`;

  // O tien do: mot o cho moi bai, sang len khi lam xong (PRD 4.3 — tien do dang hinh, khong dang so)
  $('#list-progress-boxes').innerHTML = items.map((a) => (
    isDone(a.id)
      ? `<div class="w-16 h-16 rounded-xl bg-success flex items-center justify-center text-white shadow-md">
           <span class="material-symbols-outlined text-4xl" style="font-variation-settings:'FILL' 1;">check</span>
         </div>`
      : `<div class="w-16 h-16 rounded-xl border-4 border-dashed border-outline-variant bg-surface"></div>`
  )).join('');

  $('#list-progress-text').textContent = `${doneCount}/${items.length} bài đã xong`;

  $('#list-cards').innerHTML = items.map((a) => {
    const done = isDone(a.id);
    return `
      <button data-bai="${esc(a.id)}"
              class="text-left rounded-[32px] p-6 flex items-center justify-between h-[160px] relative overflow-hidden
                     ${done ? 'bg-success-container opacity-80 soft-shadow'
                            : 'bg-surface border-[6px] border-primary interactive-shadow'}">
        ${done ? `<div class="absolute top-4 left-4 w-12 h-12 bg-success rounded-full flex items-center justify-center text-white shadow-sm z-10">
                    <span class="material-symbols-outlined text-3xl" style="font-variation-settings:'FILL' 1;">check</span>
                  </div>` : ''}
        <div class="flex items-center gap-6 z-10 ${done ? 'ml-12' : ''} min-w-0">
          <div class="text-6xl shrink-0">${esc(a.icon)}</div>
          <div class="min-w-0">
            <div class="font-body-md text-body-md uppercase tracking-wider mb-2 font-bold
                        ${done ? 'text-on-success-container' : 'text-primary'}">${esc(a.subject)}</div>
            <div class="font-headline-lg text-headline-lg truncate
                        ${done ? 'text-on-success-container' : 'text-on-surface'}">${esc(a.content)}</div>
          </div>
        </div>
        <img src="${esc(a.image)}" alt=""
             class="w-24 h-24 rounded-2xl object-cover z-10 shrink-0 ml-4
                    ${done ? 'border-4 border-white/50 opacity-70' : 'border-4 border-surface-container-highest shadow-sm'}">
      </button>`;
  }).join('');

  $('#list-cards').querySelectorAll('[data-bai]').forEach((btn) => {
    btn.addEventListener('click', () => go(`#/con/${child.id}/bai/${btn.dataset.bai}`));
  });

  show('view-list');
}

/* ---------------- Man 3: chi tiet bai ---------------- */

function renderDetail(child, a) {
  $('#detail-image').src = a.image;
  $('#detail-subject').textContent = `${a.icon} ${a.subject}`;
  $('#detail-content').textContent = a.content;

  const note = $('#detail-note');
  note.textContent = a.note || '';
  note.hidden = !a.note;

  // Nut "Da lam xong" doi thanh trang thai da xong de tre biet minh tick roi
  const done = isDone(a.id);
  $('#btn-done').hidden = done;
  $('#btn-undone').hidden = !done;

  const warn = $('#speak-warning');
  const msg = speechWarning(a.lang);
  warn.textContent = msg;
  warn.hidden = !msg;

  $('#btn-speak').onclick = () => speak(a.content, a.lang);

  $('#btn-done').onclick = () => {
    setDone(a.id, true);
    showSuccess(() => {
      // Xong bai cuoi cung -> man chuc mung; con lai thi ve danh sach
      const left = remainingCount(child.id);
      go(left === 0 ? `#/con/${child.id}/xong` : `#/con/${child.id}`);
    });
  };

  $('#btn-undone').onclick = () => {
    setDone(a.id, false);          // PRD 4.3: tick nham phai bo duoc
    go(`#/con/${child.id}`);
  };

  show('view-detail');
}

function showSuccess(onContinue) {
  const overlay = $('#success-overlay');
  const card = $('#success-card');
  overlay.hidden = false;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.classList.remove('opacity-0');
    card.classList.replace('scale-90', 'scale-100');
  });
  $('#success-continue').onclick = () => {
    overlay.classList.add('opacity-0');
    card.classList.replace('scale-100', 'scale-90');
    setTimeout(() => { overlay.hidden = true; overlay.style.display = ''; onContinue(); }, 300);
  };
}

/* ---------------- Man 5: confetti ---------------- */

function startConfetti() {
  const canvas = $('#confetti-canvas');
  const ctx = canvas.getContext('2d');
  const colors = ['#0058be', '#fd761a', '#eec200', '#22c55e', '#ffb690', '#adc6ff'];
  let raf = null;

  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const bits = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 14 + 10,
    h: Math.random() * 14 + 10,
    color: colors[Math.floor(Math.random() * colors.length)],
    speedY: Math.random() * 3 + 2,
    speedX: Math.random() * 2 - 1,
    rot: Math.random() * 360,
    rotSpeed: Math.random() * 5 - 2.5
  }));

  const frame = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const c of bits) {
      c.y += c.speedY; c.x += c.speedX; c.rot += c.rotSpeed;
      if (c.y > canvas.height) { c.y = -20; c.x = Math.random() * canvas.width; }
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate((c.rot * Math.PI) / 180);
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 4);
      ctx.fill();
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  frame();

  // Dung han khi roi man, neu khong confetti chay ngam ton pin iPad
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}

/* ---------------- Dieu huong ---------------- */

function router() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);

  if (parts[0] !== 'con' || !parts[1]) {
    renderPicker();
    show('view-picker');
    return;
  }

  const child = childById(parts[1]);
  if (!child) { go('#/'); return; }

  const items = todayAssignments(child.id);

  if (parts[2] === 'xong') {
    $('#done-title').textContent = `Giỏi quá ${child.name}!`;
    show('view-done');
    confettiStop = startConfetti();
    return;
  }

  if (parts[2] === 'bai' && parts[3]) {
    const a = items.find((x) => x.id === parts[3]);
    if (!a) { go(`#/con/${child.id}`); return; }
    renderDetail(child, a);
    return;
  }

  if (items.length === 0) {
    $('#empty-sub').textContent = `${child.name} đi chơi thôi!`;
    show('view-empty');
    return;
  }

  renderList(child);
}

/* ---------------- Khoi dong ---------------- */

async function init() {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (err) {
    $('#fatal').hidden = false;
    $('#fatal-msg').textContent =
      location.protocol === 'file:'
        ? 'Đang mở bằng file:// nên trình duyệt chặn đọc data.json. Chạy: python3 -m http.server 8000 rồi mở http://localhost:8000'
        : `Không đọc được data.json (${err.message}).`;
    return;
  }

  DATA.assignments.forEach((a) => { a.dueDate = resolveDate(a.dueDate); });

  document.querySelectorAll('[data-nav="picker"]').forEach((b) => {
    b.addEventListener('click', () => go('#/'));
  });
  $('#detail-back').addEventListener('click', () => history.back());
  $('#btn-parent').addEventListener('click', () => {
    alert('Phần của bố mẹ chưa làm ở bước này.');
  });

  window.addEventListener('hashchange', router);

  // Safari tra danh sach giong rong o lan goi dau -> ve lai canh bao khi co giong
  if ('speechSynthesis' in window) {
    speechSynthesis.addEventListener('voiceschanged', () => {
      if (!$('#view-detail').hidden) router();
    });
  }

  router();
}

init();
