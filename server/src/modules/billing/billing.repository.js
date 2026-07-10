import { query } from '../../config/database.js';

export async function insertPayment({ tenantId, orderId, amount, method, reference, actorId, q = query }) {
  const { rows } = await q(
    `INSERT INTO payments (tenant_id, order_id, amount, method, status, reference, created_by)
     VALUES ($1,$2,$3,$4,'PAID',$5,$6) RETURNING *`,
    [tenantId, orderId, amount, method, reference || null, actorId || null],
  );
  return rows[0];
}

export async function findInvoiceByOrder({ tenantId, orderId, q = query }) {
  const { rows } = await q(
    'SELECT * FROM invoices WHERE tenant_id = $1 AND order_id = $2 LIMIT 1',
    [tenantId, orderId],
  );
  return rows[0] || null;
}

export async function findInvoiceById({ tenantId, id }) {
  const { rows } = await query(
    'SELECT * FROM invoices WHERE tenant_id = $1 AND id = $2 LIMIT 1',
    [tenantId, id],
  );
  return rows[0] || null;
}

export async function insertInvoice({ tenantId, orderId, invoiceNumber, snapshot, actorId, q = query }) {
  const { rows } = await q(
    `INSERT INTO invoices (tenant_id, order_id, invoice_number, snapshot, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [tenantId, orderId, invoiceNumber, JSON.stringify(snapshot), actorId || null],
  );
  return rows[0];
}

export async function incrementPrintCount({ tenantId, id }) {
  await query('UPDATE invoices SET print_count = print_count + 1 WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
}
