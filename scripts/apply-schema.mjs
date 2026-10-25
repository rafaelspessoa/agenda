import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { databaseSsl } from '../api/_db.js';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error('SUPABASE_DB_URL nao definida. Configure-a em .env.local antes de aplicar o esquema.');
}

const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
  ssl: databaseSsl()
});

try {
  await pool.query('SELECT 1');
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);

  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name
  `, [['app_users', 'app_sessions', 'app_login_limits', 'app_records', 'suppliers', 'appointments']]);

  const tables = result.rows.map(row => row.table_name);
  if (tables.length !== 6) throw new Error('O esquema foi executado, mas nem todas as tabelas esperadas foram encontradas.');
  console.log('Conexao Supabase validada. Tabelas prontas: ' + tables.join(', '));
} finally {
  await pool.end();
}