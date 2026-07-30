import { query } from '../../config/database.js';

const RET = `id, tenant_id, user_id, work_date, status, check_in, check_out, worked_minutes, note, marked_by`;

export async function findByUserDate({ tenantId, userId, date }) {
  const { rows } = await query(
    `SELECT ${RET} FROM attendance WHERE tenant_id = $1 AND user_id = $2 AND work_date = $3`,
    [tenantId, userId, date],
  );
  return rows[0] || null;
}

/** Self check-in for today. Keeps the earliest check-in if called twice. */
export async function checkIn({ tenantId, userId }) {
  const { rows } = await query(
    `INSERT INTO attendance (tenant_id, user_id, work_date, status, check_in, marked_by)
     VALUES ($1, $2, CURRENT_DATE, 'PRESENT', now(), $2)
     ON CONFLICT (tenant_id, user_id, work_date) DO UPDATE SET
        check_in = COALESCE(attendance.check_in, now()),
        status = CASE WHEN attendance.status = 'ABSENT' THEN 'PRESENT' ELSE attendance.status END,
        updated_at = now()
     RETURNING ${RET}`,
    [tenantId, userId],
  );
  return rows[0];
}

/** Self check-out for today; computes worked minutes. Null if not checked in. */
export async function checkOut({ tenantId, userId }) {
  const { rows } = await query(
    `UPDATE attendance SET
        check_out = now(),
        worked_minutes = GREATEST(0, (EXTRACT(EPOCH FROM (now() - check_in)) / 60))::int,
        updated_at = now()
      WHERE tenant_id = $1 AND user_id = $2 AND work_date = CURRENT_DATE AND check_in IS NOT NULL
      RETURNING ${RET}`,
    [tenantId, userId],
  );
  return rows[0] || null;
}

/**
 * Admin marks/overrides a staff member's status for a date, optionally fixing
 * check-in/out times (e.g. was present but forgot to punch). Times/note are
 * only overwritten when provided (COALESCE keeps existing otherwise).
 */
export async function mark({ tenantId, userId, date, status, note, checkIn, checkOut, workedMinutes, markedBy }) {
  const { rows } = await query(
    `INSERT INTO attendance (tenant_id, user_id, work_date, status, check_in, check_out, worked_minutes, note, marked_by)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7,0), $8, $9)
     ON CONFLICT (tenant_id, user_id, work_date) DO UPDATE SET
        status = EXCLUDED.status,
        check_in = COALESCE(EXCLUDED.check_in, attendance.check_in),
        check_out = COALESCE(EXCLUDED.check_out, attendance.check_out),
        worked_minutes = CASE WHEN EXCLUDED.worked_minutes > 0 THEN EXCLUDED.worked_minutes ELSE attendance.worked_minutes END,
        note = COALESCE(EXCLUDED.note, attendance.note),
        marked_by = EXCLUDED.marked_by, updated_at = now()
     RETURNING ${RET}`,
    [tenantId, userId, date, status, checkIn || null, checkOut || null, workedMinutes || 0, note || null, markedBy],
  );
  return rows[0];
}

/** Bulk-mark many dates for one staff member with the same status (calendar select). */
export async function markBulk({ tenantId, userId, dates, status, markedBy }) {
  const { rows } = await query(
    `INSERT INTO attendance (tenant_id, user_id, work_date, status, marked_by)
     SELECT $1, $2, d::date, $4, $5 FROM unnest($3::date[]) AS d
     ON CONFLICT (tenant_id, user_id, work_date) DO UPDATE SET
        status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = now()
     RETURNING work_date`,
    [tenantId, userId, dates, status, markedBy],
  );
  return rows.length;
}

/** Daily register: every staff member + their attendance for a given date. */
export async function register({ tenantId, date }) {
  const { rows } = await query(
    `SELECT u.id AS user_id, u.full_name, u.role, u.monthly_salary,
            a.id AS attendance_id, a.status, a.check_in, a.check_out, a.worked_minutes, a.note
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id AND a.tenant_id = u.tenant_id AND a.work_date = $2
      WHERE u.tenant_id = $1 AND u.deleted_at IS NULL AND u.role <> 'CUSTOMER'
      ORDER BY u.full_name ASC`,
    [tenantId, date],
  );
  return rows;
}

/** Per-staff attendance counts + worked minutes across a date range. */
export async function monthlySummary({ tenantId, from, to }) {
  const { rows } = await query(
    `SELECT u.id AS user_id, u.full_name, u.role, u.monthly_salary,
            count(a.id) FILTER (WHERE a.status = 'PRESENT')::int    AS present,
            count(a.id) FILTER (WHERE a.status = 'ABSENT')::int     AS absent,
            count(a.id) FILTER (WHERE a.status = 'HALF_DAY')::int   AS half_day,
            count(a.id) FILTER (WHERE a.status = 'LEAVE')::int      AS leave,
            count(a.id) FILTER (WHERE a.status = 'WEEKLY_OFF')::int AS weekly_off,
            COALESCE(sum(a.worked_minutes),0)::int                 AS worked_minutes
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id AND a.tenant_id = u.tenant_id
             AND a.work_date >= $2 AND a.work_date <= $3
      WHERE u.tenant_id = $1 AND u.deleted_at IS NULL AND u.role <> 'CUSTOMER'
      GROUP BY u.id, u.full_name, u.role, u.monthly_salary
      ORDER BY u.full_name ASC`,
    [tenantId, from, to],
  );
  return rows;
}

/** Self history for a date range. */
export async function listForUser({ tenantId, userId, from, to }) {
  const { rows } = await query(
    `SELECT ${RET} FROM attendance
      WHERE tenant_id = $1 AND user_id = $2 AND work_date >= $3 AND work_date <= $4
      ORDER BY work_date DESC`,
    [tenantId, userId, from, to],
  );
  return rows;
}
