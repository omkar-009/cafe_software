import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './finance.controller.js';
import {
  createExpenseSchema, updateExpenseSchema, listExpensesSchema, rangeSchema, idParamSchema,
} from './finance.validators.js';

const router = Router();
router.use(authenticate, requireTenant);

/* Expenses */
router.get('/expenses', requirePermission(PERMISSIONS.EXPENSE_VIEW), validate({ query: listExpensesSchema }), ctrl.listExpenses);
router.get('/expenses/export', requirePermission(PERMISSIONS.EXPENSE_VIEW), ctrl.exportExpenses);
router.post('/expenses', requirePermission(PERMISSIONS.EXPENSE_MANAGE), validate({ body: createExpenseSchema }), ctrl.createExpense);
router.patch('/expenses/:id', requirePermission(PERMISSIONS.EXPENSE_MANAGE), validate({ params: idParamSchema, body: updateExpenseSchema }), ctrl.updateExpense);
router.delete('/expenses/:id', requirePermission(PERMISSIONS.EXPENSE_MANAGE), validate({ params: idParamSchema }), ctrl.removeExpense);

/* Profit & Loss reports */
router.get('/pnl', requirePermission(PERMISSIONS.FINANCE_VIEW), validate({ query: rangeSchema }), ctrl.pnl);
router.get('/pnl/trend', requirePermission(PERMISSIONS.FINANCE_VIEW), validate({ query: rangeSchema }), ctrl.pnlTrend);
router.get('/product-profit', requirePermission(PERMISSIONS.FINANCE_VIEW), validate({ query: rangeSchema }), ctrl.productProfit);
router.get('/product-profit/export', requirePermission(PERMISSIONS.FINANCE_VIEW), ctrl.exportProductProfit);

export default router;
