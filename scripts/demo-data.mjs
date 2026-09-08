/**
 * Du lieu mau cho BA NHA DEMO (issue #46): PIN 1111 tieng Nhat, 2222 tieng Han,
 * 3333 tieng Anh — captain dung de demo cho khach hang bang cach NHAP PIN.
 *
 * Moi nha: 3 con, 5 nhiem vu hang ngay (3 nhom "sau khi hoc" lay tu tu dien +
 * 2 viec nha), bai tap cho hom qua / hom nay / mai, 4 phan thuong, mot it lich
 * su diem, mot yeu cau doi thuong dang cho, mot lan bi tru ⭐ — de bam vao man
 * nao cung co thu de xem. Chu o day la CHU DO BO ME GO (de bai, ten nhiem vu,
 * ten phan thuong) nen viet thang bang ngon ngu do, khong qua lop dich.
 *
 * `subject` la ten mon THEO NGON NGU cua nha (nhu bo me chon o o Mon hoc).
 */
import { EN } from '../lib/i18n/en.ts';
import { JA } from '../lib/i18n/ja.ts';
import { KO } from '../lib/i18n/ko.ts';

const macDinh = (td) => [
  td['Cất sách vở vào ba lô'], td['Tắt đèn học'], td['Soạn sách vở cho ngày mai'],
];

export const NHA_DEMO = {
  ja: {
    pin: '1111',
    ten: '山田家',
    vietNhaSubject: JA['Việc nhà'],
    con: [
      { id: 'sakura', ten: 'さくら', lop: '1年生', mau: 'primary', anh: '/img/avatar-an.jpg' },
      { id: 'haruto', ten: 'はると', lop: '1年生', mau: 'secondary', anh: '/img/avatar-minh.jpg' },
      { id: 'yui',    ten: 'ゆい',   lop: '年少',   mau: 'tertiary',  anh: '/img/avatar-bena.jpg' },
    ],
    nhiemVuSauHoc: macDinh(JA),
    vietNha: [
      { icon: '🪥', ten: 'はをみがく', sao: 2, con: null },
      { icon: '📚', ten: 'えほんを15分よむ', sao: 3, con: ['sakura', 'haruto'] },
    ],
    // [mon, icon, de bai, ghi chu, lang, source, quayVideo]
    baiHomQua: [
      ['算数', '🔢', 'けいさんプリント 1まい（たしざん）', 'プリント No.12', 'vi', 'primary_school', false],
      ['国語', '📖', 'きょうかしょ 10ページを おんどくする', 'こくご 上 — 10ページ', 'vi', 'primary_school', true],
    ],
    baiHomNay: [
      ['国語', '📖', 'ひらがな「さ」ぎょうを ノートに 3かい かく', 'ノート — 5ページ', 'vi', 'primary_school', false],
      ['算数', '🔢', 'きょうかしょ 34ページ 3ばんを ノートにやる', 'さんすう 上 — 34ページ', 'vi', 'primary_school', false],
      ['英語', '🔤', 'Say the colors out loud: red, blue, yellow, green.', 'English class — Unit 3', 'en', 'english_class', true],
      ['図工', '🎨', 'じぶんの いえを かいて いろを ぬる', 'A4のかみ', 'vi', 'primary_school', false],
    ],
    baiMai: [
      ['理科', '🐝', 'アリを かんさつして きづいたことを はなす', null, 'vi', 'primary_school', false],
    ],
    baiConNho: ['英語', '🔤', 'Point at the picture and say: cat, dog, bird.', 'English class', 'en', 'english_class', false],
    phanThuong: [
      ['📖', 'ねるまえに えほんを よんでもらう', 10],
      ['🍦', 'アイスクリーム', 30],
      ['📺', 'どようびの よるに えいが', 50],
      ['🎡', 'こうえんに いく', 100],
    ],
    lyDoTru: 'おもちゃを かたづけなかった',
  },
  ko: {
    pin: '2222',
    ten: '김씨 가족',
    vietNhaSubject: KO['Việc nhà'],
    con: [
      { id: 'jiwoo',  ten: '지우', lop: '1학년', mau: 'primary', anh: '/img/avatar-an.jpg' },
      { id: 'minjun', ten: '민준', lop: '1학년', mau: 'secondary', anh: '/img/avatar-minh.jpg' },
      { id: 'seoyeon', ten: '서연', lop: '유치원', mau: 'tertiary', anh: '/img/avatar-bena.jpg' },
    ],
    nhiemVuSauHoc: macDinh(KO),
    vietNha: [
      { icon: '🪥', ten: '저녁에 이 닦기', sao: 2, con: null },
      { icon: '📚', ten: '책 15분 읽기', sao: 3, con: ['jiwoo', 'minjun'] },
    ],
    baiHomQua: [
      ['수학', '🔢', '덧셈 학습지 1장 풀기', '학습지 12번', 'vi', 'primary_school', false],
      ['국어', '📖', '교과서 10쪽 소리 내어 읽기', '국어 1-1 — 10쪽', 'vi', 'primary_school', true],
    ],
    baiHomNay: [
      ['국어', '📖', '받아쓰기 5급 낱말을 공책에 3번씩 쓰기', '공책 — 5쪽', 'vi', 'primary_school', false],
      ['수학', '🔢', '교과서 34쪽 3번 문제를 공책에 풀기', '수학 1-1 — 34쪽', 'vi', 'primary_school', false],
      ['영어', '🔤', 'Say the colors out loud: red, blue, yellow, green.', 'English class — Unit 3', 'en', 'english_class', true],
      ['미술', '🎨', '우리 집을 그리고 예쁘게 색칠하기', 'A4 종이', 'vi', 'primary_school', false],
    ],
    baiMai: [
      ['과학', '🐝', '개미를 관찰하고 알게 된 점 이야기하기', null, 'vi', 'primary_school', false],
    ],
    baiConNho: ['영어', '🔤', 'Point at the picture and say: cat, dog, bird.', 'English class', 'en', 'english_class', false],
    phanThuong: [
      ['📖', '자기 전에 동화책 읽어 주기', 10],
      ['🍦', '아이스크림', 30],
      ['📺', '토요일 밤 영화 보기', 50],
      ['🎡', '놀이공원 가기', 100],
    ],
    lyDoTru: '장난감을 정리하지 않았어요',
  },
  en: {
    pin: '3333',
    ten: 'The Smith family',
    vietNhaSubject: EN['Việc nhà'],
    con: [
      { id: 'emma', ten: 'Emma', lop: 'Grade 1', mau: 'primary', anh: '/img/avatar-an.jpg' },
      { id: 'liam', ten: 'Liam', lop: 'Grade 1', mau: 'secondary', anh: '/img/avatar-minh.jpg' },
      { id: 'mia',  ten: 'Mia',  lop: 'Preschool', mau: 'tertiary', anh: '/img/avatar-bena.jpg' },
    ],
    nhiemVuSauHoc: macDinh(EN),
    vietNha: [
      { icon: '🪥', ten: 'Brush teeth before bed', sao: 2, con: null },
      { icon: '📚', ten: 'Read a book for 15 minutes', sao: 3, con: ['emma', 'liam'] },
    ],
    baiHomQua: [
      ['Math', '🔢', 'Finish the addition worksheet (1 page).', 'Worksheet 12', 'en', 'primary_school', false],
      ['English', '🔤', 'Read page 10 aloud to a parent.', 'Reader Book 1 — page 10', 'en', 'primary_school', true],
    ],
    baiHomNay: [
      ['English', '🔤', 'Write this week\'s spelling words three times each.', 'Notebook — page 5', 'en', 'primary_school', false],
      ['Math', '🔢', 'Do exercise 3 on page 34 in your notebook.', 'Math Book 1 — page 34', 'en', 'primary_school', false],
      ['English', '🔤', 'Say the colors out loud: red, blue, yellow, green.', 'English class — Unit 3', 'en', 'english_class', true],
      ['Art', '🎨', 'Draw your house and colour it in.', 'A4 paper', 'en', 'primary_school', false],
    ],
    baiMai: [
      ['Science', '🐝', 'Watch an ant and tell the class what you noticed.', null, 'en', 'primary_school', false],
    ],
    baiConNho: ['English', '🔤', 'Point at the picture and say: cat, dog, bird.', 'English class', 'en', 'english_class', false],
    phanThuong: [
      ['📖', 'Bedtime story from Mom or Dad', 10],
      ['🍦', 'Ice cream', 30],
      ['📺', 'Saturday movie night', 50],
      ['🎡', 'Trip to the park', 100],
    ],
    lyDoTru: 'Did not tidy up the toys',
  },
};
