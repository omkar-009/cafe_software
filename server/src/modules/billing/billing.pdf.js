/**
 * Invoice PDF generator (pdfkit). Renders a clean thermal/A5-style bill from an
 * invoice snapshot and resolves to a Buffer for download / storage.
 */
import PDFDocument from 'pdfkit';

export function renderInvoicePdf(snapshot) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 36 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { tenant, order, items, totals, invoiceNumber, issuedAt } = snapshot;
    const money = (n) => `${tenant.currencySymbol || tenant.currency || ''}${Number(n).toFixed(2)}`;

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(tenant.name, { align: 'center' });
    if (tenant.address) {
      const a = tenant.address;
      doc.fontSize(8).font('Helvetica').fillColor('#555')
        .text([a.line1, a.city, a.state, a.pincode].filter(Boolean).join(', '), { align: 'center' });
    }
    if (tenant.gstNumber) doc.fontSize(8).text(`GSTIN: ${tenant.gstNumber}`, { align: 'center' });
    doc.moveDown(0.5).fillColor('#000');
    doc.moveTo(36, doc.y).lineTo(doc.page.width - 36, doc.y).stroke('#ddd');
    doc.moveDown(0.5);

    // Meta
    doc.fontSize(9).font('Helvetica');
    doc.text(`Invoice: ${invoiceNumber}`);
    doc.text(`Order: ${order.orderNumber}`);
    if (order.tableNumber) doc.text(`Table: ${order.tableNumber}`);
    doc.text(`Date: ${new Date(issuedAt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    })}`);
    doc.moveDown(0.5);

    // Items table
    const startX = 36;
    const rightX = doc.page.width - 36;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Item', startX, doc.y, { continued: true, width: 200 });
    doc.text('Qty', 250, doc.y, { continued: true, width: 40 });
    doc.text('Amount', 0, doc.y, { align: 'right' });
    doc.font('Helvetica');
    doc.moveTo(startX, doc.y + 2).lineTo(rightX, doc.y + 2).stroke('#eee');
    doc.moveDown(0.4);

    items.forEach((it) => {
      const y = doc.y;
      doc.text(it.name + (it.variant ? ` (${it.variant})` : ''), startX, y, { width: 200 });
      const rowY = Math.max(y, doc.y);
      doc.text(String(it.quantity), 250, y, { width: 40 });
      doc.text(money(it.lineTotal), 0, y, { align: 'right' });
      if (it.addons?.length) {
        doc.fontSize(7).fillColor('#777')
          .text('+ ' + it.addons.map((a) => a.name).join(', '), startX + 8, doc.y, { width: 200 });
        doc.fontSize(9).fillColor('#000');
      }
      doc.moveDown(0.2);
      void rowY;
    });

    doc.moveTo(startX, doc.y + 2).lineTo(rightX, doc.y + 2).stroke('#eee');
    doc.moveDown(0.4);

    // Totals
    const totalLine = (label, value, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9);
      doc.text(label, startX, doc.y, { continued: true, width: 250 });
      doc.text(money(value), 0, doc.y, { align: 'right' });
    };
    totalLine('Subtotal', totals.subtotal);
    if (Number(totals.discountAmount) > 0) totalLine('Discount', -totals.discountAmount);
    totalLine('Tax', totals.taxAmount);
    if (Number(totals.serviceCharge) > 0) totalLine('Service Charge', totals.serviceCharge);
    doc.moveDown(0.2);
    totalLine('TOTAL', totals.totalAmount, true);

    // Footer
    doc.moveDown(1).font('Helvetica').fontSize(8).fillColor('#666');
    if (tenant.menuFooter) doc.text(tenant.menuFooter, { align: 'center' });
    doc.moveDown(0.3).text('Thank you • Powered by RestroSaaS', { align: 'center' });

    doc.end();
  });
}
