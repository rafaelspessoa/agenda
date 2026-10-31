import { database } from './_db.js';
import { ALL_DEPARTMENTS, cleanDepartments } from './_departments.js';
import { hashPassword, normalizeUsername, publicUser, requireUser, requestBody, respond, revokeSessions, sameOrigin } from './_security.js';

function validName(value) {
  const name = String(value || '').trim();
  return name.length >= 2 && name.length <= 120 ? name : '';
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const admin = await requireUser(req, res, ['admin']);
      if (!admin) return;
      // contas internas (os acessos de laboratório são criados sozinhos pelo código do laboratório)
      const rows = await database()`SELECT id, username, display_name, role, active, buyer_id, departments FROM app_users WHERE role <> 'supplier' ORDER BY role, display_name`;
      return respond(res, 200, {
        users: rows.map(user => ({ id: user.id, username: user.username, name: user.display_name, role: user.role, active: user.active, buyerId: user.buyer_id, departments: user.departments || [] }))
      });
    }
    if (req.method === 'PATCH') {
      if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
      const admin = await requireUser(req, res, ['admin']);
      if (!admin) return;
      const body = requestBody(req);
      if (body.departments != null) {
        const departments = cleanDepartments(body.departments);
        if (!departments || !departments.length) return respond(res, 400, { error: 'Escolha ao menos um departamento valido.' });
        // gerente de compras sempre tem todos os departamentos
        const updated = await database()`UPDATE app_users SET departments = ${JSON.stringify(departments)}::jsonb
          WHERE id = ${String(body.id || '')} AND role IN ('buyer', 'admin', 'category_manager') RETURNING id`;
        return updated.length ? respond(res, 200, { ok: true, departments }) : respond(res, 404, { error: 'Comprador nao encontrado.' });
      }
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
    if (req.method !== 'POST') return respond(res, 405, { error: 'Metodo nao permitido.' });
    if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
    const body = requestBody(req);
    const sql = database();

    const admin = await requireUser(req, res, ['admin']);
    if (!admin) return;
    const name = validName(body.name);
    const username = normalizeUsername(body.username);
    const password = String(body.password || '');
    const role = String(body.role || '');
    if (!name || !/^[a-z0-9._-]{3,80}$/.test(username) || !['buyer', 'reception', 'purchase_manager', 'category_manager'].includes(role) || password.length < 6 || password.length > 256) {
      return respond(res, 400, { error: 'Informe nome, usuario valido, perfil permitido e senha com ao menos 6 caracteres.' });
    }
    // comprador e gerente de categoria escolhem os departamentos; gerente de compras recebe todos
    const departments = role === 'purchase_manager' ? ALL_DEPARTMENTS
      : ['buyer', 'category_manager'].includes(role) ? cleanDepartments(body.departments) : [];
    if (!departments || (['buyer', 'category_manager'].includes(role) && !departments.length)) {
      return respond(res, 400, { error: role === 'category_manager' ? 'Escolha ao menos um departamento da gerencia.' : 'Escolha ao menos um departamento do comprador.' });
    }
    const passwordHash = await hashPassword(password);
    const rows = await sql`INSERT INTO app_users (username, username_key, display_name, role, password_hash, departments)
      VALUES (${username}, ${username}, ${name}, ${role}, ${passwordHash}, ${JSON.stringify(departments)}::jsonb)
      RETURNING id, username, display_name, role, buyer_id, supplier_id, departments`;
    return respond(res, 201, { user: publicUser(rows[0]) });
  } catch (error) {
    if (error.code === '23505') return respond(res, 409, { error: 'Ja existe uma conta ou convite com esse usuario.' });
    console.error('users endpoint failed', error);
    return respond(res, 500, { error: 'Falha ao criar acesso.' });
  }
}