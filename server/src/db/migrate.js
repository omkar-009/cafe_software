/**
 * Minimal, dependency-free SQL migration runner.
 *
 * Migration files live in ./migrations named `NNNN_description.sql` and contain
 * two sections separated by markers:
 *
 *   -- migrate:up
 *   <forward SQL>
 *   -- migrate:down
 *   <rollback SQL>
 *
 * Commands:
 *   node src/db/migrate.js up       apply all pending migrations
 *   node src/db/migrate.js down     roll back the most recent migration
 *   node src/db/migrate.js status   show applied / pending
 *
 * Each migration runs inside a transaction and is recorded in schema_migrations.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool, withTransaction } from '../config/database.js';
import logger from '../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function loadMigrationFiles() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return Promise.all(
    files.map(async (name) => {
      const raw = await readFile(path.join(MIGRATIONS_DIR, name), 'utf8');
      const [up, down] = splitSections(raw);
      return { name, up, down };
    }),
  );
}

function splitSections(raw) {
  const upMarker = /--\s*migrate:up/i;
  const downMarker = /--\s*migrate:down/i;
  const downIdx = raw.search(downMarker);
  const upPart = downIdx === -1 ? raw : raw.slice(0, downIdx);
  const downPart = downIdx === -1 ? '' : raw.slice(downIdx);
  return [upPart.replace(upMarker, '').trim(), downPart.replace(downMarker, '').trim()];
}

async function appliedSet() {
  const { rows } = await pool.query('SELECT name FROM schema_migrations ORDER BY name');
  return { list: rows.map((r) => r.name), set: new Set(rows.map((r) => r.name)) };
}

async function up() {
  const migrations = await loadMigrationFiles();
  const { set } = await appliedSet();
  const pending = migrations.filter((m) => !set.has(m.name));
  if (pending.length === 0) {
    logger.info('No pending migrations — database is up to date.');
    return;
  }
  for (const m of pending) {
    logger.info(`▶ Applying ${m.name}`);
    // eslint-disable-next-line no-await-in-loop
    await withTransaction(async (q) => {
      if (m.up) await q(m.up);
      await q('INSERT INTO schema_migrations (name) VALUES ($1)', [m.name]);
    });
    logger.info(`✅ Applied ${m.name}`);
  }
  logger.info(`Done — applied ${pending.length} migration(s).`);
}

async function down() {
  const { list } = await appliedSet();
  const lastName = list[list.length - 1];
  if (!lastName) {
    logger.info('Nothing to roll back.');
    return;
  }
  const migrations = await loadMigrationFiles();
  const target = migrations.find((m) => m.name === lastName);
  if (!target?.down) {
    logger.warn(`No down section for ${lastName}; only removing record.`);
  }
  logger.info(`▼ Rolling back ${lastName}`);
  await withTransaction(async (q) => {
    if (target?.down) await q(target.down);
    await q('DELETE FROM schema_migrations WHERE name = $1', [lastName]);
  });
  logger.info(`✅ Rolled back ${lastName}`);
}

async function status() {
  const migrations = await loadMigrationFiles();
  const { set } = await appliedSet();
  // eslint-disable-next-line no-console
  console.log('\nMigration status:');
  for (const m of migrations) {
    // eslint-disable-next-line no-console
    console.log(`  ${set.has(m.name) ? '✅ applied ' : '⬜ pending '} ${m.name}`);
  }
  // eslint-disable-next-line no-console
  console.log('');
}

async function main() {
  const cmd = process.argv[2] || 'up';
  await ensureMigrationsTable();
  try {
    if (cmd === 'up') await up();
    else if (cmd === 'down') await down();
    else if (cmd === 'status') await status();
    else {
      logger.error(`Unknown command: ${cmd} (use up | down | status)`);
      process.exitCode = 1;
    }
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
