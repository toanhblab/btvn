-- Bo me THUONG ⭐ bang tay — chieu nguoc cua tru diem (017). Truoc day luat la
-- "chi tru, khong cong tay"; nay chu nha doi y: bo me cong duoc ⭐ khi con
-- ngoan, kem ly do con se doc (giong tru).
--
-- Ghi vao score_events (khong mo bang moi): moi lan thuong la MOT dong
-- kind = 'parent_bonus', points > 0 nhu moi dong khac — so du SQL_SO_DU_CON
-- (lib/sqlDiem.ts) da cong SUM(score_events) nen KHONG phai sua cong thuc.
-- Dau van la thuoc tinh cua BANG: score_events chi chua diem cong.
--
-- Khong co unique index cho kind nay: moi lan bo me bam la mot lan thuong
-- rieng, khong co "cong mot lan".
--
-- reason: chi dong 'parent_bonus' dung; dong cua ba luat tu dong de NULL.
--
-- CHECK cua kind: DROP roi ADD lai voi DU BON gia tri (xem chu thich o 016) —
-- migration nao them kind nua phai liet ke lai du, khong chi gia tri cua minh.

ALTER TABLE score_events
  ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE score_events DROP CONSTRAINT IF EXISTS score_events_kind_check;

ALTER TABLE score_events
  ADD CONSTRAINT score_events_kind_check
  CHECK (kind IN ('day_complete', 'early_finish', 'task_done', 'parent_bonus'));
