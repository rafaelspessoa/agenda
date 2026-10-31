import { createHmac } from 'node:crypto';

// Sinais instantâneos pelo Supabase Realtime (broadcast). O sinal não carrega dados:
// só avisa a tela para buscar de novo pela API autenticada. Os nomes dos canais são
// derivados de um segredo do servidor, então não dá para adivinhar o canal de outra conta.
const EVENT = 'mudou';

function baseUrl() { return String(process.env.SUPABASE_URL || '').replace(/\/$/, ''); }
function publicKey() { return String(process.env.SUPABASE_PUBLISHABLE_KEY || ''); }

export function topic(scope, id = '') {
  const secret = String(process.env.SUPABASE_DB_URL || '');
  return 'ag-' + createHmac('sha256', secret).update(scope + ':' + id).digest('hex').slice(0, 32);
}

export const topics = {
  buyer: buyerId => topic('buyer', buyerId),
  supplier: buyerId => topic('supplier', buyerId),
  reception: () => topic('reception'),
  labs: () => topic('labs') // lista única de laboratórios: todos os compradores atualizam
};

// canais que cada perfil escuta
export function realtimeConfig(user) {
  if (!user || !baseUrl() || !publicKey()) return null;
  // recepção acompanha os agendamentos de todos; gerentes têm a própria agenda e também o painel da equipe
  // (cada um vê só o que pode na API)
  const list = user.role === 'reception' ? [topics.reception()]
    : user.role === 'supplier' ? [topics.supplier(user.buyer_id)]
      : ['purchase_manager', 'category_manager'].includes(user.role) ? [topics.buyer(user.id), topics.labs(), topics.reception()]
        : [topics.buyer(user.id), topics.labs()];
  return { url: baseUrl(), key: publicKey(), topics: list };
}

export function clientId(req) {
  return String(req.headers['x-client-id'] || '').replace(/[^\w-]/g, '').slice(0, 40);
}

// falhas de envio não interrompem a gravação: o polling de reserva cobre
export async function notify(list, from = '') {
  if (!baseUrl() || !publicKey() || !list.length) return;
  try {
    await fetch(baseUrl() + '/realtime/v1/api/broadcast', {
      method: 'POST',
      headers: { apikey: publicKey(), Authorization: 'Bearer ' + publicKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...new Set(list)].map(name => ({ topic: name, event: EVENT, payload: { from } })) }),
      signal: AbortSignal.timeout(1500)
    });
  } catch (error) {
    console.error('realtime notify failed', error.message);
  }
}
