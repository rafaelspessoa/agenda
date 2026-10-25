'use strict';

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

  isBuyer(user = this.user) { return !!user && ['buyer', 'admin'].includes(user.role); },

  async request(path, options) {
    const opts = Object.assign({ credentials: 'same-origin', headers: {} }, options || {});
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
      throw error;
    }
    return result;
  },

  async current() {
    try { return (await this.request('/api/auth')).user || null; }
    catch (error) { if (error.status === 401) return null; throw error; }
  },

  async login(credentials) {
    return (await this.request('/api/auth', { method: 'POST', body: credentials })).user;
  },

  async logout() {
    try { await this.request('/api/auth', { method: 'POST', body: { action: 'logout' } }); }
    finally {
      if (this.user) { try { localStorage.removeItem('agenda_admin_users_' + this.user.id); } catch (e) { } }
      if (typeof AdminUsers !== 'undefined') AdminUsers.data = null;
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
      if (store === 'config' && this.localOnlyConfig().includes(record.id)) return;
      records.push({ store, id: record.id, record: this.cloudRecord(store, record) });
    }));
    return records;
  },

  cloudRecord(store, record) {
    const cleaned = DB._clean(record);
    if (store === 'config' && cleaned.id === 'fornecedores' && Array.isArray(cleaned.value)) {
      cleaned.value = cleaned.value.map(({ codigo, ...supplier }) => supplier);
    }
    return cleaned;
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
      try { await this.loadBuyerData(); }
      catch (error) { await this.logout(); throw error; }
      this.ready = true;
      this.startPolling();
      this.releaseGate(false);
      return;
    }

    if (user.role === 'reception') {
      document.body.classList.add('locked');
      this.releaseGate(true);
      Recep.abrir();
    } else if (user.role === 'supplier') {
      await this.loadSupplier();
      document.body.classList.add('locked');
      this.releaseGate(true);
      Forn.abrir(this.supplierSnapshot.supplier);
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
    await DB.setCfg('cloudOwner', this.user.id, true);
  },

  async replaceLocal(records) {
    const localConfig = DB.all('config').filter(record => this.localOnlyConfig().includes(record.id));
    for (const store of STORES) {
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
    try {
      const { records } = await this.request('/api/data');
      const incoming = new Map(records.map(item => [`${item.store}:${item.id}`, item.payload]));
      let changed = false;
      for (const store of STORES) {
        if (store === 'config') continue;
        for (const local of DB.all(store)) {
          const key = `${store}:${local.id}`;
          if (!incoming.has(key) && !this.isPending(store, local.id)) { await DB.del(store, local.id, true); changed = true; }
        }
      }
      for (const item of records) {
        if (this.isPending(item.store, item.id)) continue;
        const local = DB.get(item.store, item.id);
        if (!local || JSON.stringify(DB._clean(local)) !== JSON.stringify(item.payload)) { await DB.put(item.store, item.payload, true); changed = true; }
      }
      const hadError = !!this.error;
      this.error = '';
      // Redesenhar a cada consulta sem mudancas apagava formularios em edicao
      if (changed) DB.changed('@sync');
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
          await this.request('/api/data', { method: 'POST', body: { action: 'bulk', records: item.records } });
        }
        this.pending.delete(key);
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
      buyers.get(key).itens.push(Object.assign({}, item.appointment, { compradorNome: item.buyerName, _slug: key }));
    });
    Share.remotos = Array.from(buyers.values());
    Share.overlay = {};
    Share.lidoEm = new Date().toISOString();
  },

  async markReception(buyerId, id, state) {
    for (const field of ['chegouEm', 'iniciouEm', 'finalizouEm', 'avisoVistoEm', 'avisoEm']) {
      if (Object.prototype.hasOwnProperty.call(state, field)) {
        await this.request('/api/reception', { method: 'PATCH', body: { buyerId, id, field, value: state[field] } });
      }
    }
  },

  startPolling() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.isBuyer()) { this.flush(); this.pullBuyerData(); }
      else if (this.user?.role === 'reception') Recep.atualizar();
      else if (this.user?.role === 'supplier') this.loadSupplier().then(() => Forn.render()).catch(error => { this.error = error.message; });
    }, 10000);
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

