/* 經期：記錄、推算四個時期、月曆橫條、感覺記錄、分享設定 */
(function () {
  const A = window.App;
  // 四個時期：進度條、圖例圓點、圓圈、時間表都用同一個顏色
  const PH = {
    men: { n: '月經', c: '#e0567f', desc: '這時候想暖一點、想休息，不是任性。', tip: '準備暖飲和熱水袋，多點體諒和陪伴。' },
    fol: { n: '濾泡期', c: '#f2a93b', desc: '精神慢慢回來，適合計劃新事情。', tip: '通常比較有精神，可以約去做想做的事。' },
    ovu: { n: '排卵期', c: '#8b6cf0', desc: '精力和心情通常最好的幾天。', tip: '心情通常不錯，很適合約會。' },
    lut: { n: '黃體期', c: '#3fb0c6', desc: '可能容易累或情緒起伏，對自己溫柔一點。', tip: '可能比較容易累或敏感，多點耐心和關心。' }
  };
  const LUTEAL = 14; // 黃體期通常很穩定，大約 14 天；排卵日 = 下次經期前 14 天
  const SYM = ['腹痛', '腰痛', '頭痛', '胸脹', '腹脹', '痘痘', '疲倦', '失眠', '想吃甜'];
  const MOOD = ['開心', '平靜', '有活力', '敏感', '煩躁', '低落', '焦慮', '想被抱'];
  const FLOW = [['', '沒有'], ['l', '少'], ['m', '中'], ['h', '多']];
  const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  /* 根據記錄自動估算：
     - 週期：最近 6 個正常週期的加權平均（越近越重要），太長或太短的（例如漏記了一次）不計入
     - 經期長度：有記錄結束日的那幾次的平均；未有就用設定
     - 排卵日：下次經期前 14 天；易孕期：排卵日前 5 天到後 1 天 */
  function info() {
    const s = A.S();
    const recs = Store.all('period').filter(p => D.valid(p.start)).sort((a, b) => a.start < b.start ? -1 : 1);
    const gaps = [];
    for (let i = 1; i < recs.length; i++) {
      const g = D.diff(recs[i - 1].start, recs[i].start);
      if (g >= 1) gaps.push({ id: recs[i].id, prev: recs[i - 1].start, g, confirmed: !!recs[i].confirmed });
    }
    const med = median(gaps.map(x => x.g));
    // 正常範圍：和中位數相差 10 天內，而且 18–60 天；範圍外的要你核實，核實了就一樣計入
    const normal = x => Math.abs(x.g - med) <= 10 && x.g >= 18 && x.g <= 60;
    const good = gaps.filter(x => normal(x) || x.confirmed);
    const unusual = gaps.filter(x => !normal(x) && !x.confirmed);
    const recent = good.slice(-6);
    let cycle = 28;
    if (recent.length) { let sw = 0, sg = 0; recent.forEach((x, i) => { const w = i + 1; sw += w; sg += x.g * w; }); cycle = Math.round(sg / sw); }
    const lens = recs.filter(r => D.valid(r.end) && r.end >= r.start).map(r => D.diff(r.start, r.end) + 1).filter(n => n >= 1 && n <= 15);
    const recentLens = lens.slice(-6);
    const len = recentLens.length ? Math.round(recentLens.reduce((a, b) => a + b, 0) / recentLens.length) : (s.periodLen || 5);
    const last = recs[recs.length - 1] || null;
    const next = last ? D.add(last.start, cycle) : null;
    const owner = s.periodWho === 'a' || s.periodWho === 'b' ? s.periodWho : 'b'; // 預設：第二位，可以在經期設定改
    const share = s.periodShare || 'all';
    const gs = good.map(x => x.g);
    const mean = gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : 0;
    const sd = gs.length > 1 ? Math.sqrt(gs.reduce((a, g) => a + (g - mean) * (g - mean), 0) / (gs.length - 1)) : 0;
    const stat = {
      n: recs.length, cycles: gaps.length, used: good.length,
      avg: gs.length ? Math.round(mean * 10) / 10 : null,
      min: gs.length ? Math.min(...gs) : null,
      max: gs.length ? Math.max(...gs) : null,
      sd, avgLen: lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length * 10) / 10 : null,
      goodIds: new Set(good.map(x => x.id)), unusualIds: new Set(unusual.map(x => x.id)), med, gaps
    };
    return { recs, len, cycle, last, next, owner, share, avgReal: recent.length > 0, lenReal: recentLens.length > 0, stat };
  }
  const isOwner = I => !I.owner || I.owner === A.ME();
  // 兩個人都可以記錄和修改（除非她選了不分享）；私人筆記只有本人看到
  const canEdit = I => isOwner(I) || I.share === 'all';
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
      let ov = D.add(nx, -LUTEAL);
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
    const own = isOwner(I), edit = canEdit(I);
    const ownerName = A.nm(I.owner || me);
    let h = A.head('經期', own ? '你的日子，和接下來的事。' : esc(ownerName) + ' 的日子，和接下來的事。', { back: true, trash: 'period', right: '<button class="round-btn" data-act="p-settings" aria-label="設定">' + icon('sliders', 'sm') + '</button>' });
    if (!canSee('dates', I)) {
      return h + '<div class="empty"><div class="bubble glass">' + icon('lock', 'lg') + '</div><h3>' + esc(ownerName) + ' 沒有分享</h3><p>對方可以在經期設定裏改。</p></div>';
    }
    if (!I.last) {
      h += '<div class="glass card hero" style="padding:24px"><div class="q-title" style="margin-top:0">' + (own ? '你還沒記下甚麼。' : '還沒有記錄。') + '</div><div class="muted">' + (own ? '標記經期開始的那天，其餘的會自己排好。' : esc(ownerName) + ' 記錄之後，這裏就會出現。') + '</div>' +
        (edit ? '<div class="hero-actions"><button class="btn sm" data-act="p-start-today">經期今天開始了</button><button class="btn ghost sm" data-act="p-add">選另一天</button></div><div class="center" style="margin-top:10px"><button class="link-btn small" data-act="p-bulk">' + icon('plus', 'xs') + '補記過往記錄</button></div>' : '') + '</div>';
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
        '<div class="pcircle" style="background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(255,255,255,0)),' + ph.c + ';box-shadow:0 10px 24px ' + ph.c + '40"><b>' + x.cday + '</b><span>天</span></div>' +
        '<div class="grow"><div style="font-size:22px;font-weight:750">' + title + '</div><div class="muted small" style="margin-top:4px">' + desc + '</div>' +
        (edit ? '<button class="link-btn small" style="margin-top:8px;color:#c0367f" data-act="p-mood" data-k="' + t + '">' + (lg ? '改今天的感覺' : own ? '記下我的感覺' : '幫 ' + esc(ownerName) + ' 記下感覺') + icon('chevR', 'xs') + '</button>' : '') + '</div></div>' +
        phaseBar(x) + timeline(x, t) +
        (lg && canSee('all', I) ? '<div style="margin-top:12px">' + logChips(lg, own) + '</div>' : '') +
        '<hr style="border:0;height:1px;background:var(--line);margin:16px 0 8px">' +
        '<div class="set-row"><span class="muted">下次經期</span><b>' + (daysToNext > 0 ? daysToNext + ' 天後' : '今天') + '</b></div>' +
        '<div class="set-row"><span class="muted">大約</span><span>' + D.md(x.nx) + ' 週' + D.WD[D.dow(x.nx)] + '</span></div>' +
        '<div class="set-row"><span class="muted">估算週期</span><span>' + I.cycle + ' 天' + (I.avgReal ? '' : '（預設，記錄兩次後自動計算）') + '</span></div>' +
        '<div class="set-row"><span class="muted">估算經期長度</span><span>' + I.len + ' 天' + (I.lenReal ? '' : '（設定值）') + '</span></div>' +
        (edit ? '<div class="hero-actions">' + (inOpen ? '<button class="btn sm" data-act="p-end-today" data-id="' + curRec.id + '">經期結束了</button>' : x.phase === 'men' && x.c.rec ? '' : '<button class="btn sm" data-act="p-start-today">經期今天開始了</button>') + '<button class="btn ghost sm" data-act="p-add">記錄另一天</button></div>' : '') +
        '</div>';
    }
    h += '<div class="hint-bar">這是根據以前的週期推算的。不能用作避孕方法。</div>';
    h += calendarCard(I);
    h += statsCard(I);
    const desc = I.recs.slice().sort((a, b) => a.start < b.start ? 1 : -1); // 最新在最上面
    h += '<div class="section-h">之前的記錄' + (edit ? '<button class="link-btn small" data-act="p-bulk">' + icon('plus', 'xs') + '補記過往記錄</button>' : '') + '</div>';
    h += '<div class="glass card tight list no-icon">' + desc.map((r, i) => {
      const older = desc[i + 1];
      const len = r.end ? D.diff(r.start, r.end) + 1 : null;
      const lines = [len ? '經期 ' + len + ' 天' : '沒有記錄結束'];
      if (older) lines.push('距上一次（' + D.md(older.start) + '）' + D.diff(older.start, r.start) + ' 天');
      else lines.push('最早的記錄');
      if (i === 0) lines.push('現在是這個週期第 ' + (D.diff(r.start, t) + 1) + ' 天');
      let tag = '';
      if (I.stat.unusualIds.has(r.id)) tag = '<button class="tag red" data-act="p-verify" data-id="' + r.id + '" style="margin-top:6px">' + icon('help', 'xs') + '不尋常 · 請核實</button>';
      else if (r.confirmed && older) tag = '<button class="tag" data-act="p-verify" data-id="' + r.id + '" style="margin-top:6px">' + icon('check', 'xs') + '已核實，有計入</button>';
      const ttl = D.ymdText(r.start) + (r.end ? ' – ' + D.md(r.end) : '');
      return '<div class="li"><' + (edit ? 'button data-act="p-edit" data-id="' + r.id + '"' : 'div') + ' class="grow" style="text-align:left"><div class="tt">' + ttl + '</div><div class="ts">' + lines.join(' · ') + '</div></' + (edit ? 'button' : 'div') + '>' +
        (tag ? '<div>' + tag + '</div>' : '') + (edit ? '<span class="chev">' + icon('chevR', 'sm') + '</span>' : '') + '</div>';
    }).join('') + '</div>' + (edit ? '<p class="small faint" style="margin:-4px 4px 14px">「距上一次」是由上一次經期開始那天，數到這一次開始那天。輸入錯了？按記錄就可以改日子或者刪除。</p>' : '');
    return h;
  }
  function phaseBar(x) {
    const cl = x.clen;
    const men = D.diff(x.c.start, x.pe) + 1;
    const fol = Math.max(0, D.diff(x.pe, x.fs) - 1);
    const ovu = D.diff(x.fs, x.fe) + 1;
    const lut = Math.max(0, cl - men - fol - ovu);
    const pos = Math.min(99, Math.max(1, (x.cday - 0.5) / cl * 100));
    const seg = (k, n) => n > 0 ? '<i style="flex:' + n + ';background:' + PH[k].c + (k === x.phase ? '' : ';opacity:.85') + '"></i>' : '';
    return '<div class="pbar">' + seg('men', men) + seg('fol', fol) + seg('ovu', ovu) + seg('lut', lut) + '<span class="pmark" style="left:' + pos + '%"></span></div>' +
      '<div class="plegend4">' + ['men', 'fol', 'ovu', 'lut'].map(k => '<span' + (k === x.phase ? ' class="on"' : '') + '><i style="background:' + PH[k].c + '"></i>' + PH[k].n + '</span>').join('') + '</div>';
  }
  // 這個週期每個時期由幾時到幾時
  function timeline(x, t) {
    const rng = (a, b) => a > b ? null : [a, b];
    const rows = [
      ['men', rng(x.c.start, x.pe)],
      ['fol', rng(D.add(x.pe, 1), D.add(x.fs, -1))],
      ['ovu', rng(x.fs > D.add(x.pe, 1) ? x.fs : D.add(x.pe, 1), x.fe)],
      ['lut', rng(D.add(x.fe, 1), D.add(x.nx, -1))]
    ].filter(r => r[1]);
    const fmt = d => D.md(d);
    let h = '<div class="ptl">' + rows.map(([k, [a, b]]) => {
      const n = D.diff(a, b) + 1, cur = t >= a && t <= b;
      return '<div class="ptl-row' + (cur ? ' on' : '') + '"><i style="background:' + PH[k].c + '"></i><span class="pn">' + PH[k].n + '</span><span class="pd2">' + fmt(a) + (a !== b ? ' – ' + fmt(b) : '') + '</span><span class="pl">' + n + ' 天</span></div>';
    }).join('') + '</div>';
    h += '<div class="small muted" style="margin-top:6px">' + icon('spark', 'xs') + ' 排卵日大約 ' + D.md(x.ov) + ' 週' + D.WD[D.dow(x.ov)] + (x.c.rec ? '' : '（預計）') + '</div>';
    return h;
  }
  function statsCard(I) {
    const st = I.stat;
    if (st.n < 2) return '<div class="glass card"><b>統計</b><div class="small muted" style="margin-top:6px">記錄兩次或以上就會顯示平均週期、最長和最短週期。可以用「補記過往記錄」一次過輸入以前的日子。</div></div>';
    const reg = st.used < 2 ? '' : st.sd <= 2 ? '很規律' : st.sd <= 4 ? '大致規律' : '不太規律';
    const tile = (v, l) => '<div class="pstat"><b>' + v + '</b><span>' + l + '</span></div>';
    let h = '<div class="glass card"><div class="row between"><b>統計</b><span class="small muted">' + st.n + ' 次記錄 · ' + st.cycles + ' 個週期</span></div><div class="pstats">' +
      tile(st.avg != null ? st.avg + ' 天' : '—', '平均週期') +
      tile(st.min != null ? st.min + ' 天' : '—', '最短週期') +
      tile(st.max != null ? st.max + ' 天' : '—', '最長週期') +
      tile(st.avgLen != null ? st.avgLen + ' 天' : '—', '平均經期') +
      tile(reg ? reg : '—', '規律程度' + (reg ? '（±' + Math.round(st.sd * 10) / 10 + ' 天）' : '')) +
      tile(I.cycle + ' 天', '下次估算用') + '</div>' +
      (st.unusualIds.size ? '<div class="small" style="margin-top:8px;color:var(--danger)">' + icon('help', 'xs') + ' 有 ' + st.unusualIds.size + ' 個週期比平常長或短很多，請在下面「之前的記錄」核實。核實之前暫時不計入估算（灰色）。</div>' : '');
    // 最近 8 個週期的長度
    const g = st.gaps.slice(-8);
    if (g.length >= 2) {
      const mx = Math.max(...g.map(x => x.g)), mn = Math.min(...g.map(x => x.g)), lo = Math.max(0, mn - 6);
      h += '<div class="label" style="margin:14px 0 6px">最近的週期長度</div><div class="pbars">' + g.map(x => '<div><em>' + x.g + '</em><i style="height:' + Math.round((x.g - lo) / (mx - lo || 1) * 70 + 20) + '%;' + (st.goodIds.has(x.id) ? '' : 'background:#c9cfdb') + '"></i></div>').join('') + '</div>';
    }
    return h + '</div>';
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
    const lead = D.dow(first); // 星期日開始
    let h = '<div class="glass card" id="pcalCard"><div class="cal-head"><button class="cal-nav" data-act="pcal-move" data-d="-1">' + icon('chevL') + '</button><b style="font-size:19px">' + y + '年' + m + '月</b><button class="cal-nav" data-act="pcal-move" data-d="1">' + icon('chevR') + '</button></div>';
    h += '<div class="pcal-grid">' + ['日', '一', '二', '三', '四', '五', '六'].map(w => '<div class="wd">' + w + '</div>').join('');
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
    h += '<div class="plegend"><span><i style="background:' + PH.men.c + '"></i>經期</span><span><i style="background:rgba(224,86,127,.22)"></i>預計的經期</span><span><i style="background:rgba(139,108,240,.24)"></i>易孕期</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px ' + PH.ovu.c + '"></i>排卵日</span></div></div>';
    return h;
  }

  /* ---------- 彈出窗 ---------- */
  function ensureOwner() { /* 誰的記錄由設定決定，預設女方 */ }
  function verifySheet(id) {
    const I = info(), gp = I.stat.gaps.find(x => x.id === id), r = Store.get(id);
    if (!gp || !r) return;
    const usual = Math.round(I.stat.med) || 28;
    const longer = gp.g > usual;
    const mid = D.add(gp.prev, Math.round(gp.g / 2));
    openSheet('<h2>核實這個週期</h2><p class="muted" style="margin-top:-8px">' + D.ymdText(gp.prev) + ' 到 ' + D.ymdText(r.start) + '，相隔 <b>' + gp.g + ' 天</b>，' + (longer ? '比平常（約 ' + usual + ' 天）長很多。可能中間漏記了一次。' : '比平常（約 ' + usual + ' 天）短很多。可能日子輸入錯了。') + '</p>' +
      '<div class="stack">' +
      (r.confirmed ? '<button class="btn ghost block" data-un>' + icon('undo', 'sm') + '取消核實（不計入估算）</button>'
        : '<button class="btn block" data-ok>' + icon('check', 'sm') + '確認是真的，計入估算</button>') +
      (longer ? '<button class="btn ghost block" data-miss>' + icon('plus', 'sm') + '我漏記了，補記中間那一次</button>' : '') +
      '<button class="btn ghost block" data-edit>' + icon('pencil', 'sm') + '修改 ' + D.md(r.start) + ' 這次的日子</button></div>', api => {
      const ok = api.$('[data-ok]'); if (ok) ok.onclick = () => { Store.patch(id, { confirmed: true }); api.close(); toast('已核實，會計入估算', 'check'); };
      const un = api.$('[data-un]'); if (un) un.onclick = () => { Store.patch(id, { confirmed: false }); api.close(); };
      const ms = api.$('[data-miss]'); if (ms) ms.onclick = () => { api.close(); recordSheet(null, { start: mid }); };
      api.$('[data-edit]').onclick = () => { api.close(); recordSheet(id); };
    });
  }
  function recordSheet(id, preset) {
    const x = id ? Store.get(id) : Object.assign({ start: D.today(), end: '' }, preset);
    openSheet('<h2>' + (id ? '這次經期' : '記錄一次經期') + '</h2><div class="label">開始</div><input type="date" class="field" name="start" value="' + esc(x.start) + '"><div class="label">結束（可選，還沒結束就留空）</div><input type="date" class="field" name="end" value="' + esc(x.end || '') + '">' +
      '<div class="actions">' + (id ? '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      api.$('[data-save]').onclick = () => {
        const start = api.$('[name=start]').value; let end = api.$('[name=end]').value;
        if (!D.valid(start)) return;
        if (end && end < start) end = '';
        ensureOwner();
        const prevRec = id ? Store.get(id) : null;
        Store.put('period', Object.assign({}, prevRec || {}, { start, end, confirmed: prevRec && prevRec.start === start ? !!prevRec.confirmed : false }), id); api.close(); toast('已記錄', 'drop');
      };
      if (id) api.$('[data-del]').onclick = () => { Store.remove(id); api.close(); };
    });
  }
  function bulkSheet() {
    const I = info();
    const rowHTML = () => '<div class="two pbulk" style="margin-bottom:8px;grid-template-columns:1fr 1fr 32px;align-items:center"><input type="date" class="field" data-s max="' + D.today() + '"><input type="date" class="field" data-e max="' + D.today() + '"><button type="button" class="faint" data-rx aria-label="刪除這行">' + icon('x', 'sm') + '</button></div>';
    openSheet('<h2>補記過往記錄</h2><p class="small muted" style="margin-top:-8px">輸入以前每次經期開始（和結束）的日子，記錄越多，估算越準。結束日可以留空。</p>' +
      '<div class="two small faint" style="grid-template-columns:1fr 1fr 32px;margin:0 2px 6px"><span>開始</span><span>結束（可選）</span><span></span></div>' +
      '<div data-rows>' + rowHTML() + rowHTML() + rowHTML() + '</div>' +
      '<button type="button" class="link-btn" data-add style="margin:4px 2px 6px">' + icon('plus', 'xs') + '加一行</button>' +
      '<div class="actions"><button class="btn" data-save>儲存</button></div>', api => {
      const box = api.$('[data-rows]');
      api.$('[data-add]').onclick = () => box.insertAdjacentHTML('beforeend', rowHTML());
      box.onclick = e => { const b = e.target.closest('[data-rx]'); if (b) b.closest('.pbulk').remove(); };
      api.$('[data-save]').onclick = () => {
        const have = new Set(info().recs.map(r => r.start));
        let n = 0, dup = 0;
        Array.from(box.querySelectorAll('.pbulk')).forEach(r => {
          const st = r.querySelector('[data-s]').value; let en = r.querySelector('[data-e]').value;
          if (!D.valid(st)) return;
          if (have.has(st)) { dup++; return; }
          if (en && (en < st || D.diff(st, en) > 15)) en = '';
          Store.put('period', { start: st, end: en }); have.add(st); n++;
        });
        api.close();
        toast(n ? '已補記 ' + n + ' 次' + (dup ? '（' + dup + ' 次已經有）' : '') : '沒有新的記錄', n ? 'drop' : null);
      };
    });
  }
  function moodSheet(day) {
    const x = log(day) || { flow: '', sym: [], mood: [], note: '' };
    const chips = (arr, sel, name) => '<div class="chips" data-multi="' + name + '">' + arr.map(s => '<button type="button" class="chip' + (sel.includes(s) ? ' on' : '') + '" data-v="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>';
    openSheet('<h2>' + D.full(day) + '</h2>' +
      '<div class="label">流量</div><div class="seg" data-flow>' + FLOW.map(([k, n]) => '<button type="button" data-k="' + k + '" class="' + (x.flow === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div class="label">身體</div>' + chips(SYM, x.sym || [], 'sym') +
      '<div class="label">心情</div>' + chips(MOOD, x.mood || [], 'mood') +
      (isOwner(info()) ? '<div class="label">' + icon('lock', 'xs') + ' 筆記（只有你看到）</div><textarea class="field" name="note" maxlength="500" style="min-height:80px" placeholder="今天怎樣？">' + esc(x.note || '') + '</textarea>' : '') +
      '<div class="actions">' + (log(day) ? '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>' : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      let flow = x.flow || '';
      api.$('[data-flow]').onclick = e => { const b = e.target.closest('button'); if (!b) return; flow = b.dataset.k; api.$$('[data-flow] button').forEach(z => z.classList.toggle('on', z === b)); };
      api.$$('[data-multi]').forEach(box => box.onclick = e => { const b = e.target.closest('.chip'); if (b) b.classList.toggle('on'); });
      const pick = n => api.$$('[data-multi="' + n + '"] .chip.on').map(b => b.dataset.v);
      api.$('[data-save]').onclick = () => {
        ensureOwner();
        const nt = api.$('[name=note]');
        Store.put('pday', { date: day, flow, sym: pick('sym'), mood: pick('mood'), note: nt ? nt.value.trim() : (x.note || '') }, 'pd_' + day);
        api.close(); toast('已記下', 'check');
      };
      const del = api.$('[data-del]');
      if (del) del.onclick = () => { Store.remove('pd_' + day, { silent: true }); api.close(); };
    });
  }
  function daySheet(day) {
    const I = info(), own = isOwner(I), edit = canEdit(I);
    const z = dayMap(day, day, I)[day];
    const rec = I.recs.find(r => { const e = r.end || D.add(r.start, I.len - 1); return day >= r.start && day <= e; });
    let label = '沒有推算';
    if (z) label = (z.type === 'ovu' ? '大約是排卵日' : z.type === 'pred' ? '預計的經期' : PH[z.phase].n) + ' · 週期第 ' + z.cday + ' 天';
    const lg = log(day);
    openSheet('<h2>' + D.full(day) + '</h2><p class="muted" style="margin-top:-8px">' + label + '</p>' +
      (lg && canSee('all', I) ? logChips(lg, own) : '') +
      (edit ? '<div class="stack" style="margin-top:16px"><button class="btn block" data-mood>' + icon('heart', 'sm') + (lg ? '改這天的感覺' : '記下這天的感覺') + '</button>' +
        (rec ? '<button class="btn ghost block" data-edit>' + icon('pencil', 'sm') + '編輯這次經期</button>' : (day <= D.today() ? '<button class="btn ghost block" data-start>' + icon('drop', 'sm') + '這天經期開始</button>' : '')) + '</div>' : ''), api => {
      const b1 = api.$('[data-mood]'); if (b1) b1.onclick = () => { api.close(); moodSheet(day); };
      const b2 = api.$('[data-edit]'); if (b2) b2.onclick = () => { api.close(); recordSheet(rec.id); };
      const b3 = api.$('[data-start]'); if (b3) b3.onclick = () => { api.close(); ensureOwner(); Store.put('period', { start: day, end: '' }); toast('已記錄', 'drop'); };
    });
  }
  function settingsSheet() {
    const I = info(), s = A.S(), me = A.ME(), ot = A.OT();
    const owner = I.owner, own = isOwner(I);
    const shares = [['none', 'lock', '甚麼都看不到'], ['dates', 'heart', '經期的日子，和下次甚麼時候來'], ['all', 'userPlus', '連症狀和心情也看到']];
    openSheet('<h2>經期設定</h2>' +
      '<div class="label">來月經的是（預設第二位）</div><div class="seg" data-owner>' + ['a', 'b'].map(w => '<button type="button" data-k="' + w + '" class="' + (owner === w ? 'on' : '') + '">' + (w === 'a' ? '第一位 ' : '第二位 ') + esc(A.nm(w)) + '</button>').join('') + '</div>' +
      (own ? '<div class="label">你的另一半看到甚麼</div><div data-share>' + shares.map(([k, ic, n]) => '<button type="button" class="opt" data-k="' + k + '">' + icon(ic, 'sm') + '<span>' + n + '</span><span class="ck">' + (I.share === k ? icon('check') : '') + '</span></button>').join('') + '</div>' +
        '<p class="small faint" style="margin:4px 4px 0">當天的筆記，在任何情況下都不會分享。</p>'
        : '<p class="small muted" style="margin:10px 4px 0">' + icon('lock', 'xs') + ' 分享多少由 ' + esc(A.nm(owner)) + ' 在自己的手機決定。</p>') +
      '<div class="set-row" style="margin-top:12px"><div><div style="font-weight:600">經期長度</div><div class="small muted">有記錄結束日之後會自動按記錄計算</div></div><div class="row" style="gap:6px"><button class="round-btn" style="width:36px;height:36px" data-len="-1">−</button><b style="width:28px;text-align:center" data-lenv>' + I.len + '</b><button class="round-btn" style="width:36px;height:36px" data-len="1">+</button></div></div>' +
      '<div class="actions"><button class="btn" data-x>完成</button></div>', api => {
      api.$('[data-owner]').onclick = e => { const b = e.target.closest('button'); if (!b) return; api.$$('[data-owner] button').forEach(z => z.classList.toggle('on', z === b)); A.setS({ periodWho: b.dataset.k }); toast('經期記錄是 ' + A.nm(b.dataset.k) + ' 的', 'check'); api.close(); setTimeout(settingsSheet, 250); };
      const sh = api.$('[data-share]'); if (sh) sh.onclick = e => { const b = e.target.closest('.opt'); if (!b) return; api.$$('[data-share] .ck').forEach(c => c.innerHTML = ''); b.querySelector('.ck').innerHTML = icon('check'); A.setS({ periodShare: b.dataset.k }); };
      api.$$('[data-len]').forEach(b => b.onclick = () => { const v = Math.max(2, Math.min(10, (A.S().periodLen || 5) + Number(b.dataset.len))); A.setS({ periodLen: v }); api.$('[data-lenv]').textContent = v; });
      api.$('[data-x]').onclick = () => api.close();
    });
  }

  /* ---------- 給其他地方用 ---------- */
  function homeText() {
    const I = info();
    if (!canSee('dates', I)) return null;
    if (!I.last) return canEdit(I) ? '記錄第一次' : '還沒有記錄';
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
    'p-bulk'() { bulkSheet(); },
    'p-verify'(el) { verifySheet(el.dataset.id); },
    'p-edit'(el) { recordSheet(el.dataset.id); },
    'p-mood'(el) { moodSheet(el.dataset.k); },
    'p-day'(el) { daySheet(el.dataset.k); },
    'p-settings': settingsSheet,
    'pcal-move'(el) { let m = ui.m + Number(el.dataset.d), y = ui.y; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } ui.y = y; ui.m = m; A.render(); },
    'pcal-today'() { const [y, m] = D.ymd(D.today()); ui.y = y; ui.m = m; A.render(); },
    'go-period'() { location.hash = '#/period'; }
  });
})();
