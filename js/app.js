/* 我們 · 主程式 */
(function () {
  Store.load();
  const view = document.getElementById('view');
  const tabbar = document.getElementById('tabbar');

  /* ================= 設定與身分 ================= */
  const SECTION_DEF = { question: false, dolist: true, trips: true, capsule: true, vault: true, note: true, todo: true, lists: true, wishes: true, calendar: true, period: true, know: true, plans: true, jots: true, year: true };
  function S() {
    const r = Store.get('settings') || {};
    const extra = Object.assign({}, r); delete extra.id; delete extra._by; delete extra._at;
    return Object.assign(extra, {
      names: Object.assign({ a: '', b: '' }, r.names),
      together: r.together || '',
      birthday: Object.assign({ a: '', b: '' }, r.birthday),
      sections: Object.assign({}, SECTION_DEF, r.sections),
      periodLen: r.periodLen || 5,
      listCats: r.listCats || [],
      wishCats: r.wishCats || [],
      periodShare: r.periodShare || 'all',
      periodOwner: r.periodOwner || ''
    });
  }
  function setS(patch) {
    const cur = Store.get('settings') || {};
    delete cur.id; delete cur._by; delete cur._at;
    Store.put('settings', Object.assign(S(), cur, patch), 'settings');
  }
  const ME = () => Store.device.me || 'a';
  const OT = () => (ME() === 'a' ? 'b' : 'a');
  function nm(w) { const n = (S().names[w] || '').trim(); return n || (w === ME() ? '我' : '另一半'); }
  function hasName(w) { return !!(S().names[w] || '').trim(); }
  function initial(w) { return hasName(w) ? Array.from(nm(w).trim())[0].toUpperCase() : (w === ME() ? '我' : '+'); }
  // 男方藍、女方綠（在個人檔案可以改誰是男方）
  const sex = w => ((S().male || 'a') === w ? 'm' : 'f');
  const WHO_COLOR = { m: '#3d7bff', f: '#22c99a', both: '#ff5d8f' };
  const colorOf = w => w === 'both' || !w ? WHO_COLOR.both : WHO_COLOR[sex(w)];
  const HEART = '<svg class="hrt" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.3-9.2C1.5 8.6 3.6 5.5 7 5.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.4 0 5.5 3.1 4.3 6.3C19.5 16.4 12 21 12 21z" fill="#ff5d8f"/></svg>';
  function avatarPhoto(w) { const r = Store.get('avatar_' + w); return r && r.photo ? r.photo : ''; }
  function avatar(w, cls) {
    const ph = avatarPhoto(w);
    if (ph) return '<div class="avatar photo ' + (cls || '') + '"><img src="' + ph + '" alt=""></div>';
    const ghost = !hasName(w) && w !== ME();
    return '<div class="avatar ' + sex(w) + ' ' + (ghost ? 'ghost ' : '') + (cls || '') + '">' + esc(initial(w)) + '</div>';
  }
  function paired() {
    const o = OT();
    return Object.values(Store.s.records).some(r => r.by === o);
  }
  const on = k => S().sections[k] !== false;
  Object.assign(App, { S, setS, ME, OT, nm, avatar, on, paired, sex, colorOf, HEART });

  /* ================= 今日問題 ================= */
  const Q_EPOCH = '2024-01-01';
  function questionFor(day) {
    const n = QUESTIONS.length;
    return QUESTIONS[((D.diff(Q_EPOCH, day) % n) + n) % n];
  }
  function answer(w, day) { const r = Store.get('ans_' + day + '_' + w); return r && r.text ? r : null; }
  function streak(w) {
    let d = D.today();
    if (!answer(w, d)) d = D.add(d, -1);
    let n = 0;
    while (answer(w, d) && n < 5000) { n++; d = D.add(d, -1); }
    return n;
  }

  /* ================= 待辦 ================= */
  function todoBucket(t, today, weekEnd) {
    if (!t.due) return 'later';
    if (t.due <= today) return 'today';
    if (t.due <= weekEnd) return 'week';
    return 'later';
  }
  function openTodos() { return Store.all('todo').filter(t => !t.done); }

  /* ================= 日曆標記（無上限，按需要計算） ================= */
  function catColor(cats, k) { const c = cats.find(x => x.k === k); return c ? c.c : '#2f6bff'; }
  App.markers = (f, t) => markers(f, t);
  function yearlyBetween(dateKey, from, to) {
    if (!D.valid(dateKey)) return [];
    const [y0, m, d] = D.ymd(dateKey);
    const [yf] = D.ymd(from), [yt] = D.ymd(to);
    const out = [];
    for (let y = Math.max(yf, y0); y <= yt; y++) {
      const k = D.make(y, m, Math.min(d, D.daysInMonth(y, m)));
      if (k >= from && k <= to) out.push({ date: k, n: y - y0 });
    }
    return out;
  }
  function eventStarts(ev, from, to) {
    const start = ev.date;
    if (!D.valid(start)) return [];
    const rep = ev.repeat || 'none';
    const out = [];
    if (rep === 'none') { if (start <= to) out.push(start); return out; }
    if (rep === 'weekly') {
      let k = start;
      const gap = D.diff(start, from);
      if (gap > 0) k = D.add(start, Math.floor(gap / 7) * 7);
      for (; k <= to; k = D.add(k, 7)) out.push(k);
      return out;
    }
    if (rep === 'monthly') {
      const [y0, m0, d0] = D.ymd(start), [yf, mf] = D.ymd(from);
      let i = Math.max(0, (yf - y0) * 12 + (mf - m0) - 1);
      for (; ; i++) {
        const y = y0 + Math.floor((m0 - 1 + i) / 12), m = ((m0 - 1 + i) % 12) + 1;
        const k = D.make(y, m, Math.min(d0, D.daysInMonth(y, m)));
        if (k > to) break;
        out.push(k);
      }
      return out;
    }
    if (rep === 'yearly') return yearlyBetween(start, D.add(from, -400), to).map(x => x.date);
    return out;
  }
  function markers(from, to) {
    const out = [];
    const s = S();
    if (on('calendar')) {
      Store.all('event').forEach(ev => {
        const L = ev.end && D.valid(ev.end) && ev.end > ev.date ? D.diff(ev.date, ev.end) : 0;
        eventStarts(ev, D.add(from, -L), to).forEach(st => {
          for (let j = 0; j <= L; j++) {
            const d = D.add(st, j);
            if (d < from || d > to) continue;
            let sub;
            if (!L) sub = ev.allDay ? '全日' : (ev.time || '') + (ev.endTime ? '–' + ev.endTime : '');
            else if (ev.allDay) sub = '全日';
            else if (j === 0) sub = (ev.time || '') + ' 開始';
            else if (j === L) sub = ev.endTime ? '至 ' + ev.endTime : '最後一天';
            else sub = '全日';
            const who = ev.who || 'both';
            out.push({ date: d, title: ev.title, kind: 'event', id: ev.id, who, color: colorOf(who), sub: (who === 'both' ? '一起' : nm(who)) + (sub ? ' · ' + sub : ''), place: ev.place || '', multi: L > 0 ? (j + 1) + '/' + (L + 1) : '' });
          }
        });
      });
      Store.all('day').forEach(dy => {
        if (dy.yearly !== false) {
          yearlyBetween(dy.date, from, to).forEach(x => out.push({ date: x.date, title: dy.title, kind: 'day', id: dy.id, color: '#f472b6', sub: x.n > 0 ? '第 ' + x.n + ' 年' : '就是這天' }));
        } else if (dy.date >= from && dy.date <= to) {
          out.push({ date: dy.date, title: dy.title, kind: 'day', id: dy.id, color: '#f472b6', sub: '' });
        }
      });
      if (D.valid(s.together)) {
        yearlyBetween(s.together, from, to).forEach(x => out.push({ date: x.date, title: x.n === 0 ? '在一起的那天' : '在一起 ' + x.n + ' 週年', kind: 'together', color: '#f472b6', sub: '' }));
        const a = D.diff(s.together, from) + 1, b = D.diff(s.together, to) + 1;
        for (let k = Math.max(1, Math.ceil(a / 100)); k * 100 <= b; k++) {
          const N = k * 100;
          out.push({ date: D.add(s.together, N - 1), title: '在一起第 ' + N + ' 天', kind: 'together', color: '#5b8cff', sub: '' });
        }
      }
      ['a', 'b'].forEach(w => {
        if (D.valid(s.birthday[w])) yearlyBetween(s.birthday[w], from, to).forEach(x => { if (x.n > 0) out.push({ date: x.date, title: nm(w) + ' 生日', kind: 'birthday', who: w, color: colorOf(w), sub: x.n + ' 歲' }); });
      });
    }
    if (on('trips')) {
      Store.all('trip').forEach(tr => {
        if (!D.valid(tr.start)) return;
        const end = D.valid(tr.end) && tr.end >= tr.start ? tr.end : tr.start;
        if (end < from || tr.start > to) return;
        const L = D.diff(tr.start, end);
        for (let d = tr.start > from ? tr.start : from; d <= end && d <= to; d = D.add(d, 1))
          out.push({ date: d, title: '旅行：' + tr.name, kind: 'trip', id: tr.id, who: 'both', color: colorOf('both'), sub: L ? '第 ' + (D.diff(tr.start, d) + 1) + '/' + (L + 1) + ' 天' : '' });
      });
    }
    if (on('period') && App.period) {
      const nx = App.period.nextMarker();
      if (nx && nx >= from && nx <= to) out.push({ date: nx, title: '經期大約開始', kind: 'period', color: '#f472b6', sub: '預計' });
    }
    out.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : (x.sub || '').localeCompare(y.sub || ''));
    return out;
  }
  function periodDays(from, to) {
    const res = {};
    if (!on('period') || !App.period) return res;
    const m = App.period.dayMap(from, to);
    for (const d in m) if (m[d].type === 'period' || m[d].type === 'pred') res[d] = m[d].type;
    return res;
  }

  /* ================= 頁面通用 ================= */
  function head(title, sub, opts) {
    opts = opts || {};
    return (opts.back ? '<div class="topbar"><button class="round-btn" data-act="back" aria-label="返回">' + icon('chevL') + '</button>' + (opts.right || '') + '</div>' : '') +
      '<h1 class="page-title">' + title + '</h1>' + (sub ? '<p class="page-sub">' + sub + '</p>' : '');
  }
  function emptyHTML(ic, h, p) {
    return '<div class="empty"><div class="bubble glass">' + icon(ic, 'lg') + '</div><h3>' + h + '</h3><p>' + p + '</p></div>';
  }
  function row(o) {
    const tag = o.href ? 'a href="' + o.href + '"' : 'button type="button"' + (o.act ? ' data-act="' + o.act + '"' : '') + (o.id ? ' data-id="' + esc(o.id) + '"' : '');
    const close = o.href ? 'a' : 'button';
    return '<' + tag + ' class="li' + (o.cls ? ' ' + o.cls : '') + '">' +
      (o.ic ? '<span class="ic' + (o.icCls ? ' ' + o.icCls : '') + '">' + icon(o.ic, 'sm') + '</span>' : '') +
      '<span class="grow"><div class="tt">' + o.t + '</div>' + (o.s ? '<div class="ts">' + o.s + '</div>' : '') + '</span>' +
      (o.val ? '<span class="val">' + o.val + '</span>' : '') +
      (o.noChev ? '' : '<span class="chev">' + icon('chevR', 'sm') + '</span>') +
      '</' + close + '>';
  }
  window.renderSyncPill = function (el) {
    const st = Sync.configured() ? Sync.state : 'off';
    const d = Store.device;
    let txt = '只存在這部手機';
    let cls = '';
    if (st === 'busy') { txt = '同步中…'; cls = 'busy'; }
    else if (st === 'err') { txt = '同步失敗：' + (Sync.msg || d.lastError); cls = 'err'; }
    else if (Sync.configured()) {
      cls = 'ok';
      txt = d.lastSync ? '已同步 · ' + new Date(d.lastSync).toTimeString().slice(0, 5) : '已連接';
    }
    el.className = 'sync-pill ' + cls;
    el.innerHTML = '<span class="led"></span>' + esc(txt);
  };
  const syncPill = () => '<span class="sync-pill" data-sync-pill></span>';

  /* ================= UI 狀態（只在這部手機） ================= */
  const ui = {
    calY: null, calM: null, calSel: D.today(),
    todoWhen: 'all', todoWho: 'all', showDone: false,
    wishCat: 'all'
  };

  /* ================= 主頁 ================= */
  function pageHome() {
    const s = S(), t = D.today(), me = ME(), ot = OT();
    let h = '<div class="topbar"><span class="home-date">' + D.full(t) + '</span><a href="#/profile" class="round-btn" aria-label="個人檔案">' + icon('more') + '</a></div>';
    if (App.update && App.update.available) h += '<button class="glass card row update-bar" data-act="do-update" style="width:100%;text-align:left;gap:12px">' + icon('download', 'sm') + '<span class="grow"><b>有新版本 ' + esc(App.update.available) + '</b><div class="small muted">按一下更新</div></span>' + icon('chevR', 'sm') + '</button>';

    h += '<div class="couple"><div class="avatars">' + avatar('a') + avatar('b') + '</div>' +
      '<div class="couple-names">' + esc(nm('a')) + '<span class="amp">&amp;</span>' + esc(nm('b')) + '</div>';
    if (D.valid(s.together)) {
      const n = D.diff(s.together, t) + 1;
      h += '<button class="together-link" data-act="together-info">' + (n > 0 ? '在一起 ' + ymdHTML(s.together, t) : '還有 <b>' + (1 - n) + '</b> 天就在一起了') + icon('chevR', 'xs') + '</button>';
    } else {
      h += '<button class="together-link" data-act="together">你們從甚麼時候在一起？' + icon('chevR', 'xs') + '</button>';
    }
    h += '</div>';

    // 1) 螢幕便條（置頂）
    if (on('note')) {
      const pn = Store.get('note_' + ot), mn = Store.get('note_' + me);
      if (pn && (pn.text || pn.photo)) {
        h += '<a href="#/note" class="glass card hero sky note-bubble" style="display:block;margin-top:14px"><div class="eyebrow">' + icon('phone', 'xs') + esc(nm(ot)) + ' 留給你</div>' +
          (pn.text ? '<div class="text">' + esc(pn.text) + '</div>' : '') + (pn.photo ? '<img src="' + pn.photo + '" alt="">' : '') + '</a>';
      }
      h += '<a href="#/note" class="glass card row" style="gap:12px;' + (pn && (pn.text || pn.photo) ? '' : 'margin-top:14px') + '"><span class="ic" style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(var(--accent-rgb),.09);color:var(--accent-deep)">' + icon('phone', 'sm') + '</span>' +
        '<span class="grow"><b>螢幕便條</b><div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (mn && (mn.text || mn.photo) ? '在 ' + esc(nm(ot)) + ' 螢幕上：' + esc(mn.text || '一張相片') : '寫一句，放到 ' + esc(nm(ot)) + ' 的主頁') + '</div></span><span class="faint">' + icon('chevR', 'sm') + '</span></a>';
    } else h += '<div style="height:14px"></div>';

    // 2) 未完成的待辦
    if (on('todo')) {
      const open = openTodos().sort(todoSort).slice(0, 3);
      h += '<div class="glass card" style="padding-bottom:10px"><a href="#/todo" class="row between"><div class="row" style="gap:8px">' + icon('todo', 'sm') + '<b>未完成的待辦</b><span class="faint small">' + (open.length ? '' : '沒有未完成的事') + '</span></div><span class="faint">' + icon('chevR', 'sm') + '</span></a>';
      if (!open.length) h += '<div class="muted small" style="margin:8px 0 6px">加第一件：你們想一起做的小事。</div>';
      else h += open.map(x => '<div class="row" style="margin-top:12px"><button class="check" data-act="todo-toggle" data-id="' + x.id + '">' + icon('check', 'xs') + '</button><button class="grow" data-act="todo-edit" data-id="' + x.id + '" style="text-align:left">' + esc(x.title) + (x.due ? ' <span class="faint small">' + D.smart(x.due) + '</span>' : '') + '</button></div>').join('');
      h += '</div>';
    }


    h += '<div class="section-h">一起的時刻</div>';

    if (on('calendar')) {
      const up = markers(t, D.add(t, 60)).slice(0, 3);
      h += '<a href="#/calendar" class="glass card" style="display:block"><div class="row between"><div class="row" style="gap:8px">' + icon('cal', 'sm') + '<b>接下來</b></div><span class="faint">' + icon('chevR', 'sm') + '</span></div>';
      if (!up.length) h += '<div class="muted small" style="margin-top:8px">暫時沒有計劃</div>';
      else h += up.map(m => '<div class="row" style="margin-top:10px;gap:10px"><span class="tag" style="background:color-mix(in srgb,' + m.color + ' 13%,transparent);color:' + m.color + '">' + D.smart(m.date) + '</span><span class="grow" style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.title) + '</span></div>').join('');
      h += '</a>';
    }

    // 這星期的一張
    const idea = currentIdea();
    h += '<div class="glass card"><div class="eyebrow" style="color:#c0367f">' + icon('spark', 'xs') + '這星期的一張</div>' +
      '<button data-act="idea-open" style="text-align:left;display:block;width:100%"><div style="font-size:19px;font-weight:700;margin:8px 0 4px">' + esc(idea.t) + '</div><div class="muted small">' + esc(idea.d) + '</div></button>' +
      '<div class="row" style="gap:18px;margin-top:14px"><button class="link-btn" data-act="idea-plan">' + icon('cal', 'xs') + '計劃</button><button class="link-btn" data-act="idea-next">' + icon('refresh', 'xs') + '換一張</button></div></div>';

    const tiles = [];
    if (on('lists')) {
      const lists = Store.all('list');
      const items = Store.all('item');
      const left = items.filter(i => !i.done && lists.some(l => l.id === i.listId)).length;
      tiles.push('<a href="#/lists" class="glass card tile"><span class="chev">' + icon('chevR', 'sm') + '</span><span class="ic">' + icon('list', 'sm') + '</span><div class="tt">清單</div><div class="ts">' + (!lists.length ? '還沒有清單' : left ? left + ' 項未做' : '全部做完') + '</div></a>');
    }
    if (on('wishes')) {
      const w = Store.all('wish').filter(x => !x.done).length;
      tiles.push('<a href="#/wishes" class="glass card tile"><span class="chev">' + icon('chevR', 'sm') + '</span><span class="ic">' + icon('heart', 'sm') + '</span><div class="tt">願望清單</div><div class="ts">' + (w ? w + ' 個願望' : '沒有願望') + '</div></a>');
    }
    const ptxt = on('period') && App.period ? App.period.homeText() : null;
    if (ptxt != null) {
      const txt = ptxt;
      tiles.push('<a href="#/period" class="glass card tile"><span class="chev">' + icon('chevR', 'sm') + '</span><span class="ic" style="color:#db2777">' + icon('drop', 'sm') + '</span><div class="tt">經期</div><div class="ts">' + txt + '</div></a>');
    }
    tiles.push('<a href="#/sections" class="glass card tile"><span class="chev">' + icon('chevR', 'sm') + '</span><span class="ic">' + icon('grid', 'sm') + '</span><div class="tt">所有部分</div><div class="ts">待辦、清單、日曆…</div></a>');
    h += '<div class="tile-grid">' + tiles.join('') + '</div>';
    const ex = App.extraTiles ? App.extraTiles() : [];
    if (ex.length) {
      h += '<div class="section-h">我們的東西</div><div class="tile-grid">' + ex.map(([href, ic, tt, ts]) =>
        '<a href="' + href + '" class="glass card tile"><span class="chev">' + icon('chevR', 'sm') + '</span><span class="ic">' + icon(ic, 'sm') + '</span><div class="tt">' + tt + '</div><div class="ts">' + esc(ts) + '</div></a>').join('') + '</div>';
    }

    // 先做這幾件事
    const todo = [
      { done: paired(), t: '邀請你的另一半', s: Sync.configured() ? '傳一條連結給對方，兩部手機就會同步。' : '先設定雲端同步，再傳連結給對方。', ic: 'userPlus', act: 'invite' },
      { done: D.valid(s.together), t: '你們從甚麼時候在一起？', s: '讓主頁可以數日子。', ic: 'heart', act: 'together' },
      { done: D.valid(s.birthday[me]), t: '你的生日', s: '會在日曆上提醒對方，讓對方有時間想禮物。', ic: 'cake', act: 'birthday' }
    ];
    const left = todo.filter(x => !x.done);
    if (left.length) {
      h += '<div class="section-h">先做這幾件事<span class="small faint">3 項中 ' + (3 - left.length) + ' 項</span></div><div class="glass card tight list">' +
        left.map(x => row({ t: x.t, s: x.s, ic: x.ic, act: x.act })).join('') + '</div>';
    }
    h += '<div class="center" style="margin-top:20px">' + syncPill() + '</div>';
    return h;
  }

  // 兩個日子之間：X 年 X 個月 X 天
  function ymdDiff(a, b) {
    const [y1, m1, d1] = D.ymd(a), [y2, m2, d2] = D.ymd(b);
    let y = y2 - y1, m = m2 - m1, d = d2 - d1;
    if (d < 0) { m--; const pm = m2 - 1 < 1 ? 12 : m2 - 1, py = m2 - 1 < 1 ? y2 - 1 : y2; d += D.daysInMonth(py, pm); }
    if (m < 0) { y--; m += 12; }
    return { y, m, d };
  }
  function ymdHTML(a, b) {
    const r = ymdDiff(a, b);
    return (r.y ? '<b>' + r.y + '</b> 年 ' : '') + (r.y || r.m ? '<b>' + r.m + '</b> 個月 ' : '') + '<b>' + r.d + '</b> 天';
  }
  function togetherInfoSheet() {
    const s = S(), t = D.today();
    if (!D.valid(s.together)) return togetherSheet();
    const r = ymdDiff(s.together, t), n = D.diff(s.together, t) + 1;
    const months = r.y * 12 + r.m;
    const big = (v, l) => '<div class="glass card" style="margin:0 0 10px;padding:18px 20px"><div class="small muted">' + l + '</div><div style="font-size:26px;font-weight:750;margin-top:4px">' + v + '</div></div>';
    let nx = '';
    const nh = n <= 0 ? 100 : n % 100 === 0 ? n : Math.ceil(n / 100) * 100;
    const ny = nextYearly(s.together);
    const c1 = { left: D.diff(t, D.add(s.together, nh - 1)), label: '第 ' + nh + ' 天' };
    const c2 = ny ? { left: D.diff(t, ny.date), label: ny.n + ' 週年' } : null;
    const pick = c2 && c2.left < c1.left ? c2 : c1;
    nx = pick.left === 0 ? pick.label + '：就是今天！' : pick.label + '：還有 ' + pick.left + ' 天';
    openSheet('<h2>在一起</h2><p class="muted" style="margin-top:-8px">由 ' + D.ymdText(s.together) + ' 開始</p>' +
      big(ymdHTML(s.together, t).replace(/<\/?b>/g, ''), '年月日') +
      big((months ? months + ' 個月 ' : '') + r.d + ' 天', '月日') +
      big('第 ' + n.toLocaleString('en-US') + ' 天', '日數') +
      '<p class="small muted" style="margin:6px 4px 0">' + icon('heart', 'xs') + ' 下一個：' + nx + '</p>' +
      '<div class="actions"><button class="btn ghost" data-edit>' + icon('pencil', 'sm') + '改日子</button><button class="btn" data-x>好</button></div>', api => {
      api.$('[data-x]').onclick = () => api.close();
      api.$('[data-edit]').onclick = () => { api.close(); togetherSheet(); };
    });
  }

  function currentIdea() {
    const wk = Math.floor(D.diff(Q_EPOCH, D.weekStart(D.today())) / 7);
    const st = Store.device.idea || {};
    const shift = st.week === wk ? st.shift || 0 : 0;
    return IDEAS[(wk * 7 + shift) % IDEAS.length];
  }

  /* ================= 今日問題 ================= */
  function pageQuestion() {
    const t = D.today(), me = ME(), ot = OT();
    const st = streak(me);
    const mine = answer(me, t), theirs = answer(ot, t);
    let h = head('今日問題', st ? '連續 ' + st + ' 天' : '開始你們的連續記錄', { back: true });
    h += '<div class="glass card"><div class="eyebrow">今天</div><div class="q-title">' + esc(questionFor(t)) + '</div>' +
      '<div class="label" style="margin-left:0">你的答案</div>' +
      '<div class="field-wrap with-count"><textarea class="field" id="ansText" maxlength="2000" placeholder="你的答案">' + esc(mine ? mine.text : '') + '</textarea><span class="count" id="ansCount">' + (mine ? mine.text.length : 0) + '/2000</span></div>' +
      '<button class="btn block" data-act="ans-save">' + (mine ? '更新' : '儲存') + '</button>' +
      '<hr style="border:0;height:1px;background:var(--line);margin:20px 0 4px">' +
      '<div class="label" style="margin-left:0">' + esc(nm(ot)) + ' 的答案</div>' +
      (theirs ? (mine ? '<div class="answer-box">' + esc(theirs.text) + '</div>' : '<div class="answer-box"><span class="blur-text">' + esc(theirs.text.slice(0, 40)) + '</span></div><div class="muted small" style="margin-top:8px">對方答了。你答了之後就會看到。</div>') : '<div class="muted">對方還沒回答。</div>') +
      '</div>';
    // 過去
    const hist = [];
    for (let i = 1; i <= 120; i++) {
      const d = D.add(t, -i);
      const a = answer(me, d), b = answer(ot, d);
      if (a || b) hist.push({ d, a, b });
    }
    if (hist.length) {
      h += '<div class="section-h">之前的問題</div><div class="glass card tight">' + hist.map(x =>
        '<details class="hist li" style="display:block"><summary><div class="row between"><div class="grow"><div class="ts">' + D.smart(x.d) + '</div><div class="tt">' + esc(questionFor(x.d)) + '</div></div><span class="row" style="gap:4px">' +
        (x.a ? avatar(me, 'xs') : '') + (x.b ? avatar(ot, 'xs') : '') + '</span></div></summary>' +
        '<div style="margin-top:10px" class="stack">' +
        '<div><div class="label" style="margin:0 0 4px">' + esc(nm(me)) + '</div><div class="answer-box">' + (x.a ? esc(x.a.text) : '<span class="faint">沒有回答</span>') + '</div></div>' +
        '<div><div class="label" style="margin:0 0 4px">' + esc(nm(ot)) + '</div><div class="answer-box">' + (x.b ? (x.a ? esc(x.b.text) : '<span class="faint">答了那天的問題才看到</span>') : '<span class="faint">沒有回答</span>') + '</div></div>' +
        '</div></details>').join('') + '</div>';
    }
    return h;
  }

  /* ================= 待辦事項 ================= */
  function todoSort(a, b) {
    if (!!a.prio !== !!b.prio) return a.prio ? -1 : 1;
    if ((a.due || '9') !== (b.due || '9')) return (a.due || '9') < (b.due || '9') ? -1 : 1;
    return (a._at || 0) - (b._at || 0);
  }
  function pageTodo() {
    const t = D.today(), we = D.add(D.weekStart(t), 6), me = ME(), ot = OT();
    const all = Store.all('todo');
    const whoOk = x => ui.todoWho === 'all' || (ui.todoWho === 'me' ? (x.who === me || x.who === 'both' || !x.who) : (x.who === ot || x.who === 'both' || !x.who));
    const open = all.filter(x => !x.done && whoOk(x));
    const cnt = { today: 0, week: 0, later: 0 };
    open.forEach(x => cnt[todoBucket(x, t, we)]++);
    const shown = open.filter(x => ui.todoWhen === 'all' || todoBucket(x, t, we) === ui.todoWhen).sort(todoSort);
    const ws = D.weekStart(t);
    const doneWeek = all.filter(x => x.done && x.doneAt && x.doneAt >= ws && whoOk(x)).length;
    const pct = doneWeek + cnt.today + cnt.week ? Math.round(doneWeek * 100 / (doneWeek + cnt.today + cnt.week)) : 0;
    const whenLbl = { all: '全部', today: '今天', week: '這星期', later: '以後' }[ui.todoWhen];
    const whoLbl = { all: '兩個人的', me: '我的', other: esc(nm(ot)) + ' 的' }[ui.todoWho];

    let h = '<div class="topbar"><button class="dropdown-title glass" data-act="todo-menu">' + whenLbl + icon('chevD', 'sm') + '</button>' + avatar(me, 'sm') + '</div>';
    h += '<p class="page-sub" style="margin:6px 4px 16px">' + whoLbl + ' · ' + open.length + '</p>';
    h += '<div class="glass card hero"><div style="font-size:20px;font-weight:700">' + (open.length ? '還有 ' + open.length + ' 件未完成' : '沒有未完成的事') + '</div>' +
      '<div class="counts">' + ['today', 'week', 'later'].map(k => '<button data-act="todo-when" data-k="' + k + '" class="' + (ui.todoWhen === k ? 'on' : '') + '"><div class="n">' + cnt[k] + '</div><div class="t">' + { today: '今天', week: '這星期', later: '以後' }[k] + '</div></button>').join('') + '</div>' +
      '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
      '<div class="muted small" style="margin-top:8px">' + (doneWeek ? '這星期做完 ' + doneWeek + ' 件' : '這星期還沒做完一件') + '</div></div>';

    if (!shown.length) {
      h += emptyHTML('todo', open.length ? '這裏沒有' : '還沒有待辦事項', open.length ? '換一個時間看看。' : '加第一件：你們想一起做的小事。');
    } else {
      h += '<div class="glass card tight list">' + shown.map(todoRow).join('') + '</div>';
    }
    const done = all.filter(x => x.done && whoOk(x)).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '') || b._at - a._at);
    if (done.length) {
      h += '<button class="section-h" style="width:calc(100% - 8px)" data-act="todo-showdone">已完成 ' + done.length + '<span class="faint">' + icon(ui.showDone ? 'chevD' : 'chevR', 'sm') + '</span></button>';
      if (ui.showDone) h += '<div class="glass card tight list">' + done.slice(0, 50).map(todoRow).join('') + '</div>';
    }
    h += '<button class="btn fab" data-act="todo-new">' + icon('plus') + '新的待辦</button>';
    return h;
  }
  function todoRow(x) {
    const t = D.today();
    const over = !x.done && x.due && x.due < t;
    const who = x.who && x.who !== 'both' ? avatar(x.who, 'xs') : '';
    const meta = [];
    if (x.due) meta.push('<span class="' + (over ? 'tag red' : 'tag gray') + '">' + D.smart(x.due) + '</span>');
    if (x.prio) meta.push('<span class="tag pink">' + icon('flag', 'xs') + '優先</span>');
    return '<div class="li"><button class="check' + (x.done ? ' on' : '') + '" data-act="todo-toggle" data-id="' + x.id + '" aria-label="完成">' + icon('check', 'xs') + '</button>' +
      '<button class="grow" style="text-align:left" data-act="todo-edit" data-id="' + x.id + '"><div class="tt' + (x.done ? ' done-text' : '') + '">' + esc(x.title) + '</div>' +
      (meta.length ? '<div class="row" style="gap:6px;margin-top:4px;flex-wrap:wrap">' + meta.join('') + '</div>' : '') + '</button>' + who + '</div>';
  }
  function todoSheet(id) {
    const x = id ? Store.get(id) : { title: '', who: 'both', prio: false, due: '' };
    if (!x) return;
    const me = ME(), ot = OT();
    const whoCats = [{ k: 'both', n: '兩個人', c: '#2f6bff' }, { k: me, n: nm(me), c: '#5b8cff' }, { k: ot, n: nm(ot), c: '#38bdf8' }];
    const t = D.today();
    const sat = D.add(t, (6 - D.dow(t) + 7) % 7);
    openSheet(
      '<h2>' + (id ? '待辦' : '新的待辦') + '</h2>' +
      '<div class="field-wrap with-count"><input class="field" name="title" maxlength="500" placeholder="要做甚麼？" value="' + esc(x.title) + '"' + (id ? '' : ' autofocus') + '><span class="count" data-c>' + x.title.length + '/500</span></div>' +
      '<div class="set-row"><div><div style="font-weight:600">優先</div><div class="small muted">放在最上面</div></div>' + switchHTML('prio', x.prio) + '</div>' +
      '<div class="label">誰？</div>' + chipsHTML(whoCats, x.who || 'both', 'who') +
      '<div class="label">甚麼時候要做完？</div>' +
      '<div class="chips" style="margin-bottom:10px" data-quick>' +
      [['', '沒有日期'], [t, '今天'], [D.add(t, 1), '明天'], [sat, '這個週末']].map(([k, n]) => '<button type="button" class="chip" data-d="' + k + '">' + n + '</button>').join('') + '</div>' +
      '<input type="date" class="field" name="due" value="' + esc(x.due || '') + '">' +
      '<div class="actions">' + (id ? '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn" data-save>儲存</button></div>',
      api => {
        const f = n => api.$('[name="' + n + '"]');
        f('title').addEventListener('input', e => api.$('[data-c]').textContent = e.target.value.length + '/500');
        const getWho = bindChips(api.el, 'who');
        const syncQuick = () => api.$$('[data-quick] .chip').forEach(c => c.classList.toggle('on', c.dataset.d === f('due').value));
        api.$('[data-quick]').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; f('due').value = c.dataset.d; syncQuick(); });
        f('due').addEventListener('change', syncQuick); syncQuick();
        api.$('[data-save]').onclick = () => {
          const title = f('title').value.trim();
          if (!title) { f('title').focus(); return; }
          Store.put('todo', Object.assign({}, x, { title, prio: f('prio').checked, who: getWho() || 'both', due: f('due').value || '' }), id);
          api.close();
        };
        f('title').addEventListener('keydown', e => { if (e.key === 'Enter') api.$('[data-save]').click(); });
        if (id) api.$('[data-del]').onclick = () => { Store.remove(id); api.close(); toast('已刪除，可以在「最近刪除」還原', 'trash'); };
      }
    );
  }

  /* ================= 清單 ================= */
  function listCats() { return LIST_CATS.concat(S().listCats); }
  function pageLists() {
    const lists = Store.all('list').sort((a, b) => b._at - a._at);
    const items = Store.all('item');
    let h = head('清單', '買菜、電影、計劃');
    if (!lists.length) h += emptyHTML('list', '還沒有清單', '做第一張：買菜的、旅行的，或者一起看的。');
    else {
      h += lists.map(l => {
        const its = items.filter(i => i.listId === l.id);
        const done = its.filter(i => i.done).length;
        const cat = listCats().find(c => c.k === l.cat) || listCats()[4];
        const pct = its.length ? Math.round(done * 100 / its.length) : 0;
        return '<a href="#/list/' + l.id + '" class="glass card" style="display:block"><div class="row between"><div class="grow"><div style="font-size:18px;font-weight:700">' + esc(l.name) + '</div>' +
          '<div class="row small muted" style="gap:6px;margin-top:2px"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:' + cat.c + '"></span>' + esc(cat.n) + ' · ' + (its.length ? (done === its.length ? '全部做完' : (its.length - done) + ' 項未做') : '還沒有項目') + '</div></div><span class="faint">' + icon('chevR', 'sm') + '</span></div>' +
          (its.length ? '<div class="progress"><i style="width:' + pct + '%"></i></div>' : '') + '</a>';
      }).join('');
    }
    h += '<button class="btn fab" data-act="list-new">' + icon('plus') + '新清單</button>';
    return h;
  }
  function addCustomCat(key, box, cur) {
    const n = (prompt('新的種類叫甚麼？') || '').trim().slice(0, 12);
    if (!n) return null;
    const arr = S()[key].concat([{ k: 'c_' + Date.now().toString(36), n, c: ['#8b5cf6', '#ec4899', '#14b8a6', '#0ea5e9', '#84cc16'][S()[key].length % 5] }]);
    setS({ [key]: arr });
    return arr[arr.length - 1];
  }
  function listSheet(id) {
    const x = id ? Store.get(id) : { name: '', cat: 'shop' };
    openSheet(
      '<h2>' + (id ? '清單' : '新清單') + '</h2>' +
      '<div class="field-wrap with-count"><input class="field" name="name" maxlength="200" placeholder="叫甚麼名字？" value="' + esc(x.name) + '"' + (id ? '' : ' autofocus') + '><span class="count" data-c>' + x.name.length + '/200</span></div>' +
      '<div class="label">這是甚麼清單？</div><div data-chipbox>' + chipsHTML(listCats(), x.cat, 'cat', true) + '</div>' +
      '<div class="actions">' + (id ? '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn" data-save>儲存</button></div>',
      api => {
        const f = api.$('[name="name"]');
        f.addEventListener('input', () => api.$('[data-c]').textContent = f.value.length + '/200');
        let getCat;
        const bind = cur => {
          api.$('[data-chipbox]').innerHTML = chipsHTML(listCats(), cur, 'cat', true);
          getCat = bindChips(api.el, 'cat', () => { const c = addCustomCat('listCats'); if (c) bind(c.k); });
        };
        bind(x.cat);
        api.$('[data-save]').onclick = () => {
          const name = f.value.trim(); if (!name) { f.focus(); return; }
          const nid = Store.put('list', Object.assign({}, x, { name, cat: getCat() || 'other' }), id);
          api.close();
          if (!id) location.hash = '#/list/' + nid;
        };
        if (id) api.$('[data-del]').onclick = async () => {
          if (!(await confirmSheet('刪除這張清單？', '裏面的項目也會一起刪除，7 天內可以還原。', '刪除', true))) return;
          Store.all('item').filter(i => i.listId === id).forEach(i => Store.remove(i.id, { silent: true }));
          Store.remove(id); api.close(); location.hash = '#/lists';
        };
      }
    );
  }
  function pageList(id) {
    const l = Store.get(id);
    if (!l) return head('清單', '', { back: true }) + emptyHTML('list', '找不到這張清單', '可能已經被刪除了。');
    const cat = listCats().find(c => c.k === l.cat) || listCats()[4];
    const items = Store.all('item').filter(i => i.listId === id).sort((a, b) => (a.order || a._at) - (b.order || b._at));
    const open = items.filter(i => !i.done), done = items.filter(i => i.done);
    let h = head(esc(l.name), esc(cat.n) + ' · ' + open.length + ' 項未做', { back: true, right: '<button class="round-btn" data-act="list-edit" data-id="' + id + '">' + icon('pencil', 'sm') + '</button>' });
    h += '<div class="glass card" style="padding:8px 8px 8px 16px"><form class="row" data-form="item-add" data-id="' + id + '"><input class="field grow" data-live name="t" placeholder="加一項…" maxlength="200" style="background:transparent;border:0;box-shadow:none;padding:10px 0"><button class="btn sm" type="submit" style="padding:0 14px" aria-label="加">' + icon('plus', 'sm') + '</button></form></div>';
    const itemRow = i => '<div class="li"><button class="check' + (i.done ? ' on' : '') + '" data-act="item-toggle" data-id="' + i.id + '">' + icon('check', 'xs') + '</button><button class="grow" data-act="item-toggle" data-id="' + i.id + '" style="text-align:left"><span class="' + (i.done ? 'done-text' : '') + '">' + esc(i.text) + '</span></button>' + avatar(i._by || ME(), 'xs') + '<button class="faint" data-act="item-del" data-id="' + i.id + '" aria-label="刪除" style="padding:4px">' + icon('x', 'sm') + '</button></div>';
    if (!items.length) h += emptyHTML('list', '還沒有項目', '在上面輸入，按 + 就加進去。');
    if (open.length) h += '<div class="glass card tight list">' + open.map(itemRow).join('') + '</div>';
    if (done.length) {
      h += '<div class="section-h">已完成 ' + done.length + '<button class="link-btn small" data-act="item-clear" data-id="' + id + '">清除已完成</button></div>';
      h += '<div class="glass card tight list">' + done.map(itemRow).join('') + '</div>';
    }
    return h;
  }

  /* ================= 願望清單 ================= */
  function wishCats() { return WISH_CATS.concat(S().wishCats); }
  function pageWishes() {
    const all = Store.all('wish');
    const cats = wishCats();
    const shown = all.filter(w => !w.done && (ui.wishCat === 'all' || w.cat === ui.wishCat)).sort((a, b) => (b.want ? 1 : 0) - (a.want ? 1 : 0) || b._at - a._at);
    const done = all.filter(w => w.done);
    let h = head('願望清單', '我們想去的地方、想要的東西、想做的事', { back: true });
    if (all.length) {
      h += '<div class="chips" style="margin-bottom:14px"><button class="chip' + (ui.wishCat === 'all' ? ' on' : '') + '" data-act="wish-filter" data-k="all">全部</button>' +
        cats.filter(c => all.some(w => w.cat === c.k)).map(c => '<button class="chip' + (ui.wishCat === c.k ? ' on' : '') + '" data-act="wish-filter" data-k="' + c.k + '"><span class="dot" style="background:' + c.c + '"></span>' + esc(c.n) + '</button>').join('') + '</div>';
    }
    if (!shown.length) h += emptyHTML('heart', all.length ? '這裏沒有' : '還沒有願望', all.length ? '換一個種類看看。' : '加第一個：一個地方、一頓飯，或者想買的東西。');
    else h += '<div class="glass card tight list">' + shown.map(wishRow).join('') + '</div>';
    if (done.length) h += '<div class="section-h">已實現 ' + done.length + '</div><div class="glass card tight list">' + done.map(wishRow).join('') + '</div>';
    h += '<button class="btn fab" data-act="wish-new">' + icon('plus') + '新願望</button>';
    return h;
  }
  function wishRow(w) {
    const c = wishCats().find(x => x.k === w.cat) || WISH_CATS[4];
    const meta = ['<span class="row" style="gap:4px"><span style="width:7px;height:7px;border-radius:50%;background:' + c.c + '"></span>' + esc(c.n) + '</span>'];
    if (w.price) meta.push(esc(w.price));
    return '<div class="li' + (w.done ? ' dim' : '') + '"><span class="ic" style="color:' + c.c + '">' + icon(w.done ? 'check' : w.want ? 'star' : 'heart', 'sm') + '</span>' +
      '<button class="grow" style="text-align:left" data-act="wish-edit" data-id="' + w.id + '"><div class="tt' + (w.done ? ' done-text' : '') + '">' + esc(w.title) + (w.want && !w.done ? ' <span class="tag pink">很想要</span>' : '') + '</div><div class="ts row" style="gap:8px">' + meta.join(' · ') + '</div></button>' +
      (w.link ? '<a class="faint" href="' + esc(safeUrl(w.link)) + '" target="_blank" rel="noopener" aria-label="打開連結" style="padding:4px">' + icon('ext', 'sm') + '</a>' : '') + avatar(w._by || ME(), 'xs') + '</div>';
  }
  function safeUrl(u) { u = String(u || '').trim(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u; return u; }
  function wishSheet(id, preset) {
    const x = id ? Store.get(id) : Object.assign({ title: '', link: '', price: '', note: '', cat: 'travel', want: false }, preset);
    openSheet(
      '<h2>' + (id ? '願望' : '新願望') + '</h2>' +
      '<div class="field-wrap"><input class="field" name="title" maxlength="200" placeholder="你們想要甚麼？" value="' + esc(x.title) + '"' + (id ? '' : ' autofocus') + '></div>' +
      '<div class="field-wrap"><input class="field" name="link" type="url" inputmode="url" placeholder="連結（可選）" value="' + esc(x.link) + '"></div>' +
      '<div class="field-wrap"><input class="field" name="price" placeholder="大約價錢" value="' + esc(x.price) + '"></div>' +
      '<details' + (x.note ? ' open' : '') + '><summary class="link-btn" style="margin:6px 2px 10px;list-style:none">' + icon('chevR', 'xs') + '更多細節</summary><textarea class="field" name="note" placeholder="為甚麼想要、尺碼、顏色…" style="min-height:80px">' + esc(x.note || '') + '</textarea></details>' +
      '<div class="label">種類</div><div data-chipbox></div>' +
      '<div class="set-row" style="margin-top:8px"><div style="font-weight:600">我很想要</div>' + switchHTML('want', x.want) + '</div>' +
      (id ? '<div class="set-row"><div style="font-weight:600">已經實現了</div>' + switchHTML('done', x.done) + '</div>' : '') +
      '<div class="actions">' + (id ? '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn" data-save>儲存</button></div>',
      api => {
        const f = n => api.$('[name="' + n + '"]');
        let getCat;
        const bind = cur => {
          api.$('[data-chipbox]').innerHTML = chipsHTML(wishCats(), cur, 'cat', true);
          getCat = bindChips(api.el, 'cat', () => { const c = addCustomCat('wishCats'); if (c) bind(c.k); });
        };
        bind(x.cat);
        api.$('[data-save]').onclick = () => {
          const title = f('title').value.trim(); if (!title) { f('title').focus(); return; }
          Store.put('wish', Object.assign({}, x, {
            title, link: f('link').value.trim(), price: f('price').value.trim(), note: f('note').value.trim(),
            cat: getCat() || 'other', want: f('want').checked, done: id ? f('done').checked : false,
            doneAt: id && f('done').checked ? (x.doneAt || D.today()) : ''
          }), id);
          api.close();
          if (!id && preset) toast('已加到願望清單', 'heart');
        };
        if (id) api.$('[data-del]').onclick = () => { Store.remove(id); api.close(); toast('已刪除，可以在「最近刪除」還原', 'trash'); };
      }
    );
  }

  /* ================= 日曆 ================= */
  function pageCalendar() {
    const t = D.today();
    if (ui.calY == null) { const [y, m] = D.ymd(t); ui.calY = y; ui.calM = m; }
    const y = ui.calY, m = ui.calM;
    const first = D.make(y, m, 1), last = D.make(y, m, D.daysInMonth(y, m));
    const mk = markers(first, last);
    const pd = periodDays(first, last);
    const byDay = {};
    mk.forEach(x => (byDay[x.date] = byDay[x.date] || []).push(x));
    const lead = (D.dow(first) + 6) % 7;

    let h = head('日曆', '你們的計劃、活動和重要日子');
    h += '<div class="glass card" id="calCard"><div class="cal-head"><button class="cal-nav" data-act="cal-prev" aria-label="上個月">' + icon('chevL') + '</button>' +
      '<button class="ttl" data-act="cal-pick">' + y + '年' + m + '月' + icon('chevD', 'xs') + '</button>' +
      '<button class="cal-nav" data-act="cal-next" aria-label="下個月">' + icon('chevR') + '</button></div>';
    h += '<div class="cal-grid">' + ['一', '二', '三', '四', '五', '六', '日'].map(w => '<div class="wd">週' + w + '</div>').join('');
    for (let i = 0; i < lead; i++) h += '<div class="cal-day blank"></div>';
    for (let d = 1; d <= D.daysInMonth(y, m); d++) {
      const k = D.make(y, m, d);
      const list = byDay[k] || [];
      const marks = list.filter(x => x.kind !== 'period');
      const dots = marks.slice(0, 4).map(x => {
        const w = x.who || (x.kind === 'birthday' ? x.who : 'both');
        return (x.kind === 'event' || x.kind === 'trip' || x.kind === 'birthday') && w && w !== 'both' ? '<i style="background:' + colorOf(w) + '"></i>' : HEART;
      }).join('');
      const dw = D.dow(k);
      const cls = ['cal-day', k === t ? 'today' : '', k === ui.calSel ? 'sel' : '', pd[k] === 'period' ? 'period' : pd[k] === 'pred' ? 'period-pred' : '', dw === 0 || dw === 6 ? 'wkend' : ''].join(' ');
      h += '<button class="' + cls + '" data-act="cal-day" data-k="' + k + '"><span class="num">' + d + '</span><span class="dots">' + dots + '</span></button>';
    }
    h += '</div>';
    const [ty, tm] = D.ymd(t);
    if (ty !== y || tm !== m) h += '<div class="center" style="margin-top:8px"><button class="link-btn small" data-act="cal-today">回到今天</button></div>';
    h += '</div>';

    // 選中的一天
    const sel = ui.calSel;
    const selList = markers(sel, sel);
    h += '<div class="glass card tight"><div class="row between" style="padding:10px 16px 6px"><b>' + D.full(sel) + (sel === t ? ' · 今天' : '') + '</b><button class="link-btn small" data-act="event-new" data-k="' + sel + '">' + icon('plus', 'xs') + '加活動</button></div>' +
      (pd[sel] ? '<div class="small" style="padding:0 16px 6px;color:#c0367f">' + icon('drop', 'xs') + (pd[sel] === 'period' ? ' 經期' : ' 經期（預計）') + '</div>' : '') +
      (selList.length ? selList.map(markerRow).join('') : '<div class="muted small" style="padding:4px 16px 14px">這天沒有標記。</div>') + '</div>';

    // 不會忘記的日子
    h += daysCard();

    // 本月
    h += '<div class="section-h">' + m + '月標記了的日子</div>';
    h += mk.length ? '<div class="glass card tight">' + mk.map(markerRow).join('') + '</div>' : '<p class="muted small" style="margin:0 4px 16px">這個月沒有標記甚麼。</p>';
    h += '<button class="btn fab" data-act="event-new" data-k="' + (sel >= t ? sel : t) + '">' + icon('plus') + '新活動</button>';
    return h;
  }
  function markerRow(x) {
    const act = x.kind === 'event' ? 'event-edit' : x.kind === 'day' ? 'day-edit' : x.kind === 'together' ? 'together' : x.kind === 'birthday' ? 'birthday' : x.kind === 'period' ? 'go-period' : '';
    return '<button class="mk" style="width:100%;text-align:left" data-act="' + act + '"' + (x.id ? ' data-id="' + x.id + '"' : '') + (x.who ? ' data-w="' + x.who + '"' : '') + '>' +
      '<span class="date"><div class="d">' + D.ymd(x.date)[2] + '</div><div class="w">週' + D.WD[D.dow(x.date)] + '</div></span><span class="bar" style="background:' + x.color + '"></span>' +
      '<span class="grow"><div style="font-weight:600">' + esc(x.title) + '</div>' + (x.sub || x.place || x.multi ? '<div class="small muted">' + [x.sub, x.multi && '第 ' + x.multi + ' 天', x.place].filter(Boolean).map(esc).join(' · ') + '</div>' : '') + '</span></button>';
  }
  function nextYearly(dateKey) {
    const t = D.today();
    const [ty] = D.ymd(t);
    const a = yearlyBetween(dateKey, t, D.make(ty + 1, 12, 31));
    return a[0];
  }
  function daysCard() {
    const s = S(), t = D.today();
    const rows = [];
    if (D.valid(s.together)) {
      const n = D.diff(s.together, t) + 1;
      const nh = n <= 0 ? 100 : n % 100 === 0 ? n : Math.ceil(n / 100) * 100;
      const ny = nextYearly(s.together);
      const c1 = { left: D.diff(t, D.add(s.together, nh - 1)), label: '第 ' + nh + ' 天' };
      const c2 = ny ? { left: D.diff(t, ny.date), label: ny.n + ' 週年' } : null;
      const nx = c2 && c2.left < c1.left ? c2 : c1;
      rows.push({ act: 'together', ic: 'heart', t: '在一起', s: D.ymdText(s.together), right: n > 0 ? '<b>' + n + '</b> 天' : '', sub2: '下一個：' + nx.label + (nx.left === 0 ? '（今天！）' : '（還有 ' + nx.left + ' 天）') });
    }
    ['a', 'b'].forEach(w => {
      if (!D.valid(s.birthday[w])) return;
      const nb = nextYearly(s.birthday[w]);
      rows.push({ act: 'birthday', w, ic: 'cake', t: esc(nm(w)) + ' 生日', s: D.md(s.birthday[w]), right: nb ? (nb.date === t ? '<b>今天！</b>' : '還有 <b>' + D.diff(t, nb.date) + '</b> 天') : '' });
    });
    Store.all('day').sort((a, b) => a.date < b.date ? -1 : 1).forEach(dy => {
      let right = '';
      if (dy.yearly !== false) { const nx = nextYearly(dy.date); if (nx) right = nx.date === t ? '<b>今天！</b>' : '還有 <b>' + D.diff(t, nx.date) + '</b> 天'; }
      else { const n = D.diff(t, dy.date); right = n === 0 ? '<b>今天！</b>' : n > 0 ? '還有 <b>' + n + '</b> 天' : '已經 <b>' + (-n) + '</b> 天'; }
      rows.push({ act: 'day-edit', id: dy.id, ic: 'star', t: esc(dy.title), s: D.ymdText(dy.date) + (dy.yearly !== false ? ' · 每年' : ''), right });
    });
    let h = '<div class="glass card tight"><div class="row" style="padding:12px 16px 4px;gap:8px">' + icon('cake', 'sm') + '<b>不會忘記的日子</b></div>';
    if (!rows.length) h += '<div class="muted small" style="padding:2px 16px 6px">還沒有。第一個可以是你們認識的那天。</div>';
    h += rows.map(r => '<button class="li" data-act="' + r.act + '"' + (r.id ? ' data-id="' + r.id + '"' : '') + (r.w ? ' data-w="' + r.w + '"' : '') + '><span class="ic">' + icon(r.ic, 'sm') + '</span><span class="grow"><div class="tt">' + r.t + '</div><div class="ts">' + r.s + (r.sub2 ? '<br>' + r.sub2 : '') + '</div></span><span class="val">' + r.right + '</span></button>').join('');
    h += '<button class="li" data-act="day-new" style="color:var(--accent-deep)"><span class="ic">' + icon('plus', 'sm') + '</span><span class="grow tt">加一個日子</span></button></div>';
    return h;
  }
  function monthPicker() {
    let py = ui.calY;
    const draw = api => {
      const [ty, tm] = D.ymd(D.today());
      api.$('[data-y]').textContent = py + '年';
      api.$('.months').innerHTML = Array.from({ length: 12 }, (_, i) => '<button data-m="' + (i + 1) + '" class="' + (py === ui.calY && i + 1 === ui.calM ? 'on ' : '') + (py === ty && i + 1 === tm ? 'now' : '') + '">' + (i + 1) + '月</button>').join('');
    };
    openSheet('<h2>選擇月份</h2><div class="year-pick"><button class="round-btn" data-py="-1">' + icon('chevL') + '</button><span class="y" data-y></span><button class="round-btn" data-py="1">' + icon('chevR') + '</button></div><div class="months"></div>' +
      '<div class="actions"><button class="btn ghost" data-today>今天</button></div>', api => {
      draw(api);
      api.$$('[data-py]').forEach(b => b.onclick = () => { py += Number(b.dataset.py); draw(api); });
      api.$('.months').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; ui.calY = py; ui.calM = Number(b.dataset.m); selInMonth(); api.close(); render(); };
      api.$('[data-today]').onclick = () => { const [y, m] = D.ymd(D.today()); ui.calY = y; ui.calM = m; ui.calSel = D.today(); api.close(); render(); };
    });
  }
  function eventSheet(id, preset) {
    const x = id ? Store.get(id) : Object.assign({ title: '', place: '', date: D.today(), time: '20:00', end: '', endTime: '', allDay: false, cat: 'date', repeat: 'none', who: 'both' }, preset);
    const me = ME(), ot = OT();
    const whoOpts = [['both', '一起', colorOf('both')], [me, nm(me), colorOf(me)], [ot, nm(ot), colorOf(ot)]];
    if (!x) return;
    const reps = [['none', '不重複'], ['weekly', '每週'], ['monthly', '每月'], ['yearly', '每年']];
    const multi0 = !!(x.end && x.end > x.date);
    openSheet(
      '<h2>' + (id ? '活動' : '新活動') + '</h2>' +
      (id ? '' : '<div class="quick glass"><div class="row" style="gap:8px">' + icon('spark', 'sm') + '<input class="grow" name="quick" placeholder="隨手寫一句，例如：10月30日去迪士尼玩全日" autocomplete="off"><button type="button" class="btn sm" data-fill style="padding:0 14px">填好</button></div><div class="small muted" data-qprev style="margin-top:6px;display:none"></div></div>') +
      '<div class="field-wrap with-count"><input class="field" name="title" maxlength="200" placeholder="這是甚麼？" value="' + esc(x.title) + '"><span class="count" data-c>' + x.title.length + '/200</span></div>' +
      '<div class="field-wrap"><input class="field" name="place" maxlength="200" placeholder="地點（可選）" value="' + esc(x.place) + '"></div>' +
      '<div class="label">誰的</div><div class="seg who-seg" data-who>' + whoOpts.map(([k, n, c]) => '<button type="button" data-k="' + k + '" class="' + ((x.who || 'both') === k ? 'on' : '') + '">' + (k === 'both' ? '♥ ' : '<span class="d" style="background:' + c + '"></span>') + esc(n) + '</button>').join('') + '</div>' +
      '<div class="set-row" style="margin-top:6px"><div style="font-weight:600">全日</div>' + switchHTML('allDay', x.allDay) + '</div>' +
      '<div class="set-row"><div><div style="font-weight:600">多於一天</div><div class="small muted">揀到哪天哪個時間結束</div></div>' + switchHTML('multi', multi0) + '</div>' +
      '<div class="label" data-startlbl>' + (multi0 ? '開始' : '日期') + '</div><div class="two" data-startrow><input type="date" class="field" name="date" value="' + esc(x.date) + '"><input type="time" class="field" name="time" value="' + esc(x.time || '') + '" data-t></div>' +
      '<div data-endbox' + (multi0 ? '' : ' class="hidden"') + '><div class="label">結束</div><div class="two" data-endrow><input type="date" class="field" name="end" value="' + esc(x.end || '') + '"><input type="time" class="field" name="endTime" value="' + esc(x.endTime || '') + '" data-t></div></div>' +
      '<div class="label">種類</div>' + chipsHTML(EVENT_CATS, x.cat, 'cat') +
      '<div class="label">重複</div><div class="seg" data-rep>' + reps.map(([k, n]) => '<button type="button" data-k="' + k + '" class="' + (x.repeat === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div class="actions">' + (id ? '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn" data-save>儲存</button></div>',
      api => {
        const f = n => api.$('[name="' + n + '"]');
        const cnt = () => api.$('[data-c]').textContent = f('title').value.length + '/200';
        f('title').addEventListener('input', cnt);
        let getCat = bindChips(api.el, 'cat');
        let rep = x.repeat || 'none';
        let who = x.who || 'both';
        api.$('[data-who]').onclick = e => { const b = e.target.closest('button'); if (!b) return; who = b.dataset.k; api.$$('[data-who] button').forEach(z => z.classList.toggle('on', z === b)); };
        api.$('[data-rep]').onclick = e => { const b = e.target.closest('button'); if (!b) return; rep = b.dataset.k; api.$$('[data-rep] button').forEach(z => z.classList.toggle('on', z === b)); };
        const sync = () => {
          const ad = f('allDay').checked, mu = f('multi').checked;
          api.$$('[data-t]').forEach(el => el.classList.toggle('hidden', ad));
          api.$$('[data-startrow],[data-endrow]').forEach(el => el.style.gridTemplateColumns = ad ? '1fr' : '');
          api.$('[data-endbox]').classList.toggle('hidden', !mu);
          api.$('[data-startlbl]').textContent = mu ? '開始' : '日期';
          if (mu && (!f('end').value || f('end').value <= f('date').value)) f('end').value = D.add(f('date').value || D.today(), 1);
          if (mu && !f('endTime').value && f('time').value) f('endTime').value = f('time').value;
        };
        f('allDay').onchange = sync; f('multi').onchange = sync;
        f('date').addEventListener('change', () => { if (f('multi').checked && f('end').value && f('end').value < f('date').value) f('end').value = f('date').value; });
        sync();
        // 隨手寫一句
        const q = f('quick');
        if (q) {
          let parsed = null;
          const show = () => {
            const box = api.$('[data-qprev]');
            parsed = q.value.trim() ? parseEvent(q.value, D.today()) : null;
            if (!parsed || (!parsed.found.date && !parsed.found.time && !parsed.allDay)) { box.style.display = q.value.trim() ? 'block' : 'none'; box.textContent = q.value.trim() ? '看不出日期或時間，會只用作標題。' : ''; return; }
            const bits = [];
            if (parsed.date) bits.push(D.smart(parsed.date));
            if (parsed.end) bits.push('至 ' + D.smart(parsed.end));
            if (parsed.allDay) bits.push('全日'); else if (parsed.time) bits.push(parsed.time + (parsed.endTime ? '–' + parsed.endTime : ''));
            if (parsed.title) bits.push('「' + parsed.title + '」');
            box.style.display = 'block'; box.textContent = '→ ' + bits.join(' · ');
          };
          const apply = () => {
            show();
            if (!q.value.trim()) return false;
            const p = parsed || { title: q.value.trim(), found: {} };
            f('title').value = (p.title || q.value.trim()).slice(0, 200); cnt();
            if (p.date) f('date').value = p.date;
            f('allDay').checked = !!p.allDay || (!!p.found.date && !p.found.time); // 有日期沒時間：當全日
            if (p.time) f('time').value = p.time;
            f('multi').checked = !!p.end;
            if (p.end) { f('end').value = p.end; f('endTime').value = p.endTime || ''; }
            else if (p.endTime) { f('multi').checked = false; }
            x.endTime = p.end ? '' : (p.endTime || '');
            sync();
            q.value = ''; show();
            toast('已填好，看看對不對', 'spark');
            return true;
          };
          let tm;
          q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(show, 200); });
          q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
          api.$('[data-fill]').onclick = apply;
          api._applyQuick = apply;
          setTimeout(() => q.focus(), 360);
        }
        api.$('[data-save]').onclick = () => {
          if (q && q.value.trim() && !f('title').value.trim()) api._applyQuick();
          const title = f('title').value.trim(); if (!title) { (q || f('title')).focus(); return; }
          const date = f('date').value; if (!D.valid(date)) { f('date').focus(); return; }
          const allDay = f('allDay').checked, mu = f('multi').checked;
          let end = mu ? f('end').value : '';
          if (end && end <= date) end = '';
          const time = allDay ? '' : f('time').value;
          let endTime = allDay ? '' : end ? f('endTime').value : (x.endTime || '');
          if (!end && endTime && endTime <= time) endTime = '';
          Store.put('event', Object.assign({}, x, { title, place: f('place').value.trim(), date, time, end, endTime, allDay, cat: getCat() || 'other', repeat: rep, who }), id);
          ui.calSel = date; const [yy, mm] = D.ymd(date); ui.calY = yy; ui.calM = mm;
          api.close();
          toast('已加到日曆 · ' + D.smart(date), 'cal');
        };
        if (id) api.$('[data-del]').onclick = () => { Store.remove(id); api.close(); toast('已刪除，可以在「最近刪除」還原', 'trash'); };
      }
    );
  }
  function daySheet(id) {
    const x = id ? Store.get(id) : { title: '', date: D.today(), yearly: true };
    openSheet(
      '<h2>' + (id ? '日子' : '加一個日子') + '</h2>' +
      '<div class="field-wrap"><input class="field" name="title" maxlength="100" placeholder="例如：第一次約會" value="' + esc(x.title) + '"' + (id ? '' : ' autofocus') + '></div>' +
      '<div class="label">日期</div><input type="date" class="field" name="date" value="' + esc(x.date) + '">' +
      '<div class="set-row" style="margin-top:8px"><div><div style="font-weight:600">每年都記住</div><div class="small muted">關掉就只標記那一天</div></div>' + switchHTML('yearly', x.yearly !== false) + '</div>' +
      '<div class="actions">' + (id ? '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn" data-save>儲存</button></div>',
      api => {
        const f = n => api.$('[name="' + n + '"]');
        api.$('[data-save]').onclick = () => {
          const title = f('title').value.trim(); if (!title) { f('title').focus(); return; }
          if (!D.valid(f('date').value)) return;
          Store.put('day', { title, date: f('date').value, yearly: f('yearly').checked }, id);
          api.close();
        };
        if (id) api.$('[data-del]').onclick = () => { Store.remove(id); api.close(); };
      }
    );
  }

  /* ================= 螢幕便條 ================= */
  let notePhoto = null;
  function pageNote() {
    const me = ME(), ot = OT();
    const mine = Store.get('note_' + me), theirs = Store.get('note_' + ot);
    let h = head('螢幕便條', '出現在對方主頁上的一行。新的會換掉舊的。', { back: true });
    if (theirs && (theirs.text || theirs.photo)) {
      h += '<div class="glass card hero sky note-bubble"><div class="eyebrow">' + esc(nm(ot)) + ' 留給你 · ' + D.smart(D.key(new Date(theirs._at))) + '</div>' + (theirs.text ? '<div class="text">' + esc(theirs.text) + '</div>' : '') + (theirs.photo ? '<img src="' + theirs.photo + '" alt="">' : '') + '</div>';
    } else if (!paired()) {
      h += '<div class="empty" style="padding-top:20px"><div class="bubble glass">' + icon('phone', 'lg') + '</div><h3>還差一個人</h3><p>邀請對方，你們就能在螢幕上互相留便條。</p><div style="margin-top:14px"><button class="btn ghost sm" data-act="invite">' + icon('userPlus', 'sm') + '邀請</button></div></div>';
    }
    if (mine && (mine.text || mine.photo)) {
      h += '<div class="label">現在在對方螢幕上</div><div class="glass card note-bubble"><div class="row between"><span class="small muted">' + D.smart(D.key(new Date(mine._at))) + '</span><button class="link-btn small" data-act="note-clear">' + icon('undo', 'xs') + '收回</button></div>' + (mine.text ? '<div class="text" style="font-size:17px">' + esc(mine.text) + '</div>' : '') + (mine.photo ? '<img src="' + mine.photo + '" alt="">' : '') + '</div>';
    }
    h += '<div class="label">在對方的螢幕上</div>' +
      '<div class="field-wrap with-count"><textarea class="field" id="noteText" maxlength="140" placeholder="你的便條" style="min-height:90px"></textarea><span class="count" id="noteCount">0/140</span></div>' +
      '<p class="small faint" style="margin:-14px 4px 12px">短一點，一眼看得完。</p>' +
      '<input type="file" accept="image/*" id="notePhotoInput" class="hidden">' +
      '<div id="notePrev"></div>' +
      '<button class="btn ghost block" data-act="note-photo" style="margin:10px 0">' + icon('image', 'sm') + '相片</button>' +
      '<button class="btn block" data-act="note-send">' + icon('phone', 'sm') + '放到對方的螢幕</button>';
    return h;
  }
  function drawNotePrev() {
    const box = document.getElementById('notePrev');
    if (!box) return;
    box.innerHTML = notePhoto ? '<div class="photo-prev"><img src="' + notePhoto + '" alt=""><button data-act="note-photo-x" aria-label="移除">' + icon('x', 'sm') + '</button></div>' : '';
  }

  /* ================= 所有部分 ================= */
  function pageSections() {
    let h = head('所有部分', '開啟的部分有話要說時，就會出現在主頁。', { back: true });
    const L = (k, ic, t, s, href) => on(k) ? row({ ic, t, s, href }) : row({ ic, t, s: '已關掉 · 在「部分」重新開啟', href: '#/parts', cls: 'dim' });
    h += '<div class="label">每一天</div><div class="glass card tight list">' +
      L('note', 'phone', '螢幕便條', '出現在對方主頁上', '#/note') +
      L('period', 'drop', '經期', '記錄和推算', '#/period') + '</div>';
    h += '<div class="label">一起</div><div class="glass card tight list">' +
      L('todo', 'todo', '待辦事項', '兩個人的小事', '#/todo') +
      L('lists', 'list', '清單', '買菜、電影、計劃', '#/lists') +
      L('wishes', 'star', '願望清單', '想去的地方、想要的東西', '#/wishes') +
      L('calendar', 'cal', '日曆', '活動和重要日子', '#/calendar') + '</div>';
    h += '<div class="label">你們存下的</div><div class="glass card tight list">' +
      L('know', 'note', '要知道的事', '尺碼、喜歡的、不喜歡的', '#/know') +
      L('plans', 'card', '計劃', '一個目標，一起存錢', '#/plans') +
      L('jots', 'pencil', '筆記', '你們兩個的本子', '#/jots') +
      L('year', 'spark', '我們的一年', '這十二個月做過的', '#/year') + '</div>';
    h += '<div class="label">一起去、一起做</div><div class="glass card tight list">' +
      L('dolist', 'coffee', '一起做', '電影、劇集、演唱會、想去的地方', '#/dolist') +
      L('trips', 'flag', '旅行清單', '每次旅行一張執行李清單', '#/trips') + '</div>';
    h += '<div class="label">收好的</div><div class="glass card tight list">' +
      L('capsule', 'hourglass', '時間囊', '到那一天才打開的信', '#/capsule') +
      L('vault', 'lock', '保險箱', '要密碼才打開', '#/vault') + '</div>';
    h += '<a href="#/parts" class="btn ghost block" style="margin-top:6px">' + icon('sliders', 'sm') + '開關部分</a>';
    return h;
  }
  function pageParts() {
    const sec = S().sections;
    const items = [['note', 'phone', '螢幕便條'], ['todo', 'todo', '待辦事項'], ['lists', 'list', '清單'], ['wishes', 'star', '願望清單'], ['calendar', 'cal', '日曆'], ['period', 'drop', '經期'], ['know', 'note', '要知道的事'], ['plans', 'card', '計劃'], ['jots', 'pencil', '筆記'], ['year', 'spark', '我們的一年'], ['dolist', 'coffee', '一起做'], ['trips', 'flag', '旅行清單'], ['capsule', 'hourglass', '時間囊'], ['vault', 'lock', '保險箱']];
    let h = head('部分', '這個應用程式為你們兩個準備了甚麼。', { back: true });
    h += '<div class="hint-bar">關掉一個部分只是收起來，不會刪除；再開啟，全部都回來。兩部手機會一起改。</div>';
    h += '<div class="glass card tight list">' + items.map(([k, ic, t]) => '<label class="li"><span class="ic">' + icon(ic, 'sm') + '</span><span class="grow tt">' + t + '</span><span class="switch"><input type="checkbox" data-part="' + k + '"' + (sec[k] !== false ? ' checked' : '') + '><span></span></span></label>').join('') + '</div>';
    return h;
  }

  /* ================= 個人檔案 ================= */
  function pageProfile() {
    const s = S(), me = ME(), ot = OT();
    let h = head('個人檔案', '');
    h += '<div class="glass card row" style="gap:14px"><button data-act="avatar" aria-label="頭像" class="avatar-edit">' + avatar(me) + '<span class="cam">' + icon('image', 'xs') + '</span></button><button class="grow" data-act="names" style="text-align:left"><div style="font-size:20px;font-weight:700">' + esc(nm(me)) + '</div><div class="small muted">和 ' + esc(nm(ot)) + ' 一起</div></button><button class="faint" data-act="names" aria-label="改名">' + icon('pencil', 'sm') + '</button></div>';
    h += '<div class="section-h">我們</div><div class="glass card tight list">' +
      row({ act: 'names', ic: 'user', t: '我們的名字', s: esc(nm('a')) + ' &amp; ' + esc(nm('b')) }) +
      row({ act: 'whoami', ic: 'phone', t: '這部裝置是', s: esc(nm(me)) + ' · 每人可以用多部裝置' }) +
      row({ act: 'gender', ic: 'user', t: '男方 / 女方', s: '男方：' + esc(nm(S().male || 'a')) + '（藍）　女方：' + esc(nm((S().male || 'a') === 'a' ? 'b' : 'a')) + '（綠）' }) +
      row({ act: 'avatar', ic: 'image', t: '我的頭像', s: avatarPhoto(me) ? '已設定' : '還沒有上載' }) +
      row({ act: 'together', ic: 'heart', t: '在一起的日子', s: D.valid(s.together) ? D.ymdText(s.together) : '還沒有設定' }) +
      row({ act: 'birthday', ic: 'cake', t: '生日', s: [me, ot].map(w => esc(nm(w)) + '：' + (D.valid(s.birthday[w]) ? D.md(s.birthday[w]) : '未設定')).join('　') }) + '</div>';
    h += '<div class="section-h">同步' + syncPill() + '</div><div class="glass card tight list">' +
      row({ href: '#/sync', ic: 'cloud', t: '雲端同步', s: Sync.configured() ? '已連接 Google 試算表' : '還沒設定，資料只在這部手機' }) +
      row({ act: 'invite', ic: 'userPlus', t: '邀請你的另一半', s: paired() ? '已經在一起同步' : '傳一條連結給對方' }) +
      (Sync.configured() ? row({ act: 'sync-now', ic: 'refresh', t: '立即同步', noChev: true }) : '') + '</div>';
    h += '<div class="section-h">應用程式</div><div class="glass card tight list">' +
      row({ act: 'theme', ic: 'sun', t: '顏色', s: Store.device.theme === 'mint' ? '薄荷綠' : '天空藍' }) +
      row({ href: '#/parts', ic: 'grid', t: '部分', s: '開啟和關掉應用程式的各個部分' }) +
      row({ act: 'check-update', ic: 'refresh', t: '檢查更新', s: App.update && App.update.available ? '有新版本 ' + esc(App.update.available) + '，按一下更新' : '目前版本 ' + esc(window.APP_VERSION || 'dev') }) +
      row({ act: 'howto', ic: 'phone', t: '加到主畫面', s: '像 app 一樣全螢幕打開' }) + '</div>';
    h += '<div class="section-h">你的資料</div><div class="glass card tight list">' +
      row({ href: '#/privacy', ic: 'shield', t: '存甚麼資料，為甚麼', s: '你們的東西放在哪裏' }) +
      row({ href: '#/trash', ic: 'trash', t: '最近刪除', s: '7 天內可以還原' }) +
      row({ act: 'export', ic: 'download', t: '下載備份', s: '一個檔案，裝下你們的一切' }) +
      row({ act: 'import', ic: 'upload', t: '從備份還原', s: '揀之前下載的備份檔' }) + '</div>';
    h += '<div class="glass card tight list">' + row({ act: 'logout', ic: 'logout', icCls: 'red', t: '在這部手機登出', s: '只清除這部手機的資料，雲端的會保留', cls: 'danger' }) + '</div>';
    h += '<input type="file" accept="application/json,.json" id="importInput" class="hidden">';
    h += '<p class="center small faint" style="margin-top:18px">我們 · v' + esc(window.APP_VERSION || 'dev') + '</p>';
    return h;
  }

  function pageSync() {
    const d = Store.device;
    let h = head('雲端同步', '用你們自己的 Google 試算表存資料，兩部手機就會同步。', { back: true });
    h += '<div class="glass card"><div class="label" style="margin-top:0">網頁應用程式網址</div><input class="field" id="syncUrl" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(d.url) + '">' +
      '<div class="label">密碼（和 Apps Script 裏的 SPACE_KEY 一樣）</div><input class="field" id="syncKey" type="password" placeholder="你們的密碼" value="' + esc(d.key) + '">' +
      '<div class="actions"><button class="btn ghost" data-act="sync-test">測試</button><button class="btn" data-act="sync-save">儲存並同步</button></div>' +
      '<div style="margin-top:14px" class="center">' + syncPill() + '</div></div>';
    h += '<div class="section-h">怎樣設定？</div><div class="glass card"><ol style="margin:0;padding-left:20px;line-height:1.8" class="small">' +
      '<li>在 Google Drive 新增一個試算表。</li><li>按「擴充功能 → Apps Script」，把 <b>Code.gs</b> 的內容整段貼上。</li>' +
      '<li>把 <b>SPACE_KEY</b> 改成你們的密碼，儲存。</li><li>按「部署 → 新增部署作業 → 網頁應用程式」，執行身分選「我」，存取權選「所有人」。</li>' +
      '<li>複製以 /exec 結尾的網址，貼到上面。</li></ol><p class="small muted" style="margin-bottom:0">設定好之後，用「邀請你的另一半」把連結傳給對方，對方就不用再填一次。</p></div>';
    if (Sync.configured()) h += '<button class="btn ghost block" data-act="sync-off" style="color:var(--danger)">中斷連接（資料保留在這部手機）</button>';
    return h;
  }

  function pageTrash() {
    const items = Store.trash().sort((a, b) => b.deleted - a.deleted);
    const lbl = { todo: '待辦', list: '清單', item: '清單項目', wish: '願望', event: '活動', day: '日子', period: '經期記錄', note: '便條', answer: '答案', know: '要知道的事', plan: '計劃', dep: '存款紀錄', jot: '筆記', pday: '經期感覺', dodo: '一起做', trip: '旅行', tci: '旅行清單項目', capsule: '時間囊', vault: '保險箱', vfile: '保險箱相片' };
    let h = head('最近刪除', '你們刪除的東西會在這裏留 7 天，之後會自動消失。', { back: true });
    if (!items.length) h += '<div class="empty"><h3 style="font-weight:500;font-size:16px" class="muted">沒有刪除的東西。<br>如果有東西不見了，會在這裏。</h3></div>';
    else h += '<div class="glass card tight list">' + items.map(r => {
      const d = r.data || {};
      const title = d.title || d.name || d.text || (d.start ? D.ymdText(d.start) : '') || '（沒有名字）';
      const days = 7 - Math.floor((Date.now() - r.deleted) / 864e5);
      return '<div class="li"><span class="ic">' + icon('trash', 'sm') + '</span><span class="grow"><div class="tt">' + esc(String(title).slice(0, 60)) + '</div><div class="ts">' + (lbl[r.col] || r.col) + ' · 還有 ' + days + ' 天</div></span><button class="btn soft sm" data-act="restore" data-id="' + r.id + '">還原</button></div>';
    }).join('') + '</div>';
    return h;
  }

  function pagePrivacy() {
    let h = head('存甚麼資料，為甚麼', '只存這個應用程式運作所需的資料，沒有廣告，不會追蹤。', { back: true });
    const card = (ic, t, p) => '<div class="glass card"><div class="row" style="gap:8px;margin-bottom:6px">' + icon(ic, 'sm') + '<b>' + t + '</b></div><div class="small muted">' + p + '</div></div>';
    h += card('heart', '你們兩位', '名字、在一起的日子、生日。用來在主頁數日子，在日曆提醒。');
    h += card('todo', '你們一起做的', '待辦事項、清單、願望、日曆、答案、便條和經期記錄。只有你們兩個看得到。刪掉的東西會留 7 天，以防你們改變主意。');
    h += card('cloud', '雲端在哪裏', '在你們自己 Google Drive 的試算表裏，不經過任何第三方伺服器。誰擁有試算表，誰就擁有資料。');
    h += card('phone', '你的手機', '一份本機副本，讓應用程式沒有網絡也能用。登出的時候，本機副本會從手機刪掉。');
    h += card('lock', '邀請連結和密碼', '邀請連結裏沒有密碼，對方打開後要自己輸入。連續猜錯 10 次，試算表會暫停登入 10 分鐘。如果密碼外洩了，在 Apps Script 改一個新密碼，舊的立即失效。');
    return h;
  }

  /* ================= 歡迎 / 加入 ================= */
  function pageWelcome() {
    const join = pendingJoin();
    if (join) {
      const s = S();
      let h = '<div class="welcome"><div class="logo-mark">' + icon(joinStage === 'pw' ? 'lock' : 'heart', 'lg') + '</div><h1>加入你們的空間</h1>';
      if (joinStage === 'pw') return h + '<p class="lead">輸入你們的密碼。<br>不知道的話，問一問邀請你的人。</p>' +
        '<div class="glass card"><form data-form="join-pw"><input class="field" id="joinPw" type="password" autocomplete="current-password" placeholder="密碼" autofocus>' +
        '<button class="btn block" type="submit" style="margin-top:14px" id="joinPwBtn">加入</button></form></div>' +
        '<button class="btn ghost block" data-act="join-cancel">取消</button></div>';
      if (joinStage === 'loading') return h + '<p class="lead">正在讀取資料…</p></div>';
      if (joinStage === 'err') return h + '<p class="lead">讀取失敗：' + esc(Sync.msg) + '</p><button class="btn block" data-act="join-retry">再試一次</button><button class="btn ghost block" style="margin-top:10px" data-act="join-cancel">取消</button></div>';
      h += '<p class="lead">你是哪一位？</p><div class="stack">';
      ['a', 'b'].forEach(w => {
        const n = (s.names[w] || '').trim();
        h += '<button class="glass card row" style="width:100%;text-align:left;gap:14px;margin:0" data-act="join-as" data-w="' + w + '"><div class="avatar ' + (w === 'b' ? 'b' : '') + ' sm">' + esc(n ? Array.from(n)[0] : '?') + '</div><span class="grow" style="font-weight:650;font-size:17px">' + (n ? '我是 ' + esc(n) : '我是另一位（還沒有名字）') + '</span>' + icon('chevR', 'sm') + '</button>';
      });
      return h + '</div></div>';
    }
    return '<div class="welcome"><div class="logo-mark">' + icon('heart', 'lg') + '</div><h1>我們</h1><p class="lead">只屬於你們兩個的小空間</p>' +
      '<div class="glass card"><div class="label" style="margin-top:0">你的名字</div><input class="field" id="wMe" maxlength="30" placeholder="例如：Blue">' +
      '<div class="label">另一半的名字（可以之後再填）</div><input class="field" id="wOther" maxlength="30" placeholder="例如：Sky">' +
      '<div class="label">你是</div><div class="seg" id="wSex"><button type="button" data-k="m" class="on">男方</button><button type="button" data-k="f">女方</button></div>' +
      '<button class="btn block" style="margin-top:20px" data-act="welcome-start">開始</button></div>' +
      '<button class="btn ghost block" data-act="welcome-join">' + icon('link', 'sm') + '我收到了邀請連結</button></div>';
  }
  function pendingJoin() { try { return JSON.parse(sessionStorage.getItem('us.join') || 'null'); } catch (e) { return null; } }
  function decodeJoin(code) {
    try {
      const b = code.replace(/-/g, '+').replace(/_/g, '/');
      const j = JSON.parse(decodeURIComponent(escape(atob(b))));
      if (j && j.u) return { u: j.u };
    } catch (e) {}
    return null;
  }
  // 邀請連結只帶網址，不帶密碼
  function encodeJoin(u) { return btoa(unescape(encodeURIComponent(JSON.stringify({ u })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  let joinStage = 'pw'; // pw | loading | err | pick
  function startJoin(j) {
    sessionStorage.setItem('us.join', JSON.stringify({ u: j.u }));
    joinStage = 'pw';
    if (location.hash !== '#/welcome') location.hash = '#/welcome'; else render();
  }
  async function submitJoinPw() {
    const j = pendingJoin(); if (!j) return;
    const inp = document.getElementById('joinPw'), btn = document.getElementById('joinPwBtn');
    const pw = inp.value;
    if (!pw) { inp.focus(); return; }
    btn.disabled = true; btn.textContent = '檢查中…';
    try {
      await Sync.test(j.u, pw);
    } catch (e) {
      btn.disabled = false; btn.textContent = '加入';
      inp.value = ''; inp.focus();
      toast(e.message || '連接失敗');
      return;
    }
    const d = Store.device;
    if (d.me) {
      // 已經用緊這部手機的人，只是更新連接
      const changed = d.url !== j.u;
      if (changed) Object.keys(Store.s.records).forEach(id => Store.s.pending[id] = 1);
      Store.setDevice({ url: j.u, key: pw, cursor: changed ? 0 : d.cursor, lastError: '' });
      sessionStorage.removeItem('us.join');
      location.hash = '#/home';
      Sync.startPolling();
      toast('已連接雲端同步', 'cloud');
      return;
    }
    Store.setDevice({ url: j.u, key: pw, cursor: 0, lastError: '' });
    await loadJoin();
  }
  async function loadJoin() {
    joinStage = 'loading'; render();
    await Sync.run(true);
    joinStage = Sync.state === 'err' ? 'err' : 'pick';
    render();
  }

  /* ================= 共用彈出窗 ================= */
  function namesSheet() {
    const s = S(), me = ME(), ot = OT();
    openSheet('<h2>我們的名字</h2><p class="small muted" style="margin-top:-8px">任何一方都可以改，兩部手機會一起更新。</p>' +
      '<div class="label">你（' + (me === 'a' ? '第一位' : '第二位') + '）</div><input class="field" name="me" maxlength="30" value="' + esc(s.names[me]) + '" placeholder="你的名字">' +
      '<div class="label">另一半</div><input class="field" name="ot" maxlength="30" value="' + esc(s.names[ot]) + '" placeholder="另一半的名字">' +
      '<button class="link-btn small" data-swap style="margin-top:14px">' + icon('repeat', 'xs') + '我其實是另一位</button>' +
      '<div class="actions"><button class="btn" data-save>儲存</button></div>', api => {
      api.$('[data-save]').onclick = () => {
        const names = Object.assign({}, S().names);
        names[me] = api.$('[name=me]').value.trim(); names[ot] = api.$('[name=ot]').value.trim();
        setS({ names }); api.close(); toast('已更新', 'check');
      };
      api.$('[data-swap]').onclick = async () => {
        api.close();
        if (await confirmSheet('換成另一位？', '這部手機會變成「' + nm(ot) + '」。', '換')) { Store.setDevice({ me: ot }); toast('你現在是 ' + nm(ME())); }
      };
    });
  }
  function togetherSheet() {
    const s = S();
    openSheet('<h2>你們從甚麼時候在一起？</h2><p class="small muted" style="margin-top:-8px">主頁會數日子，日曆會自動標記每 100 天和每個週年，一直數下去。</p>' +
      '<input type="date" class="field" name="d" value="' + esc(s.together || '') + '">' +
      '<div class="actions">' + (s.together ? '<button class="btn ghost" data-clear>清除</button>' : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      api.$('[data-save]').onclick = () => { const v = api.$('[name=d]').value; if (!D.valid(v)) return; setS({ together: v }); api.close(); toast('在一起第 ' + (D.diff(v, D.today()) + 1) + ' 天', 'heart'); };
      if (s.together) api.$('[data-clear]').onclick = () => { setS({ together: '' }); api.close(); };
    });
  }
  function birthdaySheet() {
    const s = S(), me = ME(), ot = OT();
    openSheet('<h2>生日</h2><p class="small muted" style="margin-top:-8px">日曆每年都會標記，提早提醒對方。</p>' +
      '<div class="label">' + esc(nm(me)) + '</div><input type="date" class="field" name="me" value="' + esc(s.birthday[me] || '') + '">' +
      '<div class="label">' + esc(nm(ot)) + '</div><input type="date" class="field" name="ot" value="' + esc(s.birthday[ot] || '') + '">' +
      '<div class="actions"><button class="btn" data-save>儲存</button></div>', api => {
      api.$('[data-save]').onclick = () => {
        const b = Object.assign({}, S().birthday);
        b[me] = api.$('[name=me]').value || ''; b[ot] = api.$('[name=ot]').value || '';
        setS({ birthday: b }); api.close();
      };
    });
  }
  function inviteSheet() {
    if (!Sync.configured()) {
      openSheet('<h2>邀請你的另一半</h2><p class="muted">要兩部手機同步，先要設定雲端同步（用你們自己的 Google 試算表，大約 5 分鐘）。</p><div class="actions"><button class="btn ghost" data-x>之後再說</button><a href="#/sync" class="btn" data-go>去設定</a></div>', api => {
        api.$('[data-x]').onclick = () => api.close(); api.$('[data-go]').onclick = () => api.close();
      });
      return;
    }
    const link = location.origin + location.pathname + '#join=' + encodeJoin(Store.device.url);
    openSheet('<h2>邀請你的另一半</h2><p class="small muted" style="margin-top:-8px">對方用手機打開這條連結，再輸入你們的密碼就會加入。</p>' +
      '<div class="hint-bar">' + icon('lock', 'xs') + ' 連結裏沒有密碼。請用另一個方法告訴對方密碼，例如當面說，不要和連結放在同一個訊息裏。</div>' +
      '<div class="code-box">' + esc(link) + '</div><div class="actions"><button class="btn ghost" data-copy>' + icon('copy', 'sm') + '複製連結</button>' + (navigator.share ? '<button class="btn" data-share>' + icon('share', 'sm') + '分享</button>' : '') + '</div>', api => {
      api.$('[data-copy]').onclick = async () => { toast((await copyText(link)) ? '已複製' : '複製不到，請手動選取', 'copy'); };
      const sh = api.$('[data-share]');
      if (sh) sh.onclick = () => navigator.share({ title: '我們', text: '加入我們的空間 ♡', url: link }).catch(() => {});
    });
  }
  function howtoSheet() {
    openSheet('<h2>加到主畫面</h2><div class="stack small">' +
      '<div class="row" style="gap:12px">' + icon('share') + '<span><b>iPhone（Safari）</b>：按下面的分享按鈕，揀「加入主畫面」。</span></div>' +
      '<div class="row" style="gap:12px">' + icon('more') + '<span><b>Android（Chrome）</b>：按右上角選單，揀「加到主畫面」或「安裝應用程式」。</span></div>' +
      '</div><p class="small muted">之後在主畫面打開，就會像 app 一樣全螢幕。</p><div class="actions"><button class="btn" data-x>知道了</button></div>', api => { api.$('[data-x]').onclick = () => api.close(); });
  }
  function ideaSheet() {
    const idea = currentIdea();
    openSheet('<div class="eyebrow" style="color:#c0367f">' + icon('spark', 'xs') + '這星期的一張</div><h2 style="margin-top:6px">' + esc(idea.t) + '</h2><p class="small faint" style="margin-top:-10px">' + esc(idea.meta) + '</p>' +
      '<div class="glass card"><div class="small" style="color:#c0367f;font-weight:650">為甚麼有用</div><div style="margin-top:4px">' + esc(idea.d) + '</div></div>' +
      '<div class="glass card"><div class="small muted" style="font-weight:650">怎樣做</div><div style="margin-top:4px">' + esc(idea.how) + '</div></div>' +
      '<div class="actions"><button class="btn ghost" data-wish>' + icon('heart', 'sm') + '存起來</button><button class="btn" data-plan>' + icon('cal', 'sm') + '計劃</button></div>', api => {
      api.$('[data-plan]').onclick = () => { api.close(); planIdea(); };
      api.$('[data-wish]').onclick = () => { api.close(); Store.put('wish', { title: idea.t, note: idea.how, cat: 'do', want: false, link: '', price: '' }); toast('已存到願望清單', 'heart'); };
    });
  }
  function planIdea() {
    const idea = currentIdea(), t = D.today();
    const sat = D.add(t, (6 - D.dow(t) + 7) % 7);
    eventSheet(null, { title: idea.t, date: sat, time: '10:00', cat: 'date' });
  }

  /* ================= 身份、頭像、顏色 ================= */
  function whoamiSheet() {
    const me = ME();
    openSheet('<h2>這部裝置是誰？</h2><p class="small muted" style="margin-top:-8px">每人可以在任何數量的裝置上使用，每部裝置揀一次就可以。螢幕便條、今日問題的答案都會跟着身份走。</p>' +
      ['a', 'b'].map(w => '<button class="opt" data-w="' + w + '">' + avatar(w, 'sm') + '<span>' + esc(nm(w)) + '</span><span class="ck">' + (w === me ? icon('check') : '') + '</span></button>').join(''), api => {
      api.$$('[data-w]').forEach(b => b.onclick = () => {
        const w = b.dataset.w; api.close();
        if (w !== ME()) { Store.setDevice({ me: w }); toast('這部裝置現在是 ' + nm(w), 'check'); }
      });
    });
  }
  function avatarSheet() {
    const me = ME(), ph = avatarPhoto(me);
    openSheet('<h2>我的頭像</h2><div class="center" style="margin:6px 0 18px"><div style="display:inline-block">' + avatar(me, 'xl') + '</div></div>' +
      '<input type="file" accept="image/*" class="hidden" data-file>' +
      '<div class="stack"><button class="btn block" data-up>' + icon('image', 'sm') + (ph ? '換一張相片' : '上載相片') + '</button>' +
      (ph ? '<button class="btn ghost block" data-rm style="color:var(--danger)">' + icon('trash', 'sm') + '移除相片，用名字</button>' : '') + '</div>' +
      '<p class="small faint center" style="margin-top:12px">不上載也可以，會顯示你名字的第一個字。</p>', api => {
      const inp = api.$('[data-file]');
      api.$('[data-up]').onclick = () => inp.click();
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try { const photo = await cropSquare(f, 320); Store.put('avatar', { photo }, 'avatar_' + me); api.close(); toast('頭像已更新', 'check'); }
        catch (e) { toast('讀不到這張相片'); }
      };
      const rm = api.$('[data-rm]'); if (rm) rm.onclick = () => { Store.remove('avatar_' + me, { silent: true }); api.close(); };
    });
  }
  function cropSquare(file, size) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader(); fr.onerror = reject;
      fr.onload = () => { const img = new Image(); img.onerror = reject; img.onload = () => {
        const s = Math.min(img.width, img.height), c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.82));
      }; img.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  const THEMES = [['blue', '天空藍', 'linear-gradient(145deg,#7ab2ff,#2f6bff)'], ['mint', '薄荷綠', 'linear-gradient(145deg,#a3f7de,#1fcf9f)']];
  function applyTheme() {
    const t = Store.device.theme === 'mint' ? 'mint' : 'blue';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('us.theme', t); } catch (e) {}
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = t === 'mint' ? '#e8f8f3' : '#eaf2ff';
  }
  function themeSheet() {
    const cur = Store.device.theme === 'mint' ? 'mint' : 'blue';
    openSheet('<h2>顏色</h2><p class="small muted" style="margin-top:-8px">只改這部裝置，對方可以揀自己喜歡的。</p><div class="two">' +
      THEMES.map(([k, n, g]) => '<button class="glass card theme-pick' + (k === cur ? ' on' : '') + '" data-k="' + k + '"><span class="sw" style="background:' + g + '"></span><b>' + n + '</b></button>').join('') + '</div>', api => {
      api.$$('[data-k]').forEach(b => b.onclick = () => { Store.setDevice({ theme: b.dataset.k }); applyTheme(); api.$$('[data-k]').forEach(z => z.classList.toggle('on', z === b)); });
    });
  }

  /* ================= 檢查更新 ================= */
  App.update = { available: '', notes: '', last: 0 };
  async function checkUpdate(manual) {
    if (!window.APP_VERSION) { if (manual) toast('本機測試版本，不用更新'); return; }
    App.update.last = Date.now();
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j.version && j.version !== window.APP_VERSION) {
        const isNew = App.update.available !== j.version;
        App.update.available = j.version; App.update.notes = j.notes || '';
        if (manual) updateSheet(); else if (isNew) render();
      } else if (manual) toast('已經是最新版本 ' + window.APP_VERSION, 'check');
    } catch (e) { if (manual) toast('檢查不到，請確認有網絡'); }
  }
  function updateSheet() {
    openSheet('<h2>有新版本</h2><p class="muted" style="margin-top:-8px">' + esc(window.APP_VERSION) + ' → <b>' + esc(App.update.available) + '</b></p>' +
      (App.update.notes ? '<div class="glass card small" style="white-space:pre-wrap">' + esc(App.update.notes) + '</div>' : '') +
      '<p class="small muted">你們的資料不會受影響。</p><div class="actions"><button class="btn ghost" data-x>之後</button><button class="btn" data-go>' + icon('refresh', 'sm') + '現在更新</button></div>', api => {
      api.$('[data-x]').onclick = () => api.close();
      api.$('[data-go]').onclick = () => { api.close(); doUpdate(); };
    });
  }
  async function doUpdate() {
    toast('更新中…', 'refresh');
    try {
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
      if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.update().catch(() => {});
    } catch (e) {}
    try { localStorage.setItem('us.ver', App.update.available); } catch (e) {}
    location.reload();
  }

  /* ================= 路由 ================= */
  const PAGES = {
    home: pageHome, question: pageQuestion, todo: pageTodo, lists: pageLists, list: pageList, wishes: pageWishes,
    calendar: pageCalendar, note: pageNote, sections: pageSections, parts: pageParts,
    profile: pageProfile, sync: pageSync, trash: pageTrash, privacy: pagePrivacy, welcome: pageWelcome
  };
  Object.assign(PAGES, App.pages);
  Object.assign(App, { head, row, emptyHTML, render: () => render() });
  const TAB_OF = { home: 'home', question: 'home', note: 'home', sections: 'home', period: 'home', wishes: 'lists', todo: 'todo', lists: 'lists', list: 'lists', calendar: 'calendar', profile: 'profile', sync: 'profile', trash: 'profile', privacy: 'profile', parts: 'profile', know: 'home', plans: 'home', jots: 'home', year: 'home', dolist: 'home', trips: 'home', trip: 'home', triptpl: 'home', capsule: 'home', vault: 'home' };
  function route() {
    const h = location.hash.replace(/^#\/?/, '') || 'home';
    const [name, ...rest] = h.split('/');
    return { name: PAGES[name] ? name : 'home', arg: decodeURIComponent(rest.join('/')) };
  }
  let lastRoute = '';
  let deferred = false;
  function render() {
    let r = route();
    if (!Store.device.me && r.name !== 'welcome') { location.replace('#/welcome'); return; }
    if (Store.device.me && r.name === 'welcome' && !pendingJoin()) { location.replace('#/home'); return; }
    const ae = document.activeElement;
    const same = lastRoute === location.hash;
    const live = ae && ae.hasAttribute && ae.hasAttribute('data-live');
    if (same && !live && ae && view.contains(ae) && /INPUT|TEXTAREA/.test(ae.tagName) && ae.type !== 'checkbox') { deferred = true; return; }
    deferred = false;
    const y = window.scrollY;
    let html = '';
    try { html = PAGES[r.name](r.arg); } catch (e) { console.error(e); html = head('出錯了', esc(e.message)); }
    view.innerHTML = html;
    view.classList.toggle('no-tabs', r.name === 'welcome');
    tabbar.classList.toggle('hidden', r.name === 'welcome');
    tabbar.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === TAB_OF[r.name]));
    view.querySelectorAll('[data-sync-pill]').forEach(renderSyncPill);
    if (same) window.scrollTo(0, y);
    else { window.scrollTo(0, 0); view.classList.remove('page-enter'); void view.offsetWidth; view.classList.add('page-enter'); }
    lastRoute = location.hash;
    if (same && live) { const n = view.querySelector('[data-live]'); if (n) n.focus({ preventScroll: true }); }
    mount(r);
  }
  view.addEventListener('focusout', () => setTimeout(() => { if (deferred && !(document.activeElement && view.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) render(); }, 50));

  function mount(r) {
    if (r.name === 'question') {
      const ta = document.getElementById('ansText');
      ta.addEventListener('input', () => document.getElementById('ansCount').textContent = ta.value.length + '/2000');
    }
    if (r.name === 'note') {
      const ta = document.getElementById('noteText');
      ta.addEventListener('input', () => document.getElementById('noteCount').textContent = ta.value.length + '/140');
      document.getElementById('notePhotoInput').addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try { notePhoto = await compressImage(f, 900, 0.7); drawNotePrev(); } catch (err) { toast('讀不到這張相片'); }
        e.target.value = '';
      });
      drawNotePrev();
    }
    if (r.name === 'calendar') {
      const card = document.getElementById('calCard');
      let x0 = null, y0 = null;
      card.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      card.addEventListener('touchend', e => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1);
        x0 = null;
      });
    }
    if (r.name === 'parts') {
      view.querySelectorAll('[data-part]').forEach(cb => cb.addEventListener('change', () => {
        const sec = Object.assign({}, S().sections, { [cb.dataset.part]: cb.checked });
        setS({ sections: sec });
      }));
    }
    if (r.name === 'profile') {
      document.getElementById('importInput').addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const text = await f.text();
          if (!(await confirmSheet('從備份還原？', '備份裏較新的資料會加回來，不會刪走現有的東西。', '還原'))) return;
          const n = Store.importJSON(text);
          toast('已還原 ' + n + ' 項', 'check');
        } catch (err) { toast(err.message || '讀不到這個檔案'); }
        e.target.value = '';
      });
    }
  }
  function shiftMonth(n) {
    let m = ui.calM + n, y = ui.calY;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    ui.calY = y; ui.calM = m;
    selInMonth();
    render();
  }
  function selInMonth() {
    const t = D.today(), [ty, tm] = D.ymd(t);
    ui.calSel = ty === ui.calY && tm === ui.calM ? t : D.make(ui.calY, ui.calM, 1);
  }

  /* ================= 動作 ================= */
  const ACT = {
    back() { if (lastNav > 0) history.back(); else location.hash = '#/home'; },
    together: togetherSheet, names: namesSheet, birthday: birthdaySheet, invite: inviteSheet, howto: howtoSheet,
    'idea-open': ideaSheet, 'idea-plan': planIdea,
    'idea-next'() {
      const wk = Math.floor(D.diff(Q_EPOCH, D.weekStart(D.today())) / 7);
      const st = Store.device.idea || {};
      Store.setDevice({ idea: { week: wk, shift: (st.week === wk ? st.shift || 0 : 0) + 1 } });
    },
    'ans-save'() {
      const v = document.getElementById('ansText').value.trim();
      if (!v) { toast('寫點甚麼吧'); return; }
      const t = D.today();
      Store.put('answer', { day: t, who: ME(), text: v }, 'ans_' + t + '_' + ME());
      document.activeElement && document.activeElement.blur();
      toast('已儲存 · 連續 ' + streak(ME()) + ' 天', 'flame');
      render();
    },
    'todo-new'() { todoSheet(); },
    'todo-edit'(el) { todoSheet(el.dataset.id); },
    'todo-toggle'(el) {
      const x = Store.get(el.dataset.id); if (!x) return;
      el.classList.toggle('on', !x.done);
      setTimeout(() => Store.patch(x.id, { done: !x.done, doneAt: !x.done ? D.today() : '' }), 180);
    },
    'todo-when'(el) { ui.todoWhen = ui.todoWhen === el.dataset.k ? 'all' : el.dataset.k; render(); },
    'todo-showdone'() { ui.showDone = !ui.showDone; render(); },
    'todo-menu'(el) {
      const t = D.today(), we = D.add(D.weekStart(t), 6);
      const open = openTodos();
      const c = { all: open.length, today: 0, week: 0, later: 0 };
      open.forEach(x => c[todoBucket(x, t, we)]++);
      const trashN = Store.trash().filter(r => r.col === 'todo').length;
      const lbl = { all: '全部', today: '今天', week: '這星期', later: '以後' };
      openMenu(el, '<div class="mh">甚麼時候</div>' + Object.keys(lbl).map(k => '<button class="mi" data-w="' + k + '">' + lbl[k] + '<span class="r">' + c[k] + (ui.todoWhen === k ? icon('check', 'sm') : '<span style="width:18px"></span>') + '</span></button>').join('') +
        '<div class="mh" style="margin-top:6px">誰的</div><div class="chips">' + [['all', '兩個人'], ['me', '我'], ['other', nm(OT())]].map(([k, n]) => '<button class="chip' + (ui.todoWho === k ? ' on' : '') + '" data-who="' + k + '">' + esc(n) + '</button>').join('') + '</div><hr>' +
        '<a class="mi" href="#/trash"><span class="row" style="gap:8px">' + icon('trash', 'sm') + '垃圾桶</span><span class="r">' + trashN + '</span></a>', api => {
        api.el.onclick = e => {
          const w = e.target.closest('[data-w]'), who = e.target.closest('[data-who]'), a = e.target.closest('a');
          if (w) { ui.todoWhen = w.dataset.w; api.close(); render(); }
          if (who) { ui.todoWho = who.dataset.who; api.close(); render(); }
          if (a) api.close();
        };
      });
    },
    'list-new'() { listSheet(); },
    'list-edit'(el) { listSheet(el.dataset.id); },
    'item-toggle'(el) { const x = Store.get(el.dataset.id); if (x) Store.patch(x.id, { done: !x.done }); },
    'item-del'(el) { Store.remove(el.dataset.id); },
    async 'item-clear'(el) {
      const done = Store.all('item').filter(i => i.listId === el.dataset.id && i.done);
      if (await confirmSheet('清除 ' + done.length + ' 項已完成？', '7 天內可以在「最近刪除」還原。', '清除')) done.forEach(i => Store.remove(i.id));
    },
    'wish-new'() { wishSheet(); },
    'wish-edit'(el) { wishSheet(el.dataset.id); },
    'wish-filter'(el) { ui.wishCat = el.dataset.k; render(); },
    'cal-prev'() { shiftMonth(-1); },
    'cal-next'() { shiftMonth(1); },
    'cal-pick': monthPicker,
    'cal-today'() { const [y, m] = D.ymd(D.today()); ui.calY = y; ui.calM = m; ui.calSel = D.today(); render(); },
    'cal-day'(el) { ui.calSel = el.dataset.k; render(); },
    'event-new'(el) { eventSheet(null, { date: (el && el.dataset.k) || ui.calSel || D.today() }); },
    'event-edit'(el) { eventSheet(el.dataset.id); },
    'day-new'() { daySheet(); },
    'day-edit'(el) { daySheet(el.dataset.id); },
    'go-period'() { location.hash = '#/period'; },
    'note-photo'() { document.getElementById('notePhotoInput').click(); },
    'note-photo-x'() { notePhoto = null; drawNotePrev(); },
    'note-send'() {
      const ta = document.getElementById('noteText');
      const text = ta.value.trim();
      if (!text && !notePhoto) { ta.focus(); return; }
      Store.put('note', { text, photo: notePhoto || '' }, 'note_' + ME());
      notePhoto = null; ta.value = ''; ta.blur();
      toast(paired() ? '已放到 ' + nm(OT()) + ' 的螢幕' : '已儲存，對方加入後就會看到', 'phone');
      render();
    },
    async 'note-clear'() { if (await confirmSheet('收回便條？', '對方的主頁不會再顯示。', '收回')) Store.remove('note_' + ME(), { silent: true }); },
    'together-info': togetherInfoSheet,
    whoami: whoamiSheet,
    gender() {
      const male = S().male || 'a';
      openSheet('<h2>誰是男方？</h2><p class="small muted" style="margin-top:-8px">日曆上男方的活動是藍點，女方是綠點，一起的是心形。</p>' +
        ['a', 'b'].map(w => '<button class="opt" data-w="' + w + '">' + avatar(w, 'sm') + '<span>' + esc(nm(w)) + '</span><span class="ck">' + (w === male ? icon('check') : '') + '</span></button>').join(''), api => {
        api.$$('[data-w]').forEach(b => b.onclick = () => { setS({ male: b.dataset.w }); api.close(); toast('男方是 ' + nm(b.dataset.w), 'check'); });
      });
    },
    avatar: avatarSheet,
    theme: themeSheet,
    'check-update'() { if (App.update.available) updateSheet(); else checkUpdate(true); },
    'do-update'() { updateSheet(); },
    'sync-now'() { Sync.run(true).then(() => toast(Sync.state === 'ok' ? '已同步' : '同步失敗：' + Sync.msg, Sync.state === 'ok' ? 'check' : null)); },
    async 'sync-test'() {
      const u = document.getElementById('syncUrl').value.trim(), k = document.getElementById('syncKey').value;
      if (!u || !k) { toast('網址和密碼都要填'); return; }
      try { const j = await Sync.test(u, k); toast('連接成功 · 雲端有 ' + j.rows + ' 筆資料', 'check'); } catch (e) { toast(e.message); }
    },
    async 'sync-save'() {
      const u = document.getElementById('syncUrl').value.trim(), k = document.getElementById('syncKey').value;
      if (!u || !k) { toast('網址和密碼都要填'); return; }
      try { await Sync.test(u, k); } catch (e) { toast(e.message); return; }
      const changed = u !== Store.device.url || k !== Store.device.key;
      if (changed) {
        // 新的雲端：把本機所有資料推上去
        Object.keys(Store.s.records).forEach(id => Store.s.pending[id] = 1);
        Store.setDevice({ url: u, key: k, cursor: 0 });
      } else Store.setDevice({ key: k });
      await Sync.run(true);
      toast(Sync.state === 'ok' ? '已連接，開始同步' : '同步失敗：' + Sync.msg, 'cloud');
      Sync.startPolling();
      render();
    },
    async 'sync-off'() {
      if (!(await confirmSheet('中斷連接？', '這部手機會停止同步，資料保留在手機裏。', '中斷', true))) return;
      Store.setDevice({ url: '', key: '', cursor: 0 }); Sync.setState('off'); render();
    },
    restore(el) {
      const r = Store.rec(el.dataset.id); if (!r) return;
      if (r.col === 'list') Object.values(Store.s.records).forEach(x => { if (x.col === 'item' && x.deleted && x.data.listId === r.id && Math.abs(x.deleted - r.deleted) < 10000) { delete x.data._hidden; Store.restore(x.id); } });
      Store.restore(r.id); toast('已還原', 'undo');
    },
    export() {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'us-backup-' + D.today() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('備份已下載', 'download');
    },
    import() { document.getElementById('importInput').click(); },
    async logout() {
      const warn = Object.keys(Store.s.pending).length ? '還有 ' + Object.keys(Store.s.pending).length + ' 項未同步，會遺失。' : Sync.configured() ? '雲端的資料會保留，用邀請連結可以再登入。' : '你沒有設定雲端同步，這部手機的資料會全部消失。建議先下載備份。';
      if (!(await confirmSheet('在這部手機登出？', warn, '登出', true))) return;
      Store.wipe(); location.hash = '#/welcome'; render();
    },
    'welcome-start'() {
      const a = document.getElementById('wMe').value.trim(), b = document.getElementById('wOther').value.trim();
      if (!a) { document.getElementById('wMe').focus(); toast('先寫你的名字'); return; }
      const sx = (document.querySelector('#wSex .on') || {}).dataset;
      Store.setDevice({ me: 'a' });
      setS({ names: { a, b }, male: sx && sx.k === 'f' ? 'b' : 'a' });
      location.hash = '#/home';
      toast('歡迎，' + a, 'heart');
    },
    'welcome-join'() {
      openSheet('<h2>貼上邀請連結</h2><textarea class="field" name="l" placeholder="https://…#join=…" style="min-height:90px"></textarea><div class="actions"><button class="btn" data-go>加入</button></div>', api => {
        api.$('[data-go]').onclick = () => {
          const v = api.$('[name=l]').value.trim();
          const m = v.match(/join=([A-Za-z0-9_-]+)/);
          const j = m && decodeJoin(m[1]);
          if (!j) { toast('這條連結好像不對'); return; }
          api.close(); startJoin(j);
        };
      });
    },
    'join-as'(el) {
      const w = el.dataset.w;
      const n = (S().names[w] || '').trim();
      const finish = name => {
        Store.setDevice({ me: w });
        if (name) { const names = Object.assign({}, S().names, { [w]: name }); setS({ names }); }
        sessionStorage.removeItem('us.join');
        location.hash = '#/home';
        Sync.startPolling();
        toast('歡迎，' + nm(w), 'heart');
      };
      if (n) return finish('');
      openSheet('<h2>你的名字</h2><input class="field" name="n" maxlength="30" placeholder="你的名字" autofocus><div class="actions"><button class="btn" data-ok>好</button></div>', api => {
        api.$('[data-ok]').onclick = () => { const v = api.$('[name=n]').value.trim(); if (!v) return; api.close(); finish(v); };
      });
    },
    'join-retry'() { loadJoin(); },
    'join-cancel'() { sessionStorage.removeItem('us.join'); if (!Store.device.me) Store.setDevice({ url: '', key: '' }); location.hash = Store.device.me ? '#/home' : '#/welcome'; render(); }
  };

  Object.assign(ACT, App.acts);
  document.addEventListener('click', e => {
    const sb = e.target.closest('#wSex button');
    if (sb) { sb.parentNode.querySelectorAll('button').forEach(z => z.classList.toggle('on', z === sb)); return; }
    const el = e.target.closest('[data-act]');
    if (!el || !ACT[el.dataset.act]) return;
    e.preventDefault();
    ACT[el.dataset.act](el, e);
  });
  document.addEventListener('submit', e => {
    if (e.target.closest('[data-form="join-pw"]')) { e.preventDefault(); submitJoinPw(); return; }
    const g = e.target.closest('[data-form]');
    if (g && App.forms && App.forms[g.dataset.form]) { e.preventDefault(); App.forms[g.dataset.form](g); return; }
    const f = e.target.closest('[data-form="item-add"]');
    if (!f) return;
    e.preventDefault();
    const inp = f.querySelector('input');
    const text = inp.value.trim();
    if (!text) return;
    Store.put('item', { listId: f.dataset.id, text, done: false, order: Date.now() });
    inp.value = '';
  });

  let lastNav = 0;
  window.addEventListener('hashchange', () => {
    lastNav++;
    const h = location.hash;
    if (h.startsWith('#join=')) { const j = decodeJoin(h.slice(6)); history.replaceState(null, '', location.pathname + '#/welcome'); if (j) startJoin(j); return; }
    closeTopSheet();
    render();
  });
  Store.on(() => render());

  /* ================= 啟動 ================= */
  applyTheme();
  if (location.hash.startsWith('#join=')) {
    const j = decodeJoin(location.hash.slice(6));
    history.replaceState(null, '', location.pathname + (Store.device.me ? '#/home' : '#/welcome'));
    if (j) startJoin(j); else render();
  } else {
    render();
  }
  if (Sync.configured() && Store.device.me) Sync.startPolling();
  // 跨日自動更新
  let day = D.today();
  setInterval(() => { if (D.today() !== day) { day = D.today(); render(); } }, 60000);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // 自動檢查更新：打開後幾秒、每 30 分鐘、回到 app 時
  setTimeout(() => checkUpdate(false), 4000);
  setInterval(() => checkUpdate(false), 30 * 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - App.update.last > 10 * 60000) checkUpdate(false); });
  window.__us = { Store, Sync, S, markers, periodDays, render, checkUpdate };
})();
