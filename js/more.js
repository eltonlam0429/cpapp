/* 一起做、旅行清單、時間囊、保險箱 */
(function () {
  const A = window.App;
  A.forms = A.forms || {};
  const ui = { doCat: 'all', showDoneDo: false, showPastTrips: false };
  const delBtn = '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>';
  const checkBtn = (on, act, id) => '<button class="check' + (on ? ' on' : '') + '" data-act="' + act + '" data-id="' + id + '" aria-label="完成">' + icon('check', 'xs') + '</button>';

  /* ================= 一起做 ================= */
  function doCats() { return DO_CATS.concat(A.S().doCats || []); }
  function pageDo() {
    const cats = doCats();
    const all = Store.all('dodo');
    const open = all.filter(x => !x.done), done = all.filter(x => x.done);
    let h = A.head('一起做', '想一起看的、想一起去的、想一起做的。', { back: true });
    h += '<div class="chips" style="margin-bottom:16px"><button class="chip' + (ui.doCat === 'all' ? ' on' : '') + '" data-act="do-cat" data-k="all">全部</button>' +
      cats.map(c => { const n = open.filter(x => x.cat === c.k).length; return '<button class="chip' + (ui.doCat === c.k ? ' on' : '') + '" data-act="do-cat" data-k="' + c.k + '">' + c.e + ' ' + esc(c.n) + (n ? ' <span style="opacity:.6">' + n + '</span>' : '') + '</button>'; }).join('') +
      '<button class="chip add" data-act="do-newcat">' + icon('plus', 'xs') + '自訂</button></div>';
    const shown = open.filter(x => ui.doCat === 'all' || x.cat === ui.doCat);
    if (!shown.length) {
      h += A.emptyHTML('coffee', all.length ? '這裏沒有' : '還沒有一起做的事', all.length ? '換一個種類看看，或者加一項。' : '一套想看的電影、一個想去的地方：先寫下來。');
    } else if (ui.doCat === 'all') {
      cats.forEach(c => {
        const its = shown.filter(x => x.cat === c.k);
        if (!its.length) return;
        h += '<div class="label">' + c.e + ' ' + esc(c.n) + '</div><div class="glass card tight list">' + its.map(doRow).join('') + '</div>';
      });
      const orphan = shown.filter(x => !cats.some(c => c.k === x.cat));
      if (orphan.length) h += '<div class="label">其他</div><div class="glass card tight list">' + orphan.map(doRow).join('') + '</div>';
    } else {
      h += '<div class="glass card tight list">' + shown.map(doRow).join('') + '</div>';
    }
    const doneShown = done.filter(x => ui.doCat === 'all' || x.cat === ui.doCat);
    if (doneShown.length) {
      h += '<button class="section-h" style="width:calc(100% - 8px)" data-act="do-showdone">做過了 ' + doneShown.length + '<span class="faint">' + icon(ui.showDoneDo ? 'chevD' : 'chevR', 'sm') + '</span></button>';
      if (ui.showDoneDo) h += '<div class="glass card tight list">' + doneShown.sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).map(doRow).join('') + '</div>';
    }
    h += '<button class="btn fab" data-act="do-new">' + icon('plus') + '加一項</button>';
    return h;
  }
  function doRow(x) {
    return '<div class="li">' + checkBtn(x.done, 'do-toggle', x.id) +
      '<button class="grow" style="text-align:left" data-act="do-edit" data-id="' + x.id + '"><div class="tt' + (x.done ? ' done-text' : '') + '">' + esc(x.title) + '</div>' +
      (x.note || (x.done && x.doneAt) ? '<div class="ts">' + [x.done && x.doneAt ? D.md(x.doneAt) + ' 做了' : '', esc(x.note || '')].filter(Boolean).join(' · ') + '</div>' : '') + '</button>' + A.avatar(x._by || A.ME(), 'xs') + '</div>';
  }
  function newCat() {
    const n = (prompt('新的種類叫甚麼？例如：要試的餐廳') || '').trim().slice(0, 14);
    if (!n) return null;
    const list = (A.S().doCats || []).concat([{ k: 'c_' + Date.now().toString(36), n, c: '#8b5cf6', e: '⭐' }]);
    A.setS({ doCats: list });
    return list[list.length - 1];
  }
  function doSheet(id) {
    const x = id ? Store.get(id) : { title: '', cat: ui.doCat !== 'all' ? ui.doCat : 'movie', note: '', done: false };
    openSheet('<h2>' + (id ? '一起做' : '加一項') + '</h2><input class="field" name="title" maxlength="120" placeholder="是甚麼？例如：奧本海默" value="' + esc(x.title) + '"' + (id ? '' : ' autofocus') + '>' +
      '<div class="label">種類</div><div data-chipbox></div>' +
      '<div class="label">備註（可選）</div><input class="field" name="note" maxlength="200" placeholder="例如：Netflix 有得睇" value="' + esc(x.note || '') + '">' +
      (id ? '<div class="set-row" style="margin-top:8px"><div style="font-weight:600">做過了</div>' + switchHTML('done', x.done) + '</div>' : '') +
      '<div class="actions">' + (id ? delBtn : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      let getCat;
      const bind = cur => {
        api.$('[data-chipbox]').innerHTML = chipsHTML(doCats().map(c => ({ k: c.k, n: c.e + ' ' + c.n, c: c.c })), cur, 'cat', true);
        getCat = bindChips(api.el, 'cat', () => { const c = newCat(); if (c) bind(c.k); });
      };
      bind(x.cat);
      api.$('[data-save]').onclick = () => {
        const title = api.$('[name=title]').value.trim(); if (!title) { api.$('[name=title]').focus(); return; }
        const done = id ? api.$('[name=done]').checked : false;
        Store.put('dodo', Object.assign({}, x, { title, cat: getCat() || 'do', note: api.$('[name=note]').value.trim(), done, doneAt: done ? (x.doneAt || D.today()) : '' }), id);
        api.close();
      };
      if (id) api.$('[data-del]').onclick = () => { Store.remove(id); api.close(); };
    });
  }

  /* ================= 旅行清單 ================= */
  function tplItems() {
    const r = Store.get('triptpl');
    return r && Array.isArray(r.items) ? r.items : TRIP_DEFAULT.map((t, i) => ({ id: 'd' + i, t }));
  }
  function saveTpl(items) { Store.put('tpl', { items }, 'triptpl'); }
  function tripItems(tripId) { return Store.all('tci').filter(i => i.tripId === tripId).sort((a, b) => (a.order || 0) - (b.order || 0)); }
  function tripStatus(tr) {
    const t = D.today(), end = tr.end || tr.start;
    if (tr.start > t) return '還有 ' + D.diff(t, tr.start) + ' 天';
    if (end >= t) return '旅行中';
    return '去過了';
  }
  function dateRange(tr) {
    if (!D.valid(tr.start)) return '';
    const end = D.valid(tr.end) && tr.end > tr.start ? tr.end : '';
    return D.md(tr.start) + ' 週' + D.WD[D.dow(tr.start)] + (end ? ' – ' + D.md(end) + ' 週' + D.WD[D.dow(end)] + ' · ' + (D.diff(tr.start, end) + 1) + ' 天' : '');
  }
  function pageTrips() {
    const t = D.today();
    const trips = Store.all('trip').sort((a, b) => a.start < b.start ? -1 : 1);
    const up = trips.filter(x => (x.end || x.start) >= t), past = trips.filter(x => (x.end || x.start) < t).reverse();
    let h = A.head('旅行清單', '每次旅行一張清單，執行李時逐項剔。', { back: true, right: '<a href="#/triptpl" class="round-btn" aria-label="清單範本">' + icon('sliders', 'sm') + '</a>' });
    const card = tr => {
      const its = tripItems(tr.id), n = its.filter(i => i.done).length;
      return '<a href="#/trip/' + tr.id + '" class="glass card" style="display:block"><div class="row between"><b style="font-size:18px">' + esc(tr.name) + '</b><span class="tag' + (tripStatus(tr) === '去過了' ? ' gray' : '') + '">' + tripStatus(tr) + '</span></div>' +
        '<div class="small muted" style="margin-top:4px">' + dateRange(tr) + '</div>' +
        '<div class="progress"><i style="width:' + (its.length ? Math.round(n * 100 / its.length) : 0) + '%"></i></div><div class="small muted" style="margin-top:6px">執好 ' + n + ' / ' + its.length + '</div></a>';
    };
    if (!trips.length) h += A.emptyHTML('flag', '還沒有旅行', '加一次旅行，會自動帶入你們的清單範本。範本可以按右上角修改。');
    h += up.map(card).join('');
    if (past.length) {
      h += '<button class="section-h" style="width:calc(100% - 8px)" data-act="trip-showpast">去過的 ' + past.length + '<span class="faint">' + icon(ui.showPastTrips ? 'chevD' : 'chevR', 'sm') + '</span></button>';
      if (ui.showPastTrips) h += past.map(card).join('');
    }
    h += '<button class="btn fab" data-act="trip-new">' + icon('plus') + '新旅行</button>';
    return h;
  }
  function tripSheet(id) {
    const x = id ? Store.get(id) : { name: '', start: D.add(D.today(), 7), end: D.add(D.today(), 10) };
    openSheet('<h2>' + (id ? '這次旅行' : '新旅行') + '</h2><input class="field" name="name" maxlength="60" placeholder="去哪裏？例如：東京" value="' + esc(x.name) + '"' + (id ? '' : ' autofocus') + '>' +
      '<div class="two" style="margin-top:4px"><div><div class="label">出發</div><input type="date" class="field" name="start" value="' + esc(x.start) + '"></div><div><div class="label">回程</div><input type="date" class="field" name="end" value="' + esc(x.end || '') + '"></div></div>' +
      (id ? '' : '<p class="small muted" style="margin:12px 4px 0">' + icon('list', 'xs') + ' 會帶入清單範本的 ' + tplItems().length + ' 項，之後可以自己加減。</p>') +
      '<div class="actions">' + (id ? delBtn : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      api.$('[data-save]').onclick = () => {
        const name = api.$('[name=name]').value.trim(); if (!name) { api.$('[name=name]').focus(); return; }
        const start = api.$('[name=start]').value; if (!D.valid(start)) { api.$('[name=start]').focus(); return; }
        let end = api.$('[name=end]').value; if (end && end < start) end = start;
        const tid = Store.put('trip', Object.assign({}, x, { name, start, end }), id);
        if (!id) tplItems().forEach((it, i) => Store.put('tci', { tripId: tid, t: it.t, done: false, order: (i + 1) * 10 }));
        api.close();
        if (!id) location.hash = '#/trip/' + tid;
      };
      if (id) api.$('[data-del]').onclick = async () => {
        api.close();
        if (!(await confirmSheet('刪除「' + x.name + '」？', '清單也會一起刪除，7 天內可以還原。', '刪除', true))) return;
        tripItems(id).forEach(i => Store.remove(i.id, { silent: true }));
        Store.remove(id); location.hash = '#/trips';
      };
    });
  }
  function pageTrip(id) {
    const tr = Store.get(id);
    if (!tr) return A.head('旅行', '', { back: true }) + A.emptyHTML('flag', '找不到這次旅行', '可能已經被刪除了。');
    const its = tripItems(id), n = its.filter(i => i.done).length;
    let h = A.head(esc(tr.name), dateRange(tr) + ' · ' + tripStatus(tr), { back: true, right: '<button class="round-btn" data-act="trip-edit" data-id="' + id + '" aria-label="修改">' + icon('pencil', 'sm') + '</button>' });
    h += '<div class="glass card"><div class="row between"><b>執好 ' + n + ' / ' + its.length + '</b>' + (n ? '<button class="link-btn small" data-act="trip-uncheck" data-id="' + id + '">全部取消勾選</button>' : '') + '</div><div class="progress"><i style="width:' + (its.length ? Math.round(n * 100 / its.length) : 0) + '%"></i></div><div class="small faint" style="margin-top:8px">不用全部勾選，用得着的剔就可以。按項目可以修改或刪除。</div></div>';
    h += '<div class="glass card tight list">' + (its.length ? its.map(i => '<div class="li">' + checkBtn(i.done, 'tci-toggle', i.id) + '<button class="grow" style="text-align:left" data-act="tci-edit" data-id="' + i.id + '"><span class="' + (i.done ? 'done-text' : '') + '">' + esc(i.t) + '</span></button></div>').join('') : '<div class="muted small" style="padding:14px 16px">清單是空的，在下面加。</div>') + '</div>';
    h += '<div class="glass card" style="padding:8px 8px 8px 16px"><form class="row" data-form="tci-add" data-id="' + id + '"><input class="field grow" data-live name="t" placeholder="加一項…" maxlength="120" style="background:transparent;border:0;box-shadow:none;padding:10px 0"><button class="btn sm" type="submit" style="padding:0 14px" aria-label="加">' + icon('plus', 'sm') + '</button></form></div>';
    return h;
  }
  function textSheet(title, value, onSave, onDelete) {
    openSheet('<h2>' + title + '</h2><input class="field" name="t" maxlength="120" value="' + esc(value) + '" autofocus>' +
      '<div class="actions">' + (onDelete ? delBtn : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      const go = () => { const v = api.$('[name=t]').value.trim(); if (!v) return; onSave(v); api.close(); };
      api.$('[data-save]').onclick = go;
      api.$('[name=t]').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      if (onDelete) api.$('[data-del]').onclick = () => { onDelete(); api.close(); };
    });
  }
  const DRAG_ICON = '<svg class="i" viewBox="0 0 24 24"><path d="M5 8h14M5 12h14M5 16h14"/></svg>';
  function pageTripTpl() {
    const items = tplItems();
    let h = A.head('清單範本', '新的旅行會用這張清單。改了不會影響已經建立的旅行。', { back: true });
    h += '<p class="small faint" style="margin:-6px 4px 12px">按住右邊的 ≡ 上下拖，就可以改次序；按項目可以修改。</p>';
    h += '<div class="glass card tight" data-sortable="tpl">' + items.map((it, i) =>
      '<div class="tpl-row" data-id="' + esc(it.id) + '">' +
      '<button class="faint" data-act="tpl-del" data-i="' + i + '" aria-label="刪除" style="padding:4px">' + icon('x', 'sm') + '</button>' +
      '<button class="t" data-act="tpl-edit" data-i="' + i + '">' + esc(it.t) + '</button>' +
      '<span class="drag-handle" aria-label="拖曳排序">' + DRAG_ICON + '</span></div>').join('') + '</div>';
    h += '<div class="glass card" style="padding:8px 8px 8px 16px"><form class="row" data-form="tpl-add"><input class="field grow" data-live name="t" placeholder="加一項到範本…" maxlength="120" style="background:transparent;border:0;box-shadow:none;padding:10px 0"><button class="btn sm" type="submit" style="padding:0 14px" aria-label="加">' + icon('plus', 'sm') + '</button></form></div>';
    h += '<button class="btn ghost block" data-act="tpl-reset">' + icon('undo', 'sm') + '還原預設清單</button>';
    return h;
  }

  /* ================= 時間囊 ================= */
  function pageCapsule() {
    const t = D.today();
    const all = Store.all('capsule').sort((a, b) => a.openOn < b.openOn ? -1 : 1);
    const sealed = all.filter(c => c.openOn > t), opened = all.filter(c => c.openOn <= t).reverse();
    let h = A.head('時間囊', '到你們選的那一天才打開的信。', { back: true });
    if (!all.length) h += A.emptyHTML('lock', '還沒有一封信。', '今天寫點甚麼，一年後再讀。');
    if (opened.length) h += '<div class="label">可以讀了</div>' + opened.map(c => '<button class="glass card" style="display:block;width:100%;text-align:left" data-act="cap-read" data-id="' + c.id + '"><div class="row between"><b style="font-size:17px">' + icon('hourglass', 'xs') + ' ' + esc(c.title) + '</b>' + A.avatar(c._by || A.ME(), 'xs') + '</div><div class="small muted" style="margin-top:4px">' + D.ymdText(c.created || t) + ' 寫 · ' + D.ymdText(c.openOn) + ' 打開</div><div class="small" style="margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(c.body) + '</div></button>').join('');
    if (sealed.length) h += '<div class="label">封存中</div>' + sealed.map(c => '<button class="glass card capsule locked" style="display:block;width:100%;text-align:left" data-act="cap-sealed" data-id="' + c.id + '"><div class="row between"><b style="font-size:17px">' + icon('lock', 'xs') + ' ' + esc(c.title) + '</b>' + A.avatar(c._by || A.ME(), 'xs') + '</div><div class="small muted" style="margin-top:6px">' + D.ymdText(c.openOn) + ' 才可以打開 · 還有 ' + D.diff(t, c.openOn) + ' 天</div></button>').join('');
    h += '<button class="btn fab" data-act="cap-new">' + icon('plus') + '寫一封</button>';
    return h;
  }
  function capSheet() {
    const def = D.add(D.today(), 365);
    openSheet('<h2>寫一封</h2><input class="field" name="title" maxlength="60" placeholder="叫甚麼名字？" autofocus>' +
      '<textarea class="field" name="body" maxlength="5000" placeholder="那天你們想讀到的話" style="min-height:30vh;margin-top:10px"></textarea>' +
      '<div class="label">打開的日子</div><input type="date" class="field" name="openOn" value="' + def + '" min="' + D.add(D.today(), 1) + '">' +
      '<div class="chips" data-quick style="margin-top:8px">' + [[30, '一個月後'], [182, '半年後'], [365, '一年後'], [1826, '五年後']].map(([n, l]) => '<button type="button" class="chip" data-n="' + n + '">' + l + '</button>').join('') +
      (D.valid(A.S().together) ? '<button type="button" class="chip" data-anni>下個週年</button>' : '') + '</div>' +
      '<p class="small muted" style="margin:12px 4px 0">' + icon('lock', 'xs') + ' 封存之後，連你自己都要等到那天才看到內容。</p>' +
      '<div class="actions"><button class="btn" data-save>封存</button></div>', api => {
      const f = n => api.$('[name=' + n + ']');
      api.$('[data-quick]').onclick = e => {
        const b = e.target.closest('.chip'); if (!b) return;
        if (b.hasAttribute('data-anni')) { const s = A.S().together, [ty] = D.ymd(D.today()), [, m, d] = D.ymd(s); let k = D.make(ty, m, d); if (k <= D.today()) k = D.make(ty + 1, m, d); f('openOn').value = k; }
        else f('openOn').value = D.add(D.today(), Number(b.dataset.n));
      };
      api.$('[data-save]').onclick = async () => {
        const title = f('title').value.trim(), body = f('body').value.trim(), openOn = f('openOn').value;
        if (!title) { f('title').focus(); return; }
        if (!body) { f('body').focus(); return; }
        if (!D.valid(openOn) || openOn <= D.today()) { toast('打開的日子要在明天之後'); return; }
        api.close();
        if (!(await confirmSheet('封存到 ' + D.ymdText(openOn) + '？', '之前不能再看或修改內容。', '封存'))) { return; }
        Store.put('capsule', { title, body, openOn, created: D.today() });
        toast('已封存，' + D.diff(D.today(), openOn) + ' 天後見', 'hourglass');
      };
    });
  }

  /* ================= 保險箱（用同步密碼加密） ================= */
  const te = new TextEncoder(), td = new TextDecoder();
  let vKey = null, vAt = 0;
  const vCache = {}; const vPending = new Set();
  function b64(buf) { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  async function deriveKey(pw) {
    const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: te.encode('us-vault-v1'), iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encObj(o) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vKey, te.encode(JSON.stringify(o))); return { iv: b64(iv), ct: b64(ct) }; }
  async function decObj(e) { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, vKey, unb64(e.ct)); return JSON.parse(td.decode(pt)); }
  function lockVault() { vKey = null; for (const k in vCache) delete vCache[k]; }
  window.addEventListener('hashchange', () => { if (!/^#\/vault/.test(location.hash)) lockVault(); });
  let hidAt = 0; // 離開 app 超過一分鐘就鎖上（揀相片時不會鎖）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hidAt = Date.now();
    else if (vKey && hidAt && Date.now() - hidAt > 60000) { lockVault(); A.render(); }
  });
  function decryptLater(rec) {
    const sig = rec.id + ':' + rec._at;
    if (vCache[rec.id] && vCache[rec.id].sig === sig) return vCache[rec.id].v;
    if (!vPending.has(sig) && vKey) {
      vPending.add(sig);
      decObj(rec.enc).then(v => { vCache[rec.id] = { sig, v }; }).catch(() => { vCache[rec.id] = { sig, v: { _err: 1 } }; }).finally(() => { vPending.delete(sig); A.render(); });
    }
    return null;
  }
  function pageVault() {
    let h = A.head('保險箱', '只有你們兩個看到的文件', { back: true, right: vKey ? '<button class="round-btn" data-act="vault-lock" aria-label="鎖上">' + icon('lock', 'sm') + '</button>' : '' });
    h += '<div class="hint-bar">' + icon('shield', 'xs') + ' 請不要把信用卡號碼、網上銀行密碼這類重要資料放在這裏。</div>';
    if (vKey && Date.now() - vAt > 5 * 60000) lockVault();
    if (!vKey) {
      return h + '<div class="glass card lock-card"><div class="bubble" style="width:70px;height:70px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:rgba(var(--accent-rgb),.09);color:var(--accent-deep)">' + icon('lock', 'lg') + '</div>' +
        '<div style="font-size:17px">不能遺失的東西，放在這裏</div><div class="small muted" style="margin:6px 0 16px">用同步的密碼打開。內容會加密後才儲存。</div>' +
        '<button class="btn block" data-act="vault-open">開啟</button></div>';
    }
    vAt = Date.now();
    const items = Store.all('vault').sort((a, b) => (b._at || 0) - (a._at || 0));
    if (!items.length) h += A.emptyHTML('shield', '保險箱是空的', '證件影印本、保養單、Wi-Fi 密碼…');
    else h += '<div class="glass card tight list">' + items.map(r => {
      const v = decryptLater(r);
      const nph = Store.all('vfile').filter(f => f.itemId === r.id).length;
      return '<button class="li" data-act="vault-view" data-id="' + r.id + '"><span class="ic">' + icon(nph ? 'image' : 'note', 'sm') + '</span><span class="grow"><div class="tt">' + (v ? (v._err ? '<span class="faint">打不開（可能用了舊密碼加密）</span>' : esc(v.title)) : '<span class="faint">解密中…</span>') + '</div><div class="ts">' + D.smart(D.key(new Date(r._at))) + (nph ? ' · ' + nph + ' 張相片' : '') + '</div></span><span class="chev">' + icon('chevR', 'sm') + '</span></button>';
    }).join('') + '</div>';
    h += '<button class="btn fab" data-act="vault-new">' + icon('plus') + '放一樣</button>';
    return h;
  }
  function vaultOpen() {
    if (!Store.device.key) {
      openSheet('<h2>保險箱</h2><p class="muted">保險箱用雲端同步的密碼打開，請先設定雲端同步。</p><div class="actions"><a href="#/sync" class="btn" data-x>去設定</a></div>', api => { api.$('[data-x]').onclick = () => api.close(); });
      return;
    }
    openSheet('<h2>' + icon('lock', 'sm') + ' 輸入密碼</h2><p class="small muted" style="margin-top:-8px">和雲端同步用的密碼一樣。</p><form data-f><input class="field" type="password" name="pw" autocomplete="current-password" placeholder="密碼" autofocus><div class="actions"><button class="btn" type="submit">開啟</button></div></form>', api => {
      api.$('[data-f]').onsubmit = async e => {
        e.preventDefault();
        const pw = api.$('[name=pw]').value;
        if (pw !== Store.device.key) { toast('密碼不對'); api.$('[name=pw]').value = ''; return; }
        try { vKey = await deriveKey(pw); vAt = Date.now(); api.close(); A.render(); }
        catch (err) { toast('這個瀏覽器不支援加密，請用 Safari 或 Chrome 最新版本'); }
      };
    });
  }
  async function vaultView(id) {
    const r = Store.rec(id); if (!r || !vKey) return;
    let v;
    try { v = await decObj(r.data.enc); } catch (e) { toast('打不開這一項'); return; }
    const files = Store.all('vfile').filter(f => f.itemId === id);
    const photos = [];
    for (const f of files) { try { photos.push({ id: f.id, src: (await decObj(f.enc)).photo }); } catch (e) {} }
    openSheet('<h2>' + esc(v.title) + '</h2>' + (v.body ? '<div class="answer-box">' + esc(v.body) + '</div>' : '') +
      (photos.length ? '<div class="vault-photos">' + photos.map(p => '<a href="' + p.src + '" target="_blank" rel="noopener"><img src="' + p.src + '" alt=""></a>').join('') + '</div>' : '') +
      '<div class="actions">' + delBtn + '<button class="btn ghost" data-copy>' + icon('copy', 'sm') + '複製文字</button><button class="btn" data-edit>' + icon('pencil', 'sm') + '修改</button></div>', api => {
      api.$('[data-copy]').onclick = async () => toast((await copyText(v.body || v.title)) ? '已複製' : '複製不到', 'copy');
      api.$('[data-edit]').onclick = () => { api.close(); vaultEdit(id, v, photos); };
      api.$('[data-del]').onclick = async () => {
        api.close();
        if (!(await confirmSheet('刪除「' + v.title + '」？', '7 天內可以在「最近刪除」還原。', '刪除', true))) return;
        files.forEach(f => Store.remove(f.id, { silent: true })); Store.remove(id);
      };
    });
  }
  function vaultEdit(id, v, photos) {
    v = v || { title: '', body: '' };
    let keep = (photos || []).slice(), added = [];
    const draw = api => {
      api.$('[data-ph]').innerHTML = keep.map(p => '<div class="photo-prev" style="margin:0"><img src="' + p.src + '" alt="" style="aspect-ratio:1;max-height:none"><button type="button" data-rmk="' + p.id + '">' + icon('x', 'sm') + '</button></div>').join('') +
        added.map((src, i) => '<div class="photo-prev" style="margin:0"><img src="' + src + '" alt="" style="aspect-ratio:1;max-height:none"><button type="button" data-rma="' + i + '">' + icon('x', 'sm') + '</button></div>').join('');
    };
    openSheet('<h2>' + (id ? '修改' : '放一樣') + '</h2><input class="field" name="title" maxlength="80" placeholder="叫甚麼？例如：屋企 Wi-Fi" value="' + esc(v.title) + '"' + (id ? '' : ' autofocus') + '>' +
      '<textarea class="field" name="body" maxlength="5000" placeholder="內容" style="min-height:120px;margin-top:10px">' + esc(v.body || '') + '</textarea>' +
      '<div class="vault-photos" data-ph></div><input type="file" accept="image/*" multiple class="hidden" data-file>' +
      '<button type="button" class="btn ghost block" data-addph style="margin-top:10px">' + icon('image', 'sm') + '加相片</button>' +
      '<p class="small faint" style="margin:10px 4px 0">' + icon('shield', 'xs') + ' 請不要放信用卡號碼、網上銀行密碼等重要資料。</p>' +
      '<div class="actions"><button class="btn" data-save>加密儲存</button></div>', api => {
      draw(api);
      const inp = api.$('[data-file]');
      api.$('[data-addph]').onclick = () => inp.click();
      inp.onchange = async () => { for (const f of Array.from(inp.files).slice(0, 6)) { try { added.push(await compressImage(f, 1400, 0.75)); } catch (e) {} } inp.value = ''; draw(api); };
      api.$('[data-ph]').onclick = e => {
        const k = e.target.closest('[data-rmk]'), a = e.target.closest('[data-rma]');
        if (k) keep = keep.filter(p => p.id !== k.dataset.rmk);
        if (a) added.splice(Number(a.dataset.rma), 1);
        draw(api);
      };
      api.$('[data-save]').onclick = async () => {
        const title = api.$('[name=title]').value.trim(); if (!title) { api.$('[name=title]').focus(); return; }
        if (!vKey) { toast('保險箱鎖上了，請再開一次'); api.close(); return; }
        const btn = api.$('[data-save]'); btn.disabled = true; btn.textContent = '加密中…';
        const enc = await encObj({ title, body: api.$('[name=body]').value });
        const vid = Store.put('vault', { enc }, id);
        if (id) Store.all('vfile').filter(f => f.itemId === id && !keep.some(p => p.id === f.id)).forEach(f => Store.remove(f.id, { silent: true }));
        for (const src of added) Store.put('vfile', { itemId: vid, enc: await encObj({ photo: src }) });
        api.close(); toast('已加密儲存', 'lock');
      };
    });
  }

  /* ================= 登記 ================= */
  Object.assign(A.pages, { dolist: pageDo, trips: pageTrips, trip: pageTrip, triptpl: pageTripTpl, capsule: pageCapsule, vault: pageVault });
  Object.assign(A.acts, {
    'do-cat'(el) { ui.doCat = el.dataset.k; A.render(); },
    'do-newcat'() { const c = newCat(); if (c) { ui.doCat = c.k; A.render(); } },
    'do-new'() { doSheet(); },
    'do-edit'(el) { doSheet(el.dataset.id); },
    'do-toggle'(el) { const x = Store.get(el.dataset.id); if (!x) return; el.classList.toggle('on', !x.done); setTimeout(() => Store.patch(x.id, { done: !x.done, doneAt: !x.done ? D.today() : '' }), 180); },
    'do-showdone'() { ui.showDoneDo = !ui.showDoneDo; A.render(); },
    'trip-new'() { tripSheet(); },
    'trip-edit'(el) { tripSheet(el.dataset.id); },
    'trip-showpast'() { ui.showPastTrips = !ui.showPastTrips; A.render(); },
    'tci-toggle'(el) { const x = Store.get(el.dataset.id); if (x) Store.patch(x.id, { done: !x.done }); },
    'tci-edit'(el) { const x = Store.get(el.dataset.id); if (x) textSheet('修改項目', x.t, v => Store.patch(x.id, { t: v }), () => Store.remove(x.id)); },
    async 'trip-uncheck'(el) { if (await confirmSheet('全部取消勾選？', '', '取消勾選')) tripItems(el.dataset.id).filter(i => i.done).forEach(i => Store.patch(i.id, { done: false })); },
    'tpl-move'(el) { const items = tplItems().slice(), i = Number(el.dataset.i), j = i + Number(el.dataset.d); if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; saveTpl(items); },
    'tpl-edit'(el) { const items = tplItems().slice(), i = Number(el.dataset.i); textSheet('修改範本項目', items[i].t, v => { items[i] = Object.assign({}, items[i], { t: v }); saveTpl(items); }, () => { items.splice(i, 1); saveTpl(items); }); },
    'tpl-del'(el) { const items = tplItems().slice(); items.splice(Number(el.dataset.i), 1); saveTpl(items); },
    async 'tpl-reset'() { if (await confirmSheet('還原預設清單？', '你們改過的範本會被取代，已經建立的旅行不受影響。', '還原')) saveTpl(TRIP_DEFAULT.map((t, i) => ({ id: 'd' + i, t }))); },
    'cap-new'() { capSheet(); },
    'cap-read'(el) { const c = Store.get(el.dataset.id); if (!c) return; openSheet('<div class="eyebrow">' + icon('hourglass', 'xs') + D.ymdText(c.created || '') + ' · ' + esc(A.nm(c._by || A.ME())) + ' 寫</div><h2 style="margin-top:6px">' + esc(c.title) + '</h2><div class="answer-box" style="line-height:1.7">' + esc(c.body) + '</div><div class="actions"><button class="btn" data-x>收好</button></div>', api => { api.$('[data-x]').onclick = () => api.close(); }); },
    'cap-sealed'(el) {
      const c = Store.get(el.dataset.id); if (!c) return;
      const mine = (c._by || A.ME()) === A.ME();
      openSheet('<h2>' + icon('lock', 'sm') + ' ' + esc(c.title) + '</h2><p class="muted">' + D.ymdText(c.openOn) + ' 才可以打開，還有 ' + D.diff(D.today(), c.openOn) + ' 天。</p>' +
        '<div class="actions">' + (mine ? delBtn : '') + '<button class="btn" data-x>好</button></div>', api => {
        api.$('[data-x]').onclick = () => api.close();
        if (mine) api.$('[data-del]').onclick = async () => { api.close(); if (await confirmSheet('刪除這封信？', '還沒打開就刪除，內容不會被看到。', '刪除', true)) Store.remove(c.id); };
      });
    },
    'vault-open': vaultOpen,
    'vault-lock'() { lockVault(); A.render(); },
    'vault-new'() { vaultEdit(null); },
    'vault-view'(el) { vaultView(el.dataset.id); }
  });
  // 新加的項目放在「如適用」之前，如適用的永遠排最後
  const optional = t => /如適用/.test(t);
  /* ---------- 拖曳排序（按住 ≡ 上下拖） ---------- */
  const SORTERS = {
    tpl(ids) { const map = {}; tplItems().forEach(i => map[i.id] = i); saveTpl(ids.map(id => map[id]).filter(Boolean)); }
  };
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const hd = e.target.closest('.drag-handle'); if (!hd) return;
    const row = hd.closest('[data-id]'), list = row && row.parentNode;
    if (!list || !list.dataset.sortable) return;
    e.preventDefault();
    const r = row.getBoundingClientRect();
    drag = { row, list, off: e.clientY - r.top, y: e.clientY, before: Array.from(list.children).map(x => x.dataset.id).join('|'), id: e.pointerId };
    A.dragging = true;
    row.classList.add('dragging');
    try { hd.setPointerCapture(e.pointerId); } catch (err) {}
    drag.timer = setInterval(() => { // 拖到畫面邊緣自動捲動
      if (!drag) return;
      const edge = 90;
      if (drag.y < edge) window.scrollBy(0, -10); else if (drag.y > innerHeight - edge - 70) window.scrollBy(0, 10);
      place();
    }, 16);
  });
  function place() {
    const { row, list, y, off } = drag;
    let moved = true;
    while (moved) {
      moved = false;
      const prev = row.previousElementSibling, next = row.nextElementSibling;
      if (prev && y < prev.getBoundingClientRect().top + prev.offsetHeight / 2) { list.insertBefore(row, prev); moved = true; }
      else if (next && y > next.getBoundingClientRect().top + next.offsetHeight / 2) { list.insertBefore(next, row); moved = true; }
    }
    row.style.transform = '';
    const natural = row.getBoundingClientRect().top;
    row.style.transform = 'translateY(' + (y - off - natural) + 'px)';
  }
  document.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; e.preventDefault(); drag.y = e.clientY; place(); }, { passive: false });
  function endDrag() {
    if (!drag) return;
    const { row, list, before, timer } = drag;
    clearInterval(timer);
    row.style.transform = ''; row.classList.remove('dragging');
    const ids = Array.from(list.children).map(x => x.dataset.id);
    drag = null; A.dragging = false;
    if (ids.join('|') !== before && SORTERS[list.dataset.sortable]) SORTERS[list.dataset.sortable](ids);
    else A.render();
  }
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  A.forms['tci-add'] = f => {
    const inp = f.querySelector('input'), t = inp.value.trim(); if (!t) return;
    const its = tripItems(f.dataset.id);
    let order;
    const k = optional(t) ? -1 : its.findIndex(i => optional(i.t));
    if (k < 0) order = (its.length ? its[its.length - 1].order || 0 : 0) + 10;
    else { const prev = k > 0 ? its[k - 1].order || 0 : 0; order = (prev + (its[k].order || 0)) / 2; }
    Store.put('tci', { tripId: f.dataset.id, t, done: false, order });
    inp.value = '';
  };
  A.forms['tpl-add'] = f => {
    const inp = f.querySelector('input'), t = inp.value.trim(); if (!t) return;
    const items = tplItems().slice(), it = { id: 'u' + Date.now().toString(36), t };
    const k = optional(t) ? -1 : items.findIndex(i => optional(i.t));
    if (k < 0) items.push(it); else items.splice(k, 0, it);
    saveTpl(items); inp.value = '';
  };
})();
