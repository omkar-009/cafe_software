import { Router } from 'express';
import { pool } from '../config/database.js';
import env from '../config/env.js';

const router = Router();

/** Liveness — is the process up? */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: env.APP_NAME, uptime: process.uptime() });
});

/** Readiness — can we serve traffic (DB reachable)? */
router.get('/health/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', db: 'up' });
  } catch {
    res.status(503).json({ status: 'unavailable', db: 'down' });
  }
});

export default router;
