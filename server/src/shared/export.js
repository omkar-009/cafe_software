/**
 * Tabular export helpers for reports (CSV + Excel).
 *
 *   columns: [{ header: 'Order', key: 'order_number', width?: 20 }]
 *   rows:    [{ order_number: 'ORD-1', ... }]
 */
import ExcelJS from 'exceljs';

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(columns, rows) {
  const header = columns.map((c) => escapeCsv(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(row[c.key])).join(','))
    .join('\r\n');
  return `${header}\r\n${body}`;
}

export async function buildXlsx(sheetName, columns, rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RestroSaaS';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName || 'Report');
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 20 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rows.forEach((r) => ws.addRow(r));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Write an export result to an Express response with the right headers. */
export async function sendExport(res, { format, filename, sheetName, columns, rows }) {
  if (format === 'xlsx') {
    const buf = await buildXlsx(sheetName, columns, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(buf);
  }
  const csv = buildCsv(columns, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  return res.send(csv);
}
