import { randomBytes } from 'node:crypto';
import { database } from './_db.js';
import { realtimeConfig } from './_realtime.js';
import { clientIp, createSession, currentUser, endSession, failedLogin, hashToken, loginRolesForProfile, normalizeSupplierCode, normalizeUsername, publicUser, requestBody, respond, sameOrigin, verifyPassword } from './_security.js';

// acesso do laboratório na agenda de um comprador: conta interna de fornecedor ligada ao par laboratório + comprador
async function supplierAccess(sql, lab, buyerId, code) {
  const username = 'forn_' + randomBytes(6).toString('hex');
  const [row] = await sql`INSERT INTO app_users (username, username_key, display_name, role, buyer_id, supplier_id, supplier_code_hash)
    VALUES (${username}, ${username}, ${String(lab.nome || 'Laboratorio').slice(0, 120)}, 'supplier', ${buyerId}, ${lab.id}, ${hashToken(code)})
    ON CONFLICT (buyer_id, supplier_id) WHERE role = 'supplier'
    DO UPDATE SET display_name = EXCLUDED.display_name, supplier_code_hash = EXCLUDED.supplier_code_hash, active = TRUE
    RETURNING id, username, display_name, role, buyer_id, supplier_id`;
  return row;
}

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
    // laboratório que já entrou troca de comprador sem digitar o código de novo
    if (body.action === 'switch-buyer') {
      const current = await currentUser(req);
      if (!current || current.role !== 'supplier') return respond(res, 401, { error: 'Entre para continuar.' });
      const [row] = await sql`SELECT
          (SELECT json_build_object('id', id, 'nome', payload->>'nome', 'code', code_key) FROM labs WHERE id = ${current.supplier_id} AND code_key IS NOT NULL) AS lab,
          (SELECT u.id FROM app_users u JOIN lab_buyers lb ON lb.buyer_id = u.id AND lb.lab_id = ${current.supplier_id}
            WHERE u.id = ${String(body.buyerId || '')} AND u.role IN ('buyer', 'admin', 'purchase_manager', 'category_manager') AND u.active = TRUE) AS buyer`;
      if (!row.lab) return respond(res, 403, { error: 'Acesso do laboratorio revogado.' });
      if (!row.buyer) return respond(res, 404, { error: 'Comprador nao encontrado.' });
      const target = await supplierAccess(sql, row.lab, row.buyer, row.lab.code);
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
      // o acesso do laboratório é o código dele no cadastro de laboratórios
      const code = normalizeSupplierCode(body.code);
      if (!code || code.length > 32) return respond(res, 401, { error: 'Codigo de fornecedor invalido.' });
      rateKey = 'supplier:' + code;
      // limite também por conexão: códigos são curtos e poderiam ser testados um a um
      const ipKey = 'supplier-ip:' + clientIp(req);
      const [row] = await sql`SELECT
          (SELECT max(locked_until) FROM app_login_limits WHERE key_hash IN (${hashToken(rateKey)}, ${hashToken(ipKey)})) AS locked_until,
          (SELECT json_build_object('id', id, 'nome', payload->>'nome') FROM labs WHERE code_key = ${code}) AS lab,
          -- só os compradores que têm este laboratório em "meus laboratórios"
          COALESCE((SELECT json_agg(json_build_object('buyerId', u.id, 'buyerName', u.display_name, 'departments', u.departments) ORDER BY u.display_name)
            FROM labs l JOIN lab_buyers lb ON lb.lab_id = l.id JOIN app_users u ON u.id = lb.buyer_id
            WHERE l.code_key = ${code} AND u.role IN ('buyer', 'admin', 'purchase_manager', 'category_manager') AND u.active = TRUE), '[]'::json) AS buyers`;
      const retry = retryIn(row);
      if (retry) return respond(res, 429, { error: `Muitas tentativas. Tente novamente em ${retry} segundos.` });
      const buyers = row.buyers || [];
      if (!row.lab) { await failedLogin(rateKey); await failedLogin(ipKey, 20); }
      else {
        // o laboratório escolhe com qual comprador agendar (direto se só houver um)
        const buyer = body.buyerId ? buyers.find(item => item.buyerId === String(body.buyerId)) : buyers.length === 1 ? buyers[0] : null;
        if (!buyers.length) return respond(res, 409, { error: 'Este laboratorio ainda nao esta vinculado a nenhum comprador.' });
        if (!buyer) return respond(res, 200, { choose: buyers, lab: row.lab.nome });
        user = await supplierAccess(sql, row.lab, buyer.buyerId, code);
      }
    } else {
      const username = normalizeUsername(body.username);
      const expectedRole = String(body.role || '');
      const allowedRoles = loginRolesForProfile(expectedRole);
      if (username.length < 2 || username.length > 80 || String(body.password || '').length > 256) {
        return respond(res, 400, { error: 'Informe usuario e senha validos.' });
      }
      if (!allowedRoles.length) return respond(res, 400, { error: 'Perfil de acesso invalido.' });
      rateKey = expectedRole + ':' + username;
      const [row] = await sql`SELECT l.locked_until, u.id, u.username, u.display_name, u.role, u.buyer_id, u.supplier_id, u.departments, u.password_hash
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