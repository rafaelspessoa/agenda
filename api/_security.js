import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { database } from './_db.js';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'agenda_session';
const SESSION_HOURS = 12;

export function respond(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

export function requestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return {};
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export function normalizeUsername(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase();
}

export function loginRolesForProfile(profile) {
  if (profile === 'buyer') return ['buyer', 'admin'];
  if (profile === 'reception') return ['reception'];
  return [];
}

export function localDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: process.env.APP_TIME_ZONE || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function shiftDate(isoDate, amount) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(String(password), salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [scheme, salt, expectedHex] = String(encoded || '').split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(await scrypt(String(password), salt, expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export async function loginLock(key) {
  const rows = await database()`SELECT locked_until FROM app_login_limits WHERE key_hash = ${hashToken(key)} LIMIT 1`;
  const until = rows[0]?.locked_until ? new Date(rows[0].locked_until).getTime() : 0;
  return until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
}

export async function failedLogin(key) {
  await database()`INSERT INTO app_login_limits (key_hash, attempts, locked_until, updated_at)
    VALUES (${hashToken(key)}, 1, NULL, NOW())
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN app_login_limits.locked_until IS NOT NULL AND app_login_limits.locked_until <= NOW() THEN 1 ELSE app_login_limits.attempts + 1 END,
      locked_until = CASE
        WHEN app_login_limits.locked_until IS NOT NULL AND app_login_limits.locked_until <= NOW() THEN NULL
        WHEN app_login_limits.attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
        ELSE app_login_limits.locked_until
      END,
      updated_at = NOW()`;
}

export async function clearLoginFailures(key) {
  await database()`DELETE FROM app_login_limits WHERE key_hash = ${hashToken(key)}`;
}

export async function createSession(res, user, clearKey) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  // cria a sessao e limpa as tentativas falhas na mesma ida ao banco
  await database()`WITH cleared AS (DELETE FROM app_login_limits WHERE key_hash = ${hashToken(clearKey || '')})
    INSERT INTO app_sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${user.id}, ${expiresAt.toISOString()})`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_HOURS * 60 * 60}${secure}`);
}

function sessionToken(req) {
  const cookie = String(req.headers.cookie || '');
  const entry = cookie.split(';').map(item => item.trim()).find(item => item.startsWith(SESSION_COOKIE + '='));
  return entry ? decodeURIComponent(entry.slice(SESSION_COOKIE.length + 1)) : '';
}

export async function currentUser(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const rows = await database()`SELECT u.id, u.username, u.display_name, u.role, u.buyer_id, u.supplier_id
    FROM app_sessions s JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > NOW() AND u.active = TRUE`;
  return rows[0] || null;
}

export async function requireUser(req, res, roles) {
  const user = await currentUser(req);
  if (!user) { respond(res, 401, { error: 'Sessao expirada. Entre novamente.' }); return null; }
  if (roles && !roles.includes(user.role)) { respond(res, 403, { error: 'Perfil sem permissao para esta operacao.' }); return null; }
  return user;
}

export async function endSession(req, res) {
  const token = sessionToken(req);
  if (token) await database()`DELETE FROM app_sessions WHERE token_hash = ${hashToken(token)}`;
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

export function publicUser(user) {
  return { id: user.id, username: user.username, name: user.display_name, role: user.role, buyerId: user.buyer_id, supplierId: user.supplier_id };
}

export async function revokeSessions(userId) {
  await database()`DELETE FROM app_sessions WHERE user_id = ${userId}`;
}