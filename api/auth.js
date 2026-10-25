import { database } from './_db.js';
import { realtimeConfig } from './_realtime.js';
import { clientIp, createSession, currentUser, endSession, failedLogin, hashToken, loginRolesForProfile, normalizeSupplierCode, normalizeUsername, publicUser, requestBody, respond, sameOrigin, verifyPassword } from './_security.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const user = await currentUser(req);
      return user ? respond(res, 200, { user: publicUser(user), realtime: realtimeConfig(user) }) : respond(res, 401, { error: 'Entre para continuar.' });
    }
    if (req.method !== 'POST') return respond(res, 405, { error: 'Metodo nao permitido.' });
    if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });

    const body = requestBody(req);
    if (body.action === 'logout') {
      await endSession(req, res);
      return respond(res, 200, { ok: true });
    }

    const sql = database();
    // fornecedor que atende mais de um comprador troca de comprador sem digitar o código de novo
    if (body.action === 'switch-buyer') {
      const current = await currentUser(req);
      if (!current || current.role !== 'supplier') return respond(res, 401, { error: 'Entre para continuar.' });
      const [target] = await sql`SELECT u.id, u.username, u.display_name, u.role, u.buyer_id, u.supplier_id
        FROM app_users me JOIN app_users u ON u.supplier_code_hash = me.supplier_code_hash
        JOIN app_users b ON b.id = u.buyer_id AND b.active = TRUE
        WHERE me.id = ${current.id} AND me.supplier_code_hash IS NOT NULL
          AND u.id = ${String(body.userId || '')} AND u.role = 'supplier' AND u.active = TRUE`;
      if (!target) return respond(res, 404, { error: 'Comprador nao encontrado para este codigo.' });
      await endSession(req, res);
      await createSession(res, target);
      return respond(res, 200, { user: publicUser(target), realtime: realtimeConfig(target) });
    }
    let user, rateKey;
    // bloqueio por tentativas e conta sao consultados na mesma ida ao banco
    const retryIn = row => {
      const until = row?.locked_until ? new Date(row.locked_until).getTime() : 0;
      return until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
    };
    if (body.role === 'supplier') {
      // o código é o código interno do fornecedor, cadastrado pelo comprador
      const code = normalizeSupplierCode(body.code);
      if (!code || code.length > 32) return respond(res, 401, { error: 'Codigo de fornecedor invalido.' });
      rateKey = 'supplier:' + code;
      // limite também por conexão: códigos internos são curtos e poderiam ser testados um a um
      const ipKey = 'supplier-ip:' + clientIp(req);
      const [row] = await sql`SELECT
          (SELECT max(locked_until) FROM app_login_limits WHERE key_hash IN (${hashToken(rateKey)}, ${hashToken(ipKey)})) AS locked_until,
          COALESCE((SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'role', u.role,
              'buyer_id', u.buyer_id, 'supplier_id', u.supplier_id, 'buyer_name', b.display_name) ORDER BY b.display_name)
            FROM app_users u JOIN app_users b ON b.id = u.buyer_id AND b.active = TRUE
            WHERE u.role = 'supplier' AND u.active = TRUE AND u.supplier_code_hash = ${hashToken(code)}), '[]'::json) AS candidates`;
      const retry = retryIn(row);
      if (retry) return respond(res, 429, { error: `Muitas tentativas. Tente novamente em ${retry} segundos.` });
      const candidates = row.candidates || [];
      if (!candidates.length) { await failedLogin(rateKey); await failedLogin(ipKey, 20); }
      else if (body.userId) user = candidates.find(item => item.id === String(body.userId));
      else if (candidates.length === 1) user = candidates[0];
      // mesmo código cadastrado por mais de um comprador: o fornecedor escolhe com quem agendar
      else return respond(res, 200, { choose: candidates.map(item => ({ userId: item.id, buyerName: item.buyer_name })) });
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
    return respond(res, 200, { user: publicUser(user), realtime: realtimeConfig(user) });
  } catch (error) {
    console.error('auth endpoint failed', error);
    return respond(res, 500, { error: 'Falha ao autenticar. Verifique a configuracao do servidor.' });
  }
}