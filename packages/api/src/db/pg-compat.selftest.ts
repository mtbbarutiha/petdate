/**
 * pg-sql-translate — datetime(COALESCE(...)) must not reach Postgres.
 * Run: cd packages/api && npx tsx src/db/pg-compat.selftest.ts
 */
export {};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { translateSql } = await import('./pg-sql-translate');

  const now = translateSql(`SELECT datetime('now')`);
  assert(/TO_CHAR\s*\(\s*NOW\s*\(\s*\)/i.test(now), 'datetime(now) → TO_CHAR(NOW())');
  assert(!/\bdatetime\s*\(/i.test(now), 'no bare datetime after now rewrite');

  const bound = translateSql(
    `SELECT * FROM t WHERE created_at <= datetime('now', ?)`
  );
  assert(/\(\$1\)::interval/i.test(bound), 'now,? → ($1)::interval');
  assert(!/\bdatetime\s*\(/i.test(bound), 'no bare datetime for bound now');

  const col = translateSql(`SELECT datetime(created_at) FROM t`);
  assert(/\bcreated_at\b/.test(col), 'datetime(col) strips to col');
  assert(!/\bdatetime\s*\(/i.test(col), 'no bare datetime(col)');

  // Regression: consult idle-close listIdleActiveVetConsultIds shape (pre-fix)
  const idleSql = `SELECT vc.id AS id
         FROM vet_consultations vc
         WHERE vc.status = 'active'
           AND COALESCE(vc.chat_ended, 0) = 0
           AND datetime(
             COALESCE(
               vc.patient_last_activity_at,
               (SELECT MAX(m.created_at)
                FROM vet_consult_chat_messages m
                WHERE m.consult_id = vc.id
                  AND m.sender_user_id = vc.patient_user_id),
               vc.created_at
             )
           ) <= datetime('now', ?)
         ORDER BY vc.id ASC
         LIMIT ?`;
  const idle = translateSql(idleSql);
  assert(!/\bdatetime\s*\(/i.test(idle), 'idle-close: no bare datetime() left for PG');
  assert(
    /COALESCE\s*\(\s*vc\.patient_last_activity_at/i.test(idle),
    'idle-close: COALESCE expr preserved'
  );
  assert(
    /TO_CHAR\s*\(\s*NOW\s*\(\s*\)\s*\+\s*\(\$?\d+\)::interval/i.test(idle),
    'idle-close: right side is NOW()+($n)::interval'
  );

  // Current query shape (no outer datetime on COALESCE) still PG-safe
  const idleFixed = translateSql(`SELECT vc.id AS id
         FROM vet_consultations vc
         WHERE COALESCE(
             vc.patient_last_activity_at,
             vc.created_at
           ) <= datetime('now', ?)`);
  assert(!/\bdatetime\s*\(/i.test(idleFixed), 'fixed idle query has no bare datetime');

  console.log('pg-compat.selftest: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
