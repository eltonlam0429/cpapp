/* 經期：記錄、推算四個時期、月曆橫條、感覺記錄、分享設定 */
(function () {
  const A = window.App;
  const PH = {
    men: { n: '月經', c1: '#f39a7b', c2: '#e0567f', desc: '這時候想暖一點、想休息，不是任性。', tip: '準備暖飲和熱水袋，多點體諒和陪伴。' },
    fol: { n: '濾泡期', c1: '#f8d5b0', c2: '#f0a96e', desc: '精神慢慢回來，適合計劃新事情。', tip: '通常比較有精神，可以約去做想做的事。' },
    ovu: { n: '排卵期', c1: '#c7b3ff', c2: '#8b6cf0', desc: '精力和心情通常最好的幾天。', tip: '心情通常不錯，很適合約會。' },
    lut: { n: '黃體期', c1: '#d6deec', c2: '#9fb0cc', desc: '可能容易累或情緒起伏，對自己溫柔一點。', tip: '可能比較容易累或敏感，多點耐心和關心。' }
  };
  const SYM = ['腹痛', '腰痛', '頭痛', '胸脹', '腹脹', '痘痘', '疲倦', '失眠', '想吃甜'];
  const MOOD = ['開心', '平靜', '有活力', '敏感', '煩躁', '低落', '焦慮', '想被抱'];
  const FLOW = [['', '沒有'], ['l', '少'], ['m', '中'], ['h', '多']];

  function info() {
    const s = A.S();
    const recs = Store.all('period').filter(p => D.valid(p.start)).sort((a, b) => a.start < b.start ? -1 : 1);
    const len = s.periodLen || 5;
    const gaps = [];
    for (let i = 1; i < recs.length; i++) { const g = D.diff(recs[i - 1].start, recs[i].start); if (g >= 18 && g <= 60) gaps.push(g); }
    const recent = gaps.slice(-6);
    const cycle = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 28;
    const last = recs[recs.length - 1] || null;
    const next = last ? D.add(last.start, cycle) : null;
    const owner = s.periodOwner || (recs[0] && recs[0]._by) || '';
    const share = s.periodShare || 'all';
    return { recs, len, cycle, last, next, owner, share, avgReal: recent.length > 0 };
  }
  const isOwner = I => !I.owner || I.owner === A.ME();
  function canSee(level, I) {
    I = I || info();
    if (isOwner(I)) return true;
    if (level === 'dates') return I.share !== 'none';
    return I.share === 'all';
  }
  function cycles(I, to) {
    const out = I.recs.map(r => ({ start: r.start, end: r.end && D.valid(r.end) && r.end >= r.start ? r.end : D.add(r.start, I.len - 1), rec: true, id: r.id }));
    if (!I.last) return out;
    let p = D.add(I.last.start, I.cycle), guard = 0;
    const lim = D.add(to, I.cycle);
    while (p <= lim && guard++ < 5000) { out.push({ start: p, end: D.add(p, I.len - 1), rec: false }); p = D.add(p, I.cycle); }
    out.push({ start: p, end: D.add(p, I.len - 1), rec: false });
    return out;
  }
  // 每一天：類型（橫條用）、時期、週期第幾天
  function dayMap(from, to, I) {
    I = I || info();
    const out = {};
    if (!I.last || !canSee('dates', I)) return out;
    const cyc = cycles(I, to);
    for (let i = 0; i < cyc.length - 1; i++) {
      const c = cyc[i], nx = cyc[i + 1].start;
      if (nx <= from) continue;
      if (c.start > to) break;
      const cl = D.diff(c.start, nx);
      const pe = c.end < nx ? c.end : D.add(nx, -1);
      let ov = D.add(nx, -14);
      if (ov <= D.add(pe, 1)) ov = D.add(c.start, Math.max(D.diff(c.start, pe) + 2, Math.floor(cl / 2)));
      const fs = D.add(ov, -5), fe = D.add(ov, 1);
      for (let d = c.start > from ? c.start : from; d < nx && d <= to; d = D.add(d, 1)) {
        let type = null, phase;
        if (d <= pe) { type = c.rec ? 'period' : 'pred'; phase = 'men'; }
        else if (d >= fs && d <= fe) { type = d === ov ? 'ovu' : 'fertile'; phase = 'ovu'; }
        else phase = d < fs ? 'fol' : 'lut';
        out[d] = { type, phase, cday: D.diff(c.start, d) + 1, clen: cl, c, pe, fs, fe, ov, nx };
      }
    }
    return out;
  }
  function log(day) { return Store.get('pd_' + day); }

  /* ---------- 頁面 ---------- */
  const ui = { y: null, m: null };
  function page() {
    const I = info(), t = D.today(), me = A.ME();
    const own = isOwner(I);
    const ownerName = A.nm(I.owner || me);
    let h = A.head('經期', own ? '你的日子，和接下來的事。' : esc(ownerName) + ' 的日子，和接下來的事。', { back: true, right: own ? '<button class="round-btn" data-act="p-settings" aria-label="設定">' + icon('sliders', 'sm') + '</button>' : '' });
    if (!canSee('dates', I)) {
      return h + '<div class="empty"><div class="bubble glass">' + icon('lock', 'lg') + '</div><h3>' + esc(ownerName) + ' 沒有分享</h3><p>對方可以在經期設定裏改。</p></div>';
    }
    if (!I.last) {
      h += '<div class="glass card hero" style="padding:24px"><div class="q-title" style="margin-top:0">' + (own ? '你還沒記下甚麼。' : '還沒有記錄。') + '</div><div class="muted">' + (own ? '標記經期開始的那天，其餘的會自己排好。' : esc(ownerName) + ' 記錄之後，這裏就會出現。') + '</div>' +
        (own ? '<div class="hero-actions"><button class="btn sm" data-act="p-start-today">經期今天開始了</button><button class="btn ghost sm" data-act="p-add">選另一天</button></div>' : '') + '</div>';
      return h + calendarCard(I);
    }
    const map = dayMap(t, t, I);
    const x = map[t];
    if (x) {
      const ph = PH[x.phase];
      const late = !x.c.rec && x.phase === 'men' ? D.diff(x.c.start, t) : -1;
      let title;
      if (x.phase === 'men') title = x.c.rec ? '經期第 ' + x.cday + ' 天' : late === 0 ? '經期可能今天開始' : '經期遲了 ' + late + ' 天';
      else if (x.type === 'ovu') title = '今天大約是排卵日';
      else title = ph.n;
      const desc = own ? ph.desc : esc(ownerName) + ' ' + ph.tip;
      const daysToNext = D.diff(t, x.nx);
      const curRec = x.c.rec ? I.recs.find(r => r.id === x.c.id) : null;
      const inOpen = curRec && x.phase === 'men' && !curRec.end;
      const lg = log(t);
      h += '<div class="glass card" style="padding:20px">' +
        '<div class="small muted">今天 · ' + D.md(t) + '</div>' +
        '<div class="row" style="gap:16px;margin-top:10px;align-items:flex-start">' +
        '<div class="pcircle" style="background:linear-gradient(145deg,' + ph.c1 + ',' + ph.c2 + ')"><b>' + x.cday + '</b><span>天</span></div>' +
        '<div class="grow"><div style="font-size:22px;font-weight:750">' + title + '</div><div class="muted small" style="margin-top:4px">' + desc + '</div>' +
        (own ? '<button class="link-btn small" style="margin-top:8px;color:#c0367f" data-act="p-mood" data-k="' + t + '">' + (lg ? '改今天的感覺' : '記下我的感覺') + icon('chevR', 'xs') + '</button>' : '') + '</div></div>' +
        phaseBar(x) +
        (lg && canSee('all', I) ? '<div style="margin-top:12px">' + logChips(lg, own) + '</div>' : '') +
        '<hr style="border:0;height:1px;background:var(--line);margin:16px 0 8px">' +
        '<div class="set-row"><span class="muted">下次經期</span><b>' + (daysToNext > 0 ? daysToNext + ' 天後' : '今天') + '</b></div>' +
        '<div class="set-row"><span class="muted">大約</span><span>' + D.md(x.nx) + ' 週' + D.WD[D.dow(x.nx)] + '</span></div>' +
        '<div class="set-row"><span class="muted">平均週期</span><span>' + I.cycle + ' 天' + (I.avgReal ? '' : '（預設）') + '</span></div>' +
        (own ? '<div class="hero-actions">' + (inOpen ? '<button class="btn sm" data-act="p-end-today" data-id="' + curRec.id + '">經期結束了</button>' : x.phase === 'men' && x.c.rec ? '' : '<button class="btn sm" data-act="p-start-today">經期今天開始了</button>') + '<button class="btn ghost sm" data-act="p-add">記錄另一天</button></div>' : '') +
        '</div>';
    }
    h += '<div class="hint-bar">這是根據以前的週期推算的。不能用作避孕方法。</div>';
    h += calendarCard(I);
    h += '<div class="section-h">之前的記錄</div><div class="glass card tight list no-icon">' + I.recs.slice().reverse().map((r, i, arr) => {
      const prev = arr[i + 1];
      const len = r.end ? D.diff(r.start, r.end) + 1 : null;
      const s = [len ? len + ' 天' : '沒有記錄結束', prev ? '週期 ' + D.diff(prev.start, r.start) + ' 天' : ''].filter(Boolean).join(' · ');
      return own ? A.row({ act: 'p-edit', id: r.id, t: D.ymdText(r.start), s }) : A.row({ t: D.ymdText(r.start), s, noChev: true });
    }).join('') + '</div>';
    return h;
  }
  function phaseBar(x) {
    const cl = x.clen;
    const men = D.diff(x.c.start, x.pe) + 1;
    const fol = Math.max(0, D.diff(x.pe, x.fs) - 1);
    const ovu = D.diff(x.fs, x.fe) + 1;
    const lut = Math.max(0, cl - men - fol - ovu);
    const pos = Math.min(99, Math.max(1, (x.cday - 0.5) / cl * 100));
    const seg = (k, n) => n > 0 ? '<i style="flex:' + n + ';background:' + (k === x.phase ? PH[k].c2 : PH[k].c1) + '"></i>' : '';
    return '<div class="pbar">' + seg('men', men) + seg('fol', fol) + seg('ovu', ovu) + seg('lut', lut) + '<span class="pmark" style="left:' + pos + '%"></span></div>' +
      '<div class="plegend4">' + ['men', 'fol', 'ovu', 'lut'].map(k => '<span' + (k === x.phase ? ' class="on"' : '') + '><i style="background:' + PH[k].c2 + '"></i>' + PH[k].n + '</span>').join('') + '</div>';
  }
  function logChips(lg, own) {
    const parts = [];
    const fl = FLOW.find(f => f[0] === lg.flow);
    if (lg.flow) parts.push('<span class="tag pink">流量 ' + fl[1] + '</span>');
    (lg.sym || []).forEach(s => parts.push('<span class="tag gray">' + esc(s) + '</span>'));
    (lg.mood || []).forEach(s => parts.push('<span class="tag">' + esc(s) + '</span>'));
    let h = parts.length ? '<div class="chips" style="gap:6px">' + parts.join('') + '</div>' : '';
    if (own && lg.note) h += '<div class="small muted" style="margin-top:8px">' + icon('lock', 'xs') + ' ' + esc(lg.note) + '</div>';
    return h;
  }
  function calendarCard(I) {
    const t = D.today();
    if (ui.y == null) { const [y, m] = D.ymd(t); ui.y = y; ui.m = m; }
    const y = ui.y, m = ui.m;
    const first = D.make(y, m, 1), dim = D.daysInMonth(y, m), last = D.make(y, m, dim);
    const map = dayMap(D.add(first, -1), D.add(last, 1), I);
    const grp = k => { const z = map[k]; if (!z || !z.type) return ''; return z.type === 'ovu' || z.type === 'fertile' ? 'fert' : z.type; };
    const lead = (D.dow(first) + 6) % 7;
    let h = '<div class="glass card" id="pcalCard"><div class="cal-head"><button class="cal-nav" data-act="pcal-move" data-d="-1">' + icon('chevL') + '</button><b style="font-size:19px">' + y + '年' + m + '月</b><button class="cal-nav" data-act="pcal-move" data-d="1">' + icon('chevR') + '</button></div>';
    h += '<div class="pcal-grid">' + ['一', '二', '三', '四', '五', '六', '日'].map(w => '<div class="wd">週' + w + '</div>').join('');
    for (let i = 0; i < lead; i++) h += '<div></div>';
    const showLog = canSee('all', I);
    for (let d = 1; d <= dim; d++) {
      const k = D.make(y, m, d), z = map[k], g = grp(k);
      const col = (lead + d - 1) % 7;
      const cls = ['pd'];
      if (g) {
        cls.push('b-' + (z.type === 'ovu' ? 'ovu b-fertile' : z.type));
        if (col === 0 || d === 1 || grp(D.add(k, -1)) !== g) cls.push('bs');
        if (col === 6 || d === dim || grp(D.add(k, 1)) !== g) cls.push('be');
      }
      if (k === t) cls.push('today');
      h += '<button class="' + cls.join(' ') + '" data-act="p-day" data-k="' + k + '"><span class="band"></span><span class="num">' + d + '</span>' + (showLog && log(k) ? '<i class="pdot"></i>' : '') + '</button>';
    }
    h += '</div>';
    const [ty, tm] = D.ymd(t);
    if (ty !== y || tm !== m) h += '<div class="center" style="margin-top:6px"><button class="link-btn small" data-act="pcal-today">回到今天</button></div>';
    h += '<div class="plegend"><span><i style="background:#e0567f"></i>經期</span><span><i style="background:rgba(240,115,153,.25)"></i>預計的經期</span><span><i style="background:rgba(167,139,250,.35)"></i>易孕期</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px #8b6cf0"></i>排卵日</span></div></div>';
    return h;
  }

  /* ---------- 彈出窗 ---------- */
  function ensureOwner() { if (!A.S().periodOwner) A.setS({ periodOwner: A.ME() }); }
  function recordSheet(id, preset) {
    const x = id ? Store.get(id) : Object.assign({ start: D.today(), end: '' }, preset);
    openSheet('<h2>' + (id ? '這次經期' : '記錄一次經期') + '</h2><div class="label">開始</div><input type="date" class="field" name="start" value="' + esc(x.start) + '"><div class="label">結束（可選，還沒結束就留空）</div><input type="date" class="field" name="end" value="' + esc(x.end || '') + '">' +
      '<div class="actions">' + (id ? '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      api.$('[data-save]').onclick = () => {
        const start = api.$('[name=start]').value; let end = api.$('[name=end]').value;
        if (!D.valid(start)) return;
        if (end && end < start) end = '';
        ensureOwner();
        Store.put('period', { start, end }, id); api.close(); toast('已記錄', 'drop');
      };
      if (id) api.$('[data-del]').onclick = () => { Store.remove(id); api.close(); };
    });
  }
  function moodSheet(day) {
    const x = log(day) || { flow: '', sym: [], mood: [], note: '' };
    const chips = (arr, sel, name) => '<div class="chips" data-multi="' + name + '">' + arr.map(s => '<button type="button" class="chip' + (sel.includes(s) ? ' on' : '') + '" data-v="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>';
    openSheet('<h2>' + D.full(day) + '</h2>' +
      '<div class="label">流量</div><div class="seg" data-flow>' + FLOW.map(([k, n]) => '<button type="button" data-k="' + k + '" class="' + (x.flow === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div class="label">身體</div>' + chips(SYM, x.sym || [], 'sym') +
      '<div class="label">心情</div>' + chips(MOOD, x.mood || [], 'mood') +
      '<div class="label">' + icon('lock', 'xs') + ' 筆記（只有你看到）</div><textarea class="field" name="note" maxlength="500" style="min-height:80px" placeholder="今天怎樣？">' + esc(x.note || '') + '</textarea>' +
      '<div class="actions">' + (log(day) ? '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      let flow = x.flow || '';
      api.$('[data-flow]').onclick = e => { const b = e.target.closest('button'); if (!b) return; flow = b.dataset.k; api.$$('[data-flow] button').forEach(z => z.classList.toggle('on', z === b)); };
      api.$$('[data-multi]').forEach(box => box.onclick = e => { const b = e.target.closest('.chip'); if (b) b.classList.toggle('on'); });
      const pick = n => api.$$('[data-multi="' + n + '"] .chip.on').map(b => b.dataset.v);
      api.$('[data-save]').onclick = () => {
        ensureOwner();
        Store.put('pday', { date: day, flow, sym: pick('sym'), mood: pick('mood'), note: api.$('[name=note]').value.trim() }, 'pd_' + day);
        api.close(); toast('已記下', 'check');
      };
      const del = api.$('[data-del]');
      if (del) del.onclick = () => { Store.remove('pd_' + day, { silent: true }); api.close(); };
    });
  }
  function daySheet(day) {
    const I = info(), own = isOwner(I);
    const z = dayMap(day, day, I)[day];
    const rec = I.recs.find(r => { const e = r.end || D.add(r.start, I.len - 1); return day >= r.start && day <= e; });
    let label = '沒有推算';
    if (z) label = (z.type === 'ovu' ? '大約是排卵日' : z.type === 'pred' ? '預計的經期' : PH[z.phase].n) + ' · 週期第 ' + z.cday + ' 天';
    const lg = log(day);
    openSheet('<h2>' + D.full(day) + '</h2><p class="muted" style="margin-top:-8px">' + label + '</p>' +
      (lg && canSee('all', I) ? logChips(lg, own) : '') +
      (own ? '<div class="stack" style="margin-top:16px"><button class="btn block" data-mood>' + icon('heart', 'sm') + (lg ? '改這天的感覺' : '記下這天的感覺') + '</button>' +
        (rec ? '<button class="btn ghost block" data-edit>' + icon('pencil', 'sm') + '編輯這次經期</button>' : (day <= D.today() ? '<button class="btn ghost block" data-start>' + icon('drop', 'sm') + '這天經期開始</button>' : '')) + '</div>' : ''), api => {
      const b1 = api.$('[data-mood]'); if (b1) b1.onclick = () => { api.close(); moodSheet(day); };
      const b2 = api.$('[data-edit]'); if (b2) b2.onclick = () => { api.close(); recordSheet(rec.id); };
      const b3 = api.$('[data-start]'); if (b3) b3.onclick = () => { api.close(); ensureOwner(); Store.put('period', { start: day, end: '' }); toast('已記錄', 'drop'); };
    });
  }
  function settingsSheet() {
    const I = info(), s = A.S(), me = A.ME(), ot = A.OT();
    const owner = I.owner || me;
    const shares = [['none', 'lock', '甚麼都看不到'], ['dates', 'heart', '經期的日子，和下次甚麼時候來'], ['all', 'userPlus', '連症狀和心情也看到']];
    openSheet('<h2>經期設定</h2>' +
      '<div class="label">這是誰的記錄</div><div class="seg" data-owner>' + [me, ot].map(w => '<button type="button" data-k="' + w + '" class="' + (owner === w ? 'on' : '') + '">' + esc(A.nm(w)) + '</button>').join('') + '</div>' +
      '<div class="label">你的另一半看到甚麼</div><div data-share>' + shares.map(([k, ic, n]) => '<button type="button" class="opt" data-k="' + k + '">' + icon(ic, 'sm') + '<span>' + n + '</span><span class="ck">' + (I.share === k ? icon('check') : '') + '</span></button>').join('') + '</div>' +
      '<p class="small faint" style="margin:4px 4px 0">當天的筆記，在任何情況下都不會分享。</p>' +
      '<div class="set-row" style="margin-top:12px"><div><div style="font-weight:600">經期長度</div><div class="small muted">沒有記錄結束日時用這個</div></div><div class="row" style="gap:6px"><button class="round-btn" style="width:36px;height:36px" data-len="-1">−</button><b style="width:28px;text-align:center" data-lenv>' + I.len + '</b><button class="round-btn" style="width:36px;height:36px" data-len="1">+</button></div></div>' +
      '<div class="actions"><button class="btn" data-x>完成</button></div>', api => {
      api.$('[data-owner]').onclick = e => { const b = e.target.closest('button'); if (!b) return; api.$$('[data-owner] button').forEach(z => z.classList.toggle('on', z === b)); A.setS({ periodOwner: b.dataset.k }); };
      api.$('[data-share]').onclick = e => { const b = e.target.closest('.opt'); if (!b) return; api.$$('[data-share] .ck').forEach(c => c.innerHTML = ''); b.querySelector('.ck').innerHTML = icon('check'); A.setS({ periodShare: b.dataset.k }); };
      api.$$('[data-len]').forEach(b => b.onclick = () => { const v = Math.max(2, Math.min(10, (A.S().periodLen || 5) + Number(b.dataset.len))); A.setS({ periodLen: v }); api.$('[data-lenv]').textContent = v; });
      api.$('[data-x]').onclick = () => api.close();
    });
  }

  /* ---------- 給其他地方用 ---------- */
  function homeText() {
    const I = info();
    if (!canSee('dates', I)) return null;
    if (!I.last) return isOwner(I) ? '記錄第一次' : '還沒有記錄';
    const t = D.today(), z = dayMap(t, t, I)[t];
    if (!z) return '';
    if (z.phase === 'men') { if (z.c.rec) return '經期第 ' + z.cday + ' 天'; const late = D.diff(z.c.start, t); return late === 0 ? '可能今天開始' : '遲了 ' + late + ' 天'; }
    const n = D.diff(t, z.nx);
    return PH[z.phase].n + ' · ' + n + ' 天後經期';
  }
  function nextMarker() {
    const I = info();
    if (!canSee('dates', I) || !I.last) return null;
    const t = D.today(), z = dayMap(t, t, I)[t];
    return z ? z.nx : I.next;
  }

  A.period = { info, dayMap, canSee, homeText, nextMarker };
  A.pages.period = page;
  Object.assign(A.acts, {
    'p-start-today'() { ensureOwner(); Store.put('period', { start: D.today(), end: '' }); toast('已記錄', 'drop'); },
    'p-end-today'(el) { Store.patch(el.dataset.id, { end: D.today() }); toast('已記錄', 'check'); },
    'p-add'() { recordSheet(); },
    'p-edit'(el) { recordSheet(el.dataset.id); },
    'p-mood'(el) { moodSheet(el.dataset.k); },
    'p-day'(el) { daySheet(el.dataset.k); },
    'p-settings': settingsSheet,
    'pcal-move'(el) { let m = ui.m + Number(el.dataset.d), y = ui.y; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } ui.y = y; ui.m = m; A.render(); },
    'pcal-today'() { const [y, m] = D.ymd(D.today()); ui.y = y; ui.m = m; A.render(); },
    'go-period'() { location.hash = '#/period'; }
  });
})();
