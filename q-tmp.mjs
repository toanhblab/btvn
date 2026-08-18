import { PGlite } from '@electric-sql/pglite';
const db = await PGlite.create('./.data/pg');
const r = await db.query(`SELECT due_date, status, child_id, count(*) FROM assignments GROUP BY 1,2,3 ORDER BY 1`);
console.log('today =', new Date().toISOString().slice(0,10));
console.table(r.rows);
