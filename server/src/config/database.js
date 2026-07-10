/**
 * PostgreSQL connection pool + query helpers.
 *
 * Exposes:
 *   - query(text, params)      → single parameterized query
 *   - getClient()              → checked-out client (manual release)
 *   - withTransaction(fn)      → run fn inside a BEGIN/COMMIT/ROLLBACK block
 *
 * All data access goes through parameterized queries (no string concat) to
 * eliminate SQL injection.
 */
import pg from 'pg';
import env, { isProd } from './env.js';
import logger from './logger.js';

const { Pool } = pg;

const poolConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    };

export const pool = new Pool({
  ...poolConfig,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: 10000,
  application_name: env.APP_NAME,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

/**
 * Execute a single parameterized query.
 * @param {string} text  SQL with $1, $2 placeholders
 * @param {any[]} [params]
 */
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (!isProd && duration > 200) {
    logger.warn({ duration, rows: res.rowCount, sql: text.split('\n')[0] }, 'Slow query');
  }
  return res;
}

/** Check out a client for multi-statement work. Caller MUST release(). */
export function getClient() {
  return pool.connect();
}

/**
 * Run a function inside a transaction. Automatically COMMITs on success and
 * ROLLBACKs on any thrown error. The callback receives a bound `query` fn.
 *
 * @template T
 * @param {(q: (text: string, params?: any[]) => Promise<import('pg').QueryResult>, client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const boundQuery = (text, params) => client.query(text, params);
    const result = await fn(boundQuery, client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Verify connectivity at boot. */
export async function assertDatabaseConnection() {
  const { rows } = await pool.query('SELECT version()');
  logger.info({ version: rows[0].version.split(',')[0] }, '✅ PostgreSQL connected');
}

export async function closePool() {
  await pool.end();
  logger.info('PostgreSQL pool closed');
}
