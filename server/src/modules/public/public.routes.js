import { Router } from 'express';
import { z } from 'zod';
import validate from '../../middleware/validate.js';
import catchAsync from '../../shared/catchAsync.js';
import { ok, created } from '../../shared/ApiResponse.js';
import { cartItemSchema } from '../orders/orders.validators.js';
import * as service from './public.service.js';

const router = Router();

const encoded = z.string().min(1).max(4000);

/** Resolve a scanned QR → restaurant branding + table + menu. */
router.get(
  '/resolve',
  validate({ query: z.object({ d: encoded }) }),
  catchAsync(async (req, res) => {
    const data = await service.resolveQr(req.query.d);
    return ok(res, data);
  }),
);

/** Place an order (guest customer). */
router.post(
  '/orders',
  validate({
    body: z.object({
      d: encoded,
      cart: z.array(cartItemSchema).min(1),
      couponCode: z.string().max(30).optional(),
      customer: z.object({ name: z.string().max(120).optional(), phone: z.string().max(20).optional() }).optional(),
      customerNote: z.string().max(500).optional(),
    }),
  }),
  catchAsync(async (req, res) => {
    const result = await service.placeOrder({
      encoded: req.body.d,
      cart: req.body.cart,
      couponCode: req.body.couponCode,
      customer: req.body.customer,
      customerNote: req.body.customerNote,
      client: req.clientCtx,
    });
    return created(res, result, { message: `Order ${result.orderNumber} placed` });
  }),
);

/** Track an order. */
router.get(
  '/orders/:orderId',
  validate({ params: z.object({ orderId: z.string().uuid() }), query: z.object({ d: encoded }) }),
  catchAsync(async (req, res) => {
    const order = await service.track({ encoded: req.query.d, orderId: req.params.orderId });
    return ok(res, { order });
  }),
);

/** Download the invoice PDF (guest) once the order is served/paid. */
router.get(
  '/orders/:orderId/invoice.pdf',
  validate({
    params: z.object({ orderId: z.string().uuid() }),
    query: z.object({ d: encoded, download: z.string().optional() }),
  }),
  catchAsync(async (req, res) => {
    const { invoice, pdf } = await service.invoicePdf({
      encoded: req.query.d, orderId: req.params.orderId, client: req.clientCtx,
    });
    // download=1 → force save; otherwise open inline in the browser (view).
    const disposition = req.query.download ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${invoice.invoice_number}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.send(pdf);
  }),
);

/** Preview a coupon discount before checkout. */
router.post(
  '/coupon/preview',
  validate({ body: z.object({ d: encoded, code: z.string().max(30), subtotal: z.number().min(0) }) }),
  catchAsync(async (req, res) => {
    const result = await service.coupon({ encoded: req.body.d, code: req.body.code, subtotal: req.body.subtotal });
    return ok(res, result);
  }),
);

export default router;
