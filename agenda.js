'use strict';
/* ============================================================
   UTILITÁRIOS: datas, formatação, enums, helpers
   ============================================================ */
const APP_VERSION = '3.0.4';

const PRIORIDADES = ['URGENTE', 'ALTA', 'MEDIA', 'BAIXA'];
const PRIO_LABEL = { URGENTE: 'Urgente', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };
const PRIO_RANK = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };

const STATUS = ['A fazer', 'Em andamento', 'Aguardando fornecedor', 'Concluído', 'Cancelado'];
const STATUS_FECHADO = ['Concluído', 'Cancelado'];
const STATUS_CLASS = { 'A fazer': 'st-todo', 'Em andamento': 'st-negoc', 'Aguardando fornecedor': 'st-aguarda', 'Concluído': 'st-ok', 'Cancelado': 'st-cancel' };
// conversão de status da versão anterior
const STATUS_MIGRA = { 'Em análise': 'Em andamento', 'Em negociação': 'Em andamento', 'Pedido realizado': 'Aguardando fornecedor', 'Aguardando faturamento': 'Aguardando fornecedor', 'Parcialmente faturado': 'Aguardando fornecedor', 'Faturado': 'Concluído' };
const TIPOS_DEMANDA = ['Tarefa', 'Negociação', 'Pedido', 'Acompanhamento', 'Contato com laboratório', 'Compromisso', 'Pendência'];
const TIPOS_HIST = ['Demanda', 'Pendência resolvida', 'Laboratório', 'Sistema'];
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/* ---------- ids ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- escape ---------- */
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- datas (sempre strings YYYY-MM-DD, horário local) ---------- */
function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseISO(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
// datas e horários sempre no fuso America/Sao_Paulo, mesmo que o computador esteja em outro fuso
const TZ = 'America/Sao_Paulo';
const _fmtSP = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function spParts(d) {
  const p = {}; _fmtSP.formatToParts(d || new Date()).forEach(x => { p[x.type] = x.value; });
  return { iso: p.year + '-' + p.month + '-' + p.day, hm: p.hour + ':' + p.minute, h: +p.hour };
}
function today() { return spParts().iso; }
function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); }
function addMonths(s, n, dia) {
  const d = parseISO(s);
  const alvo = dia || d.getDate();
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ult = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(alvo, ult));
  return toISO(r);
}
function diffDays(a, b) { // b - a em dias
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
function weekday(s) { return parseISO(s).getDay(); }
function isWeekend(s, sabadoUtil) {
  const w = weekday(s);
  return w === 0 || (w === 6 && !sabadoUtil);
}
function nextBusinessDay(s, sabadoUtil) {
  let d = addDays(s, 1);
  while (isWeekend(d, sabadoUtil)) d = addDays(d, 1);
  return d;
}
function businessOrNext(s, sabadoUtil) {
  let d = s;
  while (isWeekend(d, sabadoUtil)) d = addDays(d, 1);
  return d;
}
function addBusinessDays(s, n, sabadoUtil) {
  let d = s;
  for (let i = 0; i < n; i++) d = nextBusinessDay(d, sabadoUtil);
  return d;
}
function startOfWeek(s) { const w = weekday(s); return addDays(s, w === 0 ? -6 : 1 - w); } // segunda
function endOfWeek(s) { return addDays(startOfWeek(s), 6); }
function startOfMonth(s) { return s.slice(0, 8) + '01'; }
function endOfMonth(s) { const d = parseISO(s); return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
function inRange(s, a, b) { return !!s && s >= a && s <= b; }
function fmtDate(s) {
  if (!s) return '—';
  const d = parseISO(s);
  if (!d) return esc(s);
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
}
function fmtDateShort(s) {
  if (!s) return '—';
  const d = parseISO(s);
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
}
function fmtDateLong(s) {
  const d = parseISO(s);
  return DIAS_SEMANA[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()].toLowerCase() + ' de ' + d.getFullYear();
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const p = spParts(d);
  return fmtDate(p.iso) + ' ' + p.hm;
}
function relDay(s) {
  if (!s) return '';
  const n = diffDays(today(), s);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  if (n === -1) return 'Ontem';
  if (n < 0) return 'há ' + (-n) + ' dias';
  return 'em ' + n + ' dias';
}
function nowHM() { return spParts().hm; }

/* ---------- números ---------- */
function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/[R$\s%]/g, '');
  if (s === '') return 0;
  // formato BR: 1.234,56  | formato US: 1,234.56 | simples 1234.56
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function numOrNull(v) { return (v === '' || v === null || v === undefined) ? null : num(v); }
const _fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const _fmtBRL4 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const _fmtNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const _fmtInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
function brl(v) { return _fmtBRL.format(num(v)); }
function brl4(v) { return _fmtBRL4.format(num(v)); }
function fnum(v) { return _fmtNum.format(num(v)); }
function fint(v) { return _fmtInt.format(Math.round(num(v))); }
function pct(v) { return _fmtNum.format(num(v)) + '%'; }

/* ---------- texto ---------- */
function norm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function matchText(obj, q, keys) {
  if (!q) return true;
  const nq = norm(q);
  return keys.some(k => norm(obj[k]).includes(nq));
}

/* ---------- misc ---------- */
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
function sum(arr, fn) { let s = 0; for (const x of arr) s += num(fn ? fn(x) : x); return s; }
function sortBy(arr, ...fns) {
  return arr.slice().sort((a, b) => {
    for (const f of fns) {
      const va = f(a), vb = f(b);
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    return 0;
  });
}
function prioBadge(p) {
  p = p || 'MEDIA';
  return `<span class="prio prio-${p}">${PRIO_LABEL[p] || p}</span>`;
}
function statusBadge(s) {
  return s ? `<span class="status ${STATUS_CLASS[s] || ''}">${esc(s)}</span>` : '';
}

/* ============================================================
   BANCO DE DADOS LOCAL (IndexedDB) + cache em memória
   Todas as leituras vêm do cache (rápido); gravações vão
   para o cache e para o IndexedDB, e disparam o backup.
   ============================================================ */
const DB_NAME = 'gestao_compras_toureiro';
const DB_VERSION = 2; // v2: store de pedidos
const STORES = ['demandas', 'laboratorios', 'compras', 'historico', 'config',
  'produtos', 'estoque', 'vendas', 'fornecedores', 'filiais', 'pedidos'];
// stores cujo conteúdo entra no backup (config.backupDir é excluído, é um handle do navegador)
const DATA = {};
STORES.forEach(s => DATA[s] = new Map());

const DB = {
  idb: null,
  listeners: [],
  memoryOnly: false,

  open() {
    return new Promise((resolve) => {
      if (!window.indexedDB) { this.memoryOnly = true; return resolve(); }
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { this.memoryOnly = true; return resolve(); }
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
      };
      req.onsuccess = async () => {
        this.idb = req.result;
        await this.loadAll();
        resolve();
      };
      req.onerror = () => { console.error(req.error); this.memoryOnly = true; resolve(); };
    });
  },

  loadAll() {
    return new Promise((resolve) => {
      const tx = this.idb.transaction(STORES, 'readonly');
      STORES.forEach(s => {
        const r = tx.objectStore(s).getAll();
        r.onsuccess = () => { DATA[s] = new Map(r.result.map(o => [o.id, o])); };
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  all(store) { return Array.from(DATA[store].values()); },
  get(store, id) { return DATA[store].get(id); },
  count(store) { return DATA[store].size; },

  _write(store, ops) {
    if (!this.idb) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = this.idb.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      ops(os);
      tx.oncomplete = () => { resolve(); if (typeof Sync !== 'undefined') Sync.ping(store); };
      tx.onerror = () => { console.error(tx.error); toast('Erro ao gravar no banco local: ' + tx.error, 'err'); reject(tx.error); };
    });
  },

  // grava sem redesenhar a tela, mas envia ao servidor (o modo silent sozinho é o da própria sincronização e não envia)
  async putQuiet(store, obj) {
    const gravando = this.put(store, obj, true);
    // entra na fila antes de terminar a gravação local: a sincronização periódica não apaga o que está pendente
    if (typeof Cloud !== 'undefined') Cloud.queue(store, 'put', this._clean(obj)).catch(() => {});
    await gravando;
    return obj;
  },

  put(store, obj, silent) {
    if (!obj.id) obj.id = uid();
    DATA[store].set(obj.id, obj);
    const clone = this._clean(obj);
    const p = this._write(store, os => os.put(clone));
    if (!silent) this.changed(store);
    return p.then(async () => {
      if (!silent && typeof Cloud !== 'undefined') await Cloud.queue(store, 'put', clone);
      return obj;
    });
  },

  bulkPut(store, arr, silent) {
    arr.forEach(o => { if (!o.id) o.id = uid(); DATA[store].set(o.id, o); });
    const p = this._write(store, os => arr.forEach(o => os.put(this._clean(o))));
    if (!silent) this.changed(store);
    return p.then(async () => {
      if (!silent && typeof Cloud !== 'undefined') await Cloud.queueBulk(store, arr);
    });
  },

  del(store, id, silent) {
    DATA[store].delete(id);
    const p = this._write(store, os => os.delete(id));
    if (!silent) this.changed(store);
    return p.then(async () => {
      if (!silent && typeof Cloud !== 'undefined') await Cloud.queue(store, 'delete', null, id);
    });
  },

  clear(store, silent) {
    DATA[store] = new Map();
    const p = this._write(store, os => os.clear());
    if (!silent) this.changed(store);
    return p.then(async () => {
      if (!silent && typeof Cloud !== 'undefined') await Cloud.queue(store, 'clear', null);
    });
  },

  _clean(obj) {
    // remove campos calculados/transitórios (prefixo _)
    const o = {};
    for (const k in obj) if (k[0] !== '_') o[k] = obj[k];
    return o;
  },

  cfg(key, def) {
    const r = DATA.config.get(key);
    return r ? r.value : def;
  },
  setCfg(key, value, silent) {
    return this.put('config', { id: key, value }, silent);
  },

  onChange(fn) { this.listeners.push(fn); },
  changed(store) { this.listeners.forEach(fn => { try { fn(store); } catch (e) { console.error(e); } }); },

  /* ---------- exportação/restauração completa ---------- */
  snapshot() {
    const out = { app: 'Gestao Compras Toureiro', versao: APP_VERSION, geradoEm: new Date().toISOString(), dados: {} };
    STORES.forEach(s => {
      out.dados[s] = this.all(s).filter(o => !(s === 'config' && CONFIG_LOCAL_ONLY.includes(o.id))).map(o => this._clean(o));
    });
    return out;
  },

  async restore(snap) {
    if (!snap || !snap.dados) throw new Error('Arquivo de backup inválido.');
    for (const s of STORES) {
      if (!Array.isArray(snap.dados[s])) continue;
      const keep = s === 'config' ? this.all('config').filter(o => CONFIG_LOCAL_ONLY.includes(o.id)) : [];
      await this.clear(s, true);
      await this.bulkPut(s, snap.dados[s].concat(keep), true);
      if (typeof Cloud !== 'undefined' && Cloud.ready) {
        await Cloud.queue(s, 'clear');
        await Cloud.queueBulk(s, this.all(s));
      }
    }
    this.changed('*');
  }
};
// chaves de config que pertencem só a este navegador (não vão para o backup)
const CONFIG_LOCAL_ONLY = ['backupDir', 'backupLast', 'backupLastFile', 'auth', 'recepAuth', 'cloudOwner', 'shareDir'];

/* ============================================================
   BACKUP
   1) Automático: grava JSON numa pasta do seu computador
      (File System Access API — Chrome/Edge) a cada alteração,
      + uma cópia diária (mantém os últimos 30 dias).
   2) Manual: baixar backup .json a qualquer momento.
   3) Restaurar: carregar um .json de backup.
   ============================================================ */
const Backup = {
  dir: null,
  perm: 'none',  // none | prompt | granted | unsupported
  pending: false,
  supported: typeof window.showDirectoryPicker === 'function',

  async init() {
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { }
    if (!this.supported) { this.perm = 'unsupported'; return; }
    const h = DB.cfg('backupDir', null);
    if (h && h.queryPermission) {
      this.dir = h;
      try { this.perm = await h.queryPermission({ mode: 'readwrite' }); } catch (e) { this.perm = 'prompt'; }
    }
  },

  async chooseFolder() {
    if (!this.supported) { toast('Seu navegador não permite backup automático em pasta. Use Chrome ou Edge, ou baixe o backup manualmente.', 'warn'); return; }
    try {
      const h = await window.showDirectoryPicker({ id: 'backupGestaoCompras', mode: 'readwrite' });
      this.dir = h;
      this.perm = 'granted';
      await DB.setCfg('backupDir', h, true);
      await this.writeNow();
      toast('Pasta de backup configurada. Backups automáticos ativados.', 'ok');
      App.refreshChrome();
      App.render();
    } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível usar a pasta: ' + e.message, 'err'); }
  },

  async reauthorize() {
    if (!this.dir) return this.chooseFolder();
    try {
      this.perm = await this.dir.requestPermission({ mode: 'readwrite' });
      if (this.perm === 'granted') { await this.writeNow(); toast('Backup automático reativado.', 'ok'); }
    } catch (e) { toast('Permissão negada: ' + e.message, 'err'); }
    App.refreshChrome();
  },

  schedule: debounce(function () { Backup.writeNow(); }, 4000),

  async writeNow() {
    if (!this.dir || this.perm !== 'granted') return false;
    try {
      const json = JSON.stringify(DB.snapshot());
      await this._writeFile(this.dir, 'agenda_planejamento_backup_atual.json', json);
      const sub = await this.dir.getDirectoryHandle('backups_diarios', { create: true });
      await this._writeFile(sub, 'agenda_planejamento_' + today() + '.json', json);
      await this._prune(sub);
      await DB.setCfg('backupLast', new Date().toISOString(), true);
      App.refreshChrome();
      return true;
    } catch (e) {
      console.error(e);
      if (e.name === 'NotAllowedError') { this.perm = 'prompt'; App.refreshChrome(); }
      return false;
    }
  },

  async _writeFile(dir, name, content) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(content);
    await w.close();
  },

  async _prune(sub) {
    const names = [];
    for await (const [name] of sub.entries()) if (/^agenda_planejamento_\d{4}-\d{2}-\d{2}\.json$/.test(name)) names.push(name);
    names.sort();
    while (names.length > 30) { await sub.removeEntry(names.shift()); }
  },

  download() {
    const json = JSON.stringify(DB.snapshot(), null, 1);
    downloadBlob(new Blob([json], { type: 'application/json' }), 'backup_agenda_planejamento_' + today() + '.json');
    DB.setCfg('backupLast', new Date().toISOString(), true);
    DB.setCfg('backupLastFile', new Date().toISOString(), true);
    App.refreshChrome();
  },

  async restoreFromFile(file) {
    const txt = await file.text();
    let snap;
    try { snap = JSON.parse(txt); } catch (e) { throw new Error('O arquivo não é um JSON válido.'); }
    await DB.restore(snap);
  },

  status() {
    const last = DB.cfg('backupLast', null);
    const horas = last ? (Date.now() - new Date(last).getTime()) / 3600000 : Infinity;
    if (this.perm === 'granted') return { ok: true, level: 'ok', text: 'Backup automático ativo' + (last ? ' · último ' + fmtDateTime(last) : '') };
    if (this.perm === 'prompt') return { ok: false, level: 'warn', text: 'Backup automático pausado — clique para reativar', action: 'backup-reauth' };
    if (horas > 24) return { ok: false, level: 'warn', text: last ? 'Último backup há ' + Math.floor(horas / 24) + ' dia(s) — faça um backup' : 'Nenhum backup feito ainda — configure o backup', action: this.supported ? 'backup-folder' : 'backup-download' };
    return { ok: true, level: 'ok', text: 'Último backup ' + fmtDateTime(last) };
  }
};

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ============================================================
   MOTOR DE REGRAS (versão simplificada): rotina, agendamentos,
   recorrência, alertas e bonificação
   ============================================================ */
const PARAMS_DEFAULT = { empresa: 'Grupo Toureiro', nomeUsuario: '', sabadoUtil: false, filiais: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] };
function P() { return Object.assign({}, PARAMS_DEFAULT, DB.cfg('params', {})); }

const AGENDA_DEFAULT = [
  { inicio: '08:00', fim: '08:30', titulo: 'E-mails, WhatsApp, urgências e pendências' },
  { inicio: '08:30', fim: '10:00', titulo: 'Análise de estoque, vendas, cobertura e rupturas' },
  { inicio: '10:00', fim: '12:00', titulo: 'Negociação com laboratórios e representantes' },
  { inicio: '12:00', fim: '13:00', titulo: 'Almoço', pausa: true },
  { inicio: '13:00', fim: '14:30', titulo: 'Montagem e análise dos pedidos' },
  { inicio: '14:30', fim: '15:30', titulo: 'Conferência de custo, bonificação e condição comercial' },
  { inicio: '15:30', fim: '16:30', titulo: 'Acompanhamento de pedidos e faturamentos' },
  { inicio: '16:30', fim: '17:00', titulo: 'Resolução de pendências' },
  { inicio: '17:00', fim: '17:30', titulo: 'Atualização dos controles e planejamento do próximo dia' }
];
const SEMANAL_DEFAULT = {
  1: { foco: 'Análise e planejamento', itens: ['Analisar estoque e vendas', 'Verificar cobertura e rupturas', 'Revisar pedidos pendentes', 'Planejar a semana'] },
  2: { foco: 'Cotações e negociações', itens: ['Enviar cotações', 'Negociar com laboratórios', 'Registrar propostas recebidas'] },
  3: { foco: 'Pedidos', itens: ['Montar pedidos', 'Conferir custos e bonificações', 'Enviar pedidos'] },
  4: { foco: 'Acompanhamento', itens: ['Acompanhar faturamentos', 'Verificar cortes e faltas', 'Acompanhar entregas', 'Resolver pendências'] },
  5: { foco: 'Fechamento', itens: ['Fechar a semana', 'Avaliar oportunidades comerciais', 'Planejar a próxima semana'] },
  6: { foco: '', itens: [] }
};
const MENSAL_DEFAULT = [
  { de: 1, ate: 5, titulo: 'Análise e planejamento', itens: ['Analisar mês anterior', 'Analisar estoque, vendas e cobertura', 'Planejar compras do mês'] },
  { de: 6, ate: 10, titulo: 'Compras principais', itens: ['Negociar e fechar compras principais'] },
  { de: 11, ate: 15, titulo: 'Acompanhamento', itens: ['Acompanhar pedidos e faturamentos'] },
  { de: 16, ate: 20, titulo: 'Reposição', itens: ['Reposição e segunda rodada de compras'] },
  { de: 21, ate: 25, titulo: 'Oportunidades', itens: ['Ofertas, encartes e bonificações'] },
  { de: 26, ate: 31, titulo: 'Fechamento do mês', itens: ['Fechar o mês', 'Planejar o mês seguinte'] }
];

const Engine = {
  _memo: {},
  invalidate() { this._memo = {}; },
  memo(k, fn) { if (!(k in this._memo)) this._memo[k] = fn(); return this._memo[k]; },

  async seedIfEmpty() {
    if (!DB.cfg('seeded', false)) {
      const withIds = arr => arr.map(x => Object.assign({ id: uid() }, x));
      await DB.setCfg('agenda', withIds(AGENDA_DEFAULT), true);
      const sem = {};
      Object.keys(SEMANAL_DEFAULT).forEach(k => sem[k] = { foco: SEMANAL_DEFAULT[k].foco, itens: SEMANAL_DEFAULT[k].itens.map(t => ({ id: uid(), texto: t })) });
      await DB.setCfg('semanal', sem, true);
      await DB.setCfg('mensal', MENSAL_DEFAULT.map(f => ({ id: uid(), de: f.de, ate: f.ate, titulo: f.titulo, itens: f.itens.map(t => ({ id: uid(), texto: t })) })), true);
      await DB.setCfg('seeded', true, true);
    }
    // migração da versão 1 (sistema completo) para a versão 2 (simplificada)
    if (DB.cfg('schemaV', 1) < 2) {
      const dem = DB.all('demandas').filter(d => STATUS_MIGRA[d.status]);
      dem.forEach(d => d.status = STATUS_MIGRA[d.status]);
      if (dem.length) await DB.bulkPut('demandas', dem, true);
      await DB.setCfg('schemaV', 2, true);
    }
    // início do "passa para o próximo dia" da rotina: considera a partir de ontem
    if (!DB.cfg('rotinaCarryDesde', '')) await DB.setCfg('rotinaCarryDesde', addDays(today(), -1), true);
  },

  /* ---------------- laboratórios ---------------- */
  labNome(id) { const l = DB.get('laboratorios', id); return l ? l.nome : ''; },
  labLabel(l) { return (l.codigo ? l.codigo + ' · ' : '') + l.nome + (l.uf ? ' (' + l.uf + ')' : ''); },
  labsAtivos() { return sortBy(DB.all('laboratorios'), l => norm(l.nome)); },

  /* ---------------- agendamentos / demandas ---------------- */
  proximaRecorrencia(d) {
    const r = d.recorrencia || {};
    const base = d.data || today();
    const p = P();
    let nx = null;
    switch (r.tipo) {
      case 'diaria': nx = nextBusinessDay(base, p.sabadoUtil); break;
      case 'semanal': nx = addDays(base, 7); break;
      case 'quinzenal': nx = addDays(base, 14); break;
      case 'mensal': nx = addMonths(base, 1); break;
      case 'dias': nx = addDays(base, Math.max(1, +r.n || 1)); break;
      default: return null;
    }
    let guard = 0;
    while (nx < today() && guard++ < 500) nx = this.proximaRecorrencia(Object.assign({}, d, { data: nx }));
    return r.tipo === 'diaria' ? businessOrNext(nx, p.sabadoUtil) : nx;
  },

  async salvarDemanda(d, antigo) {
    const now = new Date().toISOString();
    d.atualizadoEm = now;
    if (!d.criadoEm) d.criadoEm = now;
    const fechouAgora = STATUS_FECHADO.includes(d.status) && (!antigo || !STATUS_FECHADO.includes(antigo.status));
    if (fechouAgora) d.concluidoEm = now;
    if (!STATUS_FECHADO.includes(d.status)) d.concluidoEm = null;
    if (d.status === 'Aguardando fornecedor' && (!antigo || antigo.status !== 'Aguardando fornecedor')) d.aguardandoDesde = today();
    await DB.putQuiet('demandas', d);
    if (!antigo) await log('Demanda', 'Novo agendamento: ' + d.titulo, { demandaId: d.id, labId: d.labId });
    if (fechouAgora) {
      await log(d.status === 'Concluído' ? 'Pendência resolvida' : 'Demanda', (d.status === 'Concluído' ? 'Concluída: ' : 'Cancelada: ') + d.titulo, { demandaId: d.id, labId: d.labId });
      if (d.status === 'Concluído' && d.recorrencia && d.recorrencia.tipo && d.recorrencia.tipo !== 'nenhuma') {
        const nx = this.proximaRecorrencia(d);
        if (nx) {
          await DB.putQuiet('demandas', Object.assign({}, d, { id: uid(), data: nx, status: 'A fazer', concluidoEm: null, criadoEm: now, atualizadoEm: now, origem: 'recorrente' }));
          toast('Próxima ocorrência agendada para ' + fmtDate(nx), 'info');
        }
      }
    }
    DB.changed('demandas');
    return d;
  },
  async concluir(id) {
    const d = DB.get('demandas', id);
    if (!d) return;
    const antigo = Object.assign({}, d);
    d.status = 'Concluído';
    await this.salvarDemanda(d, antigo);
    toast('Concluída: ' + d.titulo, 'ok');
  },
  async cancelar(id, motivo, todaRepeticao) {
    const d = DB.get('demandas', id);
    if (!d) return;
    const antigo = Object.assign({}, d);
    const rec = d.recorrencia && d.recorrencia.tipo && d.recorrencia.tipo !== 'nenhuma';
    d.status = 'Cancelado';
    d.motivoCancelamento = motivo || '';
    await this.salvarDemanda(d, antigo);
    // cancelar só este dia: a repetição continua na próxima data
    if (rec && !todaRepeticao) {
      const nx = this.proximaRecorrencia(d);
      const now = new Date().toISOString();
      if (nx) { await DB.put('demandas', Object.assign({}, d, { id: uid(), data: nx, status: 'A fazer', motivoCancelamento: '', concluidoEm: null, criadoEm: now, atualizadoEm: now, origem: 'recorrente' })); toast('Repetição mantida: próxima em ' + fmtDate(nx), 'info'); }
    }
    toast('Agendamento cancelado.', 'warn');
  },
  async reabrir(id) {
    const d = DB.get('demandas', id);
    if (!d) return;
    const antigo = Object.assign({}, d);
    d.status = 'A fazer';
    d.motivoCancelamento = '';
    await this.salvarDemanda(d, antigo);
  },
  async adiar(id, dias) {
    const d = DB.get('demandas', id);
    if (!d) return;
    const p = P();
    const base = d.data && d.data > today() ? d.data : today();
    d.data = dias === 1 ? nextBusinessDay(base, p.sabadoUtil) : businessOrNext(addDays(base, dias), p.sabadoUtil);
    await this.salvarDemanda(d, Object.assign({}, d));
    toast('Reagendada para ' + fmtDate(d.data), 'info');
  },
  demandasAbertas() { return DB.all('demandas').filter(d => !STATUS_FECHADO.includes(d.status)); },

  // demandas de um dia (+ atrasadas, se pedido) ordenadas por urgência → prazo → horário
  itensDoDia(data, incluirAtrasados) {
    const t = today();
    const itens = [];
    for (const d of this.demandasAbertas()) {
      if (!d.data) continue;
      const atrasada = d.data < t;
      if (d.data === data || (incluirAtrasados && atrasada)) {
        itens.push({ key: 'd:' + d.id, kind: 'demanda', id: d.id, titulo: d.titulo, tipo: d.tipo, prio: d.prioridade || 'MEDIA',
          data: d.data, hora: d.hora || '', atrasado: atrasada, status: d.status, labId: d.labId, filial: d.filial, rec: d.recorrencia && d.recorrencia.tipo !== 'nenhuma' });
      }
    }
    return sortBy(itens, i => i.atrasado ? 0 : 1, i => i.data || '9999', i => i.hora || '99:99', i => i.titulo);
  },
  canceladasNoDia(data) { return DB.all('demandas').filter(d => d.status === 'Cancelado' && d.data === data); },
  concluidasNoDia(data) { return DB.all('demandas').filter(d => d.status === 'Concluído' && d.data === data); },

  /* ---------------- rotina ---------------- */
  agenda() { return sortBy(DB.cfg('agenda', []), b => b.inicio); },
  semanal() { return DB.cfg('semanal', {}); },
  mensal() { return sortBy(DB.cfg('mensal', []), f => +f.de); },
  faseMes(data) { const dia = parseISO(data).getDate(); return this.mensal().find(f => dia >= +f.de && dia <= +f.ate) || null; },
  rotinaDoDia(data) { return { semana: this.semanal()[weekday(data)] || { foco: '', itens: [] }, fase: this.faseMes(data) }; },
  rotinaChecks(data) { return (DB.cfg('rotinaChecks', {})[data]) || {}; },
  rotinaItensBase(data) { const r = this.rotinaDoDia(data); return (r.semana.itens || []).concat(r.fase ? r.fase.itens || [] : []); },
  // itens da rotina de dias anteriores que não foram marcados — passam para o dia seguinte até serem feitos
  rotinaPendentes(data) {
    if (data > today()) return [];
    const all = DB.cfg('rotinaChecks', {});
    const desde = DB.cfg('rotinaCarryDesde', addDays(today(), -1));
    const lim = addDays(today(), -60);
    let pend = [];
    for (let d = desde > lim ? desde : lim, g = 0; d < data && g < 400; d = addDays(d, 1), g++) {
      const ch = all[d] || {};
      const map = new Map();
      pend.forEach(it => map.set(it.id, it));
      this.rotinaItensBase(d).forEach(it => { if (!map.has(it.id)) map.set(it.id, Object.assign({ desde: d }, it)); });
      pend = Array.from(map.values()).filter(it => !ch[it.id]);
    }
    const base = new Set(this.rotinaItensBase(data).map(i => i.id));
    return pend.filter(it => !base.has(it.id));
  },
  async toggleRotina(data, itemId) {
    const all = DB.cfg('rotinaChecks', {});
    const d = all[data] || {};
    d[itemId] = !d[itemId];
    all[data] = d;
    const lim = addDays(today(), -90);
    Object.keys(all).forEach(k => { if (k < lim) delete all[k]; });
    await DB.setCfg('rotinaChecks', all);
  },

  /* ---------------- alertas ---------------- */
  alertas() {
    return this.memo('alertas', () => {
      const t = today(), p = P(), out = [];
      const ab = this.demandasAbertas();
      const amanha = nextBusinessDay(t, p.sabadoUtil);
      const hm = nowHM();
      const hh = iso => new Date(iso).toTimeString().slice(0, 5);
      ab.filter(d => d.chegouEm && !d.iniciouEm && d.data >= addDays(t, -1)).forEach(d => out.push({ nivel: 'crit', tipo: 'Chegou na recepção', texto: d.fornNome || d.titulo, sub: 'Chegou às ' + hh(d.chegouEm) + ' · agendado ' + (d.hora || '') + (d.horaFim ? '–' + d.horaFim : '') + ' · clique para iniciar o atendimento', act: 'edit-demanda', id: d.id }));
      ab.filter(d => d.iniciouEm && !d.finalizouEm).forEach(d => out.push({ nivel: 'info', tipo: 'Atendimento em andamento', texto: d.fornNome || d.titulo, sub: 'Desde ' + hh(d.iniciouEm) + ' · clique para finalizar', act: 'edit-demanda', id: d.id }));
      ab.filter(d => d.data && d.data < t && !d.chegouEm && !d.iniciouEm).forEach(d => out.push({ nivel: 'crit', tipo: 'Atrasada', texto: d.titulo, sub: 'Era para ' + fmtDate(d.data) + ' (' + relDay(d.data) + ')', act: 'edit-demanda', id: d.id }));
      ab.filter(d => d.data === t && d.hora && d.hora >= hm && minutesBetween(hm, d.hora) <= 60).forEach(d => out.push({ nivel: 'crit', tipo: 'Em breve', texto: d.titulo, sub: 'Hoje às ' + d.hora, act: 'edit-demanda', id: d.id }));
      ab.filter(d => d.status === 'Aguardando fornecedor' && (d.aguardandoDesde || t) <= addDays(t, -2)).forEach(d => out.push({ nivel: 'warn', tipo: 'Fornecedor sem retorno', texto: d.titulo, sub: 'Aguardando desde ' + fmtDate(d.aguardandoDesde), act: 'edit-demanda', id: d.id }));
      ab.filter(d => d.tipo === 'Compromisso' && d.data === amanha).forEach(d => out.push({ nivel: 'info', tipo: 'Compromisso amanhã', texto: d.titulo, sub: d.hora ? 'às ' + d.hora : '', act: 'edit-demanda', id: d.id }));
      const rank = { crit: 0, warn: 1, info: 2 };
      return sortBy(out, a => rank[a.nivel]);
    });
  }
};

function minutesBetween(a, b) {
  const [ha, ma] = a.split(':').map(Number), [hb, mb] = b.split(':').map(Number);
  return (hb * 60 + mb) - (ha * 60 + ma);
}
async function log(tipo, descricao, extra) {
  const e = Object.assign({ id: uid(), data: new Date().toISOString(), tipo, descricao }, extra || {});
  if (e.labId && !e.labNome) e.labNome = Engine.labNome(e.labId);
  await DB.putQuiet('historico', e);
  return e;
}

/* ============================================================
   UI: app shell, roteador, modal, formulários, toast, tabela
   ============================================================ */
const ICONS = {
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  hoje: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
  amanha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  agendamentos: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  cronograma: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  agenda: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  planejamento: '<path d="M4 6h16M4 12h10M4 18h6"/>',
  demandas: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  laboratorios: '<path d="M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  compras: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/>',
  estoque: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  bonificacao: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h8"/>',
  relatorios: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  historico: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  dados: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>', chevR: '<path d="M9 18l6-6-6-6"/>',
  pedidos: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 13l2 2 4-4"/>',
  encarte: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><circle cx="8.5" cy="14.5" r="2"/><path d="M13 13h5M13 16.5h3"/>',
  calcpreco: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8v4H8z"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  xml: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M10 13l-2 2 2 2M14 13l2 2-2 2"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  fornecedores: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><rect x="15" y="10" width="7" height="7" rx="1"/><path d="M15 12.5h7M17 9v2M20 9v2"/>'
};
function icon(n, cls) { return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`; }

const NAV = [
  { grupo: 'Minha rotina', itens: [['hoje', 'Rotina de hoje'], ['agendamentos', 'Agendamentos'], ['cronograma', 'Cronograma'], ['fornecedores', 'Área do fornecedor']] },
  { grupo: 'Cadastros e ferramentas', itens: [['laboratorios', 'Meus laboratórios']] }
];
const VIEWS = {};

const App = {
  view: 'hoje',
  params: {},
  st: {},  // estado por tela (filtros etc.)

  s(view) { if (!this.st[view]) this.st[view] = {}; return this.st[view]; },

  async start() {
    await DB.open();
    Sync.init();
    await Auth.gate();
    if (!Cloud.isBuyer()) return;
    // envia as configuracoes so quando a carga inicial criou ou migrou algo (sem travar a abertura)
    const cfgAntes = JSON.stringify(DB.all('config'));
    await Engine.seedIfEmpty();
    if (JSON.stringify(DB.all('config')) !== cfgAntes) Cloud.queueBulk('config', DB.all('config')).catch(() => {});
    await Backup.init();
    this.buildChrome();
    Auth.paintUser();
    // '@sync' = dados recarregados de outra aba: só redesenha (não grava de novo, evita laço entre abas)
    DB.onChange(store => {
      Engine.invalidate();
      if (store !== '@sync') { Backup.schedule(); if (!Cloud.isBuyer()) Share.agendarPublicar(); }
      // Contas de acesso nao depende dos dados sincronizados: redesenhar apagaria o formulario em edicao
      if (store === '@sync' && this.view === 'usuarios') { this.refreshChrome(); return; }
      this.renderSoon();
    });
    this.started = true;
    window.addEventListener('hashchange', () => this.fromHash());
    document.addEventListener('click', e => this.onClick(e));
    document.addEventListener('keydown', e => this.onKey(e));
    this.fromHash();
    if (DB.memoryOnly) toast('Atenção: o navegador bloqueou o banco local. Os dados NÃO serão salvos. Abra o arquivo no Chrome ou Edge.', 'err', 15000);
    // atualiza a tela a cada 5 min (virada do dia, alertas de horário)
    setInterval(() => { Engine.invalidate(); this.render(); }, 300000);
  },

  fromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [v, q] = h.split('?');
    // entrar no Cronograma por outra tela sempre abre o calendario do mes atual
    if (v === 'cronograma' && this.view !== 'cronograma') { const cr = this.s('cronograma'); cr.mode = 'mes'; delete cr.date; }
    this.view =VIEWS[v] && (v !== 'usuarios' || Cloud.user?.role === 'admin') ? v : 'hoje';
    this.params = Object.fromEntries(new URLSearchParams(q || ''));
    if (this.params.f) { // aplica filtro vindo de um link
      const st = this.s(this.view);
      Object.keys(this.params).forEach(k => { if (k !== 'f') st[k] = this.params[k]; });
    }
    this.render();
  },
  go(view, params) {
    const q = params ? '?' + new URLSearchParams(Object.assign({ f: 1 }, params)).toString() : '';
    if (params) this.st[view] = {}; // link com filtro recomeça os filtros
    const target = '#' + view + q;
    if (location.hash === target) this.fromHash(); else location.hash = target;
    document.body.classList.remove('nav-open');
  },

  // menu lateral conforme o perfil: "Administração" só para contas administrativas
  buildNav() {
    const adminMode = Cloud.user?.role === 'admin';
    if (adminMode) AdminUsers.carregar();
    const groups = adminMode ? NAV.concat([{ grupo: 'Administração', itens: [['usuarios', 'Contas de acesso']] }]) : NAV;
    const nav = groups.map(g => `<div class="nav-group"><div class="nav-title">${g.grupo}</div>${g.itens.map(([k, t]) =>
      `<a href="#${k}" class="nav-item" data-view="${k}">${icon(k === 'usuarios' ? 'fornecedores' : k)}<span>${t}</span><b class="nav-count" id="nc-${k}"></b></a>`).join('')}</div>`).join('');
    document.getElementById('nav').innerHTML = nav;
    if (this.view === 'usuarios' && !adminMode) this.go('hoje');
  },

  buildChrome() {
    this.buildNav();
    document.getElementById('bottomnav').innerHTML = [['hoje', 'Hoje'], ['agendamentos', 'Agenda'], ['cronograma', 'Cronograma'], ['fornecedores', 'Fornecedor']].map(([k, t]) =>
      `<a href="#${k}" data-view="${k}">${icon(k)}<span>${t}</span></a>`).join('') + `<a data-act="toggle-nav">${icon('menu')}<span>Menu</span></a>`;
    const si = document.getElementById('gsearch');
    si.addEventListener('input', debounce(() => this.quickSearch(si.value), 150));
    si.addEventListener('keydown', e => { if (e.key === 'Enter' && si.value.trim()) { this.go('busca', { q: si.value.trim() }); this.hideQuick(); } if (e.key === 'Escape') this.hideQuick(); });
    si.addEventListener('blur', () => setTimeout(() => this.hideQuick(), 200));
    this.refreshChrome();
  },

  refreshChrome() {
    const set = (k, n, crit) => { const el = document.getElementById('nc-' + k); if (el) { el.textContent = n || ''; el.className = 'nav-count' + (crit ? ' crit' : ''); } };
    const hojeIt = Engine.itensDoDia(today(), true);
    set('hoje', hojeIt.length, hojeIt.some(i => i.atrasado));
    set('agendamentos', Engine.demandasAbertas().length);
    const b = Backup.status();
    const el = document.getElementById('backupStatus');
    if (el) {
      el.className = 'backup-status ' + b.level;
      el.innerHTML = icon('shield') + '<span>' + esc(b.text) + '</span>';
      el.dataset.act = b.action || 'go';
      el.dataset.view = 'dados';
    }
    const sh = document.getElementById('shareStatus');
    if (sh) {
      const ss = Share.status();
      sh.hidden = !ss;
      if (ss) { sh.className = 'backup-status ' + ss.level; sh.innerHTML = icon('folder') + '<span>' + esc(ss.text) + '</span>'; sh.title = ss.title || ''; }
    }
    document.querySelectorAll('[data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === this.view));
    const al = Engine.alertas().filter(a => a.nivel === 'crit').length;
    const ab = document.getElementById('alertBtn');
    if (ab) { ab.querySelector('b').textContent = al || ''; ab.classList.toggle('has', al > 0); }
  },

  renderSoon: debounce(function () { App.render(); }, 30),

  render() {
    Engine.invalidate();
    const v = VIEWS[this.view];
    const main = document.getElementById('main');
    const scroll = main.scrollTop;
    const sameView = main.dataset.view === this.view;
    // preserva o que ja foi digitado em formularios quando a mesma tela e redesenhada
    const drafts = sameView ? Array.from(main.querySelectorAll('form[id] [name]')).filter(el => el.type !== 'file')
      .map(el => ({ form: el.form && el.form.id, name: el.name, value: el.value, checked: el.checked, radio: el.type === 'radio', focus: el === document.activeElement })) : [];
    try {
      main.innerHTML = v.render(this.s(this.view), this.params);
      if (v.mount) v.mount(this.s(this.view), main);
      drafts.forEach(d => {
        const sel = `#${CSS.escape(d.form)} [name="${CSS.escape(d.name)}"]` + (d.radio ? `[value="${CSS.escape(d.value)}"]` : '');
        const el = d.form && main.querySelector(sel);
        if (!el) return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = d.checked; else el.value = d.value;
        if (d.focus) el.focus();
      });
    } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="card"><h3>Erro ao exibir esta tela</h3><pre class="err">${esc(e.stack || e)}</pre></div>`;
    }
    main.dataset.view = this.view;
    if (sameView) main.scrollTop = scroll; else main.scrollTop = 0;
    document.title = (v.title || 'Agenda e Planejamento') + ' · Agenda e Planejamento';
    Aviso.tituloBase = document.title;
    this.refreshChrome();
    Aviso.check();
  },

  onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const fn = ACTIONS[act];
    if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
  },
  onKey(e) {
    if (e.target.matches('input,textarea,select')) return;
    if (document.body.classList.contains('locked')) return;
    if (document.querySelector('.modal-bg')) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); ACTIONS['new-demanda']({}); }
    if (e.key === '/') { e.preventDefault(); document.getElementById('gsearch').focus(); }
  },

  quickSearch(q) {
    const box = document.getElementById('quick');
    if (!q || q.trim().length < 2) return this.hideQuick();
    const r = Search.run(q, 5);
    const sec = (t, arr, fn) => arr.length ? `<div class="q-sec">${t}</div>` + arr.map(fn).join('') : '';
    const html = sec('Agendamentos', r.demandas, d => `<a data-act="edit-demanda" data-id="${d.id}">${esc(d.titulo)}<small>${fmtDate(d.data)}${d.hora ? ' ' + d.hora : ''} · ${esc(d.status)}</small></a>`) +
      sec('Laboratórios', r.labs, l => `<a data-act="edit-lab" data-id="${l.id}">${esc(l.nome)}<small>${esc([l.codigo ? 'Cód. ' + l.codigo : '', l.uf].filter(Boolean).join(' · '))}</small></a>`);
    box.innerHTML = (html || '<div class="q-empty">Nada encontrado</div>') + `<a class="q-all" data-act="go" data-view="busca" data-q="${esc(q)}">Ver todos os resultados →</a>`;
    box.hidden = false;
  },
  hideQuick() { const b = document.getElementById('quick'); if (b) b.hidden = true; }
};

/* ---------- toast ---------- */
function toast(msg, type, ms) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms || 3800);
  setTimeout(() => t.remove(), (ms || 3800) + 400);
}

/* ---------- modal ---------- */
function openModal({ title, body, footer, wide, onMount, onClose }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog"><div class="modal-h"><h3>${esc(title)}</h3><button class="icon-btn" data-close>${icon('x')}</button></div>
    <div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`;
  document.body.appendChild(bg);
  const close = () => { bg.remove(); if (onClose) onClose(); };
  bg.addEventListener('mousedown', e => { if (e.target === bg) bg._down = true; });
  bg.addEventListener('mouseup', e => { if (e.target === bg && bg._down) close(); bg._down = false; });
  bg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  const onEsc = e => { if (e.key === 'Escape' && document.body.lastElementChild === bg) { close(); document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);
  const m = bg.querySelector('.modal');
  if (onMount) onMount(m, close);
  const first = m.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea');
  if (first && window.innerWidth > 700) setTimeout(() => first.focus(), 30);
  return { el: m, close };
}
function confirmBox(msg, okText, danger) {
  return new Promise(res => {
    let done = false;
    const m = openModal({ title: 'Confirmar', body: `<p>${esc(msg)}</p>`, footer: `<button class="btn" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okText || 'Confirmar')}</button>`,
      onClose: () => { if (!done) res(false); } });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { done = true; m.close(); res(true); });
  });
}

/* ---------- formulários ---------- */
function optList(arr, sel, blank) {
  return (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
    arr.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
}
function labOptions(sel, blank) { return optList(Engine.labsAtivos().map(l => [l.id, Engine.labLabel(l)]), sel, blank === undefined ? '— selecione —' : blank); }
function filialOptions(sel, blank) {
  const fs = DB.all('filiais').length ? sortBy(DB.all('filiais'), f => +f.codigo || f.codigo).map(f => [f.codigo, f.codigo + (f.nome ? ' — ' + f.nome : '')]) : P().filiais.map(f => [f, 'Filial ' + f]);
  return optList(fs, sel, blank === undefined ? '—' : blank);
}
function field(f, obj) {
  const v = obj[f.k] ?? f.def ?? '';
  const id = 'f_' + f.k;
  let inp;
  switch (f.type) {
    case 'textarea': inp = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`; break;
    case 'select': inp = `<select id="${id}" name="${f.k}">${optList(f.options, v, f.blank)}</select>`; break;
    case 'lab': {
      const l = v ? DB.get('laboratorios', v) : null;
      inp = `<div class="labpick" id="${id}" data-only="${f.noAdd ? 1 : ''}"><input type="hidden" name="${f.k}" value="${esc(l ? l.id : '')}">
        <input class="lp-cod" placeholder="Cód." value="${esc(l ? l.codigo || '' : '')}" autocomplete="off" title="Digite o código do laboratório">
        <div class="lp-wrap"><input class="lp-nome" placeholder="${f.noAdd ? 'Clique para escolher ou digite código/nome' : 'Digite o código ou o nome do laboratório'}" value="${esc(l ? l.nome + (l.uf ? ' (' + l.uf + ')' : '') : '')}" autocomplete="off"><div class="lp-list" hidden></div></div>
        ${f.noAdd ? '' : `<button type="button" class="btn sm" data-act="quick-lab" data-target="${id}" title="Cadastrar novo laboratório">${icon('plus')}</button>`}</div><small class="lp-msg"></small>`;
      break;
    }
    case 'filial': inp = `<select id="${id}" name="${f.k}">${filialOptions(v, f.blank)}</select>`; break;
    case 'check': inp = `<label class="chk"><input type="checkbox" id="${id}" name="${f.k}" ${v ? 'checked' : ''}> ${esc(f.cb || '')}</label>`; break;
    case 'prio': inp = `<div class="seg" data-name="${f.k}">${PRIORIDADES.slice().reverse().map(p => `<label class="seg-${p}"><input type="radio" name="${f.k}" value="${p}" ${v === p ? 'checked' : ''}><span>${PRIO_LABEL[p]}</span></label>`).join('')}</div>`; break;
    case 'readonly': inp = `<div class="ro" id="${id}">${v}</div>`; break;
    default: inp = `<input id="${id}" name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" ${f.step ? `step="${f.step}"` : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} placeholder="${esc(f.ph || '')}" ${f.list ? `list="${f.list}"` : ''} ${f.req ? 'required' : ''} inputmode="${f.type === 'number' ? 'decimal' : 'text'}">`;
  }
  return `<div class="fld ${f.span ? 'span' + f.span : ''} ${f.cls || ''}"><label for="${id}">${esc(f.label)}${f.req ? ' *' : ''}</label>${inp}${f.hint ? `<small>${f.hint}</small>` : ''}</div>`;
}
function formHTML(fields, obj) { return `<form class="grid-form" onsubmit="return false">${fields.map(f => f.section ? `<div class="fsec span4">${esc(f.section)}</div>` : field(f, obj)).join('')}</form>`; }
function readForm(root, fields) {
  const o = {};
  fields.forEach(f => {
    if (!f.k || f.type === 'readonly') return;
    if (f.type === 'check') { const el = root.querySelector(`[name="${f.k}"]`); o[f.k] = !!(el && el.checked); return; }
    if (f.type === 'prio') { const el = root.querySelector(`[name="${f.k}"]:checked`); o[f.k] = el ? el.value : (f.def || ''); return; }
    const el = root.querySelector(`[name="${f.k}"]`);
    if (!el) return;
    o[f.k] = f.type === 'number' ? numOrNull(el.value) : el.value.trim();
  });
  return o;
}

/* ---------- tabela ---------- */
function table(cols, rows, opts) {
  opts = opts || {};
  const st = opts.state || {};
  let data = rows;
  if (st.sort) {
    const c = cols.find(c => c.k === st.sort);
    if (c) {
      const get = c.sv || (r => r[c.k]);
      data = rows.slice().sort((a, b) => {
        let va = get(a), vb = get(b);
        if (va == null || va === '') va = st.dir === 'desc' ? -Infinity : Infinity;
        if (vb == null || vb === '') vb = st.dir === 'desc' ? -Infinity : Infinity;
        if (typeof va === 'string' && typeof vb === 'string') return st.dir === 'desc' ? vb.localeCompare(va, 'pt-BR') : va.localeCompare(vb, 'pt-BR');
        return st.dir === 'desc' ? (vb > va ? 1 : vb < va ? -1 : 0) : (va > vb ? 1 : va < vb ? -1 : 0);
      });
    }
  }
  const limit = opts.limit || 500;
  const shown = data.slice(0, limit);
  const th = cols.map(c => `<th class="${c.cls || ''} ${c.num ? 'num' : ''}" ${c.nosort ? '' : `data-act="sort" data-view="${opts.view || ''}" data-k="${c.k}"`}>${c.t}${st.sort === c.k ? (st.dir === 'desc' ? ' ▾' : ' ▴') : ''}</th>`).join('');
  const tb = shown.map(r => `<tr ${opts.rowAttr ? opts.rowAttr(r) : ''}>${cols.map(c => `<td class="${c.cls || ''} ${c.num ? 'num' : ''}" data-l="${esc(c.t)}">${c.f ? c.f(r) : esc(r[c.k])}</td>`).join('')}</tr>`).join('');
  return `<div class="tbl-wrap"><table class="tbl ${opts.cls || ''}"><thead><tr>${th}</tr></thead><tbody>${tb || `<tr><td colspan="${cols.length}" class="empty">${opts.empty || 'Nenhum registro.'}</td></tr>`}</tbody>${opts.foot ? `<tfoot>${opts.foot}</tfoot>` : ''}</table></div>` +
    (data.length > limit ? `<div class="muted small pad">Mostrando ${limit} de ${data.length}. Use os filtros para refinar.</div>` : '');
}

/* ---------- componentes ---------- */
function pageHead(title, sub, actions) {
  return `<div class="page-h"><div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="page-actions">${actions || ''}</div></div>`;
}
function emptyState(t, s, btn) { return `<div class="empty-state">${icon('check', 'big')}<h3>${esc(t)}</h3><p>${s || ''}</p>${btn || ''}</div>`; }
function btn(txt, act, attrs, cls) { return `<button class="btn ${cls || ''}" data-act="${act}" ${attrs || ''}>${txt}</button>`; }
function tagsFor(i) {
  const t = today();
  let s = '';
  if (i.atrasado) s += '<span class="tag tag-late">ATRASADO</span>';
  else if (i.data === t) s += '<span class="tag tag-today">HOJE</span>';
  if (i.status === 'Aguardando fornecedor') s += '<span class="tag tag-wait">AGUARDANDO FORNECEDOR</span>';
  if (i.status === 'Concluído') s += '<span class="tag tag-done">CONCLUÍDO</span>';
  return s;
}

/* ---------- seletor de laboratório (código + nome, com busca) ---------- */
function labPickSet(box, lab) {
  box.querySelector('input[type=hidden]').value = lab ? lab.id : '';
  box.querySelector('.lp-cod').value = lab ? lab.codigo || '' : '';
  box.querySelector('.lp-nome').value = lab ? lab.nome + (lab.uf ? ' (' + lab.uf + ')' : '') : '';
  const msg = box.parentElement.querySelector('.lp-msg'); if (msg) msg.textContent = '';
  box.querySelector('.lp-list').hidden = true;
}
function mountLabPick(root) {
  root.querySelectorAll('.labpick').forEach(box => {
    const hid = box.querySelector('input[type=hidden]'), cod = box.querySelector('.lp-cod'), nome = box.querySelector('.lp-nome'), list = box.querySelector('.lp-list');
    const msg = box.parentElement.querySelector('.lp-msg');
    const only = box.dataset.only === '1';
    let sel = -1, res = [], todos = false;
    const busca = (q, porCodigo) => {
      const nq = norm(q);
      if (!nq) return [];
      const labs = Engine.labsAtivos();
      const score = l => { const c = norm(l.codigo), n = norm(l.nome); if (c === nq) return 0; if (c.startsWith(nq)) return 1; if (!porCodigo && n.startsWith(nq)) return 2; if (!porCodigo && (n.includes(nq) || c.includes(nq))) return 3; if (!porCodigo && norm(l.representante).includes(nq)) return 4; return 9; };
      return sortBy(labs.map(l => ({ l, s: score(l) })).filter(x => x.s < 9), x => x.s, x => porCodigo ? String(x.l.codigo || '').padStart(12, '0') : norm(x.l.nome)).slice(0, 40).map(x => x.l);
    };
    const mostrarTodos = () => { res = Engine.labsAtivos(); todos = true; sel = res.length ? 0 : -1; show(); };
    const show = () => {
      if (!Engine.labsAtivos().length) { list.innerHTML = '<div class="lp-none">Nenhum laboratório cadastrado ainda. Cadastre em <a href="#laboratorios">Meus laboratórios</a>.</div>'; list.hidden = false; return; }
      list.innerHTML = (todos && res.length ? `<div class="lp-head">${res.length} laboratório(s) cadastrado(s) — digite para filtrar</div>` : '') + (res.length ? res.map((l, i) => `<div class="lp-opt ${i === sel ? 'on' : ''}" data-i="${i}"><b>${esc(l.codigo || '—')}</b><span>${esc(l.nome)}</span>${l.uf ? `<em>${esc(l.uf)}</em>` : ''}${l.representante ? `<small>${esc(l.representante)}</small>` : ''}</div>`).join('')
        : `<div class="lp-none">${only ? 'Não está em Meus laboratórios. Confira o código ou cadastre primeiro em <a href="#laboratorios">Meus laboratórios</a>.' : 'Nenhum laboratório encontrado — clique em + para cadastrar'}</div>`);
      list.hidden = false;
    };
    const pick = l => { labPickSet(box, l); };
    cod.addEventListener('input', () => {
      hid.value = '';
      const q = cod.value.trim();
      if (!q) { nome.value = ''; list.hidden = true; return; }
      const exato = Engine.labsAtivos().filter(l => norm(l.codigo) === norm(q));
      if (exato.length === 1) { hid.value = exato[0].id; nome.value = exato[0].nome + (exato[0].uf ? ' (' + exato[0].uf + ')' : ''); list.hidden = true; if (msg) msg.textContent = ''; return; }
      nome.value = '';
      res = busca(q, true); todos = false; sel = res.length ? 0 : -1; show();
    });
    nome.addEventListener('input', () => { hid.value = ''; cod.value = ''; todos = false; res = busca(nome.value, false); sel = res.length ? 0 : -1; if (nome.value.trim()) show(); else mostrarTodos(); });
    const abrir = () => { if (hid.value) { nome.select(); mostrarTodos(); return; } if (nome.value.trim()) { todos = false; res = busca(nome.value, false); sel = 0; show(); } else mostrarTodos(); };
    nome.addEventListener('focus', abrir);
    nome.addEventListener('mousedown', () => { if (document.activeElement === nome && list.hidden) setTimeout(abrir, 0); });
    const nav = e => {
      if (list.hidden) { if (e.key === 'ArrowDown' && e.target === nome) { e.preventDefault(); abrir(); } return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); show(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); show(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (res[sel]) pick(res[sel]); }
      else if (e.key === 'Escape') { e.stopPropagation(); list.hidden = true; }
    };
    cod.addEventListener('keydown', nav); nome.addEventListener('keydown', nav);
    list.addEventListener('mousedown', e => { const o = e.target.closest('.lp-opt'); if (o) { e.preventDefault(); pick(res[+o.dataset.i]); } });
    const blur = () => setTimeout(() => {
      if (box.contains(document.activeElement)) return;
      list.hidden = true;
      if (!hid.value && (cod.value.trim() || nome.value.trim())) {
        if (res.length === 1) pick(res[0]);
        else if (msg) msg.innerHTML = `<span class="c-bad">${only ? 'Escolha uma indústria cadastrada em Meus laboratórios.' : 'Selecione um laboratório da lista (ou cadastre no +).'}</span>`;
      }
    }, 150);
    cod.addEventListener('blur', blur); nome.addEventListener('blur', blur);
  });
}

/* ============================================================
   FORMULÁRIOS + AÇÕES GLOBAIS + PESQUISA
   ============================================================ */
const REC_OPTS = [['nenhuma', 'Não se repete'], ['diaria', 'Todo dia útil'], ['semanal', 'Toda semana (mesmo dia)'], ['quinzenal', 'A cada 15 dias'], ['mensal', 'Todo mês (mesmo dia)'], ['dias', 'A cada N dias']];

/* ---------------- AGENDAMENTO (demanda) ---------------- */
function demandaFields() {
  return [
    { k: 'titulo', label: 'O que precisa ser feito', req: true, span: 4, ph: 'Ex.: Negociar reposição com EMS' },
    { k: 'data', label: 'Data', type: 'date', def: today(), span: 1 },
    { k: 'hora', label: 'Início', type: 'time', span: 1 },
    { k: 'horaFim', label: 'Término', type: 'time', span: 1 },
    { k: 'rec', label: 'Repetir', type: 'select', options: REC_OPTS, def: 'nenhuma', span: 1 },
    { k: 'recN', label: 'A cada (dias)', type: 'number', span: 1, cls: 'rec-n' },
    { k: 'labId', label: 'Laboratório (código ou nome)', type: 'lab', span: 2 },
    { k: 'tipo', label: 'Tipo', type: 'select', options: TIPOS_DEMANDA, def: 'Tarefa', span: 1 },
    { k: 'status', label: 'Status', type: 'select', options: STATUS, def: 'A fazer', span: 1 },
    { k: 'descricao', label: 'Observações', type: 'textarea', span: 4, rows: 2 }
  ];
}
// situação do atendimento dentro do agendamento (chegada, início, fim)
function atendInfoHTML(d) {
  if (!d || !(d.chegouEm || d.iniciouEm || d.finalizouEm)) return '';
  const h = iso => iso ? new Date(iso).toTimeString().slice(0, 5) : '';
  return `<div class="atend-info">${icon('bell', 'xs')} ${d.chegouEm ? 'Chegou na recepção às <b>' + h(d.chegouEm) + '</b>' : ''}${d.iniciouEm ? ' · atendimento iniciado às <b>' + h(d.iniciouEm) + '</b>' : d.chegouEm ? ' · <b>aguardando você iniciar o atendimento</b>' : ''}${d.finalizouEm ? ' · finalizado às <b>' + h(d.finalizouEm) + '</b>' : ''}</div>`;
}
function formDemanda(id, preset) {
  const antigo = id ? DB.get('demandas', id) : null;
  const d = antigo ? Object.assign({}, antigo) : Object.assign({ prioridade: 'MEDIA', status: 'A fazer', tipo: 'Tarefa', data: today() }, preset || {});
  d.rec = (d.recorrencia && d.recorrencia.tipo) || 'nenhuma';
  d.recN = d.recorrencia && d.recorrencia.n;
  const fields = demandaFields();
  const meta = antigo ? `${antigo.status === 'Cancelado' ? `<div class="cancel-box">${icon('x')} <b>Agendamento cancelado</b>${antigo.motivoCancelamento ? ' — ' + esc(antigo.motivoCancelamento) : ''}</div>` : ''}<div class="meta small muted">Criado em ${fmtDateTime(antigo.criadoEm)}${antigo.concluidoEm ? (antigo.status === 'Cancelado' ? ' · cancelado em ' : ' · concluído em ') + fmtDateTime(antigo.concluidoEm) : ''}</div>` : '';
  openModal({
    title: antigo ? 'Editar agendamento' : 'Novo agendamento', wide: true,
    body: formHTML(fields, d) + atendInfoHTML(antigo) + meta,
    footer: `${antigo ? `<button class="btn danger ghost" data-del>${icon('trash')} Excluir</button>` : ''}<span class="grow"></span>
      ${antigo && !STATUS_FECHADO.includes(antigo.status) && antigo.hora && !antigo.iniciouEm ? `<button class="btn atend-go" data-iniciar>${icon('clock')} Iniciar atendimento</button>` : ''}
      ${antigo && !STATUS_FECHADO.includes(antigo.status) && antigo.iniciouEm ? `<button class="btn atend-go" data-finalizar>${icon('check')} Finalizar atendimento</button>` : ''}
      ${antigo && !STATUS_FECHADO.includes(antigo.status) ? `<button class="btn cancel" data-cancel>${icon('x')} Cancelar agendamento</button><button class="btn ok" data-done>${icon('check')} Concluir</button>` : ''}
      ${antigo && STATUS_FECHADO.includes(antigo.status) ? `<button class="btn" data-reopen>Reativar</button>` : ''}
      <button class="btn" data-close>Fechar</button><button class="btn primary" data-save>Salvar</button>`,
    onMount(el, close) {
      mountLabPick(el);
      const cb = el.querySelector('[data-cancel]'); if (cb) cb.addEventListener('click', () => { close(); formCancelar(id); });
      const rb = el.querySelector('[data-reopen]'); if (rb) rb.addEventListener('click', async () => { await Engine.reabrir(id); close(); toast('Agendamento reativado.', 'ok'); });
      const recSel = el.querySelector('[name=rec]');
      const upd = () => el.querySelector('.rec-n').style.display = recSel.value === 'dias' ? '' : 'none';
      recSel.addEventListener('change', upd); upd();
      // término: sugere 1 hora depois do início
      const hIni = el.querySelector('[name=hora]'), hFim = el.querySelector('[name=horaFim]');
      hIni.addEventListener('change', () => { if (hIni.value && (!hFim.value || hFim.value <= hIni.value)) hFim.value = Forn.hm(Math.min(Forn.min(hIni.value) + 60, 23 * 60 + 59)); });
      const bi = el.querySelector('[data-iniciar]'); if (bi) bi.addEventListener('click', async () => { await Atend.iniciar(id); close(); });
      const bf = el.querySelector('[data-finalizar]'); if (bf) bf.addEventListener('click', async () => { await Atend.finalizar(id); close(); });
      const save = async (forceStatus) => {
        const v = readForm(el, fields);
        if (!v.titulo) { toast('Informe o que precisa ser feito.', 'warn'); el.querySelector('[name=titulo]').focus(); return; }
        if (!v.labId && (el.querySelector('.lp-nome').value.trim() || el.querySelector('.lp-cod').value.trim())) { toast('Laboratório não encontrado. Escolha da lista ou cadastre no botão +.', 'warn'); el.querySelector('.lp-nome').focus(); return; }
        const obj = Object.assign(antigo ? Object.assign({}, antigo) : { id: uid(), origem: 'manual' }, v);
        obj.recorrencia = { tipo: v.rec, n: v.recN || null };
        delete obj.rec; delete obj.recN;
        if (forceStatus) obj.status = forceStatus;
        if (!obj.hora) { toast('Informe o horário de início.', 'warn'); el.querySelector('[name=hora]').focus(); return; }
        if (!obj.horaFim || obj.horaFim <= obj.hora) { toast('Informe o horário de término (depois do início).', 'warn'); el.querySelector('[name=horaFim]').focus(); return; }
        if (!obj.compradorNome) obj.compradorNome = ((Auth.cfg() || {}).nome) || '';
        delete obj.recepOculto;
        if (forceStatus === 'Concluído' && obj.iniciouEm && !obj.finalizouEm) obj.finalizouEm = new Date().toISOString();
        await Engine.salvarDemanda(obj, antigo);
        toast(forceStatus ? 'Concluído.' : 'Agendamento salvo e enviado para a recepção.', 'ok');
        close();
      };
      el.querySelector('[data-save]').addEventListener('click', () => save());
      el.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); });
      const dn = el.querySelector('[data-done]'); if (dn) dn.addEventListener('click', () => save('Concluído'));
      const dl = el.querySelector('[data-del]');
      if (dl) dl.addEventListener('click', async () => {
        const rec = antigo.recorrencia && antigo.recorrencia.tipo !== 'nenhuma';
        if (await confirmBox(rec ? 'Excluir este agendamento? Como ele é recorrente, as próximas repetições também deixam de ser criadas.' : 'Excluir este agendamento?', 'Excluir', true)) { await DB.del('demandas', id); close(); toast('Agendamento excluído.'); }
      });
    }
  });
}

function formCancelar(id) {
  const d = DB.get('demandas', id);
  if (!d) return;
  const rec = d.recorrencia && d.recorrencia.tipo && d.recorrencia.tipo !== 'nenhuma';
  openModal({
    title: 'Cancelar agendamento',
    body: `<p><b>${esc(d.titulo)}</b><br><span class="muted">${fmtDateLong(d.data || today())}${d.hora ? ' às ' + d.hora : ''}</span></p>
      <div class="grid-form"><div class="fld span4"><label>Motivo do cancelamento (opcional)</label><input name="motivo" placeholder="Ex.: representante remarcou"></div>
      ${rec ? `<div class="fld span4"><label>Este agendamento se repete</label><label class="chk"><input type="radio" name="escopo" value="este" checked> Cancelar só este dia (a repetição continua)</label><label class="chk"><input type="radio" name="escopo" value="todos"> Cancelar este e todas as próximas repetições</label></div>` : ''}</div>`,
    footer: `<button class="btn" data-close>Voltar</button><button class="btn danger" data-ok>${icon('x')} Confirmar cancelamento</button>`,
    onMount(el, close) {
      el.querySelector('[data-ok]').addEventListener('click', async () => {
        const esc2 = el.querySelector('[name=escopo]:checked');
        await Engine.cancelar(id, el.querySelector('[name=motivo]').value.trim(), esc2 ? esc2.value === 'todos' : true);
        close();
      });
    }
  });
}

/* ---------------- LABORATÓRIO ---------------- */
function labFields() {
  return [
    { k: 'codigo', label: 'Código', span: 1, ph: 'Ex.: 1234' },
    { k: 'nome', label: 'Laboratório', req: true, span: 2 },
    { k: 'uf', label: 'Estado (UF)', type: 'select', options: UFS, blank: '—', span: 1 },
    { k: 'representante', label: 'Representante', span: 2, ph: 'Nome do representante' },
    { k: 'telefone', label: 'Telefone / WhatsApp (opcional)', span: 2 },
    { k: 'obs', label: 'Observações (opcional)', type: 'textarea', span: 4, rows: 2 }
  ];
}
function formLab(id, onSaved, preset) {
  const antigo = id ? DB.get('laboratorios', id) : null;
  const l = antigo ? Object.assign({}, antigo) : Object.assign({}, preset || {});
  const fields = labFields();
  const pend = antigo ? sortBy(Engine.demandasAbertas().filter(d => d.labId === id), d => d.data || '9999') : [];
  openModal({
    title: antigo ? antigo.nome : 'Novo laboratório',
    body: formHTML(fields, l) + (antigo ? `<h4>Agendamentos em aberto (${pend.length})</h4>${pend.slice(0, 8).map(d => `<div class="mini-row" data-act="edit-demanda" data-id="${d.id}">${d.hora ? '<b>' + d.hora + '</b> ' : ''}${esc(d.titulo)} <small>${fmtDate(d.data)}${d.hora ? ' ' + d.hora : ''}</small></div>`).join('') || '<p class="muted small">Nenhum.</p>'}
      <button class="btn sm" data-act="new-demanda" data-lab="${id}">${icon('plus')} Agendar para este laboratório</button>` : ''),
    footer: `${antigo ? `<button class="btn danger ghost" data-del>${icon('trash')} Excluir</button>` : ''}<span class="grow"></span>
      <button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Salvar</button>`,
    onMount(el, close) {
      el.querySelectorAll('.modal-b [data-act]').forEach(b => b.addEventListener('click', () => close()));
      el.querySelector('[data-save]').addEventListener('click', async () => {
        const v = readForm(el, fields);
        if (!v.nome) { toast('Informe o nome do laboratório.', 'warn'); return; }
        const dup = DB.all('laboratorios').find(x => x.id !== id && (norm(x.nome) === norm(v.nome) && (x.uf || '') === (v.uf || '')));
        if (dup) { toast('Esse laboratório já está cadastrado para este estado.', 'warn'); return; }
        const obj = Object.assign(antigo ? Object.assign({}, antigo) : { id: uid(), criadoEm: new Date().toISOString() }, v, { atualizadoEm: new Date().toISOString() });
        await DB.put('laboratorios', obj);
        if (!antigo) await log('Laboratório', 'Laboratório cadastrado: ' + Engine.labLabel(obj), { labId: obj.id });
        toast('Laboratório salvo.', 'ok');
        close();
        if (onSaved) onSaved(obj);
      });
      const dl = el.querySelector('[data-del]');
      if (dl) dl.addEventListener('click', async () => {
        const n = DB.all('demandas').filter(d => d.labId === id).length;
        if (await confirmBox(n ? `Este laboratório tem ${n} agendamento(s) vinculados (eles continuam existindo, sem laboratório). Excluir?` : 'Excluir este laboratório?', 'Excluir', true)) { await DB.del('laboratorios', id); close(); toast('Laboratório excluído.'); }
      });
    }
  });
}

/* ---------------- AÇÕES GLOBAIS (data-act) ---------------- */
const ACTIONS = {
  'share-conectar': () => Share.ok() ? App.go('dados') : Share.conectar(),
  'share-escolher': () => Share.escolher(),
  'share-sair': async () => { if (await confirmBox('Desconectar a pasta compartilhada? A recepção deixa de receber seus agendamentos deste computador.', 'Desconectar', true)) Share.desconectar(); },
  'share-agora': async () => { await Share.tick(true); toast(Share.ok() ? 'Agendamentos enviados para a recepção.' : 'Pasta compartilhada não conectada.', Share.ok() ? 'ok' : 'warn'); App.render(); },
  'aviso-teste': () => { Aviso.pedirPermissao(); Aviso.som(); toast('Este é o som do aviso de chegada.', 'info'); },
  'toggle-nav': () => document.body.classList.toggle('nav-open'),
  'go': d => App.go(d.view, d.q ? { q: d.q } : null),
  'sort': d => { const st = App.s(d.view || App.view); if (st.sort === d.k) st.dir = st.dir === 'desc' ? 'asc' : 'desc'; else { st.sort = d.k; st.dir = 'asc'; } App.render(); },
  'new-demanda': d => formDemanda(null, Object.assign({}, d.data ? { data: d.data } : {}, d.lab ? { labId: d.lab } : {}, d.tipo ? { tipo: d.tipo } : {}, d.hora ? { hora: d.hora } : {})),
  'edit-demanda': d => formDemanda(d.id),
  'done-demanda': d => Engine.concluir(d.id),
  'reopen-demanda': d => Engine.reabrir(d.id),
  'cancel-demanda': d => formCancelar(d.id),
  'adiar': d => Engine.adiar(d.id, +d.dias || 1),
  'new-lab': () => formLab(null),
  'edit-lab': d => formLab(d.id),
  'quick-lab': d => { const box = document.getElementById(d.target); const nomeTxt = box ? box.querySelector('.lp-nome').value.trim() : ''; const codTxt = box ? box.querySelector('.lp-cod').value.trim() : ''; formLab(null, lab => { if (box) labPickSet(box, lab); }, { nome: nomeTxt, codigo: codTxt }); },
  'open-item': d => formDemanda(d.id),
  'item-done': d => Engine.concluir(d.id),
  'rotina': d => Engine.toggleRotina(d.data, d.item),
  'backup-folder': () => Backup.chooseFolder(),
  'backup-reauth': () => Backup.reauthorize(),
  'backup-download': () => Backup.download(),
  'alerts': () => showAlerts(),
  'print': () => window.print()
};

function alertRow(a) {
  return `<div class="alert-row lvl-${a.nivel}" data-act="${a.act}" data-id="${a.id}"><span class="dot"></span><div><div class="a-t">${esc(a.tipo)}</div><div class="a-x">${esc(a.texto)}</div>${a.sub ? `<div class="a-s">${esc(a.sub)}</div>` : ''}</div></div>`;
}
function showAlerts() {
  const al = Engine.alertas();
  const m = openModal({ title: 'Alertas (' + al.length + ')', body: al.length ? al.map(alertRow).join('') : emptyState('Nenhum alerta', 'Tudo em dia.') });
  m.el.addEventListener('click', e => { if (e.target.closest('[data-act]')) m.close(); });
}

/* ---------------- PESQUISA ---------------- */
const Search = {
  run(q, lim) {
    const L = arr => lim ? arr.slice(0, lim) : arr;
    const labMatch = new Set(DB.all('laboratorios').filter(l => matchText(l, q, ['nome', 'codigo', 'uf', 'representante'])).map(l => l.id));
    return {
      demandas: L(sortBy(DB.all('demandas').filter(d => matchText(d, q, ['titulo', 'descricao', 'tipo', 'status']) || labMatch.has(d.labId)), d => d.data || '').reverse()),
      labs: L(DB.all('laboratorios').filter(l => matchText(l, q, ['nome', 'codigo', 'uf', 'obs', 'representante']))),
    };
  }
};

/* ============================================================
   TELAS: Rotina de hoje, Agendamentos, Cronograma, Pesquisa
   ============================================================ */
function itemCard(i, opts) {
  opts = opts || {};
  const lab = i.labId ? DB.get('laboratorios', i.labId) : null;
  const meta = [i.hora ? icon('clock', 'xs') + ' <b>' + i.hora + '</b>' : '<span class="muted">sem horário</span>', lab ? esc(Engine.labLabel(lab)) + (lab.representante ? ' — ' + esc(lab.representante) : '') : '', i.tipo && i.tipo !== 'Tarefa' ? esc(i.tipo) : '',
    i.atrasado ? 'era para ' + fmtDate(i.data) : opts.showDate && i.data ? fmtDate(i.data) : '', i.rec ? '↻ recorrente' : ''].filter(Boolean).join(' · ');
  return `<div class="item ${i.atrasado ? 'late' : ''}">
    <button class="chkbtn" data-act="item-done" data-id="${i.id}" title="Concluir">${icon('check')}</button>
    <div class="item-b" data-act="open-item" data-id="${i.id}">
      <div class="item-t">${esc(i.titulo)}</div>
      <div class="item-m">${tagsFor(i)} ${atendTag(i)} <span>${meta}</span></div>
    </div>
    ${opts.noAdiar ? '' : itemAcoes(i)}
  </div>`;
}
// situação do atendimento (recepção / comprador)
function atendTag(i) {
  const d = DB.get('demandas', i.id); if (!d) return '';
  const h = iso => new Date(iso).toTimeString().slice(0, 5);
  if (d.iniciouEm && !d.finalizouEm) return `<span class="it-st going">Em atendimento desde ${h(d.iniciouEm)}</span>`;
  if (d.chegouEm && !d.iniciouEm) return `<span class="it-st arrived">${icon('bell', 'xs')} Chegou na recepção às ${h(d.chegouEm)}</span>`;
  return i.status === 'Em andamento' ? statusBadge(i.status) : '';
}
// botões do agendamento: Iniciar / Finalizar · Adiar · Cancelar
function itemAcoes(i) {
  const d = DB.get('demandas', i.id) || {};
  const ini = d.iniciouEm && !d.finalizouEm
    ? `<button class="btn xs it-fin" data-act="atend-fin" data-id="${i.id}" title="Finalizar o atendimento">${icon('check')} Finalizar</button>`
    : `<button class="btn xs it-ini" data-act="atend-ini" data-id="${i.id}" title="Iniciar o atendimento — a recepção vê como em atendimento">▶ Iniciar</button>`;
  return `<div class="item-a">${ini}
    <button class="btn xs it-adi" data-act="adiar-form" data-id="${i.id}" title="Escolher nova data e horário">${icon('clock')} Adiar</button>
    <button class="btn xs it-can" data-act="cancel-demanda" data-id="${i.id}" title="Cancelar agendamento">${icon('x')} Cancelar</button></div>`;
}
function formAdiar(id) {
  const d = DB.get('demandas', id); if (!d) return;
  const p = P(), base = d.data && d.data > today() ? d.data : today();
  const prox = nextBusinessDay(base, p.sabadoUtil);
  const ini = d.hora || '', fim = d.horaFim || (ini ? Forn.hm(Math.min(Forn.min(ini) + 60, 23 * 60 + 59)) : '');
  openModal({
    title: 'Adiar agendamento',
    body: `<p class="small muted" style="margin-top:0"><b>${esc(d.titulo)}</b> · marcado para ${fmtDate(d.data)}${d.hora ? ' às ' + d.hora : ''}</p>
      <div class="adi-q">${[['Próximo dia útil', prox], ['Em 2 dias', businessOrNext(addDays(base, 2), p.sabadoUtil)], ['Próxima semana', businessOrNext(addDays(base, 7), p.sabadoUtil)]].map(([l, v]) => `<button class="btn sm" data-q="${v}">${l}<small>${fmtDateShort(v)} ${DIAS_CURTO[weekday(v)]}</small></button>`).join('')}</div>
      <div class="grid-form"><div class="fld span2"><label>Nova data</label><input type="date" name="data" value="${prox}"></div>
        <div class="fld span1"><label>Início</label><input type="time" name="hora" value="${esc(ini)}"></div>
        <div class="fld span1"><label>Término</label><input type="time" name="horaFim" value="${esc(fim)}"></div>
        <div class="fld span4"><label>Motivo (opcional)</label><input name="motivo" placeholder="Ex.: fornecedor pediu para remarcar"></div></div>`,
    footer: `<span class="grow"></span><button class="btn" data-close>Voltar</button><button class="btn primary" data-ok>${icon('clock')} Adiar</button>`,
    onMount(el, close) {
      const f = n => el.querySelector(`[name=${n}]`);
      el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { f('data').value = b.dataset.q; el.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('primary', x === b)); }));
      f('hora').addEventListener('change', () => { if (f('hora').value && (!f('horaFim').value || f('horaFim').value <= f('hora').value)) f('horaFim').value = Forn.hm(Math.min(Forn.min(f('hora').value) + 60, 23 * 60 + 59)); });
      el.querySelector('[data-ok]').addEventListener('click', async () => {
        const data = f('data').value, hora = f('hora').value, horaFim = f('horaFim').value, motivo = f('motivo').value.trim();
        if (!data) return toast('Escolha a nova data.', 'warn');
        if (!hora) return toast('Informe o horário de início.', 'warn');
        if (!horaFim || horaFim <= hora) return toast('Informe o término (depois do início).', 'warn');
        const novo = Object.assign({}, d, { data, hora, horaFim, chegouEm: null, avisoEm: null, avisoVistoEm: null, iniciouEm: null, recepEm: null,
          status: d.status === 'Em andamento' ? 'A fazer' : d.status,
          descricao: motivo ? ((d.descricao ? d.descricao + '\n' : '') + 'Adiado de ' + fmtDate(d.data) + (d.hora ? ' ' + d.hora : '') + ': ' + motivo) : d.descricao });
        await Engine.salvarDemanda(novo, d);
        await log('Demanda', 'Adiado: ' + d.titulo + ' → ' + fmtDate(data) + ' ' + hora, { demandaId: d.id, labId: d.labId });
        toast('Adiado para ' + fmtDate(data) + ' às ' + hora + '. A recepção já vê o novo horário.', 'ok', 5000);
        close();
      });
    }
  });
}
ACTIONS['atend-ini'] = d => Atend.iniciar(d.id);
ACTIONS['atend-fin'] = d => Atend.finalizar(d.id);
ACTIONS['adiar-form'] = d => formAdiar(d.id);
function toItem(d) {
  return { kind: 'demanda', id: d.id, titulo: d.titulo, tipo: d.tipo, prio: d.prioridade || 'MEDIA', data: d.data, hora: d.hora || '', status: d.status, labId: d.labId,
    atrasado: !STATUS_FECHADO.includes(d.status) && d.data && d.data < today(), rec: d.recorrencia && d.recorrencia.tipo && d.recorrencia.tipo !== 'nenhuma' };
}

/* ---------------- ROTINA DE HOJE ---------------- */
VIEWS.hoje = {
  title: 'Rotina de hoje',
  render() {
    const t = today(), p = P();
    const itens = Engine.itensDoDia(t, true);
    const atras = itens.filter(i => i.atrasado);
    const doDia = itens.filter(i => !i.atrasado);
    const feitas = Engine.concluidasNoDia(t);
    const canc = Engine.canceladasNoDia(t);
    const amanha = nextBusinessDay(t, p.sabadoUtil);
    const itAm = Engine.itensDoDia(amanha, false);
    const hm = nowHM();
    const prox = sortBy(doDia.filter(i => i.hora && i.hora >= hm), i => i.hora)[0];
    const h = spParts().h;
    const saud = (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + (p.nomeUsuario ? ', ' + esc(p.nomeUsuario) : '');
    return pageHead('O que preciso fazer hoje?', saud + ' · ' + fmtDateLong(t), btn(icon('plus') + ' Agendar', 'new-demanda', '', 'primary')) +
      `<div class="chips">
        <span class="chip c-late ${atras.length ? '' : 'zero'}"><b>${atras.length}</b> atrasada(s)</span>
        <span class="chip c-today"><b>${doDia.length}</b> para hoje</span>
        <span class="chip c-ok ${feitas.length ? '' : 'zero'}"><b>${feitas.length}</b> concluída(s)</span>
        ${prox ? `<span class="chip" data-act="edit-demanda" data-id="${prox.id}">Próximo: <b>${prox.hora}</b> ${esc(prox.titulo)}</span>` : ''}
      </div>
      <div class="cols-main">
        <section>
          ${atras.length ? `<div class="card flush late-card"><div class="card-h pad"><h3>Atrasadas (${atras.length})</h3><span class="muted small">resolva ou reagende</span></div><div class="items">${atras.map(i => itemCard(i)).join('')}</div></div>` : ''}
          <div class="card flush">
            <div class="card-h pad"><h3>Demandas de hoje (${doDia.length})</h3><span class="muted small">por horário</span></div>
            ${doDia.length ? `<div class="items">${doDia.map(i => itemCard(i)).join('')}</div>` : emptyState(atras.length ? 'Nada novo para hoje' : 'Nada agendado para hoje', 'Use “Agendar” para incluir uma demanda.', btn(icon('plus') + ' Agendar', 'new-demanda', '', 'primary'))}
            <div class="quick-add"><input id="qaTitle" placeholder="+ Adicionar demanda rápida para hoje e pressionar Enter"><input id="qaHora" type="time" title="Horário (opcional)"></div>
          </div>
          ${canc.length ? `<div class="card flush"><div class="card-h pad"><h3 class="c-cancel">Canceladas hoje (${canc.length})</h3></div><div class="items">${canc.map(d => `<div class="item done canc"><button class="chkbtn on" data-act="reopen-demanda" data-id="${d.id}" title="Reativar">${icon('x')}</button><div class="item-b" data-act="edit-demanda" data-id="${d.id}"><div class="item-t">${esc(d.titulo)}</div>${d.motivoCancelamento ? `<div class="item-m"><span>${esc(d.motivoCancelamento)}</span></div>` : ''}</div></div>`).join('')}</div></div>` : ''}
          ${feitas.length ? `<div class="card flush"><div class="card-h pad"><h3>Concluídas hoje (${feitas.length})</h3></div><div class="items">${feitas.map(d => `<div class="item done"><button class="chkbtn on" data-act="reopen-demanda" data-id="${d.id}" title="Reabrir">${icon('check')}</button><div class="item-b" data-act="edit-demanda" data-id="${d.id}"><div class="item-t">${esc(d.titulo)}</div></div></div>`).join('')}</div></div>` : ''}
        </section>
        <aside>
          <div class="card"><div class="card-h"><h3>Amanhã · ${DIAS_CURTO[weekday(amanha)]} ${fmtDateShort(amanha)}</h3><span class="pill">${itAm.length}</span></div>
            ${itAm.slice(0, 6).map(i => `<div class="mini-row" data-act="edit-demanda" data-id="${i.id}">${i.hora ? '<b>' + i.hora + '</b> ' : ''}${esc(i.titulo)}</div>`).join('') || '<p class="muted small">Nada agendado.</p>'}
            <button class="btn xs ghost" data-act="new-demanda" data-data="${amanha}">+ agendar para amanhã</button></div>
        </aside>
      </div>`;
  },
  mount(st, main) {
    const ti = main.querySelector('#qaTitle'), hi = main.querySelector('#qaHora');
    const add = async () => {
      const titulo = ti.value.trim(); if (!titulo) return;
      await Engine.salvarDemanda({ id: uid(), titulo, data: today(), hora: hi.value || '', prioridade: 'MEDIA', status: 'A fazer', tipo: 'Tarefa', origem: 'rápida', recorrencia: { tipo: 'nenhuma' } });
      toast('Adicionada: ' + titulo, 'ok');
      setTimeout(() => { const n = document.getElementById('qaTitle'); if (n) n.focus(); }, 60);
    };
    ti.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    hi.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  }
};

/* ---------------- AGENDAMENTOS ---------------- */
const PERIODOS = [['proximos', 'Em aberto (todos)'], ['hoje', 'Hoje'], ['atrasadas', 'Atrasadas'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['recorrentes', 'Recorrentes'], ['canceladas', 'Canceladas'], ['concluidas', 'Concluídas'], ['todas', 'Todas']];
function demandasFiltradas(st) {
  const t = today();
  const per = st.periodo || 'proximos';
  const aberta = d => !STATUS_FECHADO.includes(d.status);
  let arr = DB.all('demandas');
  switch (per) {
    case 'proximos': arr = arr.filter(aberta); break;
    case 'hoje': arr = arr.filter(d => aberta(d) && d.data === t); break;
    case 'atrasadas': arr = arr.filter(d => aberta(d) && d.data && d.data < t); break;
    case 'semana': arr = arr.filter(d => aberta(d) && inRange(d.data, startOfWeek(t), endOfWeek(t))); break;
    case 'mes': arr = arr.filter(d => aberta(d) && inRange(d.data, startOfMonth(t), endOfMonth(t))); break;
    case 'recorrentes': arr = arr.filter(d => aberta(d) && d.recorrencia && d.recorrencia.tipo && d.recorrencia.tipo !== 'nenhuma'); break;
    case 'concluidas': arr = arr.filter(d => d.status === 'Concluído'); break;
    case 'canceladas': arr = arr.filter(d => d.status === 'Cancelado'); break;
  }
  if (st.status) arr = arr.filter(d => d.status === st.status);
  if (st.lab) arr = arr.filter(d => d.labId === st.lab);
  if (st.q) { const labs = new Set(DB.all('laboratorios').filter(l => matchText(l, st.q, ['nome', 'codigo'])).map(l => l.id)); arr = arr.filter(d => matchText(d, st.q, ['titulo', 'descricao', 'tipo']) || labs.has(d.labId)); }
  return per === 'concluidas' || per === 'canceladas' ? sortBy(arr, d => d.concluidoEm || '').reverse() : sortBy(arr, d => d.data || '9999', d => d.hora || '99', d => d.titulo);
}
VIEWS.agendamentos = {
  title: 'Agendamentos',
  render(st) {
    const arr = demandasFiltradas(st);
    const t = today();
    const labs = Engine.labsAtivos().map(l => [l.id, Engine.labLabel(l)]);
    let body;
    if (!arr.length) body = `<div class="card">${emptyState('Nenhum agendamento', 'Crie agendamentos para organizar seu dia. Use “Repetir” para demandas de rotina.', btn(icon('plus') + ' Novo agendamento', 'new-demanda', '', 'primary'))}</div>`;
    else if (['concluidas', 'canceladas'].includes(st.periodo || 'proximos')) {
      body = `<div class="card flush"><div class="items">${arr.map(d => `<div class="item done ${d.status === 'Cancelado' ? 'canc' : ''}"><button class="chkbtn on" data-act="reopen-demanda" data-id="${d.id}" title="Reativar">${icon(d.status === 'Cancelado' ? 'x' : 'check')}</button><div class="item-b" data-act="edit-demanda" data-id="${d.id}"><div class="item-t">${esc(d.titulo)}</div><div class="item-m">${statusBadge(d.status)} <span>${fmtDate(d.data)}${d.hora ? ' ' + d.hora : ''} · ${d.status === 'Cancelado' ? 'cancelado' : 'concluído'} em ${fmtDateTime(d.concluidoEm)}${d.motivoCancelamento ? ' · ' + esc(d.motivoCancelamento) : ''}</span></div></div></div>`).join('')}</div></div>`;
    } else {
      const g = groupBy(arr, d => !d.data ? 'sem' : d.data < t ? 'atr' : d.data);
      const keys = Array.from(g.keys()).sort((a, b) => (a === 'atr' ? '0' : a === 'sem' ? 'z' : a).localeCompare(b === 'atr' ? '0' : b === 'sem' ? 'z' : b));
      body = keys.map(k => {
        const h = k === 'atr' ? '<span class="c-bad">Atrasadas</span>' : k === 'sem' ? 'Sem data' : `${k === t ? '<span class="tag tag-today">HOJE</span> ' : ''}${DIAS_SEMANA[weekday(k)]}, ${fmtDate(k)} <span class="muted small">${k !== t ? relDay(k) : ''}</span>`;
        return `<div class="day-h">${h}<button class="icon-btn xs" ${k.length === 10 ? `data-act="new-demanda" data-data="${k}"` : 'data-act="new-demanda"'} title="Agendar neste dia">${icon('plus')}</button></div>
          <div class="card flush"><div class="items">${g.get(k).map(d => itemCard(toItem(d), { showDate: k === 'atr' })).join('')}</div></div>`;
      }).join('');
    }
    return pageHead('Agendamentos', arr.length + ' agendamento(s)', btn(icon('download') + ' Exportar', 'exp-demandas') + btn(icon('plus') + ' Novo agendamento', 'new-demanda', '', 'primary')) +
      filterBar('agendamentos', st, [fInput('q', st, 'Pesquisar...'), fSelect('periodo', st, PERIODOS), fSelect('status', st, STATUS, 'Status'), fSelect('lab', st, labs, 'Laboratório')]) + body;
  },
  mount(st, main) { mountFilters(main, 'agendamentos'); }
};
ACTIONS['exp-demandas'] = () => exportRows('agendamentos', demandasFiltradas(App.s('agendamentos')).map(d => ({
  'Data': fmtDate(d.data), 'Horário': d.hora || '', 'Demanda': d.titulo, 'Status': d.status, 'Tipo': d.tipo || '',
  'Laboratório': (DB.get('laboratorios', d.labId) || {}).nome || '', 'Representante': (DB.get('laboratorios', d.labId) || {}).representante || '', 'Cód. lab.': (DB.get('laboratorios', d.labId) || {}).codigo || '', 'UF': (DB.get('laboratorios', d.labId) || {}).uf || '',
  'Repetição': (REC_OPTS.find(r => r[0] === (d.recorrencia || {}).tipo) || ['', ''])[1], 'Observações': d.descricao || '', 'Concluída em': d.concluidoEm ? fmtDateTime(d.concluidoEm) : ''
})));

/* ---------------- CRONOGRAMA ---------------- */
function eventosPeriodo(de, ate) {
  const ev = [];
  const t = today();
  DB.all('demandas').forEach(d => {
    const aberta = !STATUS_FECHADO.includes(d.status);
    if (inRange(d.data, de, ate)) {
      const late = aberta && d.data < t;
      ev.push({ data: d.data, hora: d.hora || '', titulo: d.titulo, cls: d.status === 'Cancelado' ? 'ev-cancel' : d.status === 'Concluído' ? 'ev-done' : late ? 'ev-late' : 'ev-ag', id: d.id });
    }
    // projeta as próximas repetições no cronograma
    if (aberta && d.status !== 'Cancelado' && d.data && d.recorrencia && d.recorrencia.tipo && d.recorrencia.tipo !== 'nenhuma') {
      let cur = Object.assign({}, d), guard = 0;
      while (guard++ < 120) {
        const nx = Engine.proximaRecorrencia(cur);
        if (!nx || nx <= cur.data || nx > ate) break;
        if (nx >= de) ev.push({ data: nx, hora: d.hora || '', titulo: d.titulo, cls: 'ev-rec', id: d.id });
        cur.data = nx;
      }
    }
  });
  return sortBy(ev, e => e.data, e => e.hora || '99', e => e.titulo);
}
VIEWS.cronograma = {
  title: 'Cronograma',
  render(st) { return pageHead('Cronograma', '', '') + calendarioHTML(st); }
};
ACTIONS['cr-tab'] = d => { App.s('cronograma').tab = d.t; App.render(); };

function calendarioHTML(st) {
  const mode = st.mode || 'mes';
  const d = st.date || today();
  const t = today();
  const seg = ['dia', 'semana', 'mes'].map(m => `<button class="${mode === m ? 'on' : ''}" data-act="cal-mode" data-m="${m}">${m === 'mes' ? 'Mês' : m === 'semana' ? 'Semana' : 'Dia'}</button>`).join('');
  const evHtml = e => `<div class="ev ${e.cls}" data-act="edit-demanda" data-id="${e.id}" title="${esc(e.titulo)}">${e.hora ? '<b>' + e.hora + '</b> ' : ''}${esc(e.titulo)}</div>`;
  let titulo, body;
  if (mode === 'mes') {
    const ini = startOfWeek(startOfMonth(d)), fim = addDays(ini, 41);
    const ev = groupBy(eventosPeriodo(ini, fim), e => e.data);
    const mesAtual = d.slice(0, 7);
    titulo = MESES[parseISO(d).getMonth()] + ' ' + parseISO(d).getFullYear();
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const dd = addDays(ini, i), list = ev.get(dd) || [];
      const cor = corDia(list);
      cells += `<div class="cal-c ${dd.slice(0, 7) !== mesAtual ? 'out' : ''} ${dd === t ? 'today' : ''} ${isWeekend(dd, P().sabadoUtil) ? 'we' : ''} ${cor}" data-act="new-demanda" data-data="${dd}" title="Clique para agendar em ${fmtDate(dd)}">
        <div class="cal-d"><a data-act="cal-day" data-d="${dd}" title="Ver o dia">${parseISO(dd).getDate()}</a>${list.length ? `<span class="cal-n">${list.length}</span>` : ''}</div>
        ${list.slice(0, 4).map(evHtml).join('')}${list.length > 4 ? `<a class="more" data-act="cal-day" data-d="${dd}">+${list.length - 4} mais</a>` : ''}</div>`;
    }
    body = `<div class="cal-m"><div class="cal-hd">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(x => `<div>${x}</div>`).join('')}</div><div class="cal-g">${cells}</div></div>`;
  } else if (mode === 'semana') {
    const ini = startOfWeek(d);
    const ev = groupBy(eventosPeriodo(ini, addDays(ini, 6)), e => e.data);
    titulo = fmtDate(ini) + ' a ' + fmtDate(addDays(ini, 6));
    body = `<div class="cal-w">${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const dd = addDays(ini, i), list = ev.get(dd) || [];
      const cor = corDia(list);
      return `<div class="cal-wc ${dd === t ? 'today' : ''} ${isWeekend(dd, P().sabadoUtil) ? 'we' : ''} ${cor}" data-act="new-demanda" data-data="${dd}" title="Clique para agendar em ${fmtDate(dd)}"><div class="cal-wh"><a data-act="cal-day" data-d="${dd}"><b>${DIAS_CURTO[weekday(dd)]}</b> ${fmtDateShort(dd)}</a>${list.length ? `<span class="cal-n">${list.length}</span>` : ''}</div>
        ${list.map(evHtml).join('') || '<div class="muted small">—</div>'}</div>`;
    }).join('')}</div>`;
  } else {
    titulo = fmtDateLong(d);
    const ev = eventosPeriodo(d, d);
    body = `<div><section><div class="card">${ev.length ? ev.map(e => `<div class="cal-dr">${e.hora ? `<b>${e.hora}</b>` : '<b class="muted">—</b>'}${evHtml(e)}</div>`).join('') : emptyState('Nada neste dia', '', btn(icon('plus') + ' Agendar', 'new-demanda', `data-data="${d}"`, 'primary'))}</div></section>
</div>`;
  }
  return `<div class="cal-bar"><h2>${titulo}</h2><div class="page-actions"><div class="segbtn">${seg}</div><button class="btn" data-act="cal-nav" data-d="-1">${icon('chevL')}</button><button class="btn" data-act="cal-nav" data-d="0">Hoje</button><button class="btn" data-act="cal-nav" data-d="1">${icon('chevR')}</button>${btn(icon('plus') + ' Agendar', 'new-demanda', `data-data="${d}"`, 'primary')}</div></div>
    <div class="legend"><span class="lg lg-has">Agendado</span><span class="lg lg-late">Atrasado</span><span class="lg lg-cancel">Cancelado</span><span class="lg lg-rec">Repetição prevista</span><span class="muted small">· clique em qualquer dia para agendar · clique no número para ver o dia</span></div>` + body;
}
ACTIONS['cal-mode'] = d => { App.s('cronograma').mode = d.m; App.render(); };
ACTIONS['cal-day'] = d => { const s = App.s('cronograma'); s.mode = 'dia'; s.date = d.d; App.render(); };
ACTIONS['cal-nav'] = d => {
  const s = App.s('cronograma');
  const mode = s.mode || (window.innerWidth < 700 ? 'semana' : 'mes');
  const cur = s.date || today(), n = +d.d;
  s.date = n === 0 ? today() : mode === 'mes' ? addMonths(startOfMonth(cur), n) : mode === 'semana' ? addDays(cur, 7 * n) : addDays(cur, n);
  App.render();
};

/* ---------------- PESQUISA ---------------- */
VIEWS.busca = {
  title: 'Pesquisa',
  render(st) {
    const q = st.q || '';
    const r = q ? Search.run(q) : null;
    return pageHead('Pesquisa', q ? 'Resultados para “' + esc(q) + '”' : 'Digite na busca do topo (atalho: /)') + (r ? `
      <div class="card flush"><div class="card-h pad"><h3>Agendamentos (${r.demandas.length})</h3></div>${r.demandas.length ? `<div class="items">${r.demandas.slice(0, 100).map(d => itemCard(toItem(d), { showDate: true, noAdiar: true })).join('')}</div>` : '<p class="muted pad">Nada encontrado.</p>'}</div>
      <div class="card"><h3>Laboratórios (${r.labs.length})</h3>${r.labs.map(l => `<div class="mini-row" data-act="edit-lab" data-id="${l.id}">${esc(Engine.labLabel(l))}</div>`).join('') || '<p class="muted">Nada encontrado.</p>'}</div>` : '');
  }
};

// cor do quadrado do dia: verde = agendado · laranja = atrasado · vermelho = só cancelados
function corDia(list) {
  if (!list.length) return '';
  const ativos = list.filter(e => e.cls !== 'ev-cancel');
  if (!ativos.length) return 'has cancel';
  if (ativos.some(e => e.cls === 'ev-late')) return 'has late';
  if (ativos.every(e => e.cls === 'ev-rec')) return 'has rec';
  return 'has';
}

/* ============================================================
   TELAS: Meus laboratórios
   ============================================================ */
function filterBar(view, st, parts) {
  return `<div class="filters" data-fview="${view}">${parts.join('')}<button class="btn xs ghost" data-act="clear-filters" data-view="${view}">Limpar filtros</button></div>`;
}
function fInput(k, st, ph) { return `<input class="f-in" data-f="${k}" value="${esc(st[k] || '')}" placeholder="${esc(ph)}" type="search">`; }
function fSelect(k, st, opts, blank) { return `<select data-f="${k}">${optList(opts, st[k] || '', blank)}</select>`; }
function mountFilters(main, view) {
  main.querySelectorAll('[data-f]').forEach(el => {
    const h = () => {
      App.s(view)[el.dataset.f] = el.value;
      App.render();
      if (el.type === 'search') { const n = document.querySelector(`[data-f="${el.dataset.f}"]`); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }
    };
    el.addEventListener(el.type === 'search' ? 'input' : 'change', el.type === 'search' ? debounce(h, 250) : h);
  });
}
ACTIONS['clear-filters'] = d => { const s = App.s(d.view); Object.keys(s).forEach(k => { if (!['sort', 'dir', 'tab'].includes(k)) delete s[k]; }); App.render(); };

/* ---------------- MEUS LABORATÓRIOS ---------------- */
function labsFiltrados(st) {
  let arr = DB.all('laboratorios');
  if (st.uf) arr = arr.filter(l => l.uf === st.uf);
  if (st.q) arr = arr.filter(l => matchText(l, st.q, ['nome', 'codigo', 'uf', 'obs', 'representante']));
  return sortBy(arr, l => norm(l.nome), l => l.uf || '');
}
VIEWS.laboratorios = {
  title: 'Meus laboratórios',
  render(st) {
    const arr = labsFiltrados(st);
    const abertas = Engine.demandasAbertas();
    const ufsUsadas = Array.from(new Set(DB.all('laboratorios').map(l => l.uf).filter(Boolean))).sort();
    const porUF = ufsUsadas.map(u => [u, DB.all('laboratorios').filter(l => l.uf === u).length]);
    const cols = [
      { k: 'codigo', t: 'Código', f: l => esc(l.codigo || '—'), sv: l => isNaN(+l.codigo) ? (l.codigo || '') : +l.codigo },
      { k: 'nome', t: 'Laboratório', f: l => `<a class="lnk" data-act="edit-lab" data-id="${l.id}"><b>${esc(l.nome)}</b></a>${l.obs ? `<div class="muted small">${esc(l.obs)}</div>` : ''}`, cls: 'wide' },
      { k: 'uf', t: 'Estado', f: l => l.uf ? `<span class="uf">${esc(l.uf)}</span>` : '—' },
      { k: 'representante', t: 'Representante', f: l => esc(l.representante || '—') + (l.telefone ? `<div class="muted small">${esc(l.telefone)}</div>` : '') },
      { k: 'ag', t: 'Agendamentos abertos', num: true, f: l => { const n = abertas.filter(d => d.labId === l.id).length; return n ? `<a data-act="go-lab" data-id="${l.id}">${n}</a>` : '—'; }, sv: l => abertas.filter(d => d.labId === l.id).length },
      { k: 'a', t: '', nosort: true, f: l => `<div class="row-actions"><button class="btn xs" data-act="new-demanda" data-lab="${l.id}">${icon('plus')} Agendar</button><button class="icon-btn xs" data-act="edit-lab" data-id="${l.id}" title="Editar">${icon('edit')}</button></div>` }
    ];
    return pageHead('Meus laboratórios', DB.count('laboratorios') + ' laboratório(s) sob minha responsabilidade',
      btn(icon('upload') + ' Importar', 'import', 'data-t="laboratorios"') + btn(icon('download') + ' Exportar', 'exp-labs') + btn(icon('plus') + ' Novo laboratório', 'new-lab', '', 'primary')) +
      (porUF.length ? `<div class="chips">${porUF.map(([u, n]) => `<a class="chip ${st.uf === u ? 'on' : ''}" data-act="lab-uf" data-u="${u}"><b>${n}</b> ${u}</a>`).join('')}${st.uf ? `<a class="chip" data-act="lab-uf" data-u="">Todos</a>` : ''}</div>` : '') +
      filterBar('laboratorios', st, [fInput('q', st, 'Pesquisar por código, nome, estado ou representante...'), fSelect('uf', st, UFS, 'Estado')]) +
      `<div class="card flush">${table(cols, arr, { view: 'laboratorios', state: st, empty: 'Nenhum laboratório cadastrado. Clique em “Novo laboratório”.' })}</div>`;
  },
  mount(st, main) { mountFilters(main, 'laboratorios'); }
};
ACTIONS['lab-uf'] = d => { App.s('laboratorios').uf = d.u; App.render(); };
ACTIONS['go-lab'] = d => App.go('agendamentos', { lab: d.id });
ACTIONS['exp-labs'] = () => exportRows('laboratorios', labsFiltrados(App.s('laboratorios')).map(l => ({ 'Código': l.codigo || '', 'Laboratório': l.nome, 'Estado': l.uf || '', 'Representante': l.representante || '', 'Telefone': l.telefone || '', 'Observações': l.obs || '' })));

/* ============================================================
   BACKUP, IMPORTAÇÃO/EXPORTAÇÃO E CONFIGURAÇÕES
   ============================================================ */
const IMPORT_TARGETS = {
  laboratorios: { label: 'Laboratórios', desc: 'Planilha com código, laboratório, estado (UF) e representante', store: 'laboratorios',
    fields: [['codigo', 'Código', 0, ['codigo', 'cod', 'codfornec', 'codlab', 'codfab']], ['nome', 'Laboratório', 1, ['laboratorio', 'nome', 'fornecedor', 'fantasia', 'fabricante']],
      ['uf', 'Estado (UF)', 0, ['uf', 'estado', 'est']], ['representante', 'Representante', 0, ['representante', 'rca', 'vendedor', 'contato', 'promotor']], ['telefone', 'Telefone', 0, ['telefone', 'fone', 'celular', 'whatsapp']], ['obs', 'Observações', 0, ['obs', 'observacao', 'observacoes']]] }
};
const UF_NOMES = { acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO' };
function normUF(v) { const s = String(v || '').trim(); if (!s) return ''; const up = s.toUpperCase(); if (UFS.includes(up)) return up; return UF_NOMES[norm(s)] || up.slice(0, 2); }
function parseDateBR(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return v > 20000 && v < 80000 ? XL.serialToISO(v) : '';
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return y + '-' + pad(+m[2]) + '-' + pad(+m[1]); }
  return '';
}
const NUM_FIELDS = ['estoque', 'custo', 'v30', 'v60', 'v90', 'qtdComprada', 'precoOfertado', 'precoAnterior', 'desconto', 'qtdFaturada'];
const DATE_FIELDS = ['dtUltEnt', 'data', 'dataFaturamento', 'dataEntrega'];
function mapStatus(s) {
  const n = norm(s);
  if (!n) return 'Pedido realizado';
  const exact = STATUS.find(x => norm(x) === n); if (exact) return exact;
  if (n.includes('parcial')) return 'Parcialmente faturado';
  if (n.includes('cancel')) return 'Cancelado';
  if (n.includes('fatur') || n.includes('entreg') || n.includes('recebid')) return 'Faturado';
  if (n.includes('conclu') || n.includes('fechad')) return 'Concluído';
  return 'Pedido realizado';
}

function importWizard(tkey) {
  const T = IMPORT_TARGETS[tkey];
  let sheets = null, sheetIdx = 0, headerRow = 0;
  const m = openModal({
    title: 'Importar ' + T.label, wide: true,
    body: `<p class="muted">${esc(T.desc)}. Aceita <b>.xlsx</b>, <b>.csv</b> e o <b>.xls</b> exportado como tabela HTML. O mapeamento de colunas fica salvo para a próxima importação.</p>
      <div class="drop" id="drop"><input type="file" id="impFile" accept=".xlsx,.xlsm,.csv,.txt,.xls,.htm,.html"><div>${icon('upload')} <b>Clique para escolher</b> ou arraste o arquivo aqui</div></div>
      <div id="impStep2"></div>`,
    footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" data-go disabled>Importar</button>`,
    onMount(el, close) {
      const fileIn = el.querySelector('#impFile');
      const drop = el.querySelector('#drop');
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
      fileIn.addEventListener('change', () => { if (fileIn.files[0]) load(fileIn.files[0]); });
      const s2 = el.querySelector('#impStep2');
      const goBtn = el.querySelector('[data-go]');

      async function load(file) {
        s2.innerHTML = '<p class="muted">Lendo arquivo...</p>';
        try {
          sheets = (await XL.readFile(file)).filter(s => s.rows.some(r => r.some(c => c !== '' && c != null)));
          if (!sheets.length) throw new Error('O arquivo está vazio.');
          sheetIdx = 0; headerRow = detectHeader(sheets[0].rows);
          drop.querySelector('div').innerHTML = icon('check') + ' ' + esc(file.name);
          renderMap();
        } catch (e) { s2.innerHTML = `<div class="alert-row lvl-crit"><span class="dot"></span><div>${esc(e.message)}</div></div>`; goBtn.disabled = true; }
      }
      function detectHeader(rows) {
        const cnt = rows.slice(0, 30).map(r => r.filter(c => c !== '' && c != null && typeof c === 'string').length);
        const mx = Math.max(...cnt);
        return Math.max(0, cnt.findIndex(c => c >= Math.max(2, mx * 0.6)));
      }
      function headers() { const r = sheets[sheetIdx].rows[headerRow] || []; const len = Math.max(...sheets[sheetIdx].rows.slice(headerRow, headerRow + 50).map(x => x.length)); return Array.from({ length: len }, (_, i) => (r[i] != null && r[i] !== '' ? String(r[i]).trim() : 'Coluna ' + XL.colName(i))); }
      function guess(hdrs) {
        const saved = DB.cfg('impMap_' + tkey, {});
        const nh = hdrs.map(h => norm(h).replace(/[^a-z0-9%]/g, ''));
        const map = {};
        T.fields.forEach(([k, , , al]) => {
          if (saved[k] && hdrs.includes(saved[k])) { map[k] = hdrs.indexOf(saved[k]); return; }
          let i = nh.findIndex(h => al.some(a => h === a.replace(/[^a-z0-9%]/g, '')));
          if (i < 0) i = nh.findIndex(h => al.some(a => a.length > 3 && h.includes(a.replace(/[^a-z0-9%]/g, ''))));
          map[k] = i;
        });
        return map;
      }
      function renderMap() {
        const hdrs = headers();
        const map = guess(hdrs);
        const opts = sel => `<option value="-1">— não importar —</option>` + hdrs.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h)}</option>`).join('');
        s2.innerHTML = `<div class="grid-form imp-top">
          ${sheets.length > 1 ? `<div class="fld span2"><label>Aba da planilha</label><select id="impSheet">${sheets.map((s, i) => `<option value="${i}" ${i === sheetIdx ? 'selected' : ''}>${esc(s.name)} (${s.rows.length} linhas)</option>`).join('')}</select></div>` : ''}
          <div class="fld span1"><label>Linha do cabeçalho</label><input type="number" id="impHdr" min="1" value="${headerRow + 1}"></div>
          ${T.filialFixa ? `<div class="fld span1"><label>Filial fixa (opcional)</label><select id="impFil">${filialOptions('', '— usar coluna —')}</select><small>Se o arquivo é de uma filial só</small></div>` : ''}
          <div class="fld span2"><label>Modo</label><select id="impMode"><option value="merge">Mesclar (atualiza existentes e adiciona novos)</option><option value="replace">Substituir ${T.filialFixa ? '(apaga os dados atuais — da filial fixa, se escolhida)' : '(apaga os dados atuais)'}</option></select></div>
        </div>
        <h4>Mapeamento de colunas</h4><div class="map-grid">${T.fields.map(([k, l, req]) => `<label>${esc(l)}${req ? ' *' : ''}</label><select data-map="${k}">${opts(map[k])}</select>`).join('')}</div>
        <h4>Prévia</h4><div id="impPrev"></div>`;
        const sh = s2.querySelector('#impSheet'); if (sh) sh.addEventListener('change', () => { sheetIdx = +sh.value; headerRow = detectHeader(sheets[sheetIdx].rows); renderMap(); });
        s2.querySelector('#impHdr').addEventListener('change', e => { headerRow = Math.max(0, (+e.target.value || 1) - 1); renderMap(); });
        s2.querySelectorAll('select').forEach(x => x.addEventListener('change', prev));
        prev();
      }
      function build() {
        const hdrs = headers();
        const map = {}; s2.querySelectorAll('[data-map]').forEach(s => map[s.dataset.map] = +s.value);
        const filFixa = s2.querySelector('#impFil') ? s2.querySelector('#impFil').value : '';
        const rows = sheets[sheetIdx].rows.slice(headerRow + 1);
        const out = [];
        for (const r of rows) {
          if (!r || !r.some(c => c !== '' && c != null)) continue;
          const o = {};
          T.fields.forEach(([k]) => { const i = map[k]; if (i >= 0) o[k] = r[i]; });
          if (filFixa) o.filial = filFixa;
          NUM_FIELDS.forEach(k => { if (k in o) o[k] = num(o[k]); });
          DATE_FIELDS.forEach(k => { if (k in o) o[k] = parseDateBR(o[k]); });
          ['codigo', 'filial', 'nome', 'descricao', 'laboratorio', 'numeroPedido'].forEach(k => { if (k in o && o[k] != null) o[k] = String(typeof o[k] === 'number' ? Math.round(o[k] * 1e6) / 1e6 : o[k]).trim(); });
          if (T.fields.some(([k, , req]) => req && (o[k] === undefined || o[k] === ''))) continue;
          out.push(o);
        }
        return { out, map, hdrs, filFixa };
      }
      function prev() {
        const { out, map } = build();
        const miss = T.fields.filter(([k, , req]) => req && map[k] < 0).map(f => f[1]);
        const cols = T.fields.filter(([k]) => map[k] >= 0 || (k === 'filial' && s2.querySelector('#impFil') && s2.querySelector('#impFil').value));
        s2.querySelector('#impPrev').innerHTML = (miss.length ? `<p class="c-bad">Campos obrigatórios sem coluna: <b>${esc(miss.join(', '))}</b></p>` : `<p class="c-good">${out.length} linha(s) válidas para importar.</p>`) +
          table(cols.map(([k, l]) => ({ k, t: l, f: r => esc(DATE_FIELDS.includes(k) ? fmtDate(r[k]) : r[k]) })), out.slice(0, 6), { cls: 'dense', empty: 'Nenhuma linha válida.' });
        goBtn.disabled = !!miss.length || !out.length;
      }
      goBtn.addEventListener('click', async () => {
        const { out, map, hdrs, filFixa } = build();
        const mode = s2.querySelector('#impMode').value;
        if (mode === 'replace' && !await confirmBox(`Substituir os dados de ${T.label}${filFixa ? ' da filial ' + filFixa : ''} por ${out.length} linha(s) deste arquivo?`, 'Substituir', true)) return;
        goBtn.disabled = true; goBtn.textContent = 'Importando...';
        const saved = {}; Object.keys(map).forEach(k => { if (map[k] >= 0) saved[k] = hdrs[map[k]]; });
        await DB.setCfg('impMap_' + tkey, saved, true);
        const n = await doImport(tkey, out, mode, filFixa);
        await log('Sistema', `Importação de ${T.label}: ${n.novos} novo(s), ${n.atual} atualizado(s)${mode === 'replace' ? ' (substituição)' : ''}`);
        DB.changed(T.store);
        close();
        toast(`${T.label}: ${n.novos} novo(s), ${n.atual} atualizado(s).`, 'ok', 6000);
      });
    }
  });
}
async function doImport(tkey, rows, mode) {
  const now = new Date().toISOString();
  let novos = 0, atual = 0;
  const existentes = DB.all('laboratorios');
  if (mode === 'replace') { await DB.clear('laboratorios', true); if (Cloud.ready) Cloud.queue('laboratorios', 'clear').catch(() => {}); }
  const base = mode === 'replace' ? [] : existentes;
  const ufOk = (l, r) => !l.uf || !r.uf || l.uf === r.uf;
  const find = r => base.find(l => r.codigo && l.codigo && String(l.codigo) === String(r.codigo) && ufOk(l, r))
    || base.find(l => norm(l.nome) === norm(r.nome) && (l.uf || '') === (r.uf || ''))
    || base.find(l => norm(l.nome) === norm(r.nome) && ufOk(l, r) && (!l.codigo || !r.codigo || String(l.codigo) === String(r.codigo)));
  const list = [];
  for (const r0 of rows) {
    const r = Object.assign({}, r0, { uf: normUF(r0.uf) });
    const ex = find(r);
    if (ex) { Object.keys(r).forEach(k => { if (r[k] !== '' && r[k] != null) ex[k] = r[k]; }); ex.atualizadoEm = now; if (!list.includes(ex)) list.push(ex); atual++; }
    else { const l = Object.assign({ id: uid(), criadoEm: now }, r); base.push(l); list.push(l); novos++; }
  }
  await DB.bulkPut('laboratorios', list, true);
  if (Cloud.ready) Cloud.queueBulk('laboratorios', list).catch(() => {});
  return { novos, atual };
}

/* ---------------- BACKUP E CONFIGURAÇÕES ---------------- */
VIEWS.dados = {
  title: 'Backup e configurações',
  render() {
    const b = Backup.status();
    const last = DB.cfg('backupLast', null);
    const p = P();
    return pageHead('Backup e configurações', 'Seus dados ficam gravados neste computador. Mantenha o backup automático ativo.') +
      `<div class="card backup-card lvl-${b.level}"><div class="card-h"><h3>${icon('shield')} Backup</h3><span class="backup-status ${b.level}">${esc(b.text)}</span></div>
        <div class="cols2 tight">
          <div><h4>Backup automático em pasta</h4>
            ${Backup.supported ? `<p class="small">Escolha uma pasta (de preferência do OneDrive/Google Drive). O sistema grava <code>agenda_planejamento_backup_atual.json</code> a cada alteração e uma cópia por dia em <code>backups_diarios/</code> (últimos 30 dias).</p>
              <div class="page-actions">${Backup.dir ? `<span class="pill">Pasta: ${esc(Backup.dir.name)}</span>` : ''}${Backup.perm === 'prompt' ? btn('Reativar backup automático', 'backup-reauth', '', 'primary') : ''}${btn(Backup.dir ? 'Trocar pasta' : 'Escolher pasta de backup', 'backup-folder', '', Backup.dir ? '' : 'primary')}${Backup.perm === 'granted' ? btn('Gravar agora', 'backup-now') : ''}</div>`
              : `<p class="small c-bad">Este navegador não grava automaticamente em pasta. Use Google Chrome ou Microsoft Edge. Enquanto isso, baixe o backup manualmente.</p>`}
          </div>
          <div><h4>Backup manual e restauração</h4>
            <p class="small">Baixe uma cópia completa (.json) ou restaure um backup (substitui os dados atuais).</p>
            <div class="page-actions">${btn(icon('download') + ' Baixar backup agora', 'backup-download')}<label class="btn">${icon('upload')} Restaurar backup<input type="file" accept=".json" id="restoreFile" hidden></label></div>
            <p class="small muted">Último backup: ${last ? fmtDateTime(last) : 'nunca'}</p>
          </div>
        </div></div>
      ${Cloud.isBuyer() ? '' : shareCardHTML()}
      ${Cloud.user ? `<div class="card"><h3>Conta</h3><p class="small muted">Acesso como <b>${esc(Cloud.user.name)}</b> (${esc(Cloud.user.username)}). Para alterar a senha, solicite ao administrador da agenda.</p></div>` : authCardHTML()}
      <div class="card"><h3>Preferências</h3><form class="grid-form" id="cfgForm" onsubmit="return false">
        <div class="fld span2"><label>Seu nome (saudação)</label><input name="nomeUsuario" value="${esc(p.nomeUsuario)}"></div>
        <div class="fld span1"><label>Sábado é dia útil?</label><select name="sabadoUtil"><option value="0" ${!p.sabadoUtil ? 'selected' : ''}>Não</option><option value="1" ${p.sabadoUtil ? 'selected' : ''}>Sim</option></select></div>
        <div class="fld span1" style="justify-content:flex-end">${btn('Salvar', 'cfg-save', '', 'primary')}</div>
      </form></div>
      <div class="card"><h3>Importar e exportar</h3>
        <p class="small muted">Importe sua lista de laboratórios de uma planilha Excel ou CSV (código, laboratório, estado). Exporte seus dados para Excel quando precisar.</p>
        <div class="page-actions">${btn(icon('upload') + ' Importar laboratórios', 'import', 'data-t="laboratorios"')}${btn(icon('download') + ' Exportar agendamentos', 'exp-all-dem')}${btn(icon('download') + ' Exportar laboratórios', 'exp-labs-all')}</div></div>
      <div class="card"><h3>Atalhos</h3><p class="small"><kbd>N</kbd> novo agendamento · <kbd>/</kbd> pesquisar · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> salvar · <kbd>Esc</kbd> fechar janela · cadeado no topo bloqueia a agenda</p></div>
      <div class="card danger-zone"><h3>Manutenção</h3><div class="page-actions">${btn('Apagar TODOS os dados', 'reset-all', '', 'danger')}</div>
        <p class="small muted">Versão ${APP_VERSION} · banco local: ${DB.memoryOnly ? '<b class="c-bad">indisponível (dados não estão sendo salvos)</b>' : 'ativo'}</p></div>`;
  },
  mount(st, main) {
    authCardMount(main);
    const f = main.querySelector('#restoreFile');
    if (f) f.addEventListener('change', async () => {
      const file = f.files[0]; if (!file) return;
      if (!await confirmBox('Restaurar o backup "' + file.name + '"? TODOS os dados atuais serão substituídos.', 'Restaurar', true)) { f.value = ''; return; }
      try { await Backup.restoreFromFile(file); await Engine.seedIfEmpty(); toast('Backup restaurado com sucesso.', 'ok'); } catch (e) { toast('Erro ao restaurar: ' + e.message, 'err', 8000); }
      f.value = '';
    });
  }
};
/* ---------------- CONTAS DE ACESSO (ADMINISTRAÇÃO) ---------------- */
VIEWS.usuarios = {
  title: 'Contas de acesso',
  render() {
    return pageHead('Contas de acesso', 'Crie os acessos da equipe e desative contas que não devem mais entrar.') +
      `<div class="cols2"><div class="card"><h3>Novo acesso interno</h3><form class="grid-form" id="adminUserForm" onsubmit="return false">
          <div class="fld span2"><label>Nome</label><input name="name" required></div>
          <div class="fld span2"><label>Usuário</label><input name="username" autocomplete="off" required></div>
          <div class="fld span2"><label>Perfil</label><select name="role"><option value="buyer">Comprador</option><option value="reception">Recepção</option></select></div>
          <div class="fld span2"><label>Senha inicial (mínimo 6 caracteres)</label><input type="password" name="password" minlength="6" autocomplete="new-password" required></div>
          <div class="page-actions span4">${btn(icon('plus') + ' Criar acesso', 'admin-user-add', '', 'primary')}</div>
        </form></div><div class="card"><div class="card-h"><h3>Usuários cadastrados</h3><button class="icon-btn" data-act="admin-user-refresh" title="Atualizar">${icon('refresh')}</button></div><div id="adminUsers">${AdminUsers.usersHTML()}</div></div>
        <div class="card"><div class="card-h"><h3>Fornecedores de todos os compradores</h3><button class="icon-btn" data-act="admin-user-refresh" title="Atualizar">${icon('refresh')}</button></div><div id="adminSuppliers">${AdminUsers.suppliersHTML()}</div></div></div>`;
  },
  mount() { ACTIONS['admin-user-refresh']({}); }
};
// ultima lista carregada: a tela abre com ela na hora e atualiza em segundo plano
const AdminUsers = {
  data: null,
  erro: '',
  carregando: null,
  chave() { return 'agenda_admin_users_' + (Cloud.user ? Cloud.user.id : ''); },
  // lista salva no navegador: a aba abre preenchida mesmo logo depois de recarregar a pagina
  lerSalvo() {
    if (this.data || !Cloud.user) return;
    try { const salvo = JSON.parse(localStorage.getItem(this.chave()) || 'null'); if (salvo && Array.isArray(salvo.users)) this.data = salvo; } catch (e) { }
  },
  usersHTML() {
    this.lerSalvo();
    if (this.erro && !this.data) return `<p class="c-bad small">${esc(this.erro)}</p>`;
    if (!this.data) return '<p class="muted small">Carregando contas…</p>';
    const { users } = this.data;
    const perfil = { admin: 'Administrador', buyer: 'Comprador', reception: 'Recepção', supplier: 'Fornecedor' };
    return users.length ? `<div class="tbl-wrap"><table class="tbl dense"><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Estado</th><th></th></tr></thead><tbody>${users.map(user => `<tr><td>${esc(user.name)}</td><td>${esc(user.username)}</td><td>${esc(perfil[user.role] || user.role)}</td><td>${user.active ? 'Ativo' : 'Inativo'}</td><td>${user.id === Cloud.user.id ? '' : `${user.active && user.role !== 'supplier' ? `<button class="btn xs" data-act="admin-user-password" data-id="${esc(user.id)}" data-name="${esc(user.name)}">Redefinir senha</button> ` : ''}<button class="btn xs ${user.active ? 'danger ghost' : ''}" data-act="admin-user-toggle" data-id="${esc(user.id)}" data-active="${user.active ? '0' : '1'}">${user.active ? 'Desativar' : 'Ativar'}</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nenhuma conta cadastrada.</p>';
  },
  suppliersHTML() {
    if (this.erro && !this.data) return `<p class="c-bad small">${esc(this.erro)}</p>`;
    if (!this.data) return '<p class="muted small">Carregando fornecedores…</p>';
    const { suppliers } = this.data;
    return suppliers.length ? `<div class="tbl-wrap"><table class="tbl dense"><thead><tr><th>Fornecedor</th><th>Comprador responsável</th><th>Indústrias</th><th>Estado</th></tr></thead><tbody>${suppliers.map(supplier => {
      const industries = Array.isArray(supplier.industries) ? supplier.industries.map(item => typeof item === 'string' ? item : item.nome || '').filter(Boolean).join(', ') : '';
      return `<tr><td>${esc(supplier.name)}</td><td>${esc(supplier.buyerName)}</td><td>${esc(industries || '—')}</td><td>${supplier.active ? 'Ativo' : 'Inativo'}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="muted small">Nenhum fornecedor cadastrado.</p>';
  },
  paint() {
    const target = document.getElementById('adminUsers');
    const supplierTarget = document.getElementById('adminSuppliers');
    if (target) target.innerHTML = this.usersHTML();
    if (supplierTarget) supplierTarget.innerHTML = this.suppliersHTML();
  },
  carregar() {
    this.lerSalvo();
    if (this.carregando) return this.carregando;
    this.carregando = Cloud.request('/api/users')
      .then(({ users, suppliers }) => {
        this.data = { users, suppliers }; this.erro = '';
        try { localStorage.setItem(this.chave(), JSON.stringify(this.data)); } catch (e) { }
      })
      .catch(error => { this.erro = error.message; if (this.data) toast(error.message, 'err'); })
      .finally(() => { this.carregando = null; this.paint(); });
    return this.carregando;
  }
};
ACTIONS['admin-user-refresh'] = () => AdminUsers.carregar();
ACTIONS['admin-user-add'] = async () => {
  const form = document.getElementById('adminUserForm'); if (!form) return;
  const button = form.querySelector('[data-act="admin-user-add"]');
  if (!button || button.disabled) return;
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Salvando…';
  const data = Object.fromEntries(new FormData(form));
  try {
    await Cloud.request('/api/users', { method: 'POST', body: data });
    form.reset(); toast('Acesso criado.', 'ok');
    await ACTIONS['admin-user-refresh']({});
  } catch (error) { toast(error.message, 'err'); }
  finally { if (button.isConnected) { button.innerHTML = originalLabel; button.disabled = false; } }
};
ACTIONS['admin-user-toggle'] = async data => {
  const active = data.active === '1';
  if (!await confirmBox((active ? 'Ativar' : 'Desativar') + ' este usuário?', active ? 'Ativar' : 'Desativar', !active)) return;
  try {
    await Cloud.request('/api/users', { method: 'PATCH', body: { id: data.id, active } });
    await ACTIONS['admin-user-refresh']({});
    toast(active ? 'Acesso ativado.' : 'Acesso desativado.', 'ok');
  } catch (error) { toast(error.message, 'err'); }
};
ACTIONS['admin-user-password'] = data => {
  openModal({
    title: 'Redefinir senha de ' + data.name,
    body: '<div class="fld"><label>Nova senha (mínimo 6 caracteres)</label><input type="password" name="password" minlength="6" autocomplete="new-password" required></div>',
    footer: '<button class="btn" data-close>Cancelar</button><button class="btn primary" data-save>Salvar nova senha</button>',
    onMount(el, close) {
      el.querySelector('[data-save]').addEventListener('click', async () => {
        const password = el.querySelector('[name=password]').value;
        if (password.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', 'warn');
        try {
          await Cloud.request('/api/users', { method: 'PATCH', body: { id: data.id, password } });
          close(); toast('Senha redefinida. A pessoa precisara entrar novamente.', 'ok');
        } catch (error) { toast(error.message, 'err'); }
      });
    }
  });
};
ACTIONS['import'] = d => importWizard(d.t);
ACTIONS['backup-now'] = async () => { if (await Backup.writeNow()) toast('Backup gravado na pasta.', 'ok'); else toast('Não foi possível gravar. Reative o backup.', 'err'); };
ACTIONS['exp-all-dem'] = () => { App.s('agendamentos').periodo = 'todas'; ACTIONS['exp-demandas'](); };
ACTIONS['exp-labs-all'] = () => exportRows('laboratorios', labsFiltrados({}).map(l => ({ 'Código': l.codigo || '', 'Laboratório': l.nome, 'Estado': l.uf || '', 'Representante': l.representante || '', 'Telefone': l.telefone || '', 'Observações': l.obs || '' })));
ACTIONS['cfg-save'] = async () => {
  const f = document.getElementById('cfgForm');
  const cur = DB.cfg('params', {});
  await DB.setCfg('params', Object.assign({}, cur, { nomeUsuario: f.querySelector('[name=nomeUsuario]').value.trim(), sabadoUtil: f.querySelector('[name=sabadoUtil]').value === '1' }));
  toast('Preferências salvas.', 'ok');
};
ACTIONS['reset-all'] = async () => {
  if (!await confirmBox('Apagar TODOS os dados (agendamentos, pedidos, laboratórios e rotina)? Esta ação não pode ser desfeita.', 'Continuar', true)) return;
  if (!await confirmBox('Tem certeza? Recomendo baixar um backup antes. Apagar definitivamente?', 'Apagar tudo', true)) return;
  for (const s of STORES) {
    const keep = s === 'config' ? DB.all('config').filter(o => CONFIG_LOCAL_ONLY.includes(o.id)) : [];
    await DB.clear(s, true);
    if (keep.length) await DB.bulkPut(s, keep, true);
    if (Cloud.ready) await Cloud.queue(s, 'clear');
  }
  await Engine.seedIfEmpty();
  if (Cloud.ready) await Cloud.queueBulk('config', DB.all('config'));
  DB.changed('*');
  toast('Todos os dados foram apagados.', 'ok');
};

/* ============================================================
   LEITURA E GRAVAÇÃO DE EXCEL (.xlsx) E CSV — sem bibliotecas
   externas. XLSX = ZIP de arquivos XML.
   ============================================================ */
const XL = {
  /* ---------- ZIP: leitura ---------- */
  async unzip(buf) {
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Arquivo não é um .xlsx válido.');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
      files[name] = { method, csize, off };
      p += 46 + nlen + elen + clen;
    }
    const get = async (name) => {
      const f = files[name];
      if (!f) return null;
      const lnl = dv.getUint16(f.off + 26, true), lel = dv.getUint16(f.off + 28, true);
      const data = new Uint8Array(buf, f.off + 30 + lnl + lel, f.csize);
      if (f.method === 0) return dec.decode(data);
      if (f.method !== 8) throw new Error('Compressão não suportada no arquivo.');
      if (typeof DecompressionStream === 'undefined') throw new Error('Seu navegador não consegue ler .xlsx. Atualize o Chrome/Edge ou salve como CSV.');
      const ds = new DecompressionStream('deflate-raw');
      const out = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
      return dec.decode(out);
    };
    return { names: Object.keys(files), get };
  },

  xml(s) { return new DOMParser().parseFromString(s, 'application/xml'); },
  tags(node, name) { return Array.from(node.getElementsByTagName(name)).concat(node.getElementsByTagNameNS ? Array.from(node.getElementsByTagNameNS('*', name)).filter(x => x.tagName !== name) : []); },
  colIndex(ref) { let n = 0; const m = /^[A-Z]+/.exec(ref); if (!m) return 0; for (const ch of m[0]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; },

  async readXlsx(buf) {
    const z = await this.unzip(buf);
    const wb = this.xml(await z.get('xl/workbook.xml'));
    const relsTxt = await z.get('xl/_rels/workbook.xml.rels');
    const rels = {};
    if (relsTxt) this.tags(this.xml(relsTxt), 'Relationship').forEach(r => rels[r.getAttribute('Id')] = r.getAttribute('Target'));
    const sheets = this.tags(wb, 'sheet').map(s => {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let t = rels[rid] || '';
      t = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
      return { name: s.getAttribute('name'), path: t };
    });
    // strings compartilhadas
    const sst = [];
    const sstTxt = await z.get('xl/sharedStrings.xml');
    if (sstTxt) this.tags(this.xml(sstTxt), 'si').forEach(si => sst.push(this.tags(si, 't').map(t => t.textContent).join('')));
    // estilos de data
    const dateStyles = new Set();
    const stTxt = await z.get('xl/styles.xml');
    if (stTxt) {
      const sx = this.xml(stTxt);
      const custom = {};
      this.tags(sx, 'numFmt').forEach(f => custom[f.getAttribute('numFmtId')] = f.getAttribute('formatCode') || '');
      const xfs = this.tags(sx, 'cellXfs')[0];
      if (xfs) Array.from(xfs.children).forEach((xf, i) => {
        const id = +xf.getAttribute('numFmtId');
        const code = custom[id] || '';
        if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (code && /[dy]/i.test(code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')))) dateStyles.add(i);
      });
    }
    const out = [];
    for (const sh of sheets) {
      const txt = await z.get(sh.path);
      if (!txt) continue;
      out.push({ name: sh.name, rows: this.parseSheet(txt, sst, dateStyles) });
    }
    return out;
  },

  parseSheet(txt, sst, dateStyles) {
    const doc = this.xml(txt);
    const rows = [];
    this.tags(doc, 'row').forEach(r => {
      const ri = (+r.getAttribute('r') || rows.length + 1) - 1;
      const row = [];
      let ci = 0;
      Array.from(r.children).forEach(c => {
        if (c.localName !== 'c') return;
        const ref = c.getAttribute('r');
        if (ref) ci = this.colIndex(ref);
        const t = c.getAttribute('t');
        const s = +c.getAttribute('s');
        const vEl = Array.from(c.children).find(x => x.localName === 'v');
        let v = vEl ? vEl.textContent : '';
        if (t === 's') v = sst[+v] ?? '';
        else if (t === 'inlineStr') v = this.tags(c, 't').map(x => x.textContent).join('');
        else if (t === 'b') v = v === '1' ? 'VERDADEIRO' : 'FALSO';
        else if (t === 'str' || t === 'e') { /* texto */ }
        else if (v !== '') { const n = +v; v = dateStyles.has(s) && n > 0 && n < 100000 ? this.serialToISO(n) : n; }
        row[ci] = v;
        ci++;
      });
      rows[ri] = row;
    });
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    return rows;
  },
  serialToISO(n) {
    const d = new Date(Math.round((n - 25569) * 86400000));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  },

  /* ---------- CSV ---------- */
  decodeText(buf) {
    let txt = new TextDecoder('utf-8').decode(buf);
    if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
    return txt.replace(/^﻿/, '');
  },
  parseCSV(txt) {
    const first = txt.split(/\r?\n/).slice(0, 5).join('\n');
    const cands = [';', ',', '\t', '|'];
    const sep = cands.map(c => [c, (first.match(new RegExp(c === '|' ? '\\|' : c, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) {
        if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  },
  parseHTMLTable(txt) {
    const doc = new DOMParser().parseFromString(txt, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));
    if (!tables.length) throw new Error('Nenhuma tabela encontrada no arquivo.');
    const t = tables.sort((a, b) => b.rows.length - a.rows.length)[0];
    return Array.from(t.rows).map(r => Array.from(r.cells).map(c => c.textContent.trim()));
  },

  /* ---------- leitura genérica de arquivo ---------- */
  async readFile(file) {
    const buf = await file.arrayBuffer();
    const b = new Uint8Array(buf.slice(0, 8));
    if (b[0] === 0x50 && b[1] === 0x4b) return await this.readXlsx(buf);
    if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) throw new Error('Este é um arquivo .xls antigo (Excel 97-2003). Abra no Excel e use "Salvar como" → Pasta de Trabalho do Excel (.xlsx) ou CSV, depois importe novamente.');
    const txt = this.decodeText(buf);
    if (/^\s*</.test(txt)) return [{ name: file.name, rows: this.parseHTMLTable(txt) }];
    return [{ name: file.name, rows: this.parseCSV(txt) }];
  },

  /* ---------- ZIP: gravação (sem compressão) ---------- */
  crcTable: null,
  crc32(u8) {
    if (!this.crcTable) { this.crcTable = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; this.crcTable[n] = c >>> 0; } }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = this.crcTable[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  },
  zip(files) { // files: [{name, data: string}]
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = this.crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((s, x) => s + (x.byteLength ?? x.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },

  xesc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); },
  colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; },

  // sheets: [{name, rows: [obj,...]}] ou [{name, aoa: [[...]]}]
  writeXlsx(sheets) {
    const used = new Set();
    const safe = n => { let s = String(n || 'Planilha').replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31) || 'Planilha'; let k = s, i = 2; while (used.has(k)) k = s.slice(0, 28) + ' ' + i++; used.add(k); return k; };
    const files = [];
    const sheetXml = sheets.map((sh, idx) => {
      let aoa = sh.aoa;
      if (!aoa) { const hdr = sh.rows.length ? Object.keys(sh.rows[0]) : ['(sem dados)']; aoa = [hdr].concat(sh.rows.map(r => hdr.map(h => r[h]))); }
      const widths = [];
      const rowsXml = aoa.map((row, ri) => `<row r="${ri + 1}">${row.map((v, ci) => {
        const ref = this.colName(ci) + (ri + 1);
        const len = v == null ? 0 : String(v).length;
        widths[ci] = Math.min(60, Math.max(widths[ci] || 8, len + 2));
        const st = ri === 0 && !sh.noHeader ? ' s="1"' : '';
        if (v === null || v === undefined || v === '') return `<c r="${ref}"${st}/>`;
        if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
        return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${this.xesc(v)}</t></is></c>`;
      }).join('')}</row>`).join('');
      const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
      const freeze = sh.noHeader ? '' : '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
      files.push({ name: `xl/worksheets/sheet${idx + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${rowsXml}</sheetData></worksheet>` });
      return safe(sh.name);
    });
    files.unshift(
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetXml.map((n, i) => `<sheet name="${this.xesc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3A5F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` }
    );
    return this.zip(files);
  },

  writeCSV(rows) {
    if (!rows.length) return '﻿';
    const hdr = Object.keys(rows[0]);
    const cell = v => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return String(v).replace('.', ',');
      const s = String(v);
      return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + [hdr.map(cell).join(';')].concat(rows.map(r => hdr.map(h => cell(r[h])).join(';'))).join('\r\n');
  }
};

/* ---------- helper de exportação usado em todas as telas ---------- */
function exportRows(nome, rows, extraSheets) {
  if (!rows.length && !extraSheets) { toast('Nada para exportar com os filtros atuais.', 'warn'); return; }
  const m = openModal({
    title: 'Exportar ' + nome.replace(/_/g, ' '),
    body: `<p>${rows.length} linha(s). Escolha o formato:</p>`,
    footer: `<button class="btn" data-close>Cancelar</button><button class="btn" data-fmt="csv">CSV (;)</button><button class="btn primary" data-fmt="xlsx">Excel (.xlsx)</button>`,
    onMount(el, close) {
      el.querySelectorAll('[data-fmt]').forEach(b => b.addEventListener('click', () => {
        const base = nome + '_' + today();
        if (b.dataset.fmt === 'xlsx') downloadBlob(XL.writeXlsx([{ name: nome, rows }].concat(extraSheets || [])), base + '.xlsx');
        else downloadBlob(new Blob([XL.writeCSV(rows)], { type: 'text/csv;charset=utf-8' }), base + '.csv');
        close();
        toast('Arquivo gerado: ' + base, 'ok');
      }));
    }
  });
}

/* ============================================================
   LOGIN E SENHA
   - 1º acesso: cria usuário + senha (+ código de recuperação)
   - Senha guardada só como hash PBKDF2 (nunca em texto)
   - Fica só neste computador (não vai para o backup)
   - Bloqueio automático por inatividade e botão "Bloquear"
   ============================================================ */
const Auth = {
  ITER: 150000,
  sessKey: 'agenda_sess',
  keepKey: 'agenda_keep_until',
  tries: 0, blockUntil: 0, timer: null, lastAct: Date.now(), unlocked: false, role: (() => { try { const r = localStorage.getItem('agenda_role'); return r === 'recep' ? 'recep' : 'comp'; } catch (e) { return 'comp'; } })(),

  cfg() { return DB.cfg('auth', null); },
  supported() { return !!(window.crypto && crypto.subtle && crypto.getRandomValues); },
  b64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); },
  salt() { const a = new Uint8Array(16); crypto.getRandomValues(a); return this.b64(a); },
  async hash(pass, salt, iter) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), iterations: iter || this.ITER }, key, 256);
    return this.b64(bits);
  },
  recCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(12); crypto.getRandomValues(a);
    const s = Array.from(a, n => abc[n % abc.length]).join('');
    return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
  },
  normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); },
  ss(get, val) { try { if (get) return sessionStorage.getItem(this.sessKey); if (val) sessionStorage.setItem(this.sessKey, val); else sessionStorage.removeItem(this.sessKey); } catch (e) { return null; } },
  keepValid() { try { return +localStorage.getItem(this.keepKey) > Date.now(); } catch (e) { return false; } },
  setKeep(on) { try { if (on) { const d = new Date(); d.setHours(23, 59, 59, 0); localStorage.setItem(this.keepKey, String(d.getTime())); } else localStorage.removeItem(this.keepKey); } catch (e) { } },

  /* chamado no início: resolve quando o usuário estiver liberado */
  gate() {
    return new Promise(resolve => {
      this._resolve = resolve;
      const mode = () => this.role === 'forn' ? 'forn' : this.role === 'recep' ? 'recep' : 'login';
      Cloud.current().then(user => {
        if (user) return Cloud.activate(user);
        this.show(mode());
      }).catch(error => {
        if (Cloud.user) Cloud.logout().catch(() => {});
        this.show(mode());
        setTimeout(() => toast('Servidor indisponivel. Abra o endereco publicado ou verifique a configuracao da API.', 'err', 10000), 100);
        console.error(error);
      });
    });
  },
  liberar() {
    this.unlocked = true; this.tries = 0;
    document.body.classList.remove('locked');
    const el = document.getElementById('auth'); if (el) el.remove();
    const a = this.cfg(); if (a) this.ss(false, a.usuario);
    this.lastAct = Date.now(); this.startIdle();
    if (this._resolve) { const r = this._resolve; this._resolve = null; r(); }
    if (typeof App !== 'undefined' && App.view && document.getElementById('nav').innerHTML) { App.refreshChrome(); Auth.paintUser(); }
    if (typeof Aviso !== 'undefined') setTimeout(() => Aviso.check(), 300);
  },
  async bloquear() {
    if (!this.cfg()) { toast('Cadastre uma senha em Backup e configurações para poder bloquear.', 'warn'); return; }
    this.unlocked = false; this.ss(false, ''); this.setKeep(false);
    document.querySelectorAll('.modal-bg').forEach(m => m.remove());
    await Cloud.logout();
    this.show('login');
  },
  startIdle() {
    if (this._idleOn) return; this._idleOn = true;
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(ev => document.addEventListener(ev, () => { this.lastAct = Date.now(); }, { passive: true, capture: true }));
    setInterval(() => {
      const a = this.cfg(); if (!a || !this.unlocked || !a.autoLock || this.keepValid()) return;
      if (Date.now() - this.lastAct > a.autoLock * 60000) { this.bloquear(); toast('Agenda bloqueada por inatividade.', 'info'); }
    }, 20000);
  },
  paintUser() {
    const a = this.cfg(), el = document.getElementById('userBox'); if (!el) return;
    el.innerHTML = a ? `<span class="u-av">${esc((a.nome || a.usuario).trim().charAt(0).toUpperCase())}</span><span class="u-n">${esc(a.nome || a.usuario)}</span>` : '';
    el.hidden = !a;
    const lb = document.getElementById('lockBtn'); if (lb) lb.hidden = !a;
  },

  /* ---------- telas ---------- */
  show(mode, extra) {
    document.body.classList.add('locked');
    let el = document.getElementById('auth');
    if (!el) { el = document.createElement('div'); el.id = 'auth'; document.body.appendChild(el); }
    const a = this.cfg();
    if ((this.role === 'forn' || this.role === 'recep') && (mode === 'login' || mode === 'setup')) mode = this.role;
    const roleSw = ['login', 'setup', 'forn', 'recep'].includes(mode) ? `<div class="au-role">${[['comp', 'COMPRADOR'], ['forn', 'FORNECEDOR'], ['recep', 'RECEPÇÃO']].map(([k, l]) => `<button type="button" data-au-role="${k}" class="${(k === this.role ? 'on' : '')}">${l}</button>`).join('')}</div>` : '';
    const eye = `<button type="button" class="au-eye" tabindex="-1" title="Mostrar/ocultar senha">${icon('eye')}</button>`;
    const pw = (name, label, ac) => `<label class="au-f"><span>${label}</span><div class="au-pw"><input type="password" name="${name}" autocomplete="${ac}" required>${eye}</div></label>`;
    const head = (t, s) => `<img class="au-logo" src="${document.getElementById('appIcon').src}" alt=""><h1>${t}</h1><p class="au-sub">${s}</p>`;
    let body = '';
    if (mode === 'setup') body = head('Bem-vindo à sua Agenda', 'Primeiro acesso: crie o login que vai proteger a agenda neste computador.') + `
      <form id="auForm" autocomplete="off">
        <label class="au-f"><span>Seu nome</span><input name="nome" placeholder="Ex.: Rafael" value="${esc(P().nomeUsuario || '')}" required></label>
        <label class="au-f"><span>Usuário (login)</span><input name="usuario" placeholder="Ex.: rafael" autocapitalize="none" required></label>
        ${pw('senha', 'Senha (mínimo 6 caracteres)', 'new-password')}
        ${pw('senha2', 'Repita a senha', 'new-password')}
        <div class="au-msg" id="auMsg"></div>
        <button class="btn primary au-go" type="submit">Criar acesso e entrar</button>
        <p class="au-note">${icon('shield', 'xs')} A senha impede que outras pessoas abram a agenda neste computador. Ela é guardada criptografada e não vai junto com o backup.</p>
      </form>`;
    else if (mode === 'login') body = head(a && a.nome ? 'Olá, ' + esc(a.nome.split(' ')[0]) : 'Entrar', 'Acesso da equipe · Agenda e Planejamento') + `
      <form id="auForm" autocomplete="on">
        <label class="au-f"><span>Usuário</span><input name="usuario" value="${esc(a && a.usuario || '')}" autocomplete="username" autocapitalize="none" required></label>
        ${pw('senha', 'Senha', 'current-password')}
        <div class="au-msg" id="auMsg"></div>
        <button class="btn primary au-go" type="submit">Entrar</button>
        <p class="au-note">O administrador da agenda cria os acessos da equipe.</p>
      </form>`;
    else if (mode === 'forn') body = head('Área do fornecedor', 'Digite o código de acesso recebido do comprador para consultar e agendar seus atendimentos.') + `
      <form id="auForm" autocomplete="off">
        <label class="au-f"><span>Código de acesso</span><input name="codigo" placeholder="XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" required></label>
        <div class="au-msg" id="auMsg"></div>
        <button class="btn primary au-go" type="submit">Entrar como fornecedor</button>
        <p class="au-note">${icon('shield', 'xs')} O código dá acesso somente aos horários e atendimentos vinculados a você.</p>
      </form>`;
    else if (mode === 'recep') body = head('Painel da recepção', 'Entre com o usuário e a senha da recepção. O painel mostra os agendamentos de todos os compradores.') + (true ? `
      <form id="auForm" autocomplete="off">
        <label class="au-f"><span>Usuário</span><input name="usuario" placeholder="RECEPCAO" autocapitalize="characters" required></label>
        ${pw('senha', 'Senha', 'current-password')}
        <div class="au-msg" id="auMsg"></div>
        <button class="btn primary au-go" type="submit">Abrir painel da recepção</button>
        <p class="au-note">${icon('shield', 'xs')} A recepção vê os horários e atendimentos agendados e marca a chegada do fornecedor.</p>
      </form>` : '');
    else if (mode === 'forgot') body = head('Recuperar acesso', 'Digite o código de recuperação que apareceu quando você criou a senha e escolha uma senha nova.') + `
      <form id="auForm" autocomplete="off">
        <label class="au-f"><span>Código de recuperação</span><input name="codigo" placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" required></label>
        ${pw('senha', 'Nova senha (mínimo 6 caracteres)', 'new-password')}
        ${pw('senha2', 'Repita a nova senha', 'new-password')}
        <div class="au-msg" id="auMsg"></div>
        <button class="btn primary au-go" type="submit">Trocar senha e entrar</button>
        <a class="au-link" data-au="login">← Voltar para o login</a>
        <p class="au-note">Sem o código não é possível recuperar. Nesse caso, o caminho é restaurar um backup em outro navegador e criar um login novo.</p>
      </form>`;
    else if (mode === 'code') body = head('Guarde seu código de recuperação', 'Se esquecer a senha, é com este código que você entra de novo. Ele aparece só agora.') + `
      <div class="au-code">${esc(extra)}</div>
      <div class="au-row"><button type="button" class="btn" data-au="copy">${icon('download')} Copiar código</button></div>
      <label class="au-chk"><input type="checkbox" id="auOk"> Anotei o código em um lugar seguro</label>
      <button class="btn primary au-go" data-au="enter" disabled>Entrar na agenda</button>`;
    el.innerHTML = `<img class="au-brand" src="${document.getElementById('brandLogo').src}" alt="Grupo Toureiro"><div class="au-card">${roleSw}${body}</div><div class="au-foot">Agenda e Planejamento · versão ${APP_VERSION}</div>`;
    this.mount(el, mode, extra);
  },

  mount(el, mode, extra) {
    el.querySelectorAll('.au-eye').forEach(b => b.addEventListener('click', () => { const i = b.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; i.focus(); }));
    el.querySelectorAll('[data-au=forgot]').forEach(b => b.addEventListener('click', () => this.show('forgot')));
    el.querySelectorAll('[data-au=login]').forEach(b => b.addEventListener('click', () => this.show('login')));
    const msg = t => { const m = el.querySelector('#auMsg'); if (m) m.textContent = t || ''; };
    el.querySelectorAll('[data-au-role]').forEach(b => b.addEventListener('click', () => { this.role = b.dataset.auRole; try { localStorage.setItem('agenda_role', this.role); } catch (e) { } this.show(this.role === 'forn' ? 'forn' : this.role === 'recep' ? 'recep' : 'login'); }));
    if (mode === 'forn' || mode === 'recep') {
      const ff = el.querySelector('#auForm'); if (!ff) return;
      setTimeout(() => ff.querySelector('input').focus(), 50);
      ff.addEventListener('submit', async e => {
        e.preventDefault();
        if (Date.now() < this.blockUntil) return msg('Muitas tentativas erradas. Aguarde ' + Math.ceil((this.blockUntil - Date.now()) / 1000) + 's.');
        try {
          const credentials = mode === 'recep'
            ? { role: 'reception', username: ff.querySelector('[name=usuario]').value, password: ff.querySelector('[name=senha]').value }
            : { role: 'supplier', code: ff.querySelector('[name=codigo]').value };
          await Cloud.activate(await Cloud.login(credentials));
        } catch (error) {
          this.falhou();
          msg(error.message || 'Nao foi possivel entrar.');
        }
      });
      return;
    }
    if (mode === 'code') {
      const ok = el.querySelector('#auOk'), go = el.querySelector('[data-au=enter]');
      ok.addEventListener('change', () => go.disabled = !ok.checked);
      el.querySelector('[data-au=copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(extra); toast('Código copiado.', 'ok'); } catch (e) { toast('Selecione e copie o código manualmente.', 'warn'); } });
      go.addEventListener('click', () => this.liberar());
      return;
    }
    const f = el.querySelector('#auForm');
    const first = f.querySelector(mode === 'login' ? '[name=senha]' : 'input'); setTimeout(() => first && first.focus(), 50);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const v = n => (f.querySelector(`[name=${n}]`) || {}).value || '';
      const btn = f.querySelector('.au-go'); btn.disabled = true;
      try {
        if (mode === 'setup' || mode === 'forgot') {
          if (v('senha').length < 6) return msg('A senha precisa ter pelo menos 6 caracteres.');
          if (v('senha') !== v('senha2')) return msg('As senhas não conferem.');
          if (mode === 'forgot') {
            const a = this.cfg();
            if (Date.now() < this.blockUntil) return msg('Muitas tentativas. Aguarde alguns segundos.');
            if ((await this.hash(this.normCode(v('codigo')), a.recSalt, a.iter)) !== a.recHash) { this.falhou(); return msg('Código de recuperação incorreto.'); }
            await this.salvarSenha(v('senha'), a);
            toast('Senha alterada.', 'ok');
            return this.liberar();
          }
          if (!v('usuario').trim()) return msg('Informe o usuário.');
          const code = await this.criar(v('nome').trim(), v('usuario').trim(), v('senha'));
          if (!P().nomeUsuario && v('nome').trim()) await DB.setCfg('params', Object.assign({}, DB.cfg('params', {}), { nomeUsuario: v('nome').trim().split(' ')[0] }), true);
          return this.show('code', code);
        }
        // login
        if (Date.now() < this.blockUntil) return msg('Muitas tentativas erradas. Aguarde ' + Math.ceil((this.blockUntil - Date.now()) / 1000) + 's.');
        const roles = { comp: 'buyer' };
        try {
          const user = await Cloud.login({ role: roles[this.role] || 'buyer', username: v('usuario'), password: v('senha') });
          await Cloud.activate(user);
          if (Cloud.isBuyer(user)) Aviso.pedirPermissao();
        } catch (error) {
          this.falhou();
          f.querySelector('[name=senha]').value = '';
          f.querySelector('[name=senha]').focus();
          msg(error.message || 'Nao foi possivel entrar.');
        }
      } finally { btn.disabled = false; }
    });
  },
  falhou() { this.tries++; if (this.tries >= 5) { this.blockUntil = Date.now() + 30000; this.tries = 0; } },

  async criar(nome, usuario, senha) {
    const code = this.recCode();
    const a = { nome, usuario, autoLock: 30, iter: this.ITER, criadoEm: new Date().toISOString() };
    a.recSalt = this.salt(); a.recHash = await this.hash(this.normCode(code), a.recSalt, a.iter);
    await this.salvarSenha(senha, a);
    return code;
  },
  async salvarSenha(senha, base) {
    const a = Object.assign({}, base); a.salt = this.salt(); a.iter = this.ITER; a.hash = await this.hash(senha, a.salt, a.iter); a.alteradoEm = new Date().toISOString();
    await DB.setCfg('auth', a, true);
  },
  async conferir(senha) { const a = this.cfg(); return !!a && (await this.hash(senha, a.salt, a.iter)) === a.hash; }
};

/* ============================================================
   ÁREA DO FORNECEDOR (versão teste — tudo neste navegador)
   - Comprador: define horários de atendimento, bloqueia dias,
     cadastra fornecedores (cada um recebe um código de acesso)
     e agenda atendimentos de qualquer duração
   - Fornecedor: entra com o código, vê só a agenda do comprador
     dele e agenda no máximo 1 hora em horário livre
   ============================================================ */
const FORN_CFG_DEFAULT = {
  passo: 30,
  dias: { 1: { on: true, ini: '08:00', fim: '17:00' }, 2: { on: true, ini: '08:00', fim: '17:00' }, 3: { on: true, ini: '08:00', fim: '17:00' },
    4: { on: true, ini: '08:00', fim: '17:00' }, 5: { on: true, ini: '08:00', fim: '17:00' }, 6: { on: false, ini: '08:00', fim: '12:00' }, 0: { on: false, ini: '08:00', fim: '12:00' } }
};
const FORN_MAX_MIN = 60; // fornecedor agenda no máximo 1 hora
const FORN_DIAS_VISIVEIS = 21;

const Forn = {
  cfg() { const c = DB.cfg('fornCfg', null); return c ? Object.assign({}, FORN_CFG_DEFAULT, c, { dias: Object.assign({}, FORN_CFG_DEFAULT.dias, c.dias || {}) }) : FORN_CFG_DEFAULT; },
  bloqs() { return sortBy(DB.cfg('fornBloq', []), b => b.de, b => b.ini || ''); },
  lista() { return sortBy(DB.cfg('fornecedores', []), f => norm(f.nome)); },
  get(id) { return DB.cfg('fornecedores', []).find(f => f.id === id) || null; },
  // indústrias que o fornecedor representa: [{ labId, nome }] (labId vazio = indústria fora de "Meus laboratórios")
  inds(f) {
    if (!f) return [];
    if (Array.isArray(f.industrias)) return f.industrias.map(i => ({ labId: i.labId || '', nome: (i.labId && Engine.labNome(i.labId)) || i.nome || '' })).filter(i => i.nome);
    return f.labId ? [{ labId: f.labId, nome: Engine.labNome(f.labId) }] : [];
  },
  indsTxt(f) { const l = this.inds(f); return l.length ? l.map(i => i.nome).join(' · ') : 'sem indústria'; },
  // indústrias de um atendimento
  indsAtend(d) { return Array.isArray(d.industrias) && d.industrias.length ? d.industrias : d.labId ? [Engine.labNome(d.labId)].filter(Boolean) : []; },
  label(f) { if (!f) return ''; const l = this.inds(f); return f.nome + (l.length ? ' · ' + (l.length === 1 ? l[0].nome : l.length + ' indústrias') : ''); },
  // seletor de várias indústrias (chips) — busca em Meus laboratórios ou aceita nome livre
  pickerHTML(lista) {
    const labs = Engine.labsAtivos();
    return `<div class="ind-pick" data-v="${esc(JSON.stringify(lista || []))}"><div class="ind-chips"></div>
      <div class="ind-add"><input list="indLabs" placeholder="Digite o nome ou código da indústria e Enter"><button type="button" class="btn sm">${icon('plus')} Adicionar</button></div>
      <datalist id="indLabs">${labs.map(l => `<option value="${esc(Engine.labLabel(l))}">`).join('')}</datalist></div>`;
  },
  pickerMount(root, onChange) {
    const box = root.querySelector('.ind-pick'); if (!box) return;
    const inp = box.querySelector('input'), chips = box.querySelector('.ind-chips');
    const get = () => JSON.parse(box.dataset.v || '[]');
    const set = v => { box.dataset.v = JSON.stringify(v); paint(); if (onChange) onChange(v); };
    const paint = () => { const v = get(); chips.innerHTML = v.length ? v.map((i, n) => `<span class="ind-chip">${esc(i.nome)}${i.labId ? '' : ' <small>(não cadastrada)</small>'}<button type="button" data-n="${n}" title="Remover">${icon('x')}</button></span>`).join('') : '<span class="muted small">Nenhuma indústria adicionada.</span>'; };
    const add = () => {
      const t = inp.value.trim(); if (!t) return;
      const labs = Engine.labsAtivos();
      const lab = labs.find(l => Engine.labLabel(l) === t) || labs.find(l => norm(l.nome) === norm(t) || (l.codigo && String(l.codigo) === t));
      const it = lab ? { labId: lab.id, nome: lab.nome } : { labId: '', nome: t.toUpperCase() };
      const v = get();
      if (v.some(x => (it.labId && x.labId === it.labId) || norm(x.nome) === norm(it.nome))) { toast('Essa indústria já está na lista.', 'warn'); inp.value = ''; return; }
      v.push(it); inp.value = ''; set(v); inp.focus();
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    box.querySelector('.ind-add .btn').addEventListener('click', add);
    chips.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (!b) return; const v = get(); v.splice(+b.dataset.n, 1); set(v); });
    paint();
  },
  pickerValue(root) { const box = root.querySelector('.ind-pick'); return box ? JSON.parse(box.dataset.v || '[]') : []; },
  // checkboxes para escolher as indústrias de um atendimento
  checksHTML(f, sel) {
    const l = this.inds(f); if (!l.length) return '';
    return `<div class="ind-checks">${l.map(i => `<label class="chk"><input type="checkbox" name="ind" value="${esc(i.nome)}" ${!sel || sel.includes(i.nome) ? 'checked' : ''}> ${esc(i.nome)}</label>`).join('')}</div>`;
  },
  checksValue(root) { return Array.from(root.querySelectorAll('.ind-checks input[name=ind]:checked')).map(i => i.value); },
  min(h) { const p = String(h || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); },
  hm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); },
  novoCodigo() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(8); crypto.getRandomValues(a);
    const s = Array.from(a, n => abc[n % abc.length]).join('');
    return s.slice(0, 4) + '-' + s.slice(4);
  },
  porCodigo(c) { const n = Auth.normCode(c); return n ? DB.cfg('fornecedores', []).find(f => Auth.normCode(f.codigo) === n) || null : null; },

  atendimentos() { return sortBy(Engine.demandasAbertas().filter(d => d.atend), d => d.data, d => d.hora); },
  doFornecedor(fornId) { return this.atendimentos().filter(d => d.fornId === fornId && d.data >= today()); },
  diaInfo(data) {
    const c = this.cfg(), dc = c.dias[weekday(data)];
    if (!dc || !dc.on || !dc.ini || !dc.fim || dc.fim <= dc.ini) return null;
    return { ini: this.min(dc.ini), fim: this.min(dc.fim), passo: Math.max(5, +c.passo || 30) };
  },
  // tudo que ocupa o comprador no dia: agendamentos com horário + bloqueios
  ocupados(data, ignoreId) {
    const passo = this.cfg().passo || 30;
    return Engine.demandasAbertas().filter(d => d.data === data && d.hora && d.id !== ignoreId)
      .map(d => ({ ini: this.min(d.hora), fim: d.horaFim && d.horaFim > d.hora ? this.min(d.horaFim) : this.min(d.hora) + passo, d }));
  },
  bloqueiosDia(data) {
    return this.bloqs().filter(b => data >= b.de && data <= (b.ate || b.de))
      .map(b => ({ ini: b.ini ? this.min(b.ini) : 0, fim: b.fim ? this.min(b.fim) : 24 * 60, b }));
  },
  diaBloqueado(data) { return this.bloqueiosDia(data).some(x => x.ini === 0 && x.fim >= 24 * 60); },
  slots(data, dur, ignoreId) {
    const di = this.diaInfo(data);
    if (!di) return [];
    const occ = this.ocupados(data, ignoreId), bl = this.bloqueiosDia(data);
    const t = today(), agora = data === t ? this.min(nowHM()) : data < t ? 1e9 : -1;
    const out = [];
    for (let s = di.ini; s + di.passo <= di.fim; s += di.passo) {
      const e = s + dur;
      const blk = bl.find(x => s < x.fim && e > x.ini), oc = occ.find(x => s < x.fim && e > x.ini);
      let st = 'livre';
      if (s <= agora) st = 'passado';
      else if (blk) st = 'bloq';
      else if (oc) st = 'ocup';
      else if (e > di.fim) st = 'fim';
      out.push({ ini: s, fim: e, st, d: oc ? oc.d : null, b: blk ? blk.b : null, dentro: !!oc && s >= oc.ini && s < oc.fim });
    }
    return out;
  },
  livres(data, dur) { return this.slots(data, dur).filter(s => s.st === 'livre').length; },
  conflito(data, ini, fim, ignoreId) {
    const a = this.min(ini), b = this.min(fim);
    const oc = this.ocupados(data, ignoreId).find(x => a < x.fim && b > x.ini);
    if (oc) return 'Conflita com: ' + oc.d.titulo + ' (' + oc.d.hora + ')';
    const bl = this.bloqueiosDia(data).find(x => a < x.fim && b > x.ini);
    if (bl) return 'Horário bloqueado' + (bl.b.motivo ? ': ' + bl.b.motivo : '');
    return '';
  },
  async agendar({ fornId, nome, data, ini, fim, assunto, por, industrias }) {
    if (Cloud.user?.role === 'supplier') return Cloud.supplierBook({ date: data, start: ini, end: fim, subject: assunto, industries: industrias });
    const f = fornId ? this.get(fornId) : null;
    const quem = f ? f.nome : (nome || 'Fornecedor');
    const inds = f ? this.inds(f).filter(i => !industrias || industrias.includes(i.nome)) : [];
    const d = {
      id: uid(), titulo: 'Atendimento fornecedor: ' + quem + ' (' + ini + '–' + fim + ')', data, hora: ini, horaFim: fim,
      labId: (inds.find(i => i.labId) || {}).labId || '', tipo: 'Compromisso', status: 'A fazer', prioridade: 'MEDIA', recorrencia: { tipo: 'nenhuma' },
      descricao: (inds.length ? 'Indústrias: ' + inds.map(i => i.nome).join(', ') + '\n' : '') + (assunto ? 'Assunto: ' + assunto + '\n' : '') + (por === 'fornecedor' ? 'Agendado pelo fornecedor na área do fornecedor.' : 'Agendado pelo comprador.'),
      atend: true, fornId: fornId || '', fornNome: quem, compradorNome: ((Auth.cfg() || {}).nome) || '', assunto: assunto || '', agendadoPor: por, origem: por === 'fornecedor' ? 'área do fornecedor' : 'manual',
      industrias: inds.map(i => i.nome)
    };
    return Engine.salvarDemanda(d);
  },
  async cancelar(id, motivo) {
    if (Cloud.user?.role === 'supplier') return Cloud.supplierCancel(id);
    await Engine.cancelar(id, motivo);
  },

  /* ---------- portal do fornecedor (tela cheia, sem abrir a agenda do comprador) ---------- */
  sess: null, st: {},
  abrir(f) {
    this.sess = f.id;
    this.st = { dia: null, dur: Math.min(FORN_MAX_MIN, 60), sel: null };
    const a = document.getElementById('auth'); if (a) a.remove();
    document.body.classList.add('locked');
    this.render();
  },
  async sair() {
    this.sess = null;
    const p = document.getElementById('fornPortal'); if (p) p.remove();
    Auth.role = 'forn';
    await Cloud.logout();
    Auth.show('forn');
  },
  render() {
    const f = this.get(this.sess);
    if (!f) return this.sair();
    let el = document.getElementById('fornPortal');
    if (!el) { el = document.createElement('div'); el.id = 'fornPortal'; document.body.appendChild(el); el.addEventListener('click', e => this.onClick(e)); }
    const c = this.cfg(), st = this.st, t = today(), a = Auth.cfg();
    const passo = c.passo || 30;
    const durs = []; for (let m = passo; m <= FORN_MAX_MIN; m += passo) durs.push(m);
    if (!durs.length) durs.push(FORN_MAX_MIN);
    if (!durs.includes(st.dur)) st.dur = durs[durs.length - 1];
    const dias = []; for (let i = 0; i < FORN_DIAS_VISIVEIS; i++) dias.push(addDays(t, i));
    const info = dias.map(d => ({ d, n: this.diaInfo(d) && !this.diaBloqueado(d) ? this.livres(d, st.dur) : 0 }));
    if (!st.dia || !dias.includes(st.dia)) { const p = info.find(x => x.n); st.dia = p ? p.d : t; }
    const meus = this.doFornecedor(f.id);
    const durTxt = m => m >= 60 ? (m / 60) + ' hora' + (m > 60 ? 's' : '') : m + ' min';
    const slots = this.diaInfo(st.dia) ? this.slots(st.dia, st.dur) : [];
    const stTxt = { passado: 'Encerrado', bloq: 'Indisponível', ocup: 'Indisponível', fim: 'Indisponível' };
    const slotHtml = slots.map(s => {
      const meu = s.st === 'ocup' && s.dentro && s.d.fornId === f.id;
      const sel = st.sel === s.ini && s.st === 'livre';
      return `<button class="fp-slot ${s.st}${meu ? ' meu' : ''}${sel ? ' sel' : ''}" ${s.st === 'livre' ? `data-fp="slot" data-m="${s.ini}"` : 'disabled'}><b>${this.hm(s.ini)}</b><small>${s.st === 'livre' ? 'Disponível' : meu ? 'Seu agendamento' : stTxt[s.st]}</small></button>`;
    }).join('');
    let painel;
    if (!this.diaInfo(st.dia) || this.diaBloqueado(st.dia)) painel = `<div class="fp-vazio">${icon('lock')}<b>Indisponível</b><span>O comprador não atende neste dia.</span></div>`;
    else painel = `<div class="fp-slots">${slotHtml}</div>`;
    const selTxt = st.sel != null ? `${fmtDateLong(st.dia)}, das <b>${this.hm(st.sel)}</b> às <b>${this.hm(st.sel + st.dur)}</b>` : '';
    el.innerHTML = `<header class="fp-top"><img src="${document.getElementById('brandLogo').src}" alt="Grupo Toureiro"><div class="fp-tt"><b>Área do fornecedor</b><span>Agenda de atendimento de <b>${esc((a && a.nome) || 'Comprador')}</b></span></div>
        <div class="fp-user"><span class="u-av">${esc(f.nome.charAt(0).toUpperCase())}</span><span>${esc(this.label(f))}</span><button class="btn sm" data-fp="sair">${icon('lock')} Sair</button></div></header>
      <div class="fp-body">
        <section class="card fp-main">
          <div class="card-h"><h3>1. Escolha o dia</h3><span class="muted small">próximos ${FORN_DIAS_VISIVEIS} dias</span></div>
          <div class="fp-days">${info.map(x => `<button class="fp-day ${x.d === st.dia ? 'on' : ''} ${x.n ? '' : 'off'}" data-fp="dia" data-d="${x.d}"><small>${DIAS_CURTO[weekday(x.d)]}</small><b>${fmtDateShort(x.d)}</b><span>${x.n ? x.n + ' livre' + (x.n > 1 ? 's' : '') : 'Indisponível'}</span></button>`).join('')}</div>
          <div class="card-h fp-h2"><h3>2. Duração e horário · ${esc(fmtDateLong(st.dia))}</h3>
            <div class="segbtn">${durs.map(m => `<button class="${m === st.dur ? 'on' : ''}" data-fp="dur" data-m="${m}">${durTxt(m)}</button>`).join('')}</div></div>
          <p class="muted small" style="margin:0 0 10px">Você pode agendar até 1 hora. Horários em cinza estão indisponíveis.</p>
          ${painel}
          <div class="fp-conf ${st.sel != null ? '' : 'hide'}">
            <div class="card-h"><h3>3. Confirmar</h3></div>
            <p>${selTxt}</p>
            ${this.inds(f).length ? `<div class="au-f"><span>Indústrias que serão tratadas neste atendimento</span>${this.checksHTML(f, st.inds)}</div>` : ''}
            <label class="au-f"><span>Assunto do atendimento (opcional)</span><input id="fpAssunto" maxlength="160" placeholder="Ex.: apresentação de lançamentos, negociação de pedido"></label>
            <button class="btn primary" data-fp="ok">${icon('check')} Confirmar agendamento</button> <button class="btn" data-fp="limpa">Cancelar</button>
          </div>
        </section>
        <aside class="fp-side">
        <div class="card fp-inds"><div class="card-h"><h3>Minhas indústrias</h3><span class="pill">${this.inds(f).length}</span></div>
          ${this.inds(f).length ? `<div class="ind-list">${this.inds(f).map(i => `<span class="ind-chip">${esc(i.nome)}</span>`).join('')}</div>` : '<p class="muted small">Nenhuma indústria vinculada. Peça ao comprador para incluir.</p>'}</div>
        <div class="card fp-meus"><div class="card-h"><h3>Meus agendamentos</h3><span class="pill">${meus.length}</span></div>
          ${meus.length ? meus.map(d => `<div class="fp-mi"><div><b>${fmtDateShort(d.data)} · ${DIAS_CURTO[weekday(d.data)]}</b><span>${esc(d.hora)}–${esc(d.horaFim || '')}</span>${this.indsAtend(d).length ? `<small>${esc(this.indsAtend(d).join(' · '))}</small>` : ''}${d.assunto ? `<small>${esc(d.assunto)}</small>` : ''}</div><button class="btn xs" data-fp="cancel" data-id="${d.id}">Cancelar</button></div>`).join('') : '<p class="muted small">Você ainda não tem atendimentos agendados.</p>'}
        </div></aside>
      </div><div class="au-foot fp-foot">Versão de teste · Agenda e Planejamento ${APP_VERSION}</div>`;
  },
  async onClick(e) {
    const b = e.target.closest('[data-fp]'); if (!b) return;
    const st = this.st, k = b.dataset.fp;
    const pt = document.getElementById('fornPortal'); if (pt && pt.querySelector('.ind-checks')) st.inds = this.checksValue(pt); // mantém as marcações entre cliques
    if (k === 'sair') return this.sair();
    if (k === 'dia') { st.dia = b.dataset.d; st.sel = null; }
    else if (k === 'dur') { st.dur = +b.dataset.m; st.sel = null; }
    else if (k === 'slot') st.sel = +b.dataset.m;
    else if (k === 'limpa') st.sel = null;
    else if (k === 'ok') {
      if (st.sel == null) return;
      const ini = this.hm(st.sel), fim = this.hm(st.sel + Math.min(st.dur, FORN_MAX_MIN));
      const s = this.slots(st.dia, st.dur).find(x => x.ini === st.sel);
      if (!s || s.st !== 'livre') { toast('Este horário acabou de ficar indisponível. Escolha outro.', 'warn'); st.sel = null; return this.render(); }
      const assunto = (document.getElementById('fpAssunto') || {}).value || '';
      const portal = document.getElementById('fornPortal'), temInds = this.inds(this.get(this.sess)).length;
      const industrias = this.checksValue(portal);
      if (temInds && !industrias.length) return toast('Marque pelo menos uma indústria para o atendimento.', 'warn');
      await this.agendar({ fornId: this.sess, data: st.dia, ini, fim, assunto: assunto.trim(), por: 'fornecedor', industrias: temInds ? industrias : null });
      toast('Atendimento agendado: ' + fmtDate(st.dia) + ' das ' + ini + ' às ' + fim + '.', 'ok');
      st.sel = null;
    }
    else if (k === 'cancel') {
      const d = DB.get('demandas', b.dataset.id);
      if (!d || d.fornId !== this.sess) return;
      if (!await confirmBox('Cancelar o atendimento de ' + fmtDate(d.data) + ' às ' + d.hora + '?', 'Cancelar atendimento', true)) return;
      await this.cancelar(d.id, 'Cancelado pelo fornecedor');
    }
    this.render();
  }
};

/* ---------- painel da recepção (tela cheia) ----------
   mostra os atendimentos do dia com horário, fornecedor e comprador
   e permite registrar a chegada do fornecedor */
const RECEP_USUARIO = 'RECEPCAO', RECEP_SENHA_PADRAO = '123456';
// vai para o painel da recepção: atendimento de fornecedor OU qualquer agendamento com horário
// (exceto cancelados e os marcados como "não mostrar na recepção")
function naRecepcao(d) { return !!d && d.status !== 'Cancelado' && (!!d.atend || !!d.hora); }
const Recep = {
  st: {}, timer: null, mapa: new Map(),
  // senha guardada só como hash; enquanto o comprador não trocar, vale a senha padrão
  async conferir(usuario, senha) {
    if (norm(usuario) !== norm(RECEP_USUARIO)) return false;
    const r = DB.cfg('recepAuth', null);
    if (!r || !r.hash) return senha === RECEP_SENHA_PADRAO;
    return (await Auth.hash(senha, r.salt, r.iter)) === r.hash;
  },
  async salvarSenha(senha) {
    if (senha == null) return DB.setCfg('recepAuth', null);
    const salt = Auth.salt();
    await DB.setCfg('recepAuth', { usuario: RECEP_USUARIO, salt, iter: Auth.ITER, hash: await Auth.hash(senha, salt, Auth.ITER), alteradoEm: new Date().toISOString() });
  },
  abrir() {
    this.st = { dia: today(), q: '' };
    const a = document.getElementById('auth'); if (a) a.remove();
    document.body.classList.add('locked');
    this.render();
    this.atualizar();
    clearInterval(this.timer);
    this.timer = setInterval(() => { if (!document.getElementById('recepPortal')) return clearInterval(this.timer); this.atualizar(); }, 10000);
  },
  async sair() {
    clearInterval(this.timer);
    const p = document.getElementById('recepPortal'); if (p) p.remove();
    Auth.role = 'recep';
    await Cloud.logout();
    Auth.show('recep');
  },
  // relê o banco deste navegador (outras abas) e a pasta compartilhada (outros computadores)
  async atualizar() {
    if (this._lendo) return; this._lendo = true;
    try {
      if (Cloud.user?.role === 'reception') await Cloud.refreshReception();
      else {
        if (DB.idb) await DB.loadAll();
        if (Share.ok()) { try { await Share.lerTodos(); Share.erro = ''; } catch (e) { Share.falha(e); } }
      }
    } finally { this._lendo = false; }
    this.renderSeguro();
  },
  // não redesenha enquanto a pessoa digita na busca ou mexe na data
  renderSeguro() {
    const el = document.getElementById('recepPortal'); if (!el) return;
    const ae = document.activeElement;
    if (ae && el.contains(ae) && (ae.id === 'rpBusca' || ae.id === 'rpDia')) { this.relogio(); return; }
    this.render();
  },
  comprador(d) { return d.compradorNome || ((Auth.cfg() || {}).nome) || 'Comprador'; },
  // junta os agendamentos deste computador + os publicados por cada comprador na pasta compartilhada
  fontes() {
    const cols = new Map(), vistos = new Set(), a = Auth.cfg();
    const col = (key, nome, info) => { let c = cols.get(key); if (!c) cols.set(key, c = Object.assign({ key, nome, itens: [] }, info || {})); return c; };
    const localKey = a ? Share.slug(a.usuario) : null;
    if (Cloud.user?.role !== 'reception') DB.all('demandas').filter(naRecepcao).forEach(d => {
      const nome = a ? (a.nome || a.usuario) : this.comprador(d);
      const c = col(localKey || 'local_' + Share.slug(nome), nome, { local: true });
      c.itens.push(Object.assign({}, d, { _local: true, compradorNome: nome }));
      vistos.add(d.id);
    });
    // coluna vazia "neste computador" só faz sentido para comprador; a conta da recepção não tem agenda própria
    if (a && !cols.has(localKey) && !Share.ok() && Cloud.user?.role !== 'reception') col(localKey, a.nome || a.usuario, { local: true });
    Share.remotos.forEach(r => {
      const ov = (Share.overlay[r.slug] || {}).itens || {};
      const c = col(r.slug, r.comprador || r.usuario || 'Comprador', {});
      c.atualizadoEm = r.geradoEm;
      r.itens.forEach(d => {
        if (!d || !d.id || vistos.has(d.id) || d.status === 'Cancelado') return;
        vistos.add(d.id);
        const x = Object.assign({}, d, { _slug: r.slug, compradorNome: c.nome });
        const e = ov[d.id];
        if (e) {
          // o que a recepção marcou vale até o comprador confirmar
          x.chegouEm = e.chegouEm || null; x.avisoEm = e.avisoEm || null;
        }
        c.itens.push(x);
      });
    });
    return Array.from(cols.values()).sort((p, q) => (q.local ? 1 : 0) - (p.local ? 1 : 0) || p.nome.localeCompare(q.nome, 'pt-BR'));
  },
  relogio() { const c = document.getElementById('rpClock'); if (c) c.textContent = nowHM(); },
  // etapas: agendado → aguardando (falta ≤ 1h ou já passou) → na recepção → em atendimento → concluído
  status(d) {
    if (d.status === 'Cancelado') return 'cancelado';
    if (d.status === 'Concluído') return 'concluido';
    if (d.iniciouEm) return 'atendimento';
    if (d.chegouEm) return 'recepcao';
    const t = today();
    if (d.data < t) return 'aguardando';
    if (d.data > t) return 'agendado';
    return Forn.min(d.hora) - Forn.min(nowHM()) <= 60 ? 'aguardando' : 'agendado';
  },
  atraso(d) { if (d.data !== today() || d.chegouEm || STATUS_FECHADO.includes(d.status)) return 0; const m = Forn.min(nowHM()) - Forn.min(d.hora); return m > 0 ? m : 0; },
  hora(iso) { return iso && !isNaN(new Date(iso)) ? spParts(new Date(iso)).hm : ''; },
  iniciais(n) { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '')[0] + (p.length > 1 ? p[p.length - 1][0] : (p[0] || '')[1] || '')).toUpperCase(); },
  CORES: ['#c8102e', '#1d7fd6', '#16a34a', '#7c3aed', '#ea580c', '#0f5f7a', '#be185d', '#4d7c0f'],
  ST_TXT: { agendado: 'Agendado', aguardando: 'Aguardando', recepcao: 'Na recepção', atendimento: 'Em atendimento', concluido: 'Concluído', cancelado: 'Cancelado' },
  ICS: {
    total: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h2M11 14h2M15 14h2M7 17h2M11 17h2"/>',
    recepcao: '<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0 1 11-5.7"/><path d="M15 19l2 2 4-4"/>',
    aguardando: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    atendimento: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4.5 4.5 0 0 1 8 0"/>',
    concluido: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>'
  },
  ic(k, cls) { return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${this.ICS[k] || ICONS[k] || ''}</svg>`; },
  render() {
    let el = document.getElementById('recepPortal');
    if (!el) {
      el = document.createElement('div'); el.id = 'recepPortal'; document.body.appendChild(el);
      el.addEventListener('click', e => this.onClick(e));
      el.addEventListener('input', e => { if (e.target.id === 'rpBusca') { this.st.q = e.target.value; this.render(); const i = document.getElementById('rpBusca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
      el.addEventListener('change', e => { if (e.target.id === 'rpDia' && e.target.value) { this.st.dia = e.target.value; this.st.modo = 'dia'; this.render(); } });
    }
    const st = this.st, dia = st.dia, t = today(), hm = nowHM();
    const fontes = this.fontes();
    this.mapa = new Map();
    fontes.forEach(c => c.itens.forEach(d => this.mapa.set(d.id, d)));
    const q = norm(st.q || '');
    const multi = st.modo === 'prox' || !!q;
    const desde = st.modo === 'prox' && dia > t ? dia : t;
    const noPeriodo = d => multi ? d.data >= desde : d.data === dia;
    const bate = (d, c) => !q || norm([d.fornNome, d.titulo, Forn.indsAtend(d).join(' '), c.nome, d.assunto, d.descricao].join(' ')).includes(q);
    const doDia = c => sortBy(c.itens.filter(d => noPeriodo(d) && bate(d, c)), d => d.data, d => d.hora);
    const filtro = st.f || 'abertos';
    const todos = [];
    const compradores = fontes.map(c => { const it = doDia(c); todos.push(...it); return { nome: c.nome, atualizadoEm: c.atualizadoEm, local: c.local, itens: it.filter(d => this.passa(d, filtro)) }; })
      .filter(c => !q || c.itens.length || norm(c.nome).includes(q));
    const proximos = {};
    fontes.forEach(c => { proximos[c.nome] = c.itens.filter(d => d.data > dia && !STATUS_FECHADO.includes(d.status)).length; });
    const cont = { recepcao: 0, aguardando: 0, agendado: 0, atendimento: 0, concluido: 0, cancelado: 0 };
    todos.forEach(d => cont[this.status(d)]++);
    const BTN = {
      agendado: d => `<button class="rp-btn red" data-rp="chegou" data-id="${d.id}">${icon('check')} Registrar chegada e avisar</button>`,
      aguardando: d => `<button class="rp-btn red" data-rp="chegou" data-id="${d.id}">${icon('check')} Registrar chegada e avisar</button>`,
      recepcao: () => `<div class="rp-btn wait">${this.ic('aguardando')} Aguardando o comprador iniciar</div>`,
      atendimento: d => `<div class="rp-btn going">${this.ic('atendimento')} Em atendimento desde ${this.hora(d.iniciouEm)}</div>`,
      concluido: () => `<button class="rp-btn done" disabled>${icon('check')} Atendimento concluído</button>`
    };
    const avisoTxt = d => {
      if (!d.avisoEm || d.iniciouEm || STATUS_FECHADO.includes(d.status)) return '';
      const ciente = d.avisoVistoEm && d.avisoVistoEm >= d.avisoEm;
      return ciente ? `<div class="rp-aviso ok">${icon('check')} ${esc(this.comprador(d).split(' ')[0])} está ciente (${this.hora(d.avisoVistoEm)})</div>`
        : `<div class="rp-aviso wait">${icon('bell')} Aviso enviado às ${this.hora(d.avisoEm)} · aguardando o comprador <a data-rp="reavisar" data-id="${d.id}">avisar de novo</a></div>`;
    };
    const card = d => {
      const s = this.status(d), inds = Forn.indsAtend(d), atr = this.atraso(d);
      const info = s === 'recepcao' ? 'Chegou às ' + this.hora(d.chegouEm) : s === 'atendimento' ? (d.chegouEm ? 'Chegou às ' + this.hora(d.chegouEm) + ' · ' : '') + 'previsto até ' + (d.horaFim || '') : s === 'concluido' && d.finalizouEm ? 'Finalizado às ' + this.hora(d.finalizouEm) : atr ? 'Atrasado ' + atr + ' min' : (d.horaFim ? 'até ' + d.horaFim : '');
      return `<div class="rp-card ${s}">
        <div class="rp-ch"><b class="rp-time">${esc(d.hora || '--:--')}${d.horaFim ? `<small> – ${esc(d.horaFim)}</small>` : ''}</b><span class="rp-pill ${s}">${this.ST_TXT[s]}</span></div>
        <div class="rp-forn">${esc(d.fornNome || d.titulo || 'Agendamento')}</div>
        ${inds.length === 1 ? `<div class="rp-lab">${esc(inds[0])}</div>` : inds.length ? `<div class="rp-inds">${inds.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
        <div class="rp-ass">${d.assunto ? 'Assunto: ' + esc(d.assunto) : '&nbsp;'}</div>
        <div class="rp-meta ${atr && s !== 'recepcao' ? 'late' : ''}">${esc(info)}${s === 'recepcao' ? ` <a data-rp="voltar" data-id="${d.id}" title="Desfazer a chegada">desfazer</a>` : ''}</div>
        ${avisoTxt(d)}
        ${d.data > t && (s === 'agendado' || s === 'aguardando') ? `<div class="rp-btn done">${this.ic('total')} Agendado para ${DIAS_CURTO[weekday(d.data)]} ${fmtDateShort(d.data)}</div>` : BTN[s] ? BTN[s](d) : ''}</div>`;
    };
    const col = (c, i) => {
      const cor = this.CORES[i % this.CORES.length], n = c.itens.length, px = proximos[c.nome] || 0;
      const sync = c.local ? 'neste computador' : c.atualizadoEm ? 'atualizado ' + this.quando(c.atualizadoEm) : '';
      return `<div class="rp-col" style="--cc:${cor}">
        <div class="rp-colh"><span class="rp-av">${esc(this.iniciais(c.nome))}</span><div><b>${esc(c.nome)}</b><small>Comprador${sync ? ' · ' + esc(sync) : ''}</small></div><span class="rp-cnt"><b>${n}</b><small>agendamento${n === 1 ? '' : 's'}</small></span></div>
        <div class="rp-cards">${c.itens.map((d, j) => (multi && (j === 0 || c.itens[j - 1].data !== d.data) ? `<div class="rp-sep">${d.data === t ? 'Hoje' : d.data === addDays(t, 1) ? 'Amanhã' : DIAS_SEMANA[weekday(d.data)]} · ${fmtDateShort(d.data)}</div>` : '') + card(d)).join('')}
          <div class="rp-fim">${this.ic('total')}<span>${n ? 'Sem mais' : 'Nenhum'} ${this.FILTRO_TXT[filtro]} ${q ? 'para essa busca' : multi ? 'nos próximos dias' : dia === t ? 'hoje' : 'neste dia'}${px && !multi ? ` · <a data-rp="prox" data-c="${esc(c.nome)}">${px} nos próximos dias</a>` : ''}</span></div></div></div>`;
    };
    const kpi = (k, cls, label, n, sub, f) => `<button type="button" class="rp-kpi rp-kf ${filtro === f ? 'on' : ''}" data-rp="filtro" data-f="${f}" title="${filtro === f && f !== 'abertos' ? 'Clique para voltar aos que estão a fazer' : 'Mostrar só: ' + this.FILTRO_TXT[f]}"><span class="rp-ki ${cls}">${this.ic(k)}</span><div><small>${label}</small><b class="${cls}">${n}</b>${sub ? `<span>${sub}</span>` : ''}</div></button>`;
    const aFazer = cont.agendado + cont.aguardando + cont.recepcao + cont.atendimento;
    const dn = DIAS_SEMANA[weekday(t)] + (weekday(t) > 0 && weekday(t) < 6 ? '-feira' : '');
    const shBtn = Cloud.user?.role === 'reception' ? '' : !Share.supported ? '' : Share.ok()
      ? `<button class="rp-share on" data-rp="share" title="Pasta compartilhada: ${esc(Share.nomePasta())}${Share.erro ? ' — ' + esc(Share.erro) : ''}">${icon('folder')}<span>${Share.erro ? 'Erro na pasta' : fontes.filter(c => !c.local).length + ' comprador(es) conectado(s)'}</span></button>`
      : `<button class="rp-share off" data-rp="share">${icon('folder')}<span>${Share.dir ? 'Reconectar pasta' : 'Conectar pasta compartilhada'}</span></button>`;
    const vazio = !fontes.length ? `<div class="fp-vazio rp-vazio">${icon('folder')}<b>Nenhum agendamento encontrado</b><span>${Cloud.user?.role === 'reception' ? 'Os atendimentos dos fornecedores aparecerão aqui quando forem agendados.' : Share.supported ? 'Conecte a pasta compartilhada usada pelos compradores para exibir os agendamentos.' : 'Abra este arquivo no Google Chrome ou Microsoft Edge para ver os agendamentos dos compradores.'}</span></div>` : '';
    el.innerHTML = `<header class="rp-top"><img src="${document.getElementById('brandLogo').src}" alt="Grupo Toureiro">
        <div class="rp-title"><b>PAINEL DA RECEPÇÃO</b><span>Agendamentos de todos os compradores</span></div>
        ${shBtn}
        <div class="rp-date">${this.ic('total')}<div><span>${dn}</span><span>${esc(fmtDateLong(t).replace(/^[^,]*,\s*/, ''))}</span></div></div>
        <b class="rp-clockb" id="rpClock">${hm}</b>
        <button class="rp-sair" data-rp="sair" title="Sair do painel">${icon('lock')}</button></header>
      <div class="rp-kpis2">
        ${kpi('total', 'k-red', 'A FAZER', aFazer, 'de ' + todos.length + ' · ver todos', 'abertos')}
        ${kpi('recepcao', 'k-green', 'NA RECEPÇÃO', cont.recepcao, '', 'recepcao')}
        ${kpi('aguardando', 'k-amber', 'AGUARDANDO', cont.aguardando + cont.agendado, '', 'aguardando')}
        ${kpi('atendimento', 'k-blue', 'EM ATENDIMENTO', cont.atendimento, '', 'atendimento')}
        ${kpi('concluido', 'k-gray', 'CONCLUÍDOS', cont.concluido, '', 'concluido')}
        <div class="rp-sbox"><label class="rp-search">${icon('search')}<input id="rpBusca" type="search" placeholder="Buscar fornecedor (todos os dias)…" value="${esc(st.q || '')}"></label>
          <button type="button" class="rp-modo ${st.modo === 'prox' ? 'on' : ''}" data-rp="modo">${this.ic('total')} ${st.modo === 'prox' ? 'Ver só o dia' : 'Próximos dias'}</button></div>
      </div>
      ${filtro !== 'abertos' ? `<div class="rp-outro rp-filt">${filtro === 'todos' ? 'Mostrando <b>todos</b> os agendamentos do dia, inclusive os concluídos' : 'Mostrando só: <b>' + this.FILTRO_TXT[filtro] + '</b>'} · <a data-rp="filtro" data-f="abertos">voltar para os que estão a fazer</a></div>` : ''}
      ${q ? `<div class="rp-outro rp-filt">Busca por <b>“${esc(st.q)}”</b> em todos os agendamentos a partir de hoje · <a data-rp="limpar">limpar busca</a></div>`
        : st.modo === 'prox' ? `<div class="rp-outro">Mostrando os <b>próximos agendamentos</b> a partir de ${desde === t ? 'hoje' : esc(fmtDateLong(desde))} · <a data-rp="modo">ver só o dia</a></div>`
        : dia !== t ? `<div class="rp-outro">Mostrando <b>${esc(fmtDateLong(dia))}</b> · <a data-rp="dia" data-n="0">voltar para hoje</a> · <a data-rp="modo">ver próximos dias</a></div>` : ''}
      ${Cloud.user?.role !== 'reception' && Share.dir && !Share.ok() ? `<div class="rp-outro rp-warn">${icon('alert')} A pasta compartilhada precisa de permissão de novo. <a data-rp="share">Clique aqui para reconectar</a> e ver os agendamentos dos outros compradores.</div>` : ''}
      ${!todos.length && fontes.length ? `<div class="rp-outro">Nenhum agendamento ${dia === t ? 'hoje' : 'neste dia'}. Compradores encontrados: ${fontes.map(c => `<b>${esc(c.nome)}</b> (${c.itens.length} agendamento${c.itens.length === 1 ? '' : 's'} no total${c.local ? ', neste computador' : c.atualizadoEm ? ', atualizado ' + esc(this.quando(c.atualizadoEm)) : ''})`).join(' · ')}. Use as setas embaixo para ver outros dias.</div>` : ''}
      <div class="rp-cols">${vazio || (compradores.length ? compradores.map(col).join('') : `<div class="fp-vazio">${icon('search')}<b>Nada encontrado</b><span>Confira o nome digitado.</span></div>`)}</div>
      <footer class="rp-foot"><span class="rp-info-i">i</span><span class="rp-help">Registrar chegada avisa o comprador na tela dele (alerta com som e no sino). O comprador inicia e finaliza o atendimento — o status muda aqui sozinho.</span>
        <span class="rp-leg"><i style="background:#f59e0b"></i>Aguardando<i style="background:#2563eb"></i>Na recepção<i style="background:#16a34a"></i>Em atendimento<i style="background:#6b7280"></i>Concluído</span>
        <div class="rp-dia"><button data-rp="dia" data-n="-1" title="Dia anterior">${icon('chevL')}</button><label>${this.ic('total')} Visualização do dia<input type="date" id="rpDia" value="${dia}"></label><button data-rp="dia" data-n="1" title="Próximo dia">${icon('chevR')}</button></div></footer>`;
  },
  FILTRO_TXT: { abertos: 'agendamento a fazer', todos: 'agendamento', recepcao: 'fornecedor na recepção', aguardando: 'agendamento aguardando', atendimento: 'atendimento em andamento', concluido: 'atendimento concluído' },
  passa(d, f) {
    const s = this.status(d);
    if (f === 'todos') return s !== 'cancelado';
    if (f === 'abertos') return ['agendado', 'aguardando', 'recepcao', 'atendimento'].includes(s);
    if (f === 'aguardando') return s === 'agendado' || s === 'aguardando';
    return s === f;
  },
  quando(iso) {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!(m >= 0)) return '';
    if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min';
    const dia = spParts(new Date(iso)).iso;
    return dia === today() ? 'às ' + this.hora(iso) : 'em ' + fmtDateShort(dia);
  },
  async onClick(e) {
    const b = e.target.closest('[data-rp]'); if (!b) return;
    const k = b.dataset.rp, st = this.st;
    if (k === 'sair') return this.sair();
    if (k === 'share') {
      if (Share.ok()) { if (!(await confirmBox('Trocar a pasta compartilhada? Escolha a mesma pasta da rede que os compradores usam.', 'Escolher outra pasta'))) return; await Share.escolher(); }
      else await Share.conectar();
      return this.atualizar();
    }
    if (k === 'filtro') { const f = b.dataset.f; st.f = f === 'abertos' ? (st.f === 'abertos' || !st.f ? 'todos' : 'abertos') : (st.f === f ? 'abertos' : f); }
    if (k === 'modo') st.modo = st.modo === 'prox' ? 'dia' : 'prox';
    if (k === 'limpar') st.q = '';
    if (k === 'dia') { const n = +b.dataset.n; st.dia = n === 0 ? today() : addDays(st.dia, n); st.modo = 'dia'; }
    if (k === 'prox') st.modo = 'prox';
    if (['chegou', 'voltar', 'reavisar'].includes(k)) {
      const d = this.mapa.get(b.dataset.id); if (!d) return;
      b.disabled = true;
      const agora = new Date().toISOString(), novo = { chegouEm: d.chegouEm || null, avisoEm: d.avisoEm || null };
      let msg = '';
      if (k === 'chegou') { novo.chegouEm = agora; novo.avisoEm = agora; msg = 'Chegada registrada: ' + (d.fornNome || d.titulo || '') + '. ' + this.comprador(d) + ' foi avisado(a) na agenda.'; }
      else if (k === 'reavisar') { novo.avisoEm = agora; if (!novo.chegouEm) novo.chegouEm = agora; msg = 'Aviso reenviado para ' + this.comprador(d) + '.'; }
      else { // desfaz a chegada (só enquanto o comprador não iniciou)
        if (d.iniciouEm) { toast('O comprador já iniciou este atendimento.', 'warn'); return this.render(); }
        novo.chegouEm = null; novo.avisoEm = null;
        msg = 'Etapa desfeita.';
      }
      try {
        if (d._local) {
          const orig = DB.get('demandas', d.id); if (!orig) return;
          await Engine.salvarDemanda(Object.assign({}, orig, novo, { recepEm: agora }), orig);
        } else {
          await Share.marcar(d._slug, d.id, novo);
        }
        toast(msg, k === 'voltar' ? 'info' : 'ok', 4500);
      } catch (err) {
        console.error(err); Share.falha(err);
        toast('Não foi possível gravar na pasta compartilhada (' + (err.message || err) + '). Clique em Reconectar pasta.', 'err', 8000);
      }
    }
    this.render();
  }
};

/* ============================================================
   SINCRONIZAÇÃO ENTRE ABAS DO MESMO NAVEGADOR
   (comprador numa aba e recepção em outra veem as mudanças na hora)
   ============================================================ */
const Sync = {
  bc: null, tab: uid(),
  init() {
    try { this.bc = new BroadcastChannel('agenda_planejamento_sync'); this.bc.onmessage = ev => { if (ev.data && ev.data.tab !== this.tab) this.recarregar(); }; } catch (e) { this.bc = null; }
    window.addEventListener('storage', e => { if (e.key === 'agenda_sync_ping') this.recarregar(); });
    window.addEventListener('focus', () => this.recarregar());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.recarregar(); });
  },
  ping: debounce(function () {
    const m = { tab: Sync.tab, t: Date.now() };
    try { if (Sync.bc) Sync.bc.postMessage(m); else localStorage.setItem('agenda_sync_ping', String(m.t)); } catch (e) { }
  }, 200),
  recarregar: debounce(async function () {
    if (!DB.idb) return;
    await DB.loadAll();
    DB.changed('@sync');
    if (document.getElementById('recepPortal')) Recep.renderSeguro();
    Aviso.check();
  }, 250)
};

/* ============================================================
   PASTA COMPARTILHADA (vários computadores)
   Cada comprador grava  agenda_<usuario>.json   com os atendimentos dele.
   A recepção lê todos e grava  recepcao_<usuario>.json  com chegada/início/fim.
   O comprador lê o arquivo da recepção a cada 10 s e recebe o alerta.
   Use uma pasta da rede (ou OneDrive/Google Drive sincronizado) acessível
   pelos computadores dos compradores e da recepção — Chrome ou Edge.
   ============================================================ */
const Share = {
  dir: null, perm: 'none', erro: '', timer: null,
  supported: typeof window.showDirectoryPicker === 'function',
  remotos: [], overlay: {}, lidoEm: null, pubLast: '', pubEm: 0, pubOk: null,
  slug(u) { return norm(u).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'comprador'; },
  async init() {
    if (!this.supported) { this.perm = 'unsupported'; return; }
    const h = DB.cfg('shareDir', null);
    if (h && h.queryPermission) { this.dir = h; try { this.perm = await h.queryPermission({ mode: 'readwrite' }); } catch (e) { this.perm = 'prompt'; } }
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 10000);
    const reautorizar = async () => {
      if (!this.dir || this.perm === 'granted') return;
      try { this.perm = await this.dir.requestPermission({ mode: 'readwrite' }); } catch (e) { return; }
      if (this.perm === 'granted') { this.erro = ''; await this.tick(true); if (document.getElementById('recepPortal')) Recep.atualizar(); else if (typeof App !== 'undefined' && App.started) App.render(); }
    };
    document.addEventListener('pointerdown', () => { if (this.dir && this.perm !== 'granted' && !this._jaPediu) { this._jaPediu = true; reautorizar(); } }, true);
  },
  ok() { return !!this.dir && this.perm === 'granted'; },
  nomePasta() { return this.dir ? this.dir.name : ''; },
  status() {
    if (!this.dir) return null;
    if (!this.ok()) return { level: 'warn', text: 'Recepção: clique para reconectar a pasta', title: 'A pasta compartilhada precisa de permissão de novo para enviar seus agendamentos à recepção.' };
    if (this.erro) return { level: 'warn', text: 'Recepção: erro na pasta', title: this.erro };
    return { level: 'ok', text: 'Recepção conectada' + (this.pubOk ? ' · ' + Recep.hora(this.pubOk) : ''), title: 'Pasta compartilhada: ' + this.nomePasta() };
  },
  async escolher() {
    if (!this.supported) { toast('Este navegador não permite pasta compartilhada. Abra a agenda no Google Chrome ou Microsoft Edge.', 'warn', 7000); return false; }
    try {
      const h = await window.showDirectoryPicker({ id: 'agendaRecepcao', mode: 'readwrite' });
      this.dir = h; this.perm = 'granted'; this.erro = '';
      await DB.setCfg('shareDir', h, true);
      toast('Pasta compartilhada conectada: ' + h.name, 'ok');
      await this.tick(true);
      if (typeof App !== 'undefined' && App.started) App.render();
      return true;
    } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível usar a pasta: ' + e.message, 'err'); return false; }
  },
  async conectar() {
    if (!this.dir) return this.escolher();
    try { this.perm = await this.dir.requestPermission({ mode: 'readwrite' }); } catch (e) { this.perm = 'prompt'; }
    if (this.perm === 'granted') { this.erro = ''; toast('Pasta compartilhada reconectada.', 'ok'); await this.tick(true); if (typeof App !== 'undefined' && App.started) App.render(); return true; }
    toast('Permissão não concedida para a pasta compartilhada.', 'warn');
    this.refresh(); return false;
  },
  async desconectar() {
    this.dir = null; this.perm = 'none'; this.remotos = []; this.overlay = {}; this.erro = '';
    await DB.setCfg('shareDir', null, true);
    toast('Pasta compartilhada desconectada.', 'info');
    if (typeof App !== 'undefined' && App.started) App.render();
  },
  refresh() { if (typeof App !== 'undefined' && App.started) App.refreshChrome(); },
  falha(e) {
    console.error(e);
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) this.perm = 'prompt';
    this.erro = (e && e.message) || String(e);
    this.refresh();
  },
  // laço do comprador: recebe as marcações da recepção e publica os atendimentos
  async tick(force) {
    if (!this.ok() || this._rodando) return;
    this._rodando = true;
    try {
      if (Auth.cfg() && typeof App !== 'undefined' && App.started) { await this.aplicarRecepcao(); await this.publicar(force); }
      this.erro = '';
    } catch (e) { this.falha(e); }
    finally { this._rodando = false; }
    if (document.getElementById('recepPortal') && force) Recep.atualizar();
    this.refresh();
  },
  async ler(name) {
    try { const fh = await this.dir.getFileHandle(name); const f = await fh.getFile(); const t = await f.text(); return t ? JSON.parse(t) : null; }
    catch (e) { if (e.name === 'NotFoundError' || e.name === 'TypeError' || e instanceof SyntaxError) return null; throw e; }
  },
  async gravar(name, obj) { await Backup._writeFile(this.dir, name, JSON.stringify(obj)); },
  CAMPOS: ['id', 'data', 'hora', 'horaFim', 'titulo', 'fornNome', 'assunto', 'status', 'chegouEm', 'iniciouEm', 'finalizouEm', 'avisoEm', 'avisoVistoEm', 'agendadoPor', 'atend'],
  itensPublicos() {
    const de = addDays(today(), -1), ate = addDays(today(), 120);
    return sortBy(DB.all('demandas').filter(d => naRecepcao(d) && d.data >= de && d.data <= ate), d => d.data, d => d.hora)
      .map(d => { const o = {}; this.CAMPOS.forEach(k => { if (d[k] != null && d[k] !== '') o[k] = d[k]; }); o.industrias = Forn.indsAtend(d); return o; });
  },
  agendarPublicar: debounce(function () { if (Share.ok()) Share.publicar().catch(e => Share.falha(e)); }, 1200),
  async publicar(force) {
    const a = Auth.cfg(); if (!this.ok() || !a) return;
    const itens = this.itensPublicos(), corpo = JSON.stringify([a.nome, itens]), agora = Date.now();
    // regrava se mudou algo, ou a cada 2 min (a recepção vê que o comprador está on-line)
    if (!force && corpo === this.pubLast && agora - this.pubEm < 120000) return;
    await this.gravar('agenda_' + this.slug(a.usuario) + '.json', { app: 'agenda-recepcao', versao: APP_VERSION, comprador: a.nome || a.usuario, usuario: a.usuario, geradoEm: new Date().toISOString(), itens });
    this.pubLast = corpo; this.pubEm = agora; this.pubOk = new Date().toISOString();
  },
  // comprador: aplica o que a recepção marcou (chegada, início, fim, novo aviso)
  async aplicarRecepcao() {
    const a = Auth.cfg(); if (!a) return;
    const ov = await this.ler('recepcao_' + this.slug(a.usuario) + '.json');
    if (!ov || !ov.itens) return;
    let mudou = 0;
    for (const id of Object.keys(ov.itens)) {
      const e = ov.itens[id], d = DB.get('demandas', id);
      if (!d || !e || !e.em || (d.recepEm && d.recepEm >= e.em)) continue;
      const novo = Object.assign({}, d, { chegouEm: e.chegouEm || null, avisoEm: e.avisoEm || null, recepEm: e.em });
      await Engine.salvarDemanda(novo, d);
      mudou++;
    }
    if (mudou) Aviso.check();
  },
  // recepção: lê os arquivos de todos os compradores
  async lerTodos() {
    if (!this.ok()) { this.remotos = []; return; }
    const remotos = [], overlay = {};
    for await (const [name, h] of this.dir.entries()) {
      if (h.kind !== 'file') continue;
      let m = /^agenda_(.+)\.json$/.exec(name);
      if (m) { const j = await this.ler(name); if (j && j.app === 'agenda-recepcao' && Array.isArray(j.itens)) remotos.push(Object.assign({}, j, { slug: m[1] })); continue; }
      m = /^recepcao_(.+)\.json$/.exec(name);
      if (m) { const j = await this.ler(name); if (j && j.itens) overlay[m[1]] = j; }
    }
    this.remotos = remotos; this.overlay = overlay; this.lidoEm = new Date().toISOString();
  },
  // recepção: grava a marcação no arquivo do comprador
  async marcar(slug, id, estado) {
    if (Cloud.user?.role === 'reception') return Cloud.markReception(slug, id, estado);
    if (!this.ok()) throw new Error('pasta compartilhada desconectada');
    const name = 'recepcao_' + slug + '.json';
    const ov = (await this.ler(name)) || { app: 'agenda-recepcao-status', itens: {} };
    ov.itens = ov.itens || {};
    const em = new Date().toISOString();
    ov.itens[id] = Object.assign({}, estado, { em });
    const lim = new Date(Date.now() - 20 * 864e5).toISOString();
    Object.keys(ov.itens).forEach(k => { if ((ov.itens[k].em || '') < lim) delete ov.itens[k]; });
    ov.atualizadoEm = em;
    await this.gravar(name, ov);
    this.overlay[slug] = ov;
  }
};

/* ============================================================
   AVISO PARA O COMPRADOR — quando a recepção registra a chegada
   (janela de alerta + som + notificação do Windows)
   ============================================================ */
const Atend = {
  async iniciar(id) {
    const d = DB.get('demandas', id); if (!d || d.iniciouEm) return;
    const agora = new Date().toISOString();
    await Engine.salvarDemanda(Object.assign({}, d, { iniciouEm: agora, avisoVistoEm: agora, status: STATUS_FECHADO.includes(d.status) ? d.status : 'Em andamento' }), d);
    toast('Atendimento iniciado: ' + (d.fornNome || d.titulo) + '. A recepção já vê como “em atendimento”.', 'ok', 5000);
    if (Share.ok()) Share.publicar(true).catch(e => Share.falha(e));
  },
  async finalizar(id) {
    const d = DB.get('demandas', id); if (!d) return;
    const agora = new Date().toISOString();
    await Engine.salvarDemanda(Object.assign({}, d, { iniciouEm: d.iniciouEm || agora, finalizouEm: agora, status: 'Concluído' }), d);
    toast('Atendimento finalizado: ' + (d.fornNome || d.titulo) + '.', 'ok');
    if (Share.ok()) Share.publicar(true).catch(e => Share.falha(e));
  }
};

const Aviso = {
  vistos: new Set(), audio: null, flash: null, tituloBase: '',
  pendentes() {
    if (!Auth.cfg()) return [];
    const de = addDays(today(), -1);
    return sortBy(DB.all('demandas').filter(d => d.avisoEm && !d.iniciouEm && !STATUS_FECHADO.includes(d.status) && d.data >= de && (!d.avisoVistoEm || d.avisoVistoEm < d.avisoEm)), d => d.avisoEm);
  },
  check() {
    if (typeof App === 'undefined' || !App.started) return;
    if (document.getElementById('recepPortal') || document.getElementById('fornPortal')) return;
    const l = this.pendentes();
    const novos = l.filter(d => !this.vistos.has(d.id + '|' + d.avisoEm));
    novos.forEach(d => this.vistos.add(d.id + '|' + d.avisoEm));
    if (novos.length) { this.som(); this.notificar(novos); }
    this.piscar(l.length);
    this.modal(l);
  },
  modal(l) {
    let bg = document.getElementById('avisoBg');
    if (!l.length || !Auth.unlocked) { if (bg) bg.remove(); return; }
    if (!bg) { bg = document.createElement('div'); bg.id = 'avisoBg'; bg.className = 'aviso-bg'; document.body.appendChild(bg); bg.addEventListener('click', e => this.onClick(e)); }
    const t = today();
    bg.innerHTML = `<div class="aviso" role="alertdialog" aria-live="assertive">
      <div class="aviso-h"><span class="aviso-ic">${icon('bell')}</span><div><b>${l.length === 1 ? 'Fornecedor chegou na recepção' : l.length + ' fornecedores chegaram na recepção'}</b><small>A recepção está avisando você · ${nowHM()}</small></div></div>
      <div class="aviso-l">${l.map(d => `<div class="aviso-i"><div><b>${esc(d.fornNome || d.titulo || 'Fornecedor')}</b>
          <span>Agendado ${d.data !== t ? fmtDateShort(d.data) + ' ' : ''}às ${esc(d.hora || '')}${d.horaFim ? '–' + esc(d.horaFim) : ''} · chegou às ${Recep.hora(d.chegouEm || d.avisoEm)}${d.chegouEm && d.avisoEm > d.chegouEm ? ' · <em>avisado de novo às ' + Recep.hora(d.avisoEm) + '</em>' : ''}</span>
          ${Forn.indsAtend(d).length ? `<small>${esc(Forn.indsAtend(d).join(' · '))}</small>` : ''}${d.assunto ? `<small>Assunto: ${esc(d.assunto)}</small>` : ''}</div>
        <div class="aviso-bt"><button class="btn primary" data-av="iniciar" data-id="${d.id}">${icon('clock')} Iniciar atendimento</button><button class="btn" data-av="ok" data-id="${d.id}">Ciente, já vou</button></div></div>`).join('')}</div>
      <div class="aviso-f">${'Notification' in window && Notification.permission === 'default' ? `<a data-av="notif">Ativar aviso do Windows (mesmo com a agenda minimizada)</a>` : '<span></span>'}${l.length > 1 ? `<button class="btn" data-av="todos">${icon('check')} Ciente de todos</button>` : ''}</div>
    </div>`;
  },
  async onClick(e) {
    const b = e.target.closest('[data-av]'); if (!b) return;
    if (b.dataset.av === 'notif') { await this.pedirPermissao(); return this.modal(this.pendentes()); }
    if (b.dataset.av === 'iniciar') { b.disabled = true; await Atend.iniciar(b.dataset.id); return this.check(); }
    const ids = b.dataset.av === 'todos' ? this.pendentes().map(d => d.id) : [b.dataset.id];
    const agora = new Date().toISOString();
    b.disabled = true;
    for (const id of ids) { const d = DB.get('demandas', id); if (d) await Engine.salvarDemanda(Object.assign({}, d, { avisoVistoEm: agora }), d); }
    toast('A recepção vai ver que você está ciente.', 'ok');
    if (Share.ok()) Share.publicar(true).catch(err => Share.falha(err));
    this.check();
  },
  som() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ac = this.audio || (this.audio = new C());
      if (ac.state === 'suspended') ac.resume();
      [0, 0.28, 0.56, 1.2, 1.48, 1.76].forEach((t, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + t;
        o.type = 'sine'; o.frequency.value = i % 3 === 2 ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
        o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + 0.26);
      });
    } catch (e) { }
  },
  notificar(l) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const d = l[0];
      const n = new Notification(l.length === 1 ? 'Chegou na recepção: ' + (d.fornNome || d.titulo || 'Fornecedor') : l.length + ' fornecedores chegaram na recepção', {
        body: l.map(x => (x.fornNome || x.titulo || 'Fornecedor') + ' · agendado às ' + (x.hora || '')).join('\n') + '\nA recepção está avisando você.', tag: 'agenda-recepcao', requireInteraction: true
      });
      n.onclick = () => { try { window.focus(); } catch (e) { } n.close(); };
    } catch (e) { }
  },
  async pedirPermissao() { try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) { } },
  piscar(n) {
    if (n && !this.flash) {
      let on = false;
      this.flash = setInterval(() => { on = !on; document.title = on ? '🔔 Fornecedor na recepção!' : (this.tituloBase || 'Agenda e Planejamento'); }, 1000);
    } else if (!n && this.flash) { clearInterval(this.flash); this.flash = null; if (this.tituloBase) document.title = this.tituloBase; }
  }
};

/* ---------- tela do comprador: Área do fornecedor ---------- */
VIEWS.fornecedores = {
  title: 'Área do fornecedor',
  render(s) {
    const tab = s.tab || 'agenda';
    const tabs = `<div class="tabs">${[['agenda', 'Atendimentos'], ['horarios', 'Horários de atendimento'], ['bloqueios', 'Dias bloqueados'], ['cadastro', 'Fornecedores e códigos']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="fo-tab" data-t="${k}">${l}</button>`).join('')}</div>`;
    const legacyShare = Cloud.isBuyer() ? '' : (Share.ok() ? btn(icon('folder') + ' Recepção conectada', 'go', 'data-view="dados"', 'sm') : btn(icon('folder') + (Share.dir ? ' Reconectar recepção' : ' Conectar com a recepção'), Share.dir ? 'share-conectar' : 'share-escolher', '', 'sm warn'));
    const head = pageHead('Área do fornecedor', 'Os fornecedores entram com o código individual emitido pelo comprador; os atendimentos são compartilhados com a recepção.', legacyShare + ' ' + btn(icon('plus') + ' Novo atendimento', 'fo-novo', `data-data="${s.dia || ''}"`, 'primary'));
    return head + tabs + this[tab](s);
  },
  agenda(s) {
    const t = today(), dia = s.dia || t, F = Forn;
    const di = F.diaInfo(dia), bloqDia = F.diaBloqueado(dia);
    const slots = di ? F.slots(dia, di.passo) : [];
    const grade = !di ? `<p class="muted">Você não atende neste dia da semana (ajuste em “Horários de atendimento”).</p>`
      : `<div class="fo-grade">${slots.map(x => {
        const txt = x.st === 'ocup' ? (x.d.atend ? esc(x.d.fornNome || x.d.titulo) : esc(x.d.titulo)) : x.st === 'bloq' ? 'Bloqueado' + (x.b.motivo ? ' · ' + esc(x.b.motivo) : '') : x.st === 'passado' ? '—' : 'Livre';
        return `<div class="fo-sl ${x.st} ${x.d && x.d.atend ? 'atend' : ''}" ${x.d ? `data-act="edit-demanda" data-id="${x.d.id}"` : x.st === 'livre' ? `data-act="fo-novo" data-data="${dia}" data-hora="${F.hm(x.ini)}"` : ''}><b>${F.hm(x.ini)}</b><span>${txt}</span></div>`;
      }).join('')}</div>`;
    const prox = F.atendimentos().filter(d => d.data >= t);
    return `<div class="cols-main"><section>
      <div class="card"><div class="card-h"><h3>${esc(fmtDateLong(dia))}</h3><div class="page-actions">
        <button class="btn sm" data-act="fo-dia" data-n="-1">${icon('chevL')}</button><button class="btn sm" data-act="fo-dia" data-n="0">Hoje</button><button class="btn sm" data-act="fo-dia" data-n="1">${icon('chevR')}</button>
        <input type="date" id="foDia" value="${dia}">
        ${bloqDia ? `<button class="btn sm" data-act="fo-desbloq-dia" data-d="${dia}">Desbloquear dia</button>` : `<button class="btn sm danger ghost" data-act="fo-bloq-dia" data-d="${dia}">${icon('lock')} Bloquear este dia</button>`}</div></div>
        <div class="legend"><span class="lg lg-has">Atendimento</span><span class="lg lg-late">Bloqueado</span><span class="muted small">· clique num horário livre para agendar · o fornecedor vê os ocupados como “Indisponível”</span></div>
        ${grade}</div></section>
      <aside><div class="card flush"><div class="card-h pad"><h3>Próximos atendimentos</h3><span class="pill">${prox.length}</span></div>
        ${prox.length ? `<div class="fo-list">${prox.map(d => `<div class="fo-li" data-act="edit-demanda" data-id="${d.id}"><div><b>${fmtDateShort(d.data)} ${DIAS_CURTO[weekday(d.data)]} · ${esc(d.hora)}–${esc(d.horaFim || '')}</b><span>${esc(d.fornNome || '')}${d.assunto ? ' — ' + esc(d.assunto) : ''}</span>${Forn.indsAtend(d).length ? `<small>${esc(Forn.indsAtend(d).join(' · '))}</small>` : ''}<small>${d.agendadoPor === 'fornecedor' ? 'agendado pelo fornecedor' : 'agendado por você'}${d.chegouEm ? `<span class="fo-chegou">chegou ${new Date(d.chegouEm).toTimeString().slice(0, 5)}</span>` : ''}</small></div><button class="btn xs" data-act="fo-cancel" data-id="${d.id}">Cancelar</button></div>`).join('')}</div>` : '<p class="muted small pad">Nenhum atendimento agendado.</p>'}
      </div></aside></div>`;
  },
  horarios() {
    const c = Forn.cfg();
    return `<div class="card" style="max-width:640px"><div class="card-h"><h3>Quando você atende fornecedores</h3></div>
      <div class="fo-hr">${[1, 2, 3, 4, 5, 6, 0].map(w => { const d = c.dias[w] || { on: false, ini: '08:00', fim: '17:00' }; return `<label class="chk"><input type="checkbox" name="on${w}" ${d.on ? 'checked' : ''}> ${DIAS_SEMANA[w]}</label><input type="time" name="ini${w}" value="${esc(d.ini)}"><span class="muted">até</span><input type="time" name="fim${w}" value="${esc(d.fim)}">`; }).join('')}</div>
      <label class="fo-passo">Intervalo entre horários <select name="passo">${optList([[15, '15 minutos'], [30, '30 minutos'], [60, '1 hora']], c.passo)}</select></label>
      <p class="muted small">O fornecedor pode agendar no máximo 1 hora. Você pode agendar o tempo que precisar.</p>
      <button class="btn primary" data-act="fo-hr-save">${icon('check')} Salvar horários</button></div>`;
  },
  bloqueios() {
    const bl = Forn.bloqs().filter(b => (b.ate || b.de) >= today());
    return `<div class="cols-main"><section><div class="card"><div class="card-h"><h3>Bloquear dias ou horários</h3></div>
      <div class="fo-form" id="foBq">
        <label>De<input type="date" name="de" value="${today()}"></label><label>Até (opcional)<input type="date" name="ate"></label>
        <label class="chk"><input type="checkbox" name="todo" checked> Dia inteiro</label>
        <label class="fo-h">Das<input type="time" name="ini"></label><label class="fo-h">Às<input type="time" name="fim"></label>
        <label class="grow">Motivo (só você vê)<input name="motivo" placeholder="Ex.: férias, feriado, reunião interna"></label>
      </div><button class="btn primary" data-act="fo-bq-add">${icon('lock')} Bloquear</button></div></section>
      <aside><div class="card flush"><div class="card-h pad"><h3>Bloqueios ativos</h3><span class="pill">${bl.length}</span></div>
        ${bl.length ? `<div class="fo-list">${bl.map(b => `<div class="fo-li"><div><b>${fmtDate(b.de)}${b.ate && b.ate !== b.de ? ' a ' + fmtDate(b.ate) : ''}</b><span>${b.ini ? esc(b.ini) + '–' + esc(b.fim) : 'Dia inteiro'}${b.motivo ? ' · ' + esc(b.motivo) : ''}</span></div><button class="icon-btn" data-act="fo-bq-del" data-id="${b.id}" title="Remover">${icon('trash')}</button></div>`).join('')}</div>` : '<p class="muted small pad">Nenhum dia bloqueado.</p>'}
      </div></aside></div>`;
  },
  cadastro() {
    const L = Forn.lista();
    return `<div class="card"><div class="card-h"><h3>Cadastrar fornecedor</h3></div>
      <div id="foCad"><div class="fo-form"><label class="grow">Nome do fornecedor / representante<input name="nome" placeholder="Ex.: João — Distribuidora Beta"></label></div>
        <div class="fo-form col"><label>Indústrias que ele representa (pode adicionar várias)</label>${Forn.pickerHTML([])}</div></div>
      <button class="btn primary" data-act="fo-cad-add">${icon('plus')} Cadastrar e gerar código</button>
      <p class="muted small">Passe o código para o fornecedor. Na tela de login ele escolhe <b>FORNECEDOR</b> e digita o código: verá apenas a sua agenda de atendimento.</p></div>
      <div class="card"><h3>Acesso da recepção</h3><p class="muted small">O administrador cria o acesso individual da recepção. O painel mostra os atendimentos compartilhados e permite registrar chegada, início e finalização.</p></div>
      <div class="card flush"><div class="card-h pad"><h3>Fornecedores cadastrados</h3><span class="pill">${L.length}</span></div>
      ${L.length ? `<div class="fo-list">${L.map(f => {
        const code = Cloud.isBuyer() ? Cloud.supplierCodes.get(f.id) : f.codigo;
        return `<div class="fo-li"><div><b>${esc(f.nome)}</b>${Forn.inds(f).length ? `<div class="ind-list sm">${Forn.inds(f).map(i => `<span class="ind-chip">${esc(i.nome)}</span>`).join('')}</div>` : '<span>sem indústria</span>'}<small>${Forn.doFornecedor(f.id).length} atendimento(s) futuros</small></div>
          <span class="fo-cod mono">${code ? esc(code) : 'Convite nao gerado'}</span><button class="btn xs" data-act="fo-cad-edit" data-id="${f.id}">${icon('edit')} Indústrias</button>${code ? `<button class="btn xs" data-act="fo-cad-copy" data-id="${f.id}" data-c="${esc(code)}">Copiar</button>` : ''}<button class="btn xs" data-act="fo-cad-new" data-id="${f.id}">${code ? 'Novo código' : 'Gerar convite'}</button><button class="icon-btn" data-act="fo-cad-del" data-id="${f.id}" title="Remover">${icon('trash')}</button></div>`;
      }).join('')}</div>` : '<p class="muted small pad">Nenhum fornecedor cadastrado ainda.</p>'}</div>`;
  },
  mount(s, main) {
    const di = main.querySelector('#foDia'); if (di) di.addEventListener('change', () => { if (di.value) { s.dia = di.value; App.render(); } });
    const bq = main.querySelector('#foBq');
    if (bq) { const todo = bq.querySelector('[name=todo]'), upd = () => bq.querySelectorAll('.fo-h').forEach(x => x.style.display = todo.checked ? 'none' : ''); todo.addEventListener('change', upd); upd(); }
    const cad = main.querySelector('#foCad'); if (cad) Forn.pickerMount(cad);
  }
};
ACTIONS['fo-cad-edit'] = d => {
  const f = Forn.get(d.id); if (!f) return;
  openModal({
    title: 'Fornecedor e indústrias',
    body: `<div class="fo-form col"><label>Nome do fornecedor / representante<input name="nome" value="${esc(f.nome)}"></label><label>Indústrias que ele representa</label>${Forn.pickerHTML(Forn.inds(f))}</div>
      <p class="muted small">O fornecedor vê todas estas indústrias na área dele e escolhe quais serão tratadas em cada atendimento.</p>`,
    footer: `<button class="btn" data-close>Fechar</button><button class="btn primary" data-ok>${icon('check')} Salvar</button>`,
    onMount(el, close) {
      Forn.pickerMount(el);
      el.querySelector('[data-ok]').addEventListener('click', async () => {
        const nome = el.querySelector('[name=nome]').value.trim();
        if (!nome) return toast('Informe o nome do fornecedor.', 'warn');
        const industrias = Forn.pickerValue(el);
        await DB.setCfg('fornecedores', DB.cfg('fornecedores', []).map(x => { if (x.id !== f.id) return x; const n = Object.assign({}, x, { nome, industrias }); delete n.labId; return n; }));
        toast('Fornecedor atualizado.', 'ok'); close();
      });
    }
  });
};
ACTIONS['fo-tab'] = d => { App.s('fornecedores').tab = d.t; App.render(); };
ACTIONS['fo-dia'] = d => { const s = App.s('fornecedores'), n = +d.n; s.dia = n === 0 ? today() : addDays(s.dia || today(), n); App.render(); };
ACTIONS['fo-bloq-dia'] = async d => { await DB.setCfg('fornBloq', DB.cfg('fornBloq', []).concat([{ id: uid(), de: d.d, ate: d.d, ini: '', fim: '', motivo: '' }])); toast('Dia bloqueado para fornecedores.', 'ok'); };
ACTIONS['fo-desbloq-dia'] = async d => { await DB.setCfg('fornBloq', DB.cfg('fornBloq', []).filter(b => !(!b.ini && d.d >= b.de && d.d <= (b.ate || b.de)))); toast('Dia desbloqueado.', 'ok'); };
ACTIONS['fo-bq-add'] = async () => {
  const f = document.getElementById('foBq'), v = n => f.querySelector(`[name=${n}]`).value;
  const todo = f.querySelector('[name=todo]').checked;
  const b = { id: uid(), de: v('de'), ate: v('ate') || v('de'), ini: todo ? '' : v('ini'), fim: todo ? '' : v('fim'), motivo: v('motivo').trim() };
  if (!b.de) return toast('Informe a data.', 'warn');
  if (b.ate < b.de) return toast('A data final é antes da inicial.', 'warn');
  if (!todo && (!b.ini || !b.fim || b.fim <= b.ini)) return toast('Informe o horário inicial e final do bloqueio.', 'warn');
  await DB.setCfg('fornBloq', DB.cfg('fornBloq', []).concat([b]));
  toast('Bloqueio salvo.', 'ok');
};
ACTIONS['fo-bq-del'] = async d => { await DB.setCfg('fornBloq', DB.cfg('fornBloq', []).filter(b => b.id !== d.id)); };
ACTIONS['fo-hr-save'] = async () => {
  const m = document.getElementById('main'), q = n => m.querySelector(`[name=${n}]`);
  const dias = {};
  for (const w of [0, 1, 2, 3, 4, 5, 6]) {
    dias[w] = { on: q('on' + w).checked, ini: q('ini' + w).value, fim: q('fim' + w).value };
    if (dias[w].on && (!dias[w].ini || !dias[w].fim || dias[w].fim <= dias[w].ini)) return toast('Confira o horário de ' + DIAS_SEMANA[w] + ': o final deve ser depois do início.', 'warn');
  }
  await DB.setCfg('fornCfg', { passo: +q('passo').value || 30, dias });
  toast('Horários de atendimento salvos.', 'ok');
};
ACTIONS['fo-cad-add'] = async () => {
  const f = document.getElementById('foCad'), nome = f.querySelector('[name=nome]').value.trim();
  if (!nome) return toast('Informe o nome do fornecedor.', 'warn');
  let codigo = '';
  if (!Cloud.isBuyer()) { do codigo = Forn.novoCodigo(); while (Forn.porCodigo(codigo)); }
  const novo = { id: uid(), nome, industrias: Forn.pickerValue(f), codigo, comprador: (Auth.cfg() || {}).usuario || '', criadoEm: new Date().toISOString() };
  await DB.setCfg('fornecedores', DB.cfg('fornecedores', []).concat([novo]));
  if (Cloud.isBuyer()) {
    try {
      const invite = await Cloud.request('/api/users', { method: 'POST', body: { action: 'supplier', supplierId: novo.id, name: novo.nome } });
      Cloud.supplierCodes.set(novo.id, invite.code);
      App.render();
      toast('Fornecedor cadastrado. Código de acesso: ' + invite.code, 'ok', 8000);
    } catch (error) { toast('Fornecedor cadastrado, mas o convite não foi gerado: ' + error.message, 'warn', 8000); }
  } else toast('Fornecedor cadastrado. Código: ' + codigo, 'ok', 6000);
};
ACTIONS['fo-cad-copy'] = async d => {
  const code = d.c || Cloud.supplierCodes.get(d.id);
  if (!code) return toast('Gere um novo convite para copiar o código.', 'warn');
  try { await navigator.clipboard.writeText(code); toast('Código copiado.', 'ok'); } catch (e) { toast('Código: ' + code, 'warn', 8000); }
};
ACTIONS['fo-cad-new'] = async d => {
  if (!await confirmBox('Gerar um novo código? O código antigo deixa de funcionar.', 'Gerar novo código')) return;
  let codigo;
  if (Cloud.isBuyer()) {
    const supplier = Forn.get(d.id); if (!supplier) return;
    try {
      const invite = await Cloud.request('/api/users', { method: 'POST', body: { action: 'supplier', supplierId: supplier.id, name: supplier.nome } });
      codigo = invite.code;
    } catch (error) { return toast('Não foi possível renovar o código: ' + error.message, 'err'); }
  } else { do codigo = Forn.novoCodigo(); while (Forn.porCodigo(codigo)); }
  if (Cloud.isBuyer()) {
    Cloud.supplierCodes.set(d.id, codigo);
    App.render();
  } else await DB.setCfg('fornecedores', DB.cfg('fornecedores', []).map(f => f.id === d.id ? Object.assign({}, f, { codigo }) : f));
  toast('Novo código: ' + codigo, 'ok', 6000);
};
ACTIONS['fo-recep-senha'] = async () => {
  const f = document.getElementById('foRecep'), s1 = f.querySelector('[name=s1]').value, s2 = f.querySelector('[name=s2]').value;
  if (s1.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', 'warn');
  if (s1 !== s2) return toast('As senhas não conferem.', 'warn');
  await Recep.salvarSenha(s1);
  toast('Senha da recepção alterada.', 'ok');
};
ACTIONS['fo-recep-padrao'] = async () => {
  if (!await confirmBox('Voltar a senha da recepção para ' + RECEP_SENHA_PADRAO + '?', 'Voltar para a padrão')) return;
  await Recep.salvarSenha(null);
  toast('A recepção voltou a usar a senha padrão.', 'ok');
};
ACTIONS['fo-cad-del'] = async d => {
  const f = Forn.get(d.id); if (!f) return;
  if (!await confirmBox('Remover ' + f.nome + '? O código dele deixa de funcionar (os atendimentos já agendados continuam na agenda).', 'Remover', true)) return;
  if (Cloud.isBuyer()) {
    try { await Cloud.request('/api/users', { method: 'DELETE', body: { supplierId: f.id } }); }
    catch (error) { return toast('Não foi possível revogar o acesso: ' + error.message, 'err'); }
  }
  await DB.setCfg('fornecedores', DB.cfg('fornecedores', []).filter(x => x.id !== d.id));
};
ACTIONS['fo-cancel'] = async (d, el, e) => {
  e.stopPropagation();
  const x = DB.get('demandas', d.id); if (!x) return;
  if (!await confirmBox('Cancelar o atendimento de ' + (x.fornNome || '') + ' em ' + fmtDate(x.data) + ' às ' + x.hora + '?', 'Cancelar atendimento', true)) return;
  await Forn.cancelar(d.id, 'Cancelado pelo comprador');
};
ACTIONS['fo-novo'] = d => {
  const L = Forn.lista(), passo = Forn.cfg().passo || 30;
  const hora = d.hora || '', fim = hora ? Forn.hm(Forn.min(hora) + passo) : '';
  openModal({
    title: 'Novo atendimento de fornecedor',
    body: `<div class="fo-form col">
      <label>Fornecedor<select name="fornId">${optList(L.map(f => [f.id, Forn.label(f)]), '', '— outro (digite abaixo) —')}</select></label>
      <label class="fo-outro">Nome (se não estiver cadastrado)<input name="nome" placeholder="Ex.: Representante da Neo Química"></label>
      <div class="fo-inds"></div>
      <label>Data<input type="date" name="data" value="${d.data || today()}"></label>
      <div class="fo-2"><label>Início<input type="time" name="ini" value="${hora}"></label><label>Fim<input type="time" name="fim" value="${fim}"></label></div>
      <label>Assunto (opcional)<input name="assunto" maxlength="160"></label>
      <div class="au-msg" id="foMsg"></div></div>`,
    footer: `<button class="btn" data-close>Fechar</button><button class="btn primary" data-ok>${icon('check')} Agendar</button>`,
    onMount(el, close) {
      const g = n => el.querySelector(`[name=${n}]`), msg = t => el.querySelector('#foMsg').textContent = t || '';
      const upd = () => {
        const fo = Forn.get(g('fornId').value);
        el.querySelector('.fo-outro').style.display = fo ? 'none' : '';
        el.querySelector('.fo-inds').innerHTML = fo && Forn.inds(fo).length ? `<label>Indústrias deste atendimento</label>${Forn.checksHTML(fo)}` : '';
      };
      g('fornId').addEventListener('change', upd); upd();
      const chk = () => { const v = [g('data').value, g('ini').value, g('fim').value]; msg(v.every(Boolean) && v[2] > v[1] ? Forn.conflito(v[0], v[1], v[2]) : ''); };
      ['data', 'ini', 'fim'].forEach(n => g(n).addEventListener('change', chk)); chk();
      el.querySelector('[data-ok]').addEventListener('click', async () => {
        const v = { fornId: g('fornId').value, nome: g('nome').value.trim(), data: g('data').value, ini: g('ini').value, fim: g('fim').value, assunto: g('assunto').value.trim() };
        if (!v.fornId && !v.nome) return msg('Escolha o fornecedor ou digite o nome.');
        if (el.querySelector('.ind-checks')) { v.industrias = Forn.checksValue(el); if (!v.industrias.length) return msg('Marque pelo menos uma indústria.'); }
        if (!v.data || !v.ini || !v.fim) return msg('Informe data, início e fim.');
        if (v.fim <= v.ini) return msg('O fim deve ser depois do início.');
        const cf = Forn.conflito(v.data, v.ini, v.fim);
        if (cf && !await confirmBox(cf + '. Agendar mesmo assim?', 'Agendar mesmo assim')) return;
        await Forn.agendar(Object.assign(v, { por: 'comprador' }));
        toast('Atendimento agendado.', 'ok'); close();
      });
    }
  });
};

/* ---------- cartão "Login e senha" em Backup e configurações ---------- */
function shareCardHTML() {
  const a = Auth.cfg(), ss = Share.status();
  const notif = !('Notification' in window) ? 'não disponível neste navegador' : Notification.permission === 'granted' ? 'ativado' : Notification.permission === 'denied' ? 'bloqueado (libere no cadeado da barra de endereço)' : 'ainda não ativado';
  return `<div class="card"><div class="card-h"><h3>${icon('folder')} Painel da recepção (pasta compartilhada)</h3>${ss ? `<span class="pill ${ss.level === 'ok' ? 'ok' : 'warn'}">${esc(ss.text)}</span>` : '<span class="pill">Não conectado</span>'}</div>
    <p class="small muted">Para a recepção ver os agendamentos de <b>todos os compradores</b> e avisar quando o fornecedor chegar, cada computador (compradores e recepção) escolhe a <b>mesma pasta da rede</b> — por exemplo uma pasta compartilhada no servidor ou no OneDrive/Google Drive da empresa. Funciona no Google Chrome ou Microsoft Edge.</p>
    ${!Share.supported ? '<p class="small warn-t">Este navegador não permite pasta compartilhada. Abra a agenda no Chrome ou Edge.</p>' : `
    <div class="page-actions">
      ${Share.ok() ? btn(icon('upload') + ' Enviar agora para a recepção', 'share-agora', '', 'primary') + btn('Trocar pasta', 'share-escolher') + btn('Desconectar', 'share-sair', '', 'danger ghost')
        : Share.dir ? btn(icon('folder') + ' Reconectar pasta “' + esc(Share.nomePasta()) + '”', 'share-conectar', '', 'primary') + btn('Escolher outra pasta', 'share-escolher')
        : btn(icon('folder') + ' Escolher pasta compartilhada', 'share-escolher', '', 'primary')}
      ${btn(icon('bell') + ' Testar som do aviso', 'aviso-teste')}
    </div>
    <p class="small muted">${Share.ok() ? `Pasta: <b>${esc(Share.nomePasta())}</b> · arquivo deste comprador: <code>agenda_${esc(Share.slug(a ? a.usuario : ''))}.json</code>${Share.pubOk ? ' · último envio às ' + Recep.hora(Share.pubOk) : ''}. ` : ''}Aviso do Windows: ${notif}.</p>`}
  </div>`;
}
function authCardHTML() {
  const a = Auth.cfg();
  if (!a) return `<div class="card"><h3>${icon('lock')} Login e senha</h3><p class="small muted">A agenda está sem senha. Crie um login para que ninguém abra sua agenda neste computador.</p>${btn('Criar login e senha', 'au-create', '', 'primary')}</div>`;
  return `<div class="card"><div class="card-h"><h3>${icon('lock')} Login e senha</h3><span class="pill">Usuário: ${esc(a.usuario)}</span></div>
    <div class="cols2 tight"><div>
      <h4>Trocar senha</h4>
      <form class="grid-form" id="auChg" onsubmit="return false">
        <div class="fld span4"><label>Senha atual</label><input type="password" name="atual" autocomplete="current-password"></div>
        <div class="fld span2"><label>Nova senha</label><input type="password" name="nova" autocomplete="new-password"></div>
        <div class="fld span2"><label>Repita a nova senha</label><input type="password" name="nova2" autocomplete="new-password"></div>
        <div class="fld span4">${btn('Salvar nova senha', 'au-chg', '', 'primary')}</div>
      </form></div>
      <div><h4>Segurança</h4>
        <div class="grid-form"><div class="fld span2"><label>Bloquear sozinho após</label><select id="auLock">${optList([[0, 'Nunca'], [5, '5 minutos parado'], [15, '15 minutos parado'], [30, '30 minutos parado'], [60, '1 hora parado'], [120, '2 horas parado']], a.autoLock || 0)}</select></div>
        <div class="fld span2"><label>Nome exibido</label><input id="auNome" value="${esc(a.nome || '')}"></div></div>
        <div class="page-actions">${btn(icon('lock') + ' Bloquear agora', 'au-lock')}${btn('Gerar novo código de recuperação', 'au-newcode')}${btn('Remover senha', 'au-remove', '', 'danger ghost')}</div>
        <p class="small muted">Senha criada em ${fmtDateTime(a.criadoEm)}${a.alteradoEm && a.alteradoEm !== a.criadoEm ? ' · alterada em ' + fmtDateTime(a.alteradoEm) : ''}. Fica só neste computador e não vai no backup.</p>
      </div></div></div>`;
}
function authCardMount(main) {
  const l = main.querySelector('#auLock'); if (l) l.addEventListener('change', async () => { await DB.setCfg('auth', Object.assign({}, Auth.cfg(), { autoLock: +l.value }), true); toast('Bloqueio automático: ' + l.options[l.selectedIndex].text + '.', 'ok'); });
  const n = main.querySelector('#auNome'); if (n) n.addEventListener('change', async () => { await DB.setCfg('auth', Object.assign({}, Auth.cfg(), { nome: n.value.trim() }), true); Auth.paintUser(); toast('Nome atualizado.', 'ok'); });
}
function pedirSenha(titulo, txt) {
  return new Promise(res => {
    let done = false;
    const m = openModal({ title: titulo, body: `<p>${esc(txt)}</p><div class="grid-form"><div class="fld span4"><label>Senha atual</label><input type="password" name="s" autocomplete="current-password"></div></div>`,
      footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" data-ok>Confirmar</button>`, onClose: () => { if (!done) res(false); } });
    const go = async () => { if (await Auth.conferir(m.el.querySelector('[name=s]').value)) { done = true; m.close(); res(true); } else toast('Senha incorreta.', 'err'); };
    m.el.querySelector('[data-ok]').addEventListener('click', go);
    m.el.querySelector('[name=s]').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });
}
ACTIONS['au-lock'] = () => Auth.bloquear();
ACTIONS['au-create'] = () => { Auth.unlocked = false; Auth._resolve = () => App.render(); Auth.show('setup'); };
ACTIONS['au-chg'] = async () => {
  const f = document.getElementById('auChg'), v = k => f.querySelector(`[name=${k}]`).value;
  if (!await Auth.conferir(v('atual'))) { toast('Senha atual incorreta.', 'err'); return; }
  if (v('nova').length < 6) { toast('A nova senha precisa ter pelo menos 6 caracteres.', 'warn'); return; }
  if (v('nova') !== v('nova2')) { toast('As novas senhas não conferem.', 'warn'); return; }
  await Auth.salvarSenha(v('nova'), Auth.cfg()); f.reset(); toast('Senha alterada.', 'ok');
};
ACTIONS['au-newcode'] = async () => {
  if (!await pedirSenha('Novo código de recuperação', 'Confirme sua senha. O código antigo deixa de valer.')) return;
  const code = Auth.recCode(), a = Object.assign({}, Auth.cfg());
  a.recSalt = Auth.salt(); a.recHash = await Auth.hash(Auth.normCode(code), a.recSalt, a.iter);
  await DB.setCfg('auth', a, true);
  openModal({ title: 'Seu novo código de recuperação', body: `<p>Anote em um lugar seguro. Ele aparece só agora.</p><div class="au-code">${esc(code)}</div>`, footer: '<button class="btn primary" data-close>Anotei</button>' });
};
ACTIONS['au-remove'] = async () => {
  if (!await pedirSenha('Remover senha', 'Sem senha, qualquer pessoa neste computador consegue abrir a agenda. Confirme sua senha para remover.')) return;
  await DB.del('config', 'auth'); Auth.ss(false, ''); Auth.setKeep(false); Auth.paintUser(); toast('Senha removida.', 'warn');
};

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
window.addEventListener('error', e => { console.error(e.error || e.message); });
window.addEventListener('unhandledrejection', e => { console.error(e.reason); toast('Erro: ' + (e.reason && e.reason.message || e.reason), 'err'); });
/* ---------- data e hora no padrão brasileiro: DD/MM/AAAA e HH:mm ----------
   Os campos nativos seguem o idioma do navegador (podem mostrar AM/PM ou mês/dia).
   Hora vira texto HH:mm (mesmo valor que o código já usa). Data ganha um campo
   visível DD/MM/AAAA e o campo original fica oculto guardando AAAA-MM-DD. */
const BRInput = {
  isoToBR(v) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; },
  brToISO(v) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || ''); if (!m) return '';
    const iso = m[3] + '-' + m[2] + '-' + m[1], d = parseISO(iso);
    return d && toISO(d) === iso ? iso : '';
  },
  maskDate(v) { const n = v.replace(/\D/g, '').slice(0, 8); return n.length > 4 ? n.slice(0, 2) + '/' + n.slice(2, 4) + '/' + n.slice(4) : n.length > 2 ? n.slice(0, 2) + '/' + n.slice(2) : n; },
  maskTime(v) { const n = v.replace(/\D/g, '').slice(0, 4); return n.length > 2 ? n.slice(0, 2) + ':' + n.slice(2) : n; },
  // aceita 9, 930, 0930, 9:30, 14:30 → HH:mm; null quando inválido
  normTime(v) {
    const n = String(v || '').replace(/\D/g, ''); if (!n) return '';
    const h = n.length <= 2 ? +n : n.length === 3 ? +n[0] : +n.slice(0, 2);
    const m = n.length <= 2 ? 0 : n.length === 3 ? +n.slice(1) : +n.slice(2, 4);
    return h <= 23 && m <= 59 ? pad(h) + ':' + pad(m) : null;
  },
  upgrade(root) {
    if (!root || !root.querySelectorAll) return;
    const list = root.matches && root.matches('input[type=date],input[type=time]') ? [root] : Array.from(root.querySelectorAll('input[type=date],input[type=time]'));
    list.forEach(el => el.type === 'time' ? this.time(el) : this.date(el));
  },
  time(el) {
    el.type = 'text';
    el.classList.add('br-time');
    el.setAttribute('inputmode', 'numeric'); el.setAttribute('maxlength', '5'); el.setAttribute('autocomplete', 'off');
    if (!el.placeholder) el.placeholder = 'HH:mm';
    if (!el.title) el.title = 'Formato HH:mm (ex.: 14:30)';
  },
  date(el) {
    const vis = document.createElement('input');
    vis.type = 'text'; vis.className = 'br-date ' + el.className;
    vis.placeholder = 'DD/MM/AAAA'; vis.title = 'Formato DD/MM/AAAA (ex.: 24/10/2026)';
    vis.setAttribute('inputmode', 'numeric'); vis.setAttribute('maxlength', '10'); vis.setAttribute('autocomplete', 'off');
    if (el.title) vis.title = el.title;
    vis.value = this.isoToBR(el.value);
    el.type = 'hidden';
    el.insertAdjacentElement('beforebegin', vis);
    vis._iso = el;
    // atribuições feitas pelo código (ex.: botões "amanhã") também atualizam o campo visível
    const nativo = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(el, 'value', { configurable: true, get() { return nativo.get.call(this); }, set(v) { nativo.set.call(this, v); vis.value = BRInput.isoToBR(v); } });
    el.focus = () => vis.focus();
  },
  init() {
    document.addEventListener('input', e => {
      const t = e.target;
      if (t.classList && t.classList.contains('br-time')) t.value = this.maskTime(t.value);
      else if (t._iso) {
        t.value = this.maskDate(t.value);
        const iso = this.brToISO(t.value);
        if (iso && t._iso.value !== iso) t._iso.value = iso;
      }
    }, true);
    // em captura: normaliza antes dos listeners de "change" de cada tela
    document.addEventListener('change', e => {
      const t = e.target;
      if (t.classList && t.classList.contains('br-time')) {
        const v = this.normTime(t.value);
        if (v === null) { toast('Horário inválido. Use HH:mm (ex.: 14:30).', 'warn'); t.value = ''; } else t.value = v;
      } else if (t._iso) {
        e.stopPropagation();
        const iso = t.value ? this.brToISO(t.value) : '';
        if (t.value && !iso) toast('Data inválida. Use DD/MM/AAAA (ex.: 24/10/2026).', 'warn');
        t._iso.value = iso;
        t._iso.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, true);
    this.upgrade(document.body);
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) this.upgrade(n); }))).observe(document.body, { childList: true, subtree: true });
  }
};

document.addEventListener('DOMContentLoaded', () => { BRInput.init(); App.start(); });