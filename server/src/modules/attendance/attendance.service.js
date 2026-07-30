import dayjs from 'dayjs';
import ApiError from '../../shared/ApiError.js';
import { AUDIT_MODULE } from '../../shared/constants.js';
import { auditFromRequest } from '../audit/audit.service.js';
import * as staffRepo from '../staff/staff.repository.js';
import * as expensesRepo from '../finance/expenses.repository.js';
import * as repo from './attendance.repository.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ── Self (waiter / kitchen / admin) ── */

export async function checkIn(req) {
  const record = await repo.checkIn({ tenantId: req.tenantId, userId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.ATTENDANCE, action: 'CHECK_IN', recordId: record.id,
    description: `${req.user.fullName} checked in`,
  });
  return record;
}

export async function checkOut(req) {
  const record = await repo.checkOut({ tenantId: req.tenantId, userId: req.user.id });
  if (!record) throw ApiError.badRequest('You have not checked in today');
  await auditFromRequest(req, {
    module: AUDIT_MODULE.ATTENDANCE, action: 'CHECK_OUT', recordId: record.id,
    description: `${req.user.fullName} checked out (${record.worked_minutes} min)`,
  });
  return record;
}

export async function myAttendance(req) {
  const from = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const to = dayjs().format('YYYY-MM-DD');
  const [today, history] = await Promise.all([
    repo.findByUserDate({ tenantId: req.tenantId, userId: req.user.id, date: to }),
    repo.listForUser({ tenantId: req.tenantId, userId: req.user.id, from, to }),
  ]);
  return { today, history };
}

/* ── Admin ── */

export function dailyRegister({ tenantId, date }) {
  return repo.register({ tenantId, date: date || dayjs().format('YYYY-MM-DD') });
}

export async function markAttendance(req) {
  const { userId, workDate, status, note, checkIn, checkOut } = req.body;
  const staff = await staffRepo.findById({ tenantId: req.tenantId, id: userId });
  if (!staff) throw ApiError.notFound('Staff member not found');

  let workedMinutes = 0;
  if (checkIn && checkOut) {
    workedMinutes = Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 60000));
  }
  const record = await repo.mark({
    tenantId: req.tenantId, userId, date: workDate, status, note, checkIn, checkOut, workedMinutes, markedBy: req.user.id,
  });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.ATTENDANCE, action: 'MARK', recordId: record.id,
    description: `Marked ${staff.full_name} ${status} on ${workDate}`,
    newValues: { status },
  });
  return record;
}

export async function markBulk(req) {
  const { userId, dates, status } = req.body;
  const staff = await staffRepo.findById({ tenantId: req.tenantId, id: userId });
  if (!staff) throw ApiError.notFound('Staff member not found');
  const count = await repo.markBulk({ tenantId: req.tenantId, userId, dates, status, markedBy: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.ATTENDANCE, action: 'MARK_BULK', recordId: userId,
    description: `Marked ${staff.full_name} ${status} on ${count} day(s)`,
    newValues: { status, days: count },
  });
  return { count };
}

/** One staff member's attendance for a month (drives the calendar view). */
export async function staffMonth({ tenantId, userId, month }) {
  const staff = await staffRepo.findById({ tenantId, id: userId });
  if (!staff) throw ApiError.notFound('Staff member not found');
  const { from, to, label } = monthBounds(month);
  const days = await repo.listForUser({ tenantId, userId, from, to });
  return {
    user: { id: staff.id, fullName: staff.full_name, role: staff.role, monthlySalary: Number(staff.monthly_salary) || 0 },
    month: label, from, to, days,
  };
}

function monthBounds(month) {
  const base = month ? dayjs(`${month}-01`) : dayjs().startOf('month');
  return {
    from: base.startOf('month').format('YYYY-MM-DD'),
    to: base.endOf('month').format('YYYY-MM-DD'),
    daysInMonth: base.daysInMonth(),
    label: base.format('MMMM YYYY'),
  };
}

/**
 * Monthly per-staff summary + payroll estimate.
 * Estimated pay = monthly_salary × (present + 0.5·half) / days-in-month
 * (absent/leave treated as unpaid — a sensible default; adjust per policy).
 */
export async function monthlySummary({ tenantId, month }) {
  const { from, to, daysInMonth, label } = monthBounds(month);
  const rows = await repo.monthlySummary({ tenantId, from, to });
  const staff = rows.map((r) => {
    const payDays = r.present + 0.5 * r.half_day;
    const salary = Number(r.monthly_salary) || 0;
    const estimatedPay = salary > 0 ? round2((salary * payDays) / daysInMonth) : 0;
    return {
      ...r,
      monthly_salary: salary,
      worked_hours: round2(r.worked_minutes / 60),
      estimated_pay: estimatedPay,
    };
  });
  const totalPayroll = round2(staff.reduce((s, r) => s + r.estimated_pay, 0));
  return { month: label, from, to, staff, totalPayroll };
}

/** Post the month's estimated payroll as a single SALARIES expense. */
export async function postSalariesToExpenses(req) {
  const { month } = req.body;
  const { staff, totalPayroll, label, to } = await monthlySummary({ tenantId: req.tenantId, month });
  if (totalPayroll <= 0) throw ApiError.badRequest('No payroll to post (set staff salaries first)');

  const expense = await expensesRepo.create({
    tenantId: req.tenantId,
    data: {
      category: 'SALARIES',
      title: `Salaries — ${label}`,
      amount: totalPayroll,
      paymentMethod: 'BANK',
      expenseDate: to,
      note: `Auto-posted from attendance for ${staff.filter((s) => s.estimated_pay > 0).length} staff`,
    },
    actorId: req.user.id,
  });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.ATTENDANCE, action: 'POST_SALARIES', recordId: expense.id,
    description: `Posted payroll ₹${totalPayroll} for ${label} to expenses`,
    newValues: { amount: totalPayroll, month: label },
  });
  return { expense, totalPayroll };
}
