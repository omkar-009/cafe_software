import catchAsync from '../../shared/catchAsync.js';
import { ok } from '../../shared/ApiResponse.js';
import * as service from './billing.service.js';

export const pay = catchAsync(async (req, res) => {
  const result = await service.completePayment(req, {
    orderId: req.params.orderId,
    method: req.body.method,
    amount: req.body.amount,
    reference: req.body.reference,
  });
  return ok(res, result, { message: 'Payment completed' });
});

export const getInvoice = catchAsync(async (req, res) => {
  const invoice = await service.getInvoice(req, { orderId: req.params.orderId });
  return ok(res, { invoice });
});

export const downloadInvoice = catchAsync(async (req, res) => {
  const { invoice, pdf } = await service.getInvoicePdf(req, { orderId: req.params.orderId });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  return res.send(pdf);
});
