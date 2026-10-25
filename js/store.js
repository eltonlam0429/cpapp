/* 本機資料 + Google 試算表同步
 * 每筆資料：{ id, col, data, updatedAt, deleted, by }
 * 本機先寫，之後在背景推上雲端；兩邊都改過的話，較新的那個勝出。 */
(function () {
  const LS_KEY = 'us.v1';
  const listeners = new Set();

  function uid(prefix) {
    return (prefix || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const Store = {
    s: null,
    rev: 0, // 每次資料有變就加一，給設定快取用
    uid,

    load() {
      try { this.s = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { this.s = null; }
      if (!this.s || !this.s.records) {
        this.s = { records: {}, pending: {}, device: {} };
      }
      this.s.device = Object.assign({ me: null, url: '', key: '', cursor: 0, lastSync: 0, lastError: '' }, this.s.device);
      this.cleanup();
    },

    save() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.s));
      } catch (e) {
        if (window.toast) toast('手機空間不夠，請刪走一些相片');
      }
    },

    get device() { return this.s.device; },
    setDevice(patch) { Object.assign(this.s.device, patch); this.save(); emit(); },

    rec(id) { return this.s.records[id]; },

    get(id) {
      const r = this.s.records[id];
      return r && !r.deleted ? Object.assign({ id: r.id, _by: r.by, _at: r.updatedAt }, r.data) : null;
    },

    all(col) {
      const out = [];
      for (const id in this.s.records) {
        const r = this.s.records[id];
        if (r.col === col && !r.deleted) out.push(Object.assign({ id: r.id, _by: r.by, _at: r.updatedAt }, r.data));
      }
      return out;
    },

    trash() {
      const cutoff = Date.now() - 7 * 864e5;
      return Object.values(this.s.records).filter(r => r.deleted && r.deleted > cutoff && !r.data._hidden);
    },

    put(col, obj, id) {
      const data = Object.assign({}, obj);
      id = id || data.id || uid(col.slice(0, 2));
      delete data.id; delete data._by; delete data._at;
      const prev = this.s.records[id];
      this.s.records[id] = {
        id, col, data,
        updatedAt: Math.max(Date.now(), prev ? prev.updatedAt + 1 : 0),
        deleted: 0,
        by: (prev && prev.by) || this.s.device.me || ''
      };
      this.touch(id);
      return id;
    },

    patch(id, patch) {
      const r = this.s.records[id];
      if (!r) return;
      return this.put(r.col, Object.assign({}, r.data, patch), id);
    },

    remove(id, opts) {
      const r = this.s.records[id];
      if (!r) return;
      r.deleted = Date.now();
      if (opts && opts.silent) r.data = Object.assign({}, r.data, { _hidden: 1 });
      r.updatedAt = Math.max(Date.now(), r.updatedAt + 1);
      this.touch(id);
    },

    restore(id) {
      const r = this.s.records[id];
      if (!r) return;
      r.deleted = 0;
      r.updatedAt = Math.max(Date.now(), r.updatedAt + 1);
      this.touch(id);
    },

    touch(id) {
      this.rev++;
      this.s.pending[id] = 1;
      this.save();
      emit();
      Sync.schedule();
    },

    // 刪除超過 7 天的，從本機清走（雲端仍保留刪除記號）
    cleanup() {
      const cutoff = Date.now() - 7 * 864e5;
      for (const id in this.s.records) {
        const r = this.s.records[id];
        if (r.deleted && r.deleted < cutoff && !this.s.pending[id]) {
          r.data = { _gone: 1 };
        }
      }
    },

    exportJSON() {
      const recs = Object.values(this.s.records);
      return JSON.stringify({ app: 'us', version: 1, exportedAt: new Date().toISOString(), records: recs }, null, 1);
    },

    importJSON(text) {
      const j = JSON.parse(text);
      if (!j || !Array.isArray(j.records)) throw new Error('不是這個 app 的備份檔');
      let n = 0;
      j.records.forEach(r => {
        if (!r || !r.id || !r.col) return;
        const local = this.s.records[r.id];
        if (!local || (r.updatedAt || 0) > local.updatedAt) {
          this.s.records[r.id] = { id: r.id, col: r.col, data: r.data || {}, updatedAt: Math.max(Date.now(), (r.updatedAt || 0)), deleted: r.deleted || 0, by: r.by || '' };
          this.s.pending[r.id] = 1;
          n++;
        }
      });
      this.rev++; this.save(); emit(); Sync.schedule();
      return n;
    },

    wipe() {
      localStorage.removeItem(LS_KEY);
      this.load();
      this.rev++;
      emit();
    },

    on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };

  let emitT = null;
  function emit() {
    clearTimeout(emitT);
    emitT = setTimeout(() => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }), 30);
  }

  /* ---------------- 同步 ---------------- */
  const Sync = {
    state: 'idle', // idle | busy | ok | err | off
    timer: null,
    pollT: null,
    busy: false,
    again: false,

    configured() { const d = Store.s.device; return !!(d.url && d.key); },

    schedule(delay) {
      if (!this.configured()) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.run(), delay == null ? 700 : delay);
    },

    startPolling() {
      clearInterval(this.pollT);
      this.pollT = setInterval(() => { if (document.visibilityState === 'visible') this.run(); }, 12000);
      if (!this._listening) {
        this._listening = true;
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.run(); });
        window.addEventListener('online', () => this.run());
      }
      this.run();
    },

    /* 連接一個試算表：永遠以試算表那份作準。
       1) 先把雲端全部資料拉下來，同一筆資料一律用雲端的；
       2) 如果雲端已經有設定（名字、生日、在一起的日子…），這部手機的設定全部丟掉，不會覆蓋雲端；
       3) 其餘只在這部手機有的東西（例如待辦）才推上去。 */
    async connect(url, key) {
      const s = Store.s;
      Object.assign(s.device, { url, key, cursor: 0, lastError: '' });
      this.busy = true; this.setState('busy');
      try {
        const j = await this.request({ action: 'sync', since: 0, changes: [] }, url, key);
        const rows = j.rows || [];
        const cloud = new Set(rows.map(r => r.id));
        const isCfg = id => id === 'settings' || /^cfg_/.test(id);
        const cloudHasSettings = rows.some(r => isCfg(r.id) && !r.deleted);
        rows.forEach(row => {
          let data = {};
          try { data = JSON.parse(row.json || '{}'); } catch (e) { return; }
          s.records[row.id] = { id: row.id, col: row.col, data, updatedAt: row.updatedAt, deleted: row.deleted || 0, by: row.by || '' };
          delete s.pending[row.id];
        });
        Object.keys(s.records).forEach(id => {
          if (cloud.has(id)) return;
          if (cloudHasSettings && isCfg(id)) { delete s.records[id]; delete s.pending[id]; return; }
          s.pending[id] = 1;
        });
        s.device.cursor = j.cursor || 0;
        s.device.lastSync = Date.now();
        Store.rev++; Store.save(); emit();
        this.busy = false;
        await this.run(true);
        return { rows: rows.length, hasSettings: cloudHasSettings };
      } catch (e) {
        this.busy = false;
        s.device.lastError = e.message || String(e); Store.save();
        this.setState('err', s.device.lastError);
        throw e;
      }
    },

    async request(payload, url, key) {
      const d = Store.s.device;
      const res = await fetch(url || d.url, {
        method: 'POST',
        // text/plain 避免瀏覽器先送 OPTIONS，Apps Script 不支援
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ key: key || d.key }, payload)),
        redirect: 'follow'
      });
      if (!res.ok) throw new Error('連線失敗（' + res.status + '）');
      let j;
      try { j = await res.json(); } catch (e) { throw new Error('網址好像不對，請確認是 /exec 結尾的網頁應用程式網址'); }
      if (!j.ok) throw new Error(j.error || '同步失敗');
      return j;
    },

    async test(url, key) {
      return this.request({ action: 'ping' }, url, key);
    },

    async run(force) {
      if (!this.configured()) { this.setState('off'); return; }
      // 密碼錯誤時停止自動同步，免得觸發試算表的防猜保護；手動同步或改密碼時才再試
      if (!force && /密碼/.test(Store.s.device.lastError || '')) { this.setState('err', Store.s.device.lastError); return; }
      if (!navigator.onLine) { this.setState('err', '沒有網絡'); return; }
      if (this.busy) { this.again = true; return; }
      this.busy = true;
      this.setState('busy');
      const s = Store.s;
      try {
        const ids = Object.keys(s.pending);
        const changes = ids.map(id => s.records[id]).filter(Boolean).map(r => ({
          id: r.id, col: r.col, updatedAt: r.updatedAt, deleted: r.deleted, by: r.by, json: JSON.stringify(r.data)
        }));
        const j = await this.request({ action: 'sync', since: s.device.cursor || 0, changes });
        changes.forEach(c => { const r = s.records[c.id]; if (r && r.updatedAt === c.updatedAt) delete s.pending[c.id]; });
        let changed = false;
        (j.rows || []).forEach(row => {
          const local = s.records[row.id];
          if (local && row.updatedAt <= local.updatedAt) return;
          let data = {};
          try { data = JSON.parse(row.json || '{}'); } catch (e) { return; }
          s.records[row.id] = { id: row.id, col: row.col, data, updatedAt: row.updatedAt, deleted: row.deleted || 0, by: row.by || '' };
          delete s.pending[row.id];
          changed = true;
        });
        s.device.cursor = j.cursor || s.device.cursor;
        s.device.lastSync = Date.now();
        s.device.lastError = '';
        Store.cleanup();
        if (changed) Store.rev++;
        Store.save();
        if (changed) emit();
        this.setState('ok');
      } catch (e) {
        s.device.lastError = e.message || String(e);
        Store.save();
        this.setState('err', s.device.lastError);
      } finally {
        this.busy = false;
        if (this.again) { this.again = false; this.schedule(300); }
        return this.state;
      }
    },

    setState(st, msg) {
      this.state = st;
      this.msg = msg || '';
      document.querySelectorAll('[data-sync-pill]').forEach(el => window.renderSyncPill && window.renderSyncPill(el));
    }
  };

  window.Store = Store;
  window.Sync = Sync;
})();
