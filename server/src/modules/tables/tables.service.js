import QRCode from 'qrcode';
import ApiError from '../../shared/ApiError.js';
import env from '../../config/env.js';
import { signQrPayload } from '../../shared/security.js';
import { AUDIT_MODULE } from '../../shared/constants.js';
import { auditFromRequest } from '../audit/audit.service.js';
import * as repo from './tables.repository.js';

/* ── Floors ── */
export const listFloors = (tenantId) => repo.listFloors({ tenantId });

export async function createFloor(req) {
  const floor = await repo.createFloor({ tenantId: req.tenantId, ...req.body, actorId: req.user.id });
  await auditFromRequest(req, { module: AUDIT_MODULE.TABLE, action: 'FLOOR_CREATE', recordId: floor.id, description: `Created floor "${floor.name}"` });
  return floor;
}

export async function updateFloor(req) {
  const floor = await repo.updateFloor({ tenantId: req.tenantId, id: req.params.id, data: req.body, actorId: req.user.id });
  if (!floor) throw ApiError.notFound('Floor not found');
  await auditFromRequest(req, { module: AUDIT_MODULE.TABLE, action: 'FLOOR_UPDATE', recordId: floor.id, description: `Updated floor "${floor.name}"` });
  return floor;
}

export async function deleteFloor(req) {
  const ok = await repo.deleteFloor({ tenantId: req.tenantId, id: req.params.id, actorId: req.user.id });
  if (!ok) throw ApiError.notFound('Floor not found');
  await auditFromRequest(req, { module: AUDIT_MODULE.TABLE, action: 'FLOOR_DELETE', recordId: req.params.id, description: 'Deleted floor' });
}

/* ── Tables ── */
export const listTables = ({ tenantId, floorId, status }) => repo.listTables({ tenantId, floorId, status });

export async function getTable({ tenantId, id }) {
  const table = await repo.findTable({ tenantId, id });
  if (!table) throw ApiError.notFound('Table not found');
  return table;
}

export async function createTable(req) {
  const table = await repo.createTable({ tenantId: req.tenantId, ...req.body, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.TABLE, action: 'CREATE', recordId: table.id,
    description: `Created table "${table.table_number}"`, newValues: { table_number: table.table_number },
  });
  return table;
}

export async function updateTable(req) {
  const before = await repo.findTable({ tenantId: req.tenantId, id: req.params.id });
  if (!before) throw ApiError.notFound('Table not found');
  const table = await repo.updateTable({ tenantId: req.tenantId, id: req.params.id, data: req.body, actorId: req.user.id });
  await auditFromRequest(req, {
    module: AUDIT_MODULE.TABLE, action: 'UPDATE', recordId: table.id,
    description: `Updated table "${table.table_number}"`,
    oldValues: { status: before.status }, newValues: { status: table.status },
  });
  return table;
}

export async function deleteTable(req) {
  const table = await repo.findTable({ tenantId: req.tenantId, id: req.params.id });
  if (!table) throw ApiError.notFound('Table not found');
  await repo.deleteTable({ tenantId: req.tenantId, id: req.params.id, actorId: req.user.id });
  await auditFromRequest(req, { module: AUDIT_MODULE.TABLE, action: 'DELETE', recordId: table.id, description: `Deleted table "${table.table_number}"` });
}

/**
 * Build the customer-facing QR URL for a table: a signed, tamper-evident deep
 * link into the ordering web app.
 */
export function buildQrUrl(table) {
  const payload = signQrPayload({
    tenantId: table.tenant_id,
    floorId: table.floor_id,
    tableId: table.id,
    qrToken: table.qr_token,
    qrVersion: table.qr_version,
  });
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${env.CLIENT_URL}/order?d=${encoded}`;
}

/** Return the QR as a PNG data URL plus the encoded deep link. */
export async function getTableQr({ tenantId, id }) {
  const table = await repo.findTable({ tenantId, id });
  if (!table) throw ApiError.notFound('Table not found');
  const url = buildQrUrl(table);
  const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: 'M' });
  return { table, url, qrImage: dataUrl };
}

export async function regenerateQr(req) {
  const rotated = await repo.rotateQr({ tenantId: req.tenantId, id: req.params.id, actorId: req.user.id });
  if (!rotated) throw ApiError.notFound('Table not found');
  await auditFromRequest(req, {
    module: AUDIT_MODULE.QR, action: 'REGENERATE', recordId: rotated.id,
    description: `Regenerated QR for table "${rotated.table_number}" (v${rotated.qr_version})`,
  });
  const url = buildQrUrl(rotated);
  const qrImage = await QRCode.toDataURL(url, { width: 512, margin: 2 });
  return { table: rotated, url, qrImage };
}
