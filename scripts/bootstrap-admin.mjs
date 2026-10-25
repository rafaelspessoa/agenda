import dotenv from 'dotenv';
import { closeDatabase, database } from '../api/_db.js';
import { hashPassword, normalizeUsername } from '../api/_security.js';

dotenv.config({ path: '.env.local' });

const username = normalizeUsername(process.env.APP_ADMIN_USERNAME);
const name = String(process.env.APP_ADMIN_NAME || '').trim();
const password = process.env.APP_ADMIN_PASSWORD || '';

if (!username || !/^[a-z0-9._-]{3,80}$/.test(username) || name.length < 2 || password.length < 12) {
  throw new Error('Defina APP_ADMIN_USERNAME, APP_ADMIN_NAME e APP_ADMIN_PASSWORD (minimo 12 caracteres) no ambiente.');
}

try {
  const sql = database();
  const existing = await sql`SELECT id FROM app_users WHERE role = 'admin' LIMIT 1`;
  if (existing.length) throw new Error('Ja existe um administrador. O bootstrap inicial foi bloqueado.');

  await sql`INSERT INTO app_users (username, username_key, display_name, role, password_hash)
    VALUES (${username}, ${username}, ${name}, 'admin', ${await hashPassword(password)})`;
  console.log('Administrador inicial criado. Remova APP_ADMIN_PASSWORD do ambiente de execucao.');
} finally {
  await closeDatabase();
}