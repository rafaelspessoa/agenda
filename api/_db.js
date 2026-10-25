import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
let pool;

export function compileSql(parts, values) {
  if (parts.length !== values.length + 1) throw new TypeError('SQL template invalido.');
  let text = parts[0];
  values.forEach((_, index) => { text += `$${index + 1}` + parts[index + 1]; });
  return { text, values };
}

export function databaseSsl() {
  let ca = String(process.env.SUPABASE_DB_CA || '').replace(/\\n/g, '\n').trim();
  if (!ca) {
    try { ca = readFileSync(new URL('../prod-ca-2021.crt', import.meta.url), 'utf8').trim(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!ca.startsWith('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    throw new Error('Configure SUPABASE_DB_CA ou disponibilize prod-ca-2021.crt com a CA raiz do Supabase.');
  }
  return { ca, rejectUnauthorized: true };
}

export function database() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error('SUPABASE_DB_URL nao configurada.');
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: databaseSsl()
    });
    pool.on('error', error => console.error('Supabase PostgreSQL pool error', error));
  }
  return (parts, ...values) => pool.query(compileSql(parts, values)).then(result => result.rows);
}

export async function closeDatabase() {
  if (!pool) return;
  const activePool = pool;
  pool = null;
  await activePool.end();
}