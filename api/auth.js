import { database } from './_db.js';
import { createSession, currentUser, endSession, failedLogin, hashToken, loginRolesForProfile, normalizeUsername, publicUser, requestBody, respond, sameOrigin, verifyPassword } from './_security.js';

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
    let user, rateKey;
    // bloqueio por tentativas e conta sao consultados na mesma ida ao banco
    const retryIn = row => {
      const until = row?.locked_until ? new Date(row.locked_until).getTime() : 0;
      return until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
    };
    if (body.role === 'supplier') {
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 8 || code.length > 32) return respond(res, 401, { error: 'Codigo de fornecedor invalido.' });
      rateKey = 'supplier:' + code;
      const [row] = await sql`SELECT l.locked_until, u.id, u.username, u.display_name, u.role, u.buyer_id, u.supplier_id
        FROM (SELECT 1) AS one
        LEFT JOIN app_login_limits l ON l.key_hash = ${hashToken(rateKey)}
        LEFT JOIN LATERAL (SELECT * FROM app_users WHERE supplier_code_hash = ${hashToken(code)} AND active = TRUE LIMIT 1) u ON TRUE`;
      const retry = retryIn(row);
      if (retry) return respond(res, 429, { error: `Muitas tentativas. Tente novamente em ${retry} segundos.` });
      if (row.id) user = row;
      else await failedLogin(rateKey);
    } else {
      const username = normalizeUsername(body.username);
      const expectedRole = String(body.role || '');
      const allowedRoles = loginRolesForProfile(expectedRole);
      if (username.length < 2 || username.length > 80 || String(body.password || '').length > 256) {
        return respond(res, 400, { error: 'Informe usuario e senha validos.' });
      }
      if (!allowedRoles.length) return respond(res, 400, { error: 'Perfil de acesso invalido.' });
      rateKey = expectedRole + ':' + username;
      const [row] = await sql`SELECT l.locked_until, u.id, u.username, u.display_name, u.role, u.buyer_id, u.supplier_id, u.password_hash
        FROM (SELECT 1) AS one
        LEFT JOIN app_login_limits l ON l.key_hash = ${hashToken(rateKey)}
        LEFT JOIN LATERAL (SELECT * FROM app_users WHERE username_key = ${username} AND role = ANY(${allowedRoles}) AND active = TRUE LIMIT 1) u ON TRUE`;
      const retry = retryIn(row);
      if (retry) return respond(res, 429, { error: `Muitas tentativas. Tente novamente em ${retry} segundos.` });
      if (row.id && allowedRoles.includes(row.role) && await verifyPassword(body.password, row.password_hash)) user = row;
      else await failedLogin(rateKey);
    }

    if (!user) return respond(res, 401, { error: 'Usuario, senha ou codigo incorretos.' });
    await createSession(res, user, rateKey);
    return respond(res, 200, { user: publicUser(user) });
  } catch (error) {
    console.error('auth endpoint failed', error);
    return respond(res, 500, { error: 'Falha ao autenticar. Verifique a configuracao do servidor.' });
  }
}