import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireTenant } from '../../middleware/tenantContext.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../shared/constants.js';
import * as ctrl from './tables.controller.js';
import {
  createFloorSchema, updateFloorSchema,
  createTableSchema, updateTableSchema,
  listTablesSchema, idParamSchema,
} from './tables.validators.js';

const router = Router();
router.use(authenticate, requireTenant);

/* Floors */
router.get('/floors', requirePermission(PERMISSIONS.TABLE_VIEW), ctrl.listFloors);
router.post('/floors', requirePermission(PERMISSIONS.TABLE_MANAGE), validate({ body: createFloorSchema }), ctrl.createFloor);
router.patch('/floors/:id', requirePermission(PERMISSIONS.TABLE_MANAGE), validate({ params: idParamSchema, body: updateFloorSchema }), ctrl.updateFloor);
router.delete('/floors/:id', requirePermission(PERMISSIONS.TABLE_MANAGE), validate({ params: idParamSchema }), ctrl.deleteFloor);

/* Tables */
router.get('/', requirePermission(PERMISSIONS.TABLE_VIEW), validate({ query: listTablesSchema }), ctrl.listTables);
router.post('/', requirePermission(PERMISSIONS.TABLE_MANAGE), validate({ body: createTableSchema }), ctrl.createTable);
router.get('/:id', requirePermission(PERMISSIONS.TABLE_VIEW), validate({ params: idParamSchema }), ctrl.getTable);
router.patch('/:id', requirePermission(PERMISSIONS.TABLE_MANAGE), validate({ params: idParamSchema, body: updateTableSchema }), ctrl.updateTable);
router.delete('/:id', requirePermission(PERMISSIONS.TABLE_MANAGE), validate({ params: idParamSchema }), ctrl.deleteTable);

/* QR */
router.get('/:id/qr', requirePermission(PERMISSIONS.QR_GENERATE), validate({ params: idParamSchema }), ctrl.getQr);
router.post('/:id/qr/regenerate', requirePermission(PERMISSIONS.QR_GENERATE), validate({ params: idParamSchema }), ctrl.regenerateQr);

export default router;
