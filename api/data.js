import { database } from './_db.js';
import { requireUser, requestBody, respond, sameOrigin } from './_security.js';

const STORES = new Set(['demandas', 'laboratorios', 'compras', 'historico', 'produtos', 'estoque', 'vendas', 'fornecedores', 'filiais', 'pedidos', 'config']);
const LOCAL_CONFIG = new Set(['auth', 'recepAuth', 'cloudOwner', 'backupDir', 'backupLast', 'backupLastFile', 'shareDir']);

export default async function handler(req, res) {
  try {
    const user = await requireUser(req, res, ['admin', 'buyer']);
    if (!user) return;
    const sql = database();
    if (req.method === 'GET') {
      const rows = await sql`SELECT store, record_id AS id, payload, updated_at
        FROM app_records WHERE owner_id = ${user.id} ORDER BY store, record_id`;
      return respond(res, 200, { records: rows.filter(row => !(row.store === 'config' && LOCAL_CONFIG.has(row.id))) });
    }
    if (req.method === 'POST') {
      if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
      const body = requestBody(req);
      if (body.action !== 'bulk' || !Array.isArray(body.records) || body.records.length > 5000) {
        return respond(res, 400, { error: 'Migracao invalida ou excedeu o limite de registros.' });
      }
      const records = body.records.filter(item => item && STORES.has(item.store) && item.record &&
        typeof item.record === 'object' && !Array.isArray(item.record) && String(item.record.id || '') === String(item.id || '') &&
        !(item.store === 'config' && LOCAL_CONFIG.has(String(item.id))));
      if (records.length !== body.records.length || JSON.stringify(records).length > 2000000) {
        return respond(res, 400, { error: 'A migracao contem registros invalidos ou grandes demais.' });
      }
      if (!records.length) return respond(res, 200, { imported: 0 });
      const encoded = JSON.stringify(records.map(item => ({ store: item.store, id: String(item.id), payload: item.record })));
      const result = await sql`INSERT INTO app_records (owner_id, store, record_id, payload)
        SELECT ${user.id}, incoming.store, incoming.id, incoming.payload
        FROM jsonb_to_recordset(${encoded}::jsonb) AS incoming(store text, id text, payload jsonb)
        ON CONFLICT (owner_id, store, record_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`;
      return respond(res, 200, { imported: records.length, result });
    }
    if (!['PUT', 'DELETE'].includes(req.method)) return respond(res, 405, { error: 'Metodo nao permitido.' });
    if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });

    const body = requestBody(req);
    const store = String(body.store || '');
    const id = String(body.id || '');
    if (!STORES.has(store) || (req.method !== 'DELETE' && (!id || id.length > 200))) return respond(res, 400, { error: 'Registro invalido.' });
    if (req.method === 'DELETE' && body.action === 'clear') {
      await sql`DELETE FROM app_records WHERE owner_id = ${user.id} AND store = ${store}`;
      return respond(res, 200, { ok: true });
    }
    if (!id || id.length > 200) return respond(res, 400, { error: 'Registro invalido.' });
    if (store === 'config' && LOCAL_CONFIG.has(id)) return respond(res, 403, { error: 'Configuracao local nao pode ser sincronizada.' });

    if (req.method === 'DELETE') {
      await sql`DELETE FROM app_records WHERE owner_id = ${user.id} AND store = ${store} AND record_id = ${id}`;
      return respond(res, 200, { ok: true });
    }

    if (!body.record || typeof body.record !== 'object' || Array.isArray(body.record) || String(body.record.id) !== id) {
      return respond(res, 400, { error: 'Conteudo do registro invalido.' });
    }
    const serialized = JSON.stringify(body.record);
    if (serialized.length > 500000) return respond(res, 413, { error: 'Registro excede o limite permitido.' });
    if (store === 'demandas' && body.record.data && body.record.hora && body.record.status !== 'Cancelado') {
      const date = String(body.record.data);
      const start = String(body.record.hora).slice(0, 5);
      const end = String(body.record.horaFim || body.record.hora).slice(0, 5);
      if (!/^\d{4}-\d\d-\d\d$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end < start) {
        return respond(res, 400, { error: 'Data ou horario do agendamento invalido.' });
      }
      const cfgRows = await sql`SELECT payload->'value'->>'passo' AS passo FROM app_records
        WHERE owner_id = ${user.id} AND store = 'config' AND record_id = 'fornCfg' LIMIT 1`;
      const step = Math.max(5, Number(cfgRows[0]?.passo) || 30);
      const saved = await sql`WITH slot_lock AS MATERIALIZED (
          SELECT pg_advisory_xact_lock(hashtext(${user.id}), hashtext(${date}))
        ), conflicts AS MATERIALIZED (
          SELECT record_id FROM app_records, slot_lock
          WHERE owner_id = ${user.id} AND store = 'demandas' AND record_id <> ${id}
            AND payload->>'data' = ${date} AND COALESCE(payload->>'status', '') <> 'Cancelado'
            AND COALESCE(payload->>'hora', '') < ${end}
            AND COALESCE(NULLIF(payload->>'horaFim', ''), to_char((payload->>'hora')::time + (${step} * INTERVAL '1 minute'), 'HH24:MI')) > ${start}
        )
        INSERT INTO app_records (owner_id, store, record_id, payload)
        SELECT ${user.id}, ${store}, ${id}, ${serialized}::jsonb FROM slot_lock
        WHERE NOT EXISTS (SELECT 1 FROM conflicts)
        ON CONFLICT (owner_id, store, record_id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
        RETURNING record_id`;
      if (!saved.length) return respond(res, 409, { error: 'Esse horario ja esta ocupado por outro agendamento.' });
      return respond(res, 200, { ok: true });
    }
    await sql`INSERT INTO app_records (owner_id, store, record_id, payload)
      VALUES (${user.id}, ${store}, ${id}, ${serialized}::jsonb)
      ON CONFLICT (owner_id, store, record_id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`;
    return respond(res, 200, { ok: true });
  } catch (error) {
    console.error('data endpoint failed', error);
    return respond(res, 500, { error: 'Falha ao acessar os dados compartilhados.' });
  }
}