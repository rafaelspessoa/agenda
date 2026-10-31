'use strict';

/* Sinais instantâneos (Supabase Realtime, canal broadcast). O sinal não traz dados:
   ao recebê-lo a tela busca de novo pela API autenticada. Protocolo Phoenix direto,
   sem biblioteca externa (a CSP só permite scripts do próprio site). */
const Realtime = {
  ws: null, cfg: null, onSignal: null, ref: 0, hb: null, retry: 0, timer: null, joined: new Set(),
  clientId: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/[^\w-]/g, ''),
  get connected() { return !!this.ws && this.ws.readyState === 1 && this.joined.size > 0; },
  start(cfg, onSignal) {
    this.stop();
    if (!cfg || !cfg.url || !cfg.key || !Array.isArray(cfg.topics) || !cfg.topics.length || typeof WebSocket === 'undefined') return;
    this.cfg = cfg; this.onSignal = onSignal; this.retry = 0;
    this.connect();
  },
  stop() {
    this.cfg = null; this.onSignal = null; this.joined.clear();
    clearInterval(this.hb); clearTimeout(this.timer); clearTimeout(this._debounce);
    if (this.ws) { const ws = this.ws; this.ws = null; ws.onclose = null; try { ws.close(); } catch (e) { } }
  },
  send(topic, event, payload) { try { this.ws.send(JSON.stringify({ topic, event, payload, ref: String(++this.ref) })); } catch (e) { } },
  connect() {
    const cfg = this.cfg; if (!cfg) return;
    const ws = new WebSocket(cfg.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(cfg.key) + '&vsn=1.0.0');
    this.ws = ws; this.joined.clear();
    ws.onopen = () => {
      cfg.topics.forEach(t => this.send('realtime:' + t, 'phx_join', { config: { broadcast: { self: false }, presence: { key: '' }, private: false } }));
      clearInterval(this.hb);
      this.hb = setInterval(() => this.send('phoenix', 'heartbeat', {}), 25000);
    };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.event === 'phx_reply' && m.payload && m.payload.status === 'ok' && String(m.topic).startsWith('realtime:')) {
        const first = !this.joined.size;
        this.joined.add(m.topic); this.retry = 0;
        // ao (re)conectar busca uma vez: cobre o que mudou enquanto estava desconectado
        if (first) this.fire();
      }
      if (m.event === 'broadcast' && !(m.payload && m.payload.payload && m.payload.payload.from === this.clientId)) this.fire();
    };
    ws.onclose = () => {
      clearInterval(this.hb); this.joined.clear();
      if (!this.cfg || this.ws !== ws) return;
      const delay = Math.min(15000, 500 * Math.pow(2, this.retry++));
      this.timer = setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => { try { ws.close(); } catch (e) { } };
  },
  // vários sinais seguidos viram uma única atualização
  fire() {
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => { if (this.onSignal) this.onSignal(); }, 120);
  }
};

const Cloud = {
  user: null,
  ready: false,
  timer: null,
  syncing: false,
  refreshPending: false,
  error: '',
  pending: new Map(),
  pendingKey: '',
  supplierCodes: new Map(),
  supplierSnapshot: null,

  // gerentes usam a agenda como compradores (agendam, atendem) e ainda têm o painel da gerência
  isBuyer(user = this.user) { return !!user && ['buyer', 'admin', 'purchase_manager', 'category_manager'].includes(user.role); },
  // gerente de compras (todos os compradores) e gerente de categoria (compradores dos seus departamentos)
  isManager(user = this.user) { return !!user && ['purchase_manager', 'category_manager'].includes(user.role); },
  // painel lido do servidor: recepção (registra chegada) e gerentes (só consultam)
  isPanel(user = this.user) { return !!user && (user.role === 'reception' || this.isManager(user)); },

  async request(path, options) {
    const opts = Object.assign({ credentials: 'same-origin', headers: {} }, options || {});
    opts.headers['X-Client-Id'] = Realtime.clientId; // o servidor não manda o sinal de volta para quem gravou
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    opts.signal = opts.signal || controller.signal;
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    let response;
    try { response = await fetch(path, opts); }
    catch (error) {
      if (error.name === 'AbortError') throw new Error('O servidor demorou para responder. Tente novamente.');
      throw error;
    } finally { clearTimeout(timer); }
    let result = {};
    try { result = await response.json(); } catch (e) { }
    if (!response.ok) {
      const error = new Error(result.error || 'Nao foi possivel acessar o servidor.');
      error.status = response.status;
      error.data = result; // ex.: laboratório que já tem o código (para oferecer "adicionar aos meus")
      throw error;
    }
    return result;
  },

  async current() {
    try { const result = await this.request('/api/auth'); this.realtimeCfg = result.realtime || null; return result.user || null; }
    catch (error) { if (error.status === 401) return null; throw error; }
  },

  async login(credentials) {
    const result = await this.request('/api/auth', { method: 'POST', body: credentials });
    // código de fornecedor cadastrado por mais de um comprador: a tela pede para escolher
    if (result.choose) return { choose: result.choose };
    this.realtimeCfg = result.realtime || null;
    return result.user;
  },

  // o que cada perfil faz ao receber um sinal do servidor
  startRealtime() {
    Realtime.start(this.realtimeCfg, () => {
      if (this.isBuyer()) { this.flush(); this.pullBuyerData(); if (this.isManager() && document.getElementById('recepPortal')) Recep.atualizar(); }
      else if (this.isPanel()) Recep.atualizar();
      else if (this.user?.role === 'supplier') this.loadSupplier().then(() => Forn.render()).catch(error => { this.error = error.message; });
    });
  },

  async logout() {
    try { await this.request('/api/auth', { method: 'POST', body: { action: 'logout' } }); }
    finally {
      Realtime.stop();
      if (this.user) { try { localStorage.removeItem('agenda_admin_users_' + this.user.id); } catch (e) { } }
      if (typeof AdminUsers !== 'undefined') AdminUsers.data = null;
      if (typeof Equipe !== 'undefined') { Equipe.chave = ''; Equipe.itens = []; }
      this.user = null;
      this.ready = false;
      this.pending.clear();
      this.pendingKey = '';
      clearInterval(this.timer);
    }
  },

  localOnlyConfig() {
    return ['auth', 'recepAuth', 'cloudOwner', 'backupDir', 'backupLast', 'backupLastFile', 'shareDir'];
  },

  localRecords() {
    const records = [];
    STORES.forEach(store => DB.all(store).forEach(record => {
      if (store === 'laboratorios') return; // laboratórios são compartilhados (api/labs)
      if (store === 'config' && this.localOnlyConfig().includes(record.id)) return;
      records.push({ store, id: record.id, record: this.cloudRecord(store, record) });
    }));
    return records;
  },

  // o código do fornecedor agora é o código interno do cadastro (não é mais um segredo gerado), então sincroniza junto
  cloudRecord(store, record) { return DB._clean(record); },

  // espera a fila de envio esvaziar (ex.: o cadastro do fornecedor precisa estar no servidor antes de liberar o acesso)
  async sync() {
    for (let i = 0; i < 100 && (this.flushing || this.pending.size); i++) {
      if (!this.flushing) await this.flush();
      if (this.error) throw new Error(this.error);
      if (this.flushing || this.pending.size) await new Promise(r => setTimeout(r, 50));
    }
  },

  // fornecedor que atende mais de um comprador
  async switchBuyer(buyerId) {
    const result = await this.request('/api/auth', { method: 'POST', body: { action: 'switch-buyer', buyerId } });
    this.realtimeCfg = result.realtime || null;
    await this.activate(result.user);
  },

  async activate(user) {
    if (this.user?.id !== user.id) {
      this.pending.clear();
      this.supplierCodes.clear();
      this.pendingKey = `agenda_cloud_pending_${user.id}`;
      try {
        const queued = JSON.parse(localStorage.getItem(this.pendingKey) || '[]');
        if (Array.isArray(queued)) this.pending = new Map(queued);
      } catch (e) { this.pending = new Map(); }
    }
    this.user = user;
    Auth.role = user.role === 'reception' ? 'recep' : user.role === 'supplier' ? 'forn' : 'comp';
    try { localStorage.setItem('agenda_role', Auth.role); } catch (e) { }
    const profile = { id: user.id, usuario: user.username, nome: user.name, role: user.role, buyerId: user.buyerId, supplierId: user.supplierId };
    await DB.setCfg('auth', profile, true);

    if (this.isBuyer(user)) {
      // dados desta conta ja estao neste navegador: libera a tela na hora e sincroniza em segundo plano
      const cached = DB.cfg('cloudOwner', '') === user.id;
      if (!cached) {
        try { await this.loadBuyerData(); }
        catch (error) { await this.logout(); throw error; }
      }
      this.ready = true;
      this.startPolling();
      this.releaseGate(false);
      if (typeof App !== 'undefined' && App.started) { App.buildNav(); Auth.paintUser(); App.render(); }
      if (cached) { this.flush().then(() => this.pullBuyerData()); this.loadLabs().catch(() => {}); }
      return;
    }

    if (this.isPanel(user)) {
      document.body.classList.add('locked');
      this.releaseGate(true);
      Recep.abrir();
      this.startPolling();
    } else if (user.role === 'supplier') {
      await this.loadSupplier();
      document.body.classList.add('locked');
      this.releaseGate(true);
      Forn.abrir(this.supplierSnapshot.supplier);
      this.startPolling();
    }
  },

  releaseGate(portal) {
    Auth.unlocked = true;
    const overlay = document.getElementById('auth');
    if (overlay) overlay.remove();
    if (!portal) document.body.classList.remove('locked');
    Auth.lastAct = Date.now();
    Auth.startIdle();
    const resolve = Auth._resolve;
    Auth._resolve = null;
    if (resolve) resolve();
  },

  async loadBuyerData() {
    let { records } = await this.request('/api/data');
    if (!records.length) {
      const localOwner = DB.cfg('cloudOwner', '');
      const local = localOwner && localOwner !== this.user.id ? [] : this.localRecords();
      if (local.length && window.confirm('Encontramos dados locais neste navegador. Deseja importá-los para a conta compartilhada?')) {
        for (let index = 0; index < local.length; index += 50) {
          await this.request('/api/data', { method: 'POST', body: { action: 'bulk', records: local.slice(index, index + 50) } });
        }
        records = (await this.request('/api/data')).records;
      } else if (local.length) throw new Error('A importacao foi cancelada; os dados locais foram mantidos e o login nao foi concluido.');
    }
    await this.replaceLocal(records);
    await this.loadLabs();
    await DB.setCfg('cloudOwner', this.user.id, true);
  },

  // lista única de laboratórios (todos os compradores); substitui o cache local quando muda
  async loadLabs() {
    const { labs } = await this.request('/api/labs');
    const atual = JSON.stringify(sortBy(DB.all('laboratorios').map(l => DB._clean(l)), l => l.id));
    const novo = sortBy(labs, l => l.id);
    if (JSON.stringify(novo) === atual) return false;
    await DB.clear('laboratorios', true);
    await DB.bulkPut('laboratorios', novo, true);
    DB.changed('@sync');
    return true;
  },

  async saveLab(lab, isNew) {
    const result = await this.request('/api/labs', { method: isNew ? 'POST' : 'PUT', body: { lab: DB._clean(lab) } });
    await DB.put('laboratorios', result.lab, true);
    DB.changed('laboratorios');
    return result.lab;
  },

  // adicionar / remover dos meus laboratórios (não altera o cadastro)
  async linkLab(id, ligar) {
    const result = await this.request('/api/labs', { method: 'POST', body: { action: ligar === false ? 'unlink' : 'link', id } });
    await DB.put('laboratorios', result.lab, true);
    DB.changed('laboratorios');
    return result.lab;
  },

  async deleteLab(id) {
    await this.request('/api/labs', { method: 'DELETE', body: { id } });
    await DB.del('laboratorios', id, true);
    DB.changed('laboratorios');
  },

  async importLabs(labs) {
    let created = 0, updated = 0, linked = 0, skipped = 0;
    for (let index = 0; index < labs.length; index += 500) {
      const r = await this.request('/api/labs', { method: 'POST', body: { action: 'bulk', labs: labs.slice(index, index + 500).map(l => DB._clean(l)) } });
      created += r.created; updated += r.updated; linked += r.linked || 0; skipped += r.skipped;
    }
    await this.loadLabs();
    return { created, updated, linked, skipped };
  },

  async replaceLocal(records) {
    const localConfig = DB.all('config').filter(record => this.localOnlyConfig().includes(record.id));
    for (const store of STORES) {
      if (store === 'laboratorios') continue; // vem de loadLabs
      await DB.clear(store, true);
      const incoming = records.filter(record => record.store === store).map(record => record.payload);
      if (store === 'config') incoming.push(...localConfig);
      await DB.bulkPut(store, incoming, true);
    }
    DB.changed('@sync');
  },

  async pullBuyerData() {
    if (!this.ready) return;
    if (this.syncing) { this.refreshPending = true; return; }
    this.syncing = true;
    const inicio = Date.now();
    try {
      const { records } = await this.request('/api/data');
      // algo foi enviado enquanto esta consulta estava em andamento: a lista pode estar desatualizada; consulta de novo
      if (this.lastSent >= inicio) { this.refreshPending = true; return; }
      const incoming = new Map(records.map(item => [`${item.store}:${item.id}`, item.payload]));
      let changed = false;
      for (const store of STORES) {
        if (store === 'config' || store === 'laboratorios') continue;
        for (const local of DB.all(store)) {
          const key = `${store}:${local.id}`;
          if (!incoming.has(key) && !this.isPending(store, local.id)) { await DB.del(store, local.id, true); changed = true; }
        }
      }
      for (const item of records) {
        if (item.store === 'laboratorios' || this.isPending(item.store, item.id)) continue;
        const local = DB.get(item.store, item.id);
        if (!local || JSON.stringify(DB._clean(local)) !== JSON.stringify(item.payload)) { await DB.put(item.store, item.payload, true); changed = true; }
      }
      const hadError = !!this.error;
      this.error = '';
      // Redesenhar a cada consulta sem mudancas apagava formularios em edicao
      if (changed) { DB.changed('@sync'); if (typeof Aviso !== 'undefined') Aviso.check(); }
      else if (hadError && App.started) App.refreshChrome();
    } catch (error) {
      this.error = error.message;
      this.showSyncError();
    } finally {
      this.syncing = false;
      if (this.refreshPending) { this.refreshPending = false; queueMicrotask(() => this.pullBuyerData()); }
    }
  },

  async queue(store, action, record, id) {
    if (!this.ready || (store === 'config' && this.localOnlyConfig().includes(id || (record || {}).id))) return;
    const key = `${store}:${id || (record || {}).id || '*'}`;
    this.pending.set(key, { store, action, record: record ? this.cloudRecord(store, record) : null, id: id || (record || {}).id || '' });
    this.savePending();
    return this.flush();
  },

  savePending() {
    if (!this.pendingKey) return;
    try { localStorage.setItem(this.pendingKey, JSON.stringify(Array.from(this.pending.entries()))); } catch (e) { }
  },

  isPending(store, id) {
    if (this.pending.has(`${store}:${id}`) || this.pending.has(`${store}:*`)) return true;
    const bulk = this.pending.get(`${store}:bulk`);
    return !!bulk && bulk.records.some(record => String(record.id) === String(id));
  },

  async queueBulk(store, records) {
    if (!this.ready) return;
    const allowed = records.filter(record => !(store === 'config' && this.localOnlyConfig().includes(record.id)));
    if (!allowed.length) return;
    this.pending.set(`${store}:bulk`, { store, action: 'bulk', records: allowed.map(record => ({ store, id: record.id, record: this.cloudRecord(store, record) })) });
    this.savePending();
    return this.flush();
  },

  async flush() {
    if (!this.ready || !this.pending.size || this.flushing || !this.user || this.pendingKey !== `agenda_cloud_pending_${this.user.id}`) return;
    this.flushing = true;
    let failedKey = '';
    let rejected = false;
    try {
      for (const [key, item] of Array.from(this.pending.entries())) {
        failedKey = key;
        if (item.action === 'put') {
          await this.request('/api/data', { method: 'PUT', body: { store: item.store, id: item.id, record: item.record } });
        } else if (item.action === 'delete') {
          await this.request('/api/data', { method: 'DELETE', body: { store: item.store, id: item.id } });
        } else if (item.action === 'clear') {
          await this.request('/api/data', { method: 'DELETE', body: { store: item.store, action: 'clear' } });
        } else if (item.action === 'bulk') {
          // em partes, para não passar do limite de tamanho da API
          for (let index = 0; index < item.records.length; index += 200) {
            await this.request('/api/data', { method: 'POST', body: { action: 'bulk', records: item.records.slice(index, index + 200) } });
          }
        }
        this.pending.delete(key);
        this.lastSent = Date.now();
        this.savePending();
      }
      this.error = '';
    } catch (error) {
      if (error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429 && failedKey) {
        this.pending.delete(failedKey);
        this.savePending();
        this.error = '';
        rejected = true;
        toast(error.message, 'warn', 8000);
      } else {
        this.error = error.message;
        this.showSyncError();
      }
    } finally { this.flushing = false; }
    if (rejected) await this.pullBuyerData();
    // o que entrou na fila durante o envio segue logo em seguida, sem esperar a próxima consulta
    else if (!this.error && this.pending.size) await this.flush();
  },

  async loadSupplier() {
    this.supplierSnapshot = await this.request('/api/suppliers');
    await this.applySupplierSnapshot();
  },

  async applySupplierSnapshot() {
    if (!this.supplierSnapshot) return;
    const snapshot = this.supplierSnapshot;
    await DB.setCfg('fornCfg', snapshot.cfg, true);
    await DB.setCfg('fornBloq', snapshot.blocks, true);
    await DB.setCfg('fornecedores', [snapshot.supplier], true);
    const busy = snapshot.busy.map(item => ({
      id: `busy-${item.data}-${item.hora}`, data: item.data, hora: item.hora, horaFim: item.horaFim,
      titulo: 'Horario ocupado', status: 'A fazer', prioridade: 'MEDIA', tipo: 'Compromisso'
    }));
    await DB.clear('demandas', true);
    await DB.bulkPut('demandas', busy.concat(snapshot.appointments), true);
    DB.changed('@sync');
  },

  async supplierBook({ date, start, end, subject, industries }) {
    const result = await this.request('/api/suppliers', { method: 'POST', body: { date, start, end, subject, industries } });
    await DB.put('demandas', result.appointment, true);
    DB.changed('demandas');
    return result.appointment;
  },

  async supplierCancel(id) {
    await this.request('/api/suppliers', { method: 'DELETE', body: { id } });
    const record = DB.get('demandas', id);
    if (record) await DB.put('demandas', Object.assign({}, record, { status: 'Cancelado' }), true);
    DB.changed('demandas');
  },

  async refreshReception() {
    const { appointments } = await this.request('/api/reception');
    const buyers = new Map();
    appointments.forEach(item => {
      const key = item.buyerId;
      if (!buyers.has(key)) buyers.set(key, { slug: key, comprador: item.buyerName, usuario: key, itens: [], geradoEm: new Date().toISOString() });
      buyers.get(key).itens.push(Object.assign({}, item.appointment, { compradorNome: item.buyerName, compradorDeps: deptTxt(item.buyerDepartments), _slug: key }));
    });
    Share.remotos = Array.from(buyers.values());
    Share.overlay = {};
    Share.lidoEm = new Date().toISOString();
  },

  // relatório da gerência: agendamentos dos compradores da gerência no período
  async teamReport(de, ate) {
    const { appointments } = await this.request('/api/reception?de=' + encodeURIComponent(de) + '&ate=' + encodeURIComponent(ate));
    return appointments.map(item => Object.assign({}, item.appointment, { compradorId: item.buyerId, compradorNome: item.buyerName }));
  },

  async markReception(buyerId, id, state) {
    const changes = {};
    for (const field of ['chegouEm', 'iniciouEm', 'finalizouEm', 'avisoVistoEm', 'avisoEm']) {
      if (Object.prototype.hasOwnProperty.call(state, field)) changes[field] = state[field];
    }
    // uma única gravação: o comprador recebe chegada e aviso juntos
    await this.request('/api/reception', { method: 'PATCH', body: { buyerId, id, changes } });
  },

  // busca o estado atual do servidor conforme o perfil
  refreshNow() {
    if (this.isBuyer()) { this.flush(); this.pullBuyerData(); this.loadLabs().catch(() => {}); if (this.isManager() && document.getElementById('recepPortal')) Recep.atualizar(); }
    else if (this.isPanel()) Recep.atualizar();
    else if (this.user?.role === 'supplier') this.loadSupplier().then(() => Forn.render()).catch(error => { this.error = error.message; });
  },

  startPolling() {
    clearInterval(this.timer);
    this.startRealtime();
    let ultimo = Date.now();
    this.timer = setInterval(() => {
      // com o canal instantâneo ativo, a consulta periódica vira só reserva (a cada 60 s)
      if (Realtime.connected && Date.now() - ultimo < 60000) return;
      ultimo = Date.now();
      this.refreshNow();
    }, 10000);
    if (!this._visOn) {
      this._visOn = true;
      // ao voltar para a aba (o navegador desacelera abas em segundo plano), atualiza na hora
      document.addEventListener('visibilitychange', () => { if (!document.hidden && this.user) this.refreshNow(); });
    }
  },

  showSyncError() {
    if (typeof App !== 'undefined' && App.started) App.refreshChrome();
    if (!this._errorShown) {
      this._errorShown = true;
      toast('Os dados ainda nao foram sincronizados com o servidor. Verifique a conexao.', 'warn', 8000);
      setTimeout(() => { this._errorShown = false; }, 30000);
    }
  }
};

