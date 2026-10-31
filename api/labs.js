import { randomUUID } from 'node:crypto';
import { database } from './_db.js';
import { clientId, notify, topics } from './_realtime.js';
import { normalizeSupplierCode, requireUser, requestBody, respond, revokeSessions, sameOrigin } from './_security.js';

// Laboratórios compartilhados: todos os compradores veem e cadastram; só o administrador edita ou exclui.
// Cada comprador escolhe os laboratórios com que trabalha (lab_buyers) — o laboratório só agenda com eles.
// O código do laboratório é único e é o acesso dele à área do fornecedor.
const FIELDS = ['nome', 'codigo', 'uf', 'representante', 'telefone', 'obs', 'criadoEm', 'atualizadoEm'];
const LIMITS = { nome: 160, codigo: 40, uf: 2, representante: 160, telefone: 60, obs: 2000, criadoEm: 40, atualizadoEm: 40 };

function clean(input, id) {
  const lab = { id };
  for (const field of FIELDS) {
    if (input[field] == null) continue;
    lab[field] = String(input[field]).trim().slice(0, LIMITS[field]);
  }
  return lab;
}

function toClient(row) { return Object.assign({}, row.payload, { id: row.id, meu: !!row.meu }); }

export default async function handler(req, res) {
  try {
    const user = await requireUser(req, res, ['admin', 'buyer', 'purchase_manager', 'category_manager']);
    if (!user) return;
    const sql = database();
    const avisar = () => notify([topics.labs()], clientId(req));
    const one = async id => (await sql`SELECT l.id, l.payload, EXISTS (SELECT 1 FROM lab_buyers lb WHERE lb.lab_id = l.id AND lb.buyer_id = ${user.id}) AS meu
      FROM labs l WHERE l.id = ${id}`)[0];

    if (req.method === 'GET') {
      const rows = await sql`SELECT l.id, l.payload, (lb.buyer_id IS NOT NULL) AS meu
        FROM labs l LEFT JOIN lab_buyers lb ON lb.lab_id = l.id AND lb.buyer_id = ${user.id}
        ORDER BY lower(l.payload->>'nome')`;
      return respond(res, 200, { labs: rows.map(toClient) });
    }
    if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
    const body = requestBody(req);
    const isAdmin = user.role === 'admin';

    // "adicionar aos meus" / "remover dos meus": não altera o cadastro, só o vínculo do comprador
    if (req.method === 'POST' && (body.action === 'link' || body.action === 'unlink')) {
      const id = String(body.id || '');
      if (!(await one(id))) return respond(res, 404, { error: 'Laboratorio nao encontrado.' });
      if (body.action === 'link') await sql`INSERT INTO lab_buyers (lab_id, buyer_id) VALUES (${id}, ${user.id}) ON CONFLICT DO NOTHING`;
      else {
        await sql`DELETE FROM lab_buyers WHERE lab_id = ${id} AND buyer_id = ${user.id}`;
        // o laboratório deixa de agendar com este comprador
        const access = await sql`UPDATE app_users SET active = FALSE WHERE role = 'supplier' AND supplier_id = ${id} AND buyer_id = ${user.id} RETURNING id`;
        for (const row of access) await revokeSessions(row.id);
      }
      await avisar();
      return respond(res, 200, { lab: toClient(await one(id)) });
    }

    if (req.method === 'POST' && body.action === 'bulk') {
      // importação de planilha: cria os novos e adiciona todos aos laboratórios de quem importou;
      // atualizar o cadastro dos que já existem só o administrador
      if (!Array.isArray(body.labs) || body.labs.length > 5000) return respond(res, 400, { error: 'Importacao invalida.' });
      const existing = new Map((await sql`SELECT id, code_key FROM labs WHERE code_key IS NOT NULL`).map(row => [row.code_key, row.id]));
      const create = [], update = [], link = [], seen = new Set();
      let skipped = 0;
      for (const item of body.labs) {
        const key = normalizeSupplierCode(item && item.codigo);
        if (!item || !String(item.nome || '').trim() || !key || key.length > 32 || seen.has(key)) { skipped++; continue; }
        seen.add(key);
        const id = existing.get(key);
        if (id) { link.push(id); if (isAdmin) update.push({ id, key, payload: clean(item, id) }); }
        else { const newId = String(item.id || randomUUID()).slice(0, 80); create.push({ id: newId, key, payload: clean(item, newId) }); link.push(newId); }
      }
      if (create.length) {
        await sql`INSERT INTO labs (id, code_key, payload, created_by)
          SELECT x.id, x.key, x.payload, ${user.id} FROM jsonb_to_recordset(${JSON.stringify(create)}::jsonb) AS x(id text, key text, payload jsonb)
          ON CONFLICT DO NOTHING`;
      }
      if (update.length) {
        await sql`UPDATE labs SET payload = labs.payload || x.payload, updated_at = NOW()
          FROM jsonb_to_recordset(${JSON.stringify(update)}::jsonb) AS x(id text, key text, payload jsonb) WHERE labs.id = x.id`;
      }
      if (link.length) {
        await sql`INSERT INTO lab_buyers (lab_id, buyer_id)
          SELECT x.id, ${user.id} FROM jsonb_to_recordset(${JSON.stringify(link.map(id => ({ id })))}::jsonb) AS x(id text)
          WHERE EXISTS (SELECT 1 FROM labs l WHERE l.id = x.id)
          ON CONFLICT DO NOTHING`;
      }
      await avisar();
      return respond(res, 200, { created: create.length, updated: update.length, linked: link.length - create.length, skipped });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const input = body.lab && typeof body.lab === 'object' ? body.lab : null;
      if (!input || !String(input.nome || '').trim()) return respond(res, 400, { error: 'Informe o nome do laboratorio.' });
      const key = normalizeSupplierCode(input.codigo);
      if (!key || key.length > 32) return respond(res, 400, { error: 'Informe o codigo do laboratorio (letras e numeros, ate 32).' });
      const id = String(input.id || (req.method === 'POST' ? randomUUID() : '')).slice(0, 80);
      if (req.method === 'PUT' && !isAdmin) return respond(res, 403, { error: 'Somente o administrador edita laboratorios.' });
      const [dup] = await sql`SELECT id, payload->>'nome' AS nome FROM labs WHERE code_key = ${key} AND id <> ${id} LIMIT 1`;
      // código já cadastrado: devolve o laboratório para a tela oferecer "adicionar aos meus"
      if (dup) return respond(res, 409, { error: `O codigo ${key} ja pertence ao laboratorio ${dup.nome}.`, existing: { id: dup.id, nome: dup.nome } });
      const payload = JSON.stringify(clean(input, id));
      if (req.method === 'POST') {
        const rows = await sql`INSERT INTO labs (id, code_key, payload, created_by) VALUES (${id}, ${key}, ${payload}::jsonb, ${user.id})
          ON CONFLICT (id) DO NOTHING RETURNING id`;
        if (!rows.length) return respond(res, 409, { error: 'Laboratorio ja cadastrado.' });
        await sql`INSERT INTO lab_buyers (lab_id, buyer_id) VALUES (${id}, ${user.id}) ON CONFLICT DO NOTHING`;
      } else {
        const [old] = await sql`SELECT code_key FROM labs WHERE id = ${id}`;
        const rows = await sql`UPDATE labs SET code_key = ${key}, payload = ${payload}::jsonb, updated_at = NOW() WHERE id = ${id} RETURNING id`;
        if (!rows.length) return respond(res, 404, { error: 'Laboratorio nao encontrado.' });
        // código trocado: quem entrou com o código antigo precisa entrar de novo
        if (old && old.code_key !== key) {
          const access = await sql`SELECT id FROM app_users WHERE role = 'supplier' AND supplier_id = ${id}`;
          for (const row of access) await revokeSessions(row.id);
        }
      }
      await avisar();
      return respond(res, req.method === 'POST' ? 201 : 200, { lab: toClient(await one(id)) });
    }

    if (req.method === 'DELETE') {
      if (!isAdmin) return respond(res, 403, { error: 'Somente o administrador exclui laboratorios.' });
      const id = String(body.id || '');
      const rows = await sql`DELETE FROM labs WHERE id = ${id} RETURNING id`;
      if (!rows.length) return respond(res, 404, { error: 'Laboratorio nao encontrado.' });
      // o acesso do laboratório à área do fornecedor deixa de existir
      const access = await sql`UPDATE app_users SET active = FALSE WHERE role = 'supplier' AND supplier_id = ${id} RETURNING id`;
      for (const row of access) await revokeSessions(row.id);
      await avisar();
      return respond(res, 200, { ok: true });
    }
    return respond(res, 405, { error: 'Metodo nao permitido.' });
  } catch (error) {
    if (error.code === '23505') return respond(res, 409, { error: 'Ja existe um laboratorio com esse codigo.' });
    console.error('labs endpoint failed', error);
    return respond(res, 500, { error: 'Falha ao acessar os laboratorios.' });
  }
}
