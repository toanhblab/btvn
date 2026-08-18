# Prompt cho Google Stitch — Giao diện app BTVN

Nguồn: [PRD.md](PRD.md)

## Cách dùng

1. Mở https://stitch.withgoogle.com/ → tạo project mới.
2. **Chạy 2 project riêng** (Stitch giữ style theo project):
   - Project **"BTVN - Kids"** → chọn mode **Web** (iPad ngang, không có mode tablet riêng).
   - Project **"BTVN - Parent"** → chọn mode **Mobile** (điện thoại bố mẹ).
3. Với mỗi project: dán **Prompt 0 (style)** trước để định hình design system, rồi dán từng prompt màn hình một, mỗi lần một prompt.
4. Prompt viết bằng **tiếng Anh** (Stitch hiểu tốt hơn) nhưng **chữ trên giao diện là tiếng Việt** — các câu tiếng Việt đã ghi sẵn trong ngoặc kép, giữ nguyên khi dán.
5. Nếu Stitch báo prompt quá dài: cắt bớt phần "Avoid" ở cuối.

---

# PROJECT A — Giao diện cho các con (iPad, Web mode)

## Prompt 0 — Style (dán đầu tiên)

```
Design system for a homework app used by very young children (ages 4 to 6) on an
iPad in landscape orientation. The children cannot read fluently, so the interface
must communicate through large photos, icons, and color — text is secondary.

Style: warm, playful, friendly, generous whitespace. Rounded corners (24px), soft
drop shadows, chunky elements. Cream background (#FFF8F0), white cards, one accent
color per child: blue (#3B82F6), orange (#F97316), yellow (#FACC15). Green (#22C55E)
means done. Friendly rounded sans-serif font. Body text minimum 20px, headings 32px
and up. Every tappable target at least 64px tall.

All interface text is in Vietnamese. No dense text, no tiny labels, no hamburger
menu, no sidebar, no tabs, no settings icons, no dropdowns, no data tables. A child
must understand each screen from images and icons alone.
```

## Prompt 1 — Cửa vào: chọn con

```
An iPad landscape "who are you" screen for a children's homework app. Vietnamese UI.

Top center: a friendly greeting "Hôm nay con là ai?" in large rounded text.

Center: three very large circular photo avatars in a single row, evenly spaced, each
about 220px across, each with a thick colored ring — first blue, second orange, third
yellow. Under each photo, the child's first name in large bold text: "Minh", "An",
"Bé Na". Under each name, a small colored pill badge showing today's remaining
homework count: "3 bài", "3 bài", "1 bài". If the count is zero the pill is green
and reads "Xong hết 🎉".

The first two avatars are twins, so they must look clearly distinguishable by their
ring color and their name, not by layout.

Bottom right corner: a small, low-contrast text link "Bố mẹ" — deliberately quiet so
children ignore it.

Avoid: any login form, password field, keyboard, text input, or app menu.
```

## Prompt 2 — Danh sách bài tập hôm nay

```
An iPad landscape "homework for today" screen for a 6-year-old. Vietnamese UI.

Header: the child's small circular photo on the left, next to large text "Bài tập
hôm nay của Minh". A back arrow at the far left. The header carries the child's
accent color (blue).

Progress: a row of 5 large rounded squares, 3 filled solid green with a white
checkmark, 2 empty with a dashed outline. Small text beside it: "3/5 bài đã xong".

Body: a vertical list of very large homework cards, 2 per row in a grid. Each card
contains a big subject emoji icon on the left (📖 for Tiếng Việt, 🔢 for Toán, 🔤 for
Tiếng Anh, 🎨 for Vẽ), the subject name in large bold Vietnamese text, one short line
of the assignment below it, and a small thumbnail of the original photo on the right.
Cards that are done are tinted green, slightly faded, with a large green checkmark
badge in the corner. Cards not done are white with the child's accent color border.

Show 5 cards: two done, three not done.

Avoid: small text, dates, filters, sorting controls, or any menu.
```

## Prompt 3 — Chi tiết một bài tập

```
An iPad landscape homework detail screen for a young child who cannot read well.
Vietnamese UI.

Left two-thirds: the original photo of the homework (a photo of a school notebook
page), large, filling the area, with rounded corners and a subtle "tap to zoom" magnifier
icon in its corner.

Right one-third, stacked vertically with generous spacing:
- Subject chip at top with emoji and name: "🔢 Toán"
- The assignment text in very large rounded font, 3 short lines: "Làm bài 3 trang 34.
  Viết vào vở ô ly."
- A very large pill button with a speaker icon and the label "🔊 Nghe đề bài" — this is
  the most prominent control on the right side, in the child's accent color.
- A huge full-width green button with a big checkmark: "Đã làm xong". Minimum 96px tall.

Bottom of the right column: small quiet text button "Chưa làm xong" for undoing.

Avoid: sidebars, breadcrumbs, small icon rows, share buttons, or comment fields.
```

## Prompt 4 — Xong hết / không có bài

```
An iPad landscape celebration empty-state screen in a children's homework app.
Vietnamese UI.

Centered, vertically stacked: a large cheerful illustration of a happy child with
confetti; big rounded headline "Hôm nay không có bài tập 🎉"; a friendly subline in
smaller text "Con đi chơi thôi!"; and a large rounded outline button "Về trang chính".

Warm cream background, soft confetti shapes scattered behind the illustration.
Nothing else on screen.

Avoid: making this look like an error, an empty list, or a loading state.
```

---

# PROJECT B — Giao diện cho bố mẹ (điện thoại, Mobile mode)

## Prompt 0 — Style (dán đầu tiên)

```
Design system for the parent side of a family homework app, used on a phone by busy
parents at night. Same warm family brand as the kids app but denser and more
efficient: cream background (#FFF8F0), white cards, rounded corners (16px), clean
rounded sans-serif. Child accent colors: blue (#3B82F6), orange (#F97316), yellow
(#FACC15). Green (#22C55E) for done, amber for pending, red for overdue.

Priority is speed: the main task is capturing homework from a Zalo screenshot in
under one minute. Body text 16px, comfortable 48px tap targets, primary actions as
full-width buttons at the bottom of the screen within thumb reach.

All interface text is in Vietnamese.
```

## Prompt 5 — Nhập PIN

```
A mobile PIN entry screen for the parent area of a family homework app. Vietnamese UI.

Centered: a small lock icon, headline "Nhập mã PIN của bố mẹ", four large empty
rounded PIN boxes in a row, and below them a large numeric keypad with digits 0-9,
a delete key, and big rounded keys.

Under the keypad, small quiet text: "Chỉ bố mẹ dùng phần này".
A checkbox row above the keypad: "Nhớ trên thiết bị này" — checked by default.

Warm cream background, no other navigation.

Avoid: email fields, password fields, social login buttons, or a "forgot password" link.
```

## Prompt 6 — Tổng quan 3 con

```
A mobile parent dashboard for a family homework app showing three children.
Vietnamese UI.

Header: "Hôm nay" with today's date in Vietnamese ("Thứ Hai, 17/8") and a small
avatar-group icon.

Body: three stacked cards, one per child. Each card has a circular photo on the left
with a colored ring (blue, orange, yellow), the child's name and class in bold
("Minh — Lớp 1", "An — Lớp 1", "Bé Na — Mẫu giáo"), a compact horizontal progress bar
in the child's color, and a status line: "3/5 bài đã xong", "5/5 bài đã xong ✅",
"0/1 bài — Tiếng Anh". A small red "Quá hạn" chip appears on one card.

Below the three cards, a section header "Tuần này" with a small 7-column bar chart of
completed assignments per day.

Fixed at the bottom: a large full-width primary button with a plus and camera icon:
"+ Thêm bài tập".

Avoid: data tables, dense metrics, sparklines everywhere, or a bottom tab bar with
more than 3 items.
```

## Prompt 7 — Thêm bài tập (nhập ảnh / text)

```
A mobile "add homework" capture screen for a family homework app. Vietnamese UI.
This screen must be fillable in under a minute.

Header with back arrow and title "Thêm bài tập".

Section 1 — "Ảnh bài tập": a large dashed-border upload area with a camera icon and
text "Chụp ảnh hoặc chọn ảnh từ Zalo", showing two already-added image thumbnails in a
row, each with a small remove X.

Section 2 — "Hoặc dán nội dung": a multiline text area with placeholder "Dán tin nhắn
của cô giáo vào đây...".

Section 3 — "Giao cho con nào": three large selectable chips, each with a small
circular photo and name — "Minh" and "An" are selected (shown with a colored fill and
checkmark, both in class 1), "Bé Na" is unselected. Small helper text below: "Hai bé
sinh đôi học cùng lớp nên được chọn sẵn".

Section 4 — "Hạn hoàn thành": a compact row of date chips "Hôm nay", "Mai", "Chọn ngày",
with "Hôm nay" selected.

Fixed bottom: a large full-width primary button with a sparkle icon: "✨ Tách bài tập".

Avoid: a long scrolling form, per-field labels stacked with tiny inputs, or a
multi-step wizard.
```

## Prompt 8 — Xem lại bản nháp AI đã tách

```
A mobile review screen where a parent checks and edits homework items that an AI
extracted from a photo. Vietnamese UI. This is the most important screen — corrections
must be fast.

Header: back arrow, title "Kiểm tra lại", and a small caption "AI đã tách được 4 bài
tập từ ảnh của con".

Body: a vertical list of editable draft cards. Each card shows an inline-editable
assignment text in a bordered field, and below it a compact row of small chips the
parent can tap to change: a subject chip ("🔢 Toán"), a language chip ("🇻🇳 Tiếng Việt"
on some cards, "🇬🇧 Tiếng Anh" on one card), and a note chip ("trang 34, bài 3"). Each
card has a small trash icon top-right and a drag handle on the left. One card shows a
subtle amber "AI không chắc" warning chip.

Between cards, small quiet "+ Thêm bài" buttons and a "Gộp với bài trên" text action.

A collapsed section at the top: "Ảnh gốc (2)" showing small thumbnails, tappable to expand.

Fixed bottom: two buttons side by side — a quiet outline "Huỷ" and a large green
primary "Lưu 4 bài tập".

Avoid: read-only preview cards, modal dialogs for editing, or a JSON-looking layout.
```

## Prompt 9 — Chi tiết theo con

```
A mobile parent detail screen for one child's homework in a family homework app.
Vietnamese UI.

Header: the child's circular photo with a blue ring, name and class "Minh — Lớp 1",
and a segmented control with two options: "Hôm nay" (selected) and "Tuần này".

Below: a progress summary row — "3/5 bài đã xong" with a blue progress bar.

Body: a grouped list of assignments. Group headers are subject names with emoji
("🔢 Toán", "📖 Tiếng Việt", "🔤 Tiếng Anh"). Each row has a checkbox on the left
(some checked green), the assignment text, a small note in grey ("trang 34, bài 3"),
a tiny photo thumbnail, and a chevron. One row has a red "Quá hạn" chip and one row
shows a small clock icon with "Xong lúc 20:15".

Swipe affordance hinted on one row revealing "Sửa" and "Xoá" actions.

Fixed bottom: full-width primary button "+ Thêm bài tập cho Minh".

Avoid: charts, gamification badges, or streak counters.
```

---

## Mẹo khi chỉnh sửa trong Stitch

Sau khi có màn hình, dùng các câu ngắn để tinh chỉnh (dán riêng từng câu):

```
Make the "Đã làm xong" button twice as tall and move it to the bottom of the screen.
```

```
Make all text 25% larger — the users are 4 to 6 years old.
```

```
Replace the icon row with a single large speaker button labeled "🔊 Nghe đề bài".
```

```
Use the child's accent color for the header background instead of white.
```

```
Show the empty state as a celebration, not as an error.
```

## Sau khi xong

- Stitch xuất được **HTML/CSS** và **Figma**. App dự kiến làm bằng Next.js (mục 8 của PRD) → lấy HTML/CSS làm mốc thị giác, đừng dùng trực tiếp làm code sản phẩm.
- Nhớ kiểm tra thật trên **iPad ngang** — Stitch xem trên màn hình máy tính rất dễ ảo giác là chữ đã đủ to.
