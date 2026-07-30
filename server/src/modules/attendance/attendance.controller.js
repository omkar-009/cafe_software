import dayjs from 'dayjs';
import catchAsync from '../../shared/catchAsync.js';
import { ok, created } from '../../shared/ApiResponse.js';
import { sendExport } from '../../shared/export.js';
import * as service from './attendance.service.js';

/* Self */
export const checkIn = catchAsync(async (req, res) => {
  const attendance = await service.checkIn(req);
  return ok(res, { attendance }, { message: 'Checked in' });
});

export const checkOut = catchAsync(async (req, res) => {
  const attendance = await service.checkOut(req);
  return ok(res, { attendance }, { message: 'Checked out' });
});

export const me = catchAsync(async (req, res) => {
  const data = await service.myAttendance(req);
  return ok(res, data);
});

/* Admin */
export const register = catchAsync(async (req, res) => {
  const rows = await service.dailyRegister({ tenantId: req.tenantId, date: req.query.date });
  return ok(res, { register: rows, date: req.query.date || dayjs().format('YYYY-MM-DD') });
});

export const mark = catchAsync(async (req, res) => {
  const attendance = await service.markAttendance(req);
  return created(res, { attendance }, { message: 'Attendance marked' });
});

export const markBulk = catchAsync(async (req, res) => {
  const result = await service.markBulk(req);
  return created(res, result, { message: `Marked ${result.count} day(s)` });
});

export const staffMonth = catchAsync(async (req, res) => {
  const data = await service.staffMonth({ tenantId: req.tenantId, userId: req.params.userId, month: req.query.month });
  return ok(res, data);
});

export const summary = catchAsync(async (req, res) => {
  const data = await service.monthlySummary({ tenantId: req.tenantId, month: req.query.month });
  return ok(res, data);
});

export const exportSummary = catchAsync(async (req, res) => {
  const { staff, month } = await service.monthlySummary({ tenantId: req.tenantId, month: req.query.month });
  return sendExport(res, {
    format: req.query.format === 'xlsx' ? 'xlsx' : 'csv',
    filename: `attendance-${(month || '').replace(' ', '-')}`,
    sheetName: 'Attendance',
    columns: [
      { header: 'Staff', key: 'full_name' }, { header: 'Role', key: 'role' },
      { header: 'Present', key: 'present' }, { header: 'Absent', key: 'absent' },
      { header: 'Half day', key: 'half_day' }, { header: 'Leave', key: 'leave' },
      { header: 'Weekly off', key: 'weekly_off' }, { header: 'Hours', key: 'worked_hours' },
      { header: 'Salary', key: 'monthly_salary' }, { header: 'Est. pay', key: 'estimated_pay' },
    ],
    rows: staff,
  });
});

export const postSalaries = catchAsync(async (req, res) => {
  const result = await service.postSalariesToExpenses(req);
  return created(res, result, { message: `Posted ₹${result.totalPayroll} to expenses` });
});
