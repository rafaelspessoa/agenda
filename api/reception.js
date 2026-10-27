import { database } from './_db.js';
import { clientId, notify, topics } from './_realtime.js';
import { localDate, requireUser, requestBody, respond, sameOrigin, shiftDate } from './_security.js';

const ATTENDANCE_FIELDS = new Set(['chegouEm', 'iniciouEm', 'finalizouEm', 'avisoEm', 'avisoVistoEm']);

export default async function handler(req, res) {
  try {
    const user = await requireUser(req, res, ['reception']);
    if (!user) return;
    const sql = database();
    if (req.method === 'GET') {
      const fromDate = shiftDate(localDate(), -1);
      const toDate = shiftDate(localDate(), 120);
      const rows = await sql`SELECT r.owner_id AS "buyerId", u.display_name AS "buyerName", u.departments AS "buyerDepartments", r.record_id AS id,
        jsonb_strip_nulls(jsonb_build_object(
          'id', r.record_id, 'data', r.payload->'data', 'hora', r.payload->'hora', 'horaFim', r.payload->'horaFim',
          'titulo', r.payload->'titulo', 'fornNome', r.payload->'fornNome', 'assunto', r.payload->'assunto',
          'status', r.payload->'status', 'chegouEm', r.payload->'chegouEm', 'iniciouEm', r.payload->'iniciouEm',
          'finalizouEm', r.payload->'finalizouEm', 'avisoEm', r.payload->'avisoEm', 'avisoVistoEm', r.payload->'avisoVistoEm',
          'agendadoPor', r.payload->'agendadoPor', 'atend', r.payload->'atend', 'industrias', r.payload->'industrias'
        )) AS appointment
        FROM app_records r JOIN app_users u ON u.id = r.owner_id
        WHERE r.store = 'demandas' AND u.role IN ('buyer', 'admin') AND u.active = TRUE
          -- mesma regra da tela (naRecepcao): atendimentos de fornecedor e qualquer agendamento com horario
          AND (r.payload->>'atend' = 'true' OR COALESCE(r.payload->>'hora', '') <> '')
          AND COALESCE(r.payload->>'status', '') <> 'Cancelado'
          AND r.payload->>'data' BETWEEN ${fromDate} AND ${toDate}
        ORDER BY r.payload->>'data', r.payload->>'hora' LIMIT 1000`;
      return respond(res, 200, { appointments: rows });
    }
    if (req.method !== 'PATCH') return respond(res, 405, { error: 'Metodo nao permitido.' });
    if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
    const body = requestBody(req);
    const buyerId = String(body.buyerId || '');
    const id = String(body.id || '');
    // várias marcações (ex.: chegada + aviso) numa única gravação; mantém o formato antigo field/value
    const changes = body.changes && typeof body.changes === 'object' && !Array.isArray(body.changes)
      ? body.changes : { [String(body.field || '')]: body.value };
    const entries = Object.entries(changes).map(([field, value]) => [field, value == null ? null : String(value)]);
    if (!buyerId || !id || !entries.length || entries.some(([field, value]) => !ATTENDANCE_FIELDS.has(field) || (value && !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value)))) {
      return respond(res, 400, { error: 'Atualizacao de atendimento invalida.' });
    }
    const patch = JSON.stringify(Object.fromEntries(entries));
    const rows = await sql`UPDATE app_records SET payload = payload || ${patch}::jsonb, updated_at = NOW()
      WHERE owner_id = ${buyerId} AND store = 'demandas' AND record_id = ${id}
        AND (payload->>'atend' = 'true' OR COALESCE(payload->>'hora', '') <> '') RETURNING record_id`;
    if (!rows.length) return respond(res, 404, { error: 'Atendimento nao encontrado.' });
    // o comprador recebe o aviso na hora; outras telas da recepção também atualizam
    await notify([topics.buyer(buyerId), topics.reception()], clientId(req));
    return respond(res, 200, { ok: true });
  } catch (error) {
    console.error('reception endpoint failed', error);
    return respond(res, 500, { error: 'Falha ao acessar o painel da recepcao.' });
  }
}