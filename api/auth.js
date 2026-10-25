import { database } from './_db.js';
import { clearLoginFailures, createSession, currentUser, endSession, failedLogin, hashToken, loginLock, loginRolesForProfile, normalizeUsername, publicUser, requestBody, respond, sameOrigin, verifyPassword } from './_security.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const user = await currentUser(req);
      return user ? respond(res, 200, { user: publicUser(user) }) : respond(res, 401, { error: 'Entre para continuar.' });
    }
    if (req.method !== 'POST') return respond(res, 405, { error: 'Metodo nao permitido.' });
    if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });

    const body = requestBody(req);
    if (body.action === 'logout') {
      await endSession(req, res);
      return respond(res, 200, { ok: true });
    }

    const sql = database();
    let user;
    if (body.role === 'supplier') {
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 8 || code.length > 32) return respond(res, 401, { error: 'Codigo de fornecedor invalido.' });
      const rateKey = 'supplier:' + code;
      const retry = await loginLock(rateKey);
      if (retry) return respond(res, 429, { error: `Muitas tentativas. Tente novamente em ${retry} segundos.` });
      const rows = await sql`SELECT id, username, display_name, role, buyer_id, supplier_id
        FROM app_users WHERE supplier_code_hash = ${hashToken(code)} AND active = TRUE LIMIT 1`;
      user = rows[0];
      if (!user) await failedLogin(rateKey);
      else await clearLoginFailures(rateKey);
    } else {
      const username = normalizeUsername(body.username);
      const expectedRole = String(body.role || '');
      const allowedRoles = loginRolesForProfile(expectedRole);
      if (username.length < 2 || username.length > 80 || String(body.password || '').length > 256) {
        return respond(res, 400, { error: 'Informe usuario e senha validos.' });
      }
      if (!allowedRoles.length) return respond(res, 400, { error: 'Perfil de acesso invalido.' });
      const rateKey = expectedRole + ':' + username;
      const retry = await loginLock(rateKey);
      if (retry) return respond(res, 429, { error: `Muitas tentativas. Tente novamente em ${retry} segundos.` });
      const rows = await sql`SELECT id, username, display_name, role, buyer_id, supplier_id, password_hash
        FROM app_users WHERE username_key = ${username} AND role = ANY(${allowedRoles}) AND active = TRUE LIMIT 1`;
      const candidate = rows[0];
      if (candidate && allowedRoles.includes(candidate.role) && await verifyPassword(body.password, candidate.password_hash)) user = candidate;
      if (!user) await failedLogin(rateKey);
      else await clearLoginFailures(rateKey);
    }

    if (!user) return respond(res, 401, { error: 'Usuario, senha ou codigo incorretos.' });
    await createSession(res, user);
    return respond(res, 200, { user: publicUser(user) });
  } catch (error) {
    console.error('auth endpoint failed', error);
    return respond(res, 500, { error: 'Falha ao autenticar. Verifique a configuracao do servidor.' });
  }
}