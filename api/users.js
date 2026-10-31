import { database } from './_db.js';
import { ALL_DEPARTMENTS, cleanDepartments } from './_departments.js';
import { hashPassword, normalizeUsername, publicUser, requireUser, requestBody, respond, revokeSessions, sameOrigin } from './_security.js';

const MANAGERS = ['purchase_manager', 'category_manager'];
const INTERNAL_ROLES = ['buyer', 'reception', ...MANAGERS];
// gerente de categoria só alcança compradores dos seus departamentos; administrador e gerente de compras alcançam todos
function scopeOf(user) { return user.role === 'category_manager' ? (Array.isArray(user.departments) ? user.departments : []).map(Number) : null; }
function touches(departments, scope) { return !scope || (Array.isArray(departments) ? departments : []).some(code => scope.includes(Number(code))); }

function validName(value) {
  const name = String(value || '').trim();
  return name.length >= 2 && name.length <= 120 ? name : '';
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const admin = await requireUser(req, res, ['admin', ...MANAGERS]);
      if (!admin) return;
      // contas internas (os acessos de laboratório são criados sozinhos pelo código do laboratório)
      let rows = await database()`SELECT id, username, display_name, role, active, buyer_id, departments FROM app_users WHERE role <> 'supplier' ORDER BY role, display_name`;
      // gerente vê só os compradores que administra
      if (admin.role !== 'admin') rows = rows.filter(user => user.role === 'buyer' && touches(user.departments, scopeOf(admin)));
      return respond(res, 200, {
        users: rows.map(user => ({ id: user.id, username: user.username, name: user.display_name, role: user.role, active: user.active, buyerId: user.buyer_id, departments: user.departments || [] }))
      });
    }
    if (req.method === 'PATCH') {
      if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
      const admin = await requireUser(req, res, ['admin', ...MANAGERS]);
      if (!admin) return;
      const body = requestBody(req);
      const scope = scopeOf(admin);
      let target = null;
      if (admin.role !== 'admin') {
        // gerente só altera compradores da sua gerência
        [target] = await database()`SELECT role, departments FROM app_users WHERE id = ${String(body.id || '')}`;
        if (!target || target.role !== 'buyer' || !touches(target.departments, scope)) return respond(res, 404, { error: 'Comprador nao encontrado.' });
      }
      if (body.action === 'edit') {
        // nome e usuário: administrador e gerentes (nos seus compradores); perfil: só o administrador
        const id = String(body.id || '');
        const [current] = await database()`SELECT id, role, departments FROM app_users WHERE id = ${id} AND role <> 'supplier'`;
        if (!current) return respond(res, 404, { error: 'Conta nao encontrada.' });
        const name = validName(body.name);
        const username = normalizeUsername(body.username);
        if (!name || !/^[a-z0-9._-]{3,80}$/.test(username)) return respond(res, 400, { error: 'Informe nome e usuario valido (letras, numeros, ponto, hifen).' });
        let role = current.role, departments = current.departments || [];
        if (body.role != null && String(body.role) !== current.role) {
          if (admin.role !== 'admin') return respond(res, 403, { error: 'Somente o administrador altera o perfil.' });
          if (id === admin.id || current.role === 'admin') return respond(res, 400, { error: 'O perfil de administrador nao pode ser alterado.' });
          if (!INTERNAL_ROLES.includes(String(body.role))) return respond(res, 400, { error: 'Perfil invalido.' });
          role = String(body.role);
        }
        if (admin.role === 'admin' && (role !== current.role || body.departments != null)) {
          // mesmas regras do cadastro: gerente de compras tem todos; recepção nenhum
          departments = role === 'purchase_manager' ? ALL_DEPARTMENTS
            : ['buyer', 'category_manager', 'admin'].includes(role) ? cleanDepartments(body.departments != null ? body.departments : departments) : [];
          if (!departments || (['buyer', 'category_manager'].includes(role) && !departments.length)) {
            return respond(res, 400, { error: role === 'category_manager' ? 'Escolha ao menos um departamento da gerencia.' : 'Escolha ao menos um departamento do comprador.' });
          }
        }
        const [before] = await database()`SELECT username FROM app_users WHERE id = ${id}`;
        await database()`UPDATE app_users SET display_name = ${name}, username = ${username}, username_key = ${username},
          role = ${role}, departments = ${JSON.stringify(departments)}::jsonb WHERE id = ${id}`;
        // perfil ou usuário trocados: a pessoa entra de novo com o acesso novo
        if (id !== admin.id && (role !== current.role || before.username !== username)) await revokeSessions(id);
        return respond(res, 200, { ok: true, user: { id, name, username, role, departments } });
      }
      if (body.departments != null) {
        let departments = cleanDepartments(body.departments);
        if (!departments) return respond(res, 400, { error: 'Escolha ao menos um departamento valido.' });
        if (scope) {
          // gerente de categoria mexe só nos seus departamentos; os outros do comprador continuam
          if (departments.some(code => !scope.includes(code))) return respond(res, 403, { error: 'Departamento fora da sua gerencia.' });
          departments = [...new Set((target.departments || []).map(Number).filter(code => !scope.includes(code)).concat(departments))].sort((a, b) => a - b);
        }
        if (!departments.length) return respond(res, 400, { error: 'Escolha ao menos um departamento valido.' });
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

    const admin = await requireUser(req, res, ['admin', ...MANAGERS]);
    if (!admin) return;
    const name = validName(body.name);
    const username = normalizeUsername(body.username);
    const password = String(body.password || '');
    const role = String(body.role || '');
    if (!name || !/^[a-z0-9._-]{3,80}$/.test(username) || !INTERNAL_ROLES.includes(role) || password.length < 6 || password.length > 256) {
      return respond(res, 400, { error: 'Informe nome, usuario valido, perfil permitido e senha com ao menos 6 caracteres.' });
    }
    // comprador e gerente de categoria escolhem os departamentos; gerente de compras recebe todos
    const departments = role === 'purchase_manager' ? ALL_DEPARTMENTS
      : ['buyer', 'category_manager'].includes(role) ? cleanDepartments(body.departments) : [];
    if (!departments || (['buyer', 'category_manager'].includes(role) && !departments.length)) {
      return respond(res, 400, { error: role === 'category_manager' ? 'Escolha ao menos um departamento da gerencia.' : 'Escolha ao menos um departamento do comprador.' });
    }
    // gerente cadastra só compradores (o de categoria, só nos seus departamentos)
    if (admin.role !== 'admin') {
      if (role !== 'buyer') return respond(res, 403, { error: 'A gerencia cadastra somente compradores.' });
      const scope = scopeOf(admin);
      if (scope && departments.some(code => !scope.includes(code))) return respond(res, 403, { error: 'Departamento fora da sua gerencia.' });
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