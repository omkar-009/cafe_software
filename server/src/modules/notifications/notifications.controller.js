import catchAsync from '../../shared/catchAsync.js';
import { ok } from '../../shared/ApiResponse.js';
import { parseOffsetPagination } from '../../shared/pagination.js';
import * as service from './notifications.service.js';

export const list = catchAsync(async (req, res) => {
  const { limit, offset } = parseOffsetPagination(req.query);
  const { rows, unread } = await service.list({
    tenantId: req.tenantId,
    userId: req.user.id,
    role: req.user.role,
    unreadOnly: req.query.unreadOnly === 'true' || req.query.unreadOnly === true,
    limit,
    offset,
  });
  return ok(res, { notifications: rows, unreadCount: unread });
});

export const markRead = catchAsync(async (req, res) => {
  await service.markRead({ tenantId: req.tenantId, userId: req.user.id, role: req.user.role, id: req.params.id });
  return ok(res, null, { message: 'Marked as read' });
});

export const markAllRead = catchAsync(async (req, res) => {
  await service.markAllRead({ tenantId: req.tenantId, userId: req.user.id, role: req.user.role });
  return ok(res, null, { message: 'All notifications marked as read' });
});
