import { randomUUID } from 'node:crypto';
import { database } from './_db.js';
import { clientId, notify, topics } from './_realtime.js';
import { localDate, requireUser, requestBody, respond, sameOrigin, shiftDate } from './_security.js';

const DEFAULT_CFG = {
  passo: 30,
  dias: {
    1: { on: true, ini: '08:00', fim: '17:00' }, 2: { on: true, ini: '08:00', fim: '17:00' },
    3: { on: true, ini: '08:00', fim: '17:00' }, 4: { on: true, ini: '08:00', fim: '17:00' },
    5: { on: true, ini: '08:00', fim: '17:00' }
  }
};

const minutes = value => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))) return NaN;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

function timeText(value) { return String(value || '').slice(0, 5); }

function isBlocked(blocks, date, start, end) {
  return blocks.some(block => {
    if (date < block.de || date > (block.ate || block.de)) return false;
    const blockStart = block.ini ? minutes(block.ini) : 0;
    const blockEnd = block.fim ? minutes(block.fim) : 1440;
    return start < blockEnd && end > blockStart;
  });
}

async function supplierData(sql, user) {
  const configRows = await sql`SELECT record_id, payload->'value' AS value FROM app_records
    WHERE owner_id = ${user.buyer_id} AND store = 'config'
      AND record_id IN ('fornCfg', 'fornBloq', 'fornecedores')`;
  const config = Object.fromEntries(configRows.map(row => [row.record_id, row.value]));
  const source = (config.fornecedores || []).find(item => String(item.id) === user.supplier_id);
  if (!source) return null;
  const supplier = { id: source.id, nome: source.nome, industrias: source.industrias || source.inds || [] };
  return {
    supplier,
    cfg: { ...DEFAULT_CFG, ...(config.fornCfg || {}), dias: { ...DEFAULT_CFG.dias, ...((config.fornCfg || {}).dias || {}) } },
    blocks: (config.fornBloq || []).map(({ de, ate, ini, fim }) => ({ de, ate, ini, fim }))
  };
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req, res, ['supplier']);
    if (!user) return;
    const sql = database();
    const account = await supplierData(sql, user);
    if (!account) return respond(res, 403, { error: 'Acesso do fornecedor revogado ou cadastro removido.' });

    const today = localDate();
    const maxDate = shiftDate(today, 21);
    const records = await sql`SELECT record_id AS id, payload FROM app_records
      WHERE owner_id = ${user.buyer_id} AND store = 'demandas'
        AND payload->>'data' >= ${today} AND payload->>'data' <= ${maxDate}`;
    if (req.method === 'GET') {
      // compradores atendidos com o mesmo código (para escolher/trocar na área do fornecedor)
      const buyers = await sql`SELECT u.id AS "userId", b.display_name AS "buyerName"
        FROM app_users me JOIN app_users u ON u.supplier_code_hash = me.supplier_code_hash AND u.role = 'supplier' AND u.active = TRUE
        JOIN app_users b ON b.id = u.buyer_id AND b.active = TRUE
        WHERE me.id = ${user.id} AND me.supplier_code_hash IS NOT NULL ORDER BY b.display_name`;
      const buyerName = (buyers.find(item => item.userId === user.id) || {}).buyerName || '';
      const busy = [];
      const appointments = [];
      for (const row of records) {
        const item = row.payload;
        if (!item.hora || item.status === 'Cancelado') continue;
        if (String(item.fornId || '') === user.supplier_id && item.atend) {
          appointments.push({
            id: item.id, data: item.data, hora: timeText(item.hora), horaFim: timeText(item.horaFim),
            titulo: item.titulo, status: item.status, atend: true, fornId: item.fornId,
            fornNome: item.fornNome, assunto: item.assunto, industrias: item.industrias,
            agendadoPor: item.agendadoPor
          });
        } else {
          busy.push({ data: item.data, hora: timeText(item.hora), horaFim: timeText(item.horaFim || item.hora) });
        }
      }
      return respond(res, 200, { supplier: account.supplier, cfg: account.cfg, blocks: account.blocks, busy, appointments, buyerName, buyers });
    }

    if (!['POST', 'DELETE'].includes(req.method)) return respond(res, 405, { error: 'Metodo nao permitido.' });
    if (!sameOrigin(req)) return respond(res, 403, { error: 'Origem nao permitida.' });
    const body = requestBody(req);
    if (req.method === 'DELETE') {
      const id = String(body.id || '');
      const cancelled = await sql`UPDATE app_records SET payload = jsonb_set(payload, '{status}', '"Cancelado"'::jsonb), updated_at = NOW()
        WHERE owner_id = ${user.buyer_id} AND store = 'demandas' AND record_id = ${id}
          AND payload->>'fornId' = ${user.supplier_id} AND payload->>'atend' = 'true'
        RETURNING record_id`;
      if (!cancelled.length) return respond(res, 404, { error: 'Atendimento nao encontrado.' });
      await notify([topics.buyer(user.buyer_id), topics.reception(), topics.supplier(user.buyer_id)], clientId(req));
      return respond(res, 200, { ok: true });
    }

    const date = String(body.date || '');
    const startText = String(body.start || '');
    const endText = String(body.end || '');
    const start = minutes(startText), end = minutes(endText);
    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d\d-\d\d$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || date < today || date > maxDate || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 60) {
      return respond(res, 400, { error: 'Data ou duracao do atendimento invalida.' });
    }
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    const dayConfig = account.cfg.dias?.[day];
    const open = dayConfig?.on ? minutes(dayConfig.ini) : NaN;
    const close = dayConfig?.on ? minutes(dayConfig.fim) : NaN;
    const step = Math.max(5, Number(account.cfg.passo) || 30);
    if (!Number.isFinite(open) || !Number.isFinite(close) || start < open || end > close || (start - open) % step !== 0 || (end - start) % step !== 0) {
      return respond(res, 409, { error: 'Horario fora da disponibilidade do comprador.' });
    }
    if (isBlocked(account.blocks, date, start, end)) return respond(res, 409, { error: 'Horario bloqueado pelo comprador.' });
    if (records.some(({ payload }) => {
      if (payload.data !== date || payload.status === 'Cancelado' || !payload.hora) return false;
      const occupiedStart = minutes(timeText(payload.hora));
      const occupiedEnd = payload.horaFim ? minutes(timeText(payload.horaFim)) : occupiedStart + step;
      return start < occupiedEnd && end > occupiedStart;
    })) {
      return respond(res, 409, { error: 'Esse horario acabou de ficar indisponivel.' });
    }

    const selectedIndustries = Array.isArray(body.industries) ? body.industries.map(String) : [];
    const industries = (account.supplier.inds || account.supplier.industrias || [])
      .filter(item => selectedIndustries.includes(String(item.nome || item)));
    if ((account.supplier.inds || account.supplier.industrias || []).length && !industries.length) {
      return respond(res, 400, { error: 'Selecione ao menos uma industria vinculada ao seu cadastro.' });
    }
    const id = randomUUID();
    const title = `Atendimento fornecedor: ${account.supplier.nome} (${startText}-${endText})`;
    const description = (industries.length ? 'Industrias: ' + industries.map(item => item.nome || item).join(', ') + '\n' : '') +
      (body.subject ? 'Assunto: ' + String(body.subject).slice(0, 160) + '\n' : '') +
      'Agendado pelo fornecedor na area do fornecedor.';
    const record = {
      id, titulo: title, data: date, hora: startText, horaFim: endText, tipo: 'Compromisso', status: 'A fazer',
      prioridade: 'MEDIA', recorrencia: { tipo: 'nenhuma' }, descricao: description, atend: true,
      fornId: user.supplier_id, fornNome: account.supplier.nome, compradorNome: '', assunto: String(body.subject || '').slice(0, 160),
      agendadoPor: 'fornecedor', origem: 'area do fornecedor', industrias: industries.map(item => item.nome || item)
    };
    const inserted = await sql`WITH slot_lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtext(${user.buyer_id}), hashtext(${date}))
      ), conflicts AS MATERIALIZED (
        SELECT record_id FROM app_records, slot_lock
        WHERE owner_id = ${user.buyer_id} AND store = 'demandas' AND payload->>'data' = ${date}
          AND COALESCE(payload->>'status', '') <> 'Cancelado'
          AND COALESCE(payload->>'hora', '') < ${endText}
          AND COALESCE(NULLIF(payload->>'horaFim', ''), to_char((payload->>'hora')::time + (${step} * INTERVAL '1 minute'), 'HH24:MI')) > ${startText}
      )
      INSERT INTO app_records (owner_id, store, record_id, payload)
      SELECT ${user.buyer_id}, 'demandas', ${id}, ${JSON.stringify(record)}::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM conflicts) RETURNING record_id`;
    if (!inserted.length) return respond(res, 409, { error: 'Esse horario acabou de ficar indisponivel.' });
    await notify([topics.buyer(user.buyer_id), topics.reception(), topics.supplier(user.buyer_id)], clientId(req));
    return respond(res, 201, { appointment: record });
  } catch (error) {
    console.error('suppliers endpoint failed', error);
    return respond(res, 500, { error: 'Falha ao acessar horarios do fornecedor.' });
  }
}