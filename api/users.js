import { randomBytes } from 'node:crypto';
import { database } from './_db.js';
import { hashPassword, hashToken, normalizeSupplierCode, normalizeUsername, publicUser, requireUser, requestBody, respond, revokeSessions, sameOrigin } from './_security.js';

function validName(value) {
  const name = String(value || '').trim();
  return name.length >= 2 && name.length <= 120 ? name : '';
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const admin = await requireUser(req, res, ['admin']);
      if (!admin) return;
      const [rows, suppliers] = await Promise.all([
        database()`SELECT id, username, display_name, role, active, buyer_id FROM app_users ORDER BY role, display_name`,
        database()`SELECT s.supplier_id AS id, s.name, s.buyer_id AS "buyerId", buyer.display_name AS "buyerName", s.industries, s.active
          FROM suppliers s JOIN app_users buyer ON buyer.id = s.buyer_id
          WHERE buyer.role IN ('buyer', 'admin')
          ORDER BY buyer.display_name, s.name`
      ]);
      return respond(res, 200, {
        users: rows.map(user => ({ id: user.id, username: user.username, name: user.display_name, role: user.role, active: user.active, buyerId: user.buyer_id })),
        suppliers: suppliers.map(supplier => ({ id: supplier.id, name: supplier.name, buyerId: supplier.buyerId, buyerName: supplier.buyerName, industries: supplier.industries, active: supplier.active }))
      });
    }
    if (req.method === 'PATCH') {
      if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
      const admin = await requireUser(req, res, ['admin']);
      if (!admin) return;
      const body = requestBody(req);
      if (!body.id || body.id === admin.id) return respond(res, 400, { error: 'Conta invalida.' });
      let rows;
      if (body.password != null) {
        const password = String(body.password);
        if (password.length < 6 || password.length > 256) return respond(res, 400, { error: 'A senha deve ter entre 6 e 256 caracteres.' });
        rows = await database()`UPDATE app_users SET password_hash = ${await hashPassword(password)}
          WHERE id = ${String(body.id)} AND active = TRUE AND role <> 'supplier' RETURNING id`;
      } else {
        rows = await database()`UPDATE app_users SET active = ${body.active === true}
          WHERE id = ${String(body.id)} RETURNING id`;
      }
      if (!rows.length) return respond(res, 404, { error: 'Conta nao encontrada.' });
      if (body.password != null || body.active !== true) await revokeSessions(String(body.id));
      return respond(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
      const buyer = await requireUser(req, res, ['buyer', 'admin']);
      if (!buyer) return;
      const body = requestBody(req);
      const rows = await database()`UPDATE app_users SET active = FALSE
        WHERE role = 'supplier' AND buyer_id = ${buyer.id} AND supplier_id = ${String(body.supplierId || '')}
        RETURNING id`;
      for (const row of rows) await revokeSessions(row.id);
      return respond(res, 200, { ok: true });
    }
    if (req.method !== 'POST') return respond(res, 405, { error: 'Metodo nao permitido.' });
    if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
    const body = requestBody(req);
    const sql = database();

    if (body.action === 'supplier') {
      const buyer = await requireUser(req, res, ['buyer', 'admin']);
      if (!buyer) return;
      const name = validName(body.name);
      const supplierId = String(body.supplierId || '').trim();
      // o acesso usa o código interno do fornecedor, informado no cadastro
      const code = normalizeSupplierCode(body.code);
      if (!name || !supplierId || supplierId.length > 120) return respond(res, 400, { error: 'Fornecedor invalido.' });
      if (!code || code.length > 32) return respond(res, 400, { error: 'Informe o codigo do fornecedor (letras e numeros, ate 32).' });
      const records = await sql`SELECT payload FROM app_records WHERE owner_id = ${buyer.id} AND store = 'config' AND record_id = 'fornecedores' LIMIT 1`;
      const supplier = (records[0]?.payload?.value || []).find(item => String(item.id) === supplierId);
      if (!supplier) return respond(res, 404, { error: 'Cadastre o fornecedor antes de gerar o acesso.' });
      const repetido = await sql`SELECT 1 FROM app_users WHERE role = 'supplier' AND active = TRUE AND buyer_id = ${buyer.id}
        AND supplier_code_hash = ${hashToken(code)} AND supplier_id <> ${supplierId} LIMIT 1`;
      if (repetido.length) return respond(res, 409, { error: 'Voce ja tem outro fornecedor com esse codigo.' });
      const username = 'forn_' + randomBytes(6).toString('hex');
      const rows = await sql`INSERT INTO app_users (username, username_key, display_name, role, buyer_id, supplier_id, supplier_code_hash)
        VALUES (${username}, ${username}, ${name}, 'supplier', ${buyer.id}, ${supplierId}, ${hashToken(code)})
        ON CONFLICT (buyer_id, supplier_id) WHERE role = 'supplier'
        DO UPDATE SET username = EXCLUDED.username, username_key = EXCLUDED.username_key,
          display_name = EXCLUDED.display_name, supplier_code_hash = EXCLUDED.supplier_code_hash, active = TRUE
        RETURNING id, username, display_name, role, buyer_id, supplier_id`;
      await revokeSessions(rows[0].id);
      return respond(res, 201, { user: publicUser(rows[0]), code });
    }

    const admin = await requireUser(req, res, ['admin']);
    if (!admin) return;
    const name = validName(body.name);
    const username = normalizeUsername(body.username);
    const password = String(body.password || '');
    const role = String(body.role || '');
    if (!name || !/^[a-z0-9._-]{3,80}$/.test(username) || !['buyer', 'reception'].includes(role) || password.length < 6 || password.length > 256) {
      return respond(res, 400, { error: 'Informe nome, usuario valido, perfil permitido e senha com ao menos 6 caracteres.' });
    }
    const passwordHash = await hashPassword(password);
    const rows = await sql`INSERT INTO app_users (username, username_key, display_name, role, password_hash)
      VALUES (${username}, ${username}, ${name}, ${role}, ${passwordHash})
      RETURNING id, username, display_name, role, buyer_id, supplier_id`;
    return respond(res, 201, { user: publicUser(rows[0]) });
  } catch (error) {
    if (error.code === '23505') return respond(res, 409, { error: 'Ja existe uma conta ou convite com esse usuario.' });
    console.error('users endpoint failed', error);
    return respond(res, 500, { error: 'Falha ao criar acesso.' });
  }
}