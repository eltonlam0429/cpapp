/* 食譜：中式 / 西式篩選，材料清單，分段步驟，每一步顯示用到的材料和份量 */
(function () {
  const A = window.App;
  const CUISINES = [{ k: 'cn', n: '中式' }, { k: 'west', n: '西式' }];
  const cuisineName = k => (CUISINES.find(c => c.k === k) || CUISINES[0]).n;
  const ui = { filter: 'all', q: '', done: {}, draft: null, draftFor: '' };
  const uid = p => p + Math.random().toString(36).slice(2, 8);
  const delBtn = '<button class="btn ghost" data-act="rcp-del" style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>';

  /* ---------- 資料 ----------
     { title, cuisine:'cn'|'west', serves, note,
       ings:  [{ id, n, q, h }]           h = 分類標題（例如「蝦仁去腥醃料」）
       groups:[{ id, n, steps:[{ id, t, uses:[{ i: 材料 id, q: 份量 }] }] }] } */
  function norm(r) {
    r = Object.assign({ title: '', cuisine: 'cn', serves: '', note: '', ings: [], groups: [] }, r || {});
    r.ings = (r.ings || []).map(x => Object.assign({ id: uid('i'), n: '', q: '', h: false }, x));
    r.groups = (r.groups || []).map(g => Object.assign({ id: uid('g'), n: '' }, g, { steps: (g.steps || []).map(st => Object.assign({ id: uid('s'), t: '' }, st, { uses: (st.uses || []).map(u => Object.assign({ q: '' }, u)) })) }));
    return r;
  }
  const ingById = (r, id) => r.ings.find(x => x.id === id);
  const useQty = (r, u) => { const g = ingById(r, u.i); return (u.q != null && String(u.q).trim() !== '') ? u.q : (g ? g.q : ''); };
  const plainName = n => String(n || '').replace(/[（(][^）)]*[）)]/g, '').replace(/\s*[-－]\s*/g, '').trim();

  /* ---------- 清單 ---------- */
  function pageList() {
    if (ui.draftFor !== 'new') { ui.draft = null; ui.draftFor = ''; }
    const all = Store.all('recipe').map(norm).sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-Hant'));
    const n = k => k === 'all' ? all.length : all.filter(r => r.cuisine === k).length;
    let h = A.head('食譜', '你們的拿手菜。', { back: true, trash: 'recipes', right: '<button class="round-btn" data-act="rcp-import" aria-label="匯入">' + icon('download', 'sm') + '</button>' });
    h += '<div class="chips" style="margin-bottom:12px">' + [['all', '全部'], ['cn', '中式'], ['west', '西式']].map(([k, l]) => '<button class="chip' + (ui.filter === k ? ' on' : '') + '" data-act="rcp-filter" data-k="' + k + '">' + l + ' ' + n(k) + '</button>').join('') + '</div>';
    if (all.length) h += '<div class="glass card" style="padding:6px 6px 6px 14px;margin-bottom:12px"><div class="row" style="gap:8px">' + icon('search', 'sm') + '<input class="field grow" id="rcpSearch" placeholder="搜尋名稱或材料，例如：蠔油" value="' + esc(ui.q) + '" style="background:transparent;border:0;box-shadow:none;padding:10px 0"></div></div>';
    const shown = all.filter(r => ui.filter === 'all' || r.cuisine === ui.filter);
    if (!all.length) {
      h += A.emptyHTML('book', '還沒有食譜', '加第一個，或者一次匯入之前整理好的。');
      h += '<div class="stack" style="margin-top:-6px"><button class="btn block" data-act="rcp-seed">' + icon('download', 'sm') + '匯入 5 個食譜（鼓油雞翼、洋蔥炒牛柳…）</button><button class="btn ghost block" data-act="rcp-import">' + icon('note', 'sm') + '貼上文字或試算表匯入</button></div>';
    } else if (!shown.length) {
      h += A.emptyHTML('book', '這裏沒有', '換一個分類看看。');
    } else {
      h += '<div data-rcplist>' + shown.map(r => {
        const ings = r.ings.filter(x => !x.h && x.n);
        const steps = r.groups.reduce((a, g) => a + g.steps.length, 0);
        const hay = (r.title + ' ' + ings.map(x => x.n).join(' ')).toLowerCase();
        return '<a href="#/recipe/' + r.id + '" class="glass card rcp-card" style="display:block" data-hay="' + esc(hay) + '"><div class="row between"><b style="font-size:18px">' + esc(r.title || '（沒有名字）') + '</b><span class="tag' + (r.cuisine === 'west' ? ' pink' : '') + '">' + cuisineName(r.cuisine) + '</span></div>' +
          '<div class="small muted" style="margin-top:4px">' + ings.length + ' 種材料 · ' + steps + ' 個步驟' + (r.serves ? ' · ' + esc(r.serves) : '') + '</div>' +
          '<div class="small faint" style="margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(ings.slice(0, 6).map(x => plainName(x.n)).join('、')) + '</div></a>';
      }).join('') + '</div><p class="center small faint hidden" data-rcpnone>找不到。</p>';
    }
    h += '<button class="btn fab" data-act="rcp-new">' + icon('plus') + '新食譜</button>';
    return h;
  }
  // 搜尋：直接在畫面上篩選，不用重畫（輸入不會失去焦點）
  document.addEventListener('input', e => {
    if (e.target.id !== 'rcpSearch') return;
    ui.q = e.target.value;
    const q = ui.q.trim().toLowerCase();
    let any = false;
    document.querySelectorAll('.rcp-card').forEach(c => { const ok = !q || c.dataset.hay.includes(q); c.classList.toggle('hidden', !ok); any = any || ok; });
    const none = document.querySelector('[data-rcpnone]'); if (none) none.classList.toggle('hidden', any);
  });

  /* ---------- 食譜頁 ---------- */
  function pageView(id) {
    const rec = Store.get(id);
    if (!rec) return A.head('食譜', '', { back: true }) + A.emptyHTML('book', '找不到這個食譜', '可能已經被刪除了。');
    const r = norm(rec);
    ui.draft = null; ui.draftFor = '';
    const done = ui.done[id] = ui.done[id] || new Set();
    let h = A.head(esc(r.title || '（沒有名字）'), cuisineName(r.cuisine) + (r.serves ? ' · ' + esc(r.serves) : ''), { back: true, right: '<a href="#/recipe-edit/' + id + '" class="round-btn" aria-label="修改">' + icon('pencil', 'sm') + '</a>' });
    if (r.note) h += '<div class="hint-bar" style="white-space:pre-wrap">' + esc(r.note) + '</div>';
    // 材料
    h += '<div class="section-h">所需材料' + (done.size ? '<button class="link-btn small" data-act="rcp-reset" data-id="' + id + '">全部重設</button>' : '') + '</div><div class="glass card tight list no-icon">';
    h += r.ings.map(x => x.h
      ? '<div class="li rcp-ih"><b class="small" style="color:var(--accent-deep)">' + esc(x.n) + '</b></div>'
      : '<button class="li" data-act="rcp-tick" data-id="' + id + '" data-k="' + x.id + '" style="text-align:left"><span class="check' + (done.has(x.id) ? ' on' : '') + '">' + icon('check', 'xs') + '</span><span class="grow' + (done.has(x.id) ? ' done-text' : '') + '">' + esc(x.n) + '</span><span class="val">' + esc(x.q || '') + '</span></button>').join('') || '<div class="muted small" style="padding:14px 16px">沒有材料。</div>';
    h += '</div>';
    // 步驟
    h += '<div class="section-h">步驟</div>';
    r.groups.forEach(g => {
      h += '<div class="glass card tight">' + (g.n ? '<div class="rcp-gh">' + esc(g.n) + '</div>' : '');
      g.steps.forEach((st, i) => {
        const on = done.has(st.id);
        const chips = (st.uses || []).map(u => { const ig = ingById(r, u.i); if (!ig) return ''; const q = useQty(r, u); return '<span class="rcp-use">' + esc(plainName(ig.n) || ig.n) + (q ? ' <b>' + esc(q) + '</b>' : '') + '</span>'; }).join('');
        h += '<button class="rcp-step' + (on ? ' on' : '') + '" data-act="rcp-tick" data-id="' + id + '" data-k="' + st.id + '"><span class="no">' + (on ? icon('check', 'xs') : i + 1) + '</span><span class="grow"><span class="tx">' + esc(st.t).replace(/\n/g, '<br>') + '</span>' + (chips ? '<span class="rcp-uses">' + chips + '</span>' : '') + '</span></button>';
      });
      if (!g.steps.length) h += '<div class="muted small" style="padding:10px 16px">沒有步驟。</div>';
      h += '</div>';
    });
    if (!r.groups.length) h += '<div class="glass card muted small">還沒有步驟，按右上角修改。</div>';
    h += '<p class="small faint" style="margin:4px 4px 0">按材料或步驟可以剔走，方便一邊煮一邊跟（只在這部手機）。</p>';
    return h;
  }

  /* ---------- 新增 / 修改 ---------- */
  function draftFor(id) {
    const key = id || 'new';
    if (ui.draftFor !== key || !ui.draft) {
      ui.draftFor = key;
      ui.draft = id && Store.get(id) ? norm(JSON.parse(JSON.stringify(Store.get(id)))) : norm({
        cuisine: ui.filter === 'west' ? 'west' : 'cn',
        ings: [{ n: '', q: '' }, { n: '', q: '' }, { n: '', q: '' }],
        groups: [{ n: '備料', steps: [{ t: '' }] }, { n: '烹飪', steps: [{ t: '' }] }]
      });
    }
    return ui.draft;
  }
  function pageEdit(id) {
    if (id === 'new') id = '';
    const r = draftFor(id);
    let h = A.head(id ? '修改食譜' : '新食譜', '', { back: true });
    h += '<div data-redit>';
    h += '<div class="glass card"><input class="field" data-f="title" maxlength="60" placeholder="叫甚麼？例如：鼓油雞翼" value="' + esc(r.title) + '">' +
      '<div class="seg" style="margin-top:10px" data-cuis>' + CUISINES.map(c => '<button type="button" data-act="rcp-cuis" data-k="' + c.k + '" class="' + (r.cuisine === c.k ? 'on' : '') + '">' + c.n + '</button>').join('') + '</div>' +
      '<input class="field" data-f="serves" maxlength="30" placeholder="份量（可選），例如：2 人份" value="' + esc(r.serves) + '" style="margin-top:10px">' +
      '<textarea class="field" data-f="note" maxlength="1000" placeholder="備註（可選）" style="min-height:60px;margin-top:10px">' + esc(r.note) + '</textarea></div>';
    // 材料
    h += '<div class="section-h">所需材料</div><div class="glass card">';
    h += r.ings.map((x, i) => x.h
      ? '<div class="rcp-erow"><input class="field" data-ing="' + i + '" data-f="n" placeholder="分類標題，例如：醃料" value="' + esc(x.n) + '" style="grid-column:1 / 3;font-weight:650;color:var(--accent-deep)"><button type="button" class="faint" data-act="rcp-ing-x" data-i="' + i + '" aria-label="刪除">' + icon('x', 'sm') + '</button></div>'
      : '<div class="rcp-erow"><input class="field" data-ing="' + i + '" data-f="n" placeholder="材料" value="' + esc(x.n) + '"><input class="field" data-ing="' + i + '" data-f="q" placeholder="份量" value="' + esc(x.q) + '"><button type="button" class="faint" data-act="rcp-ing-x" data-i="' + i + '" aria-label="刪除">' + icon('x', 'sm') + '</button></div>').join('');
    h += '<div class="row" style="gap:16px;margin-top:6px"><button type="button" class="link-btn" data-act="rcp-ing-add">' + icon('plus', 'xs') + '加材料</button><button type="button" class="link-btn" data-act="rcp-ing-head">' + icon('plus', 'xs') + '加分類標題</button></div></div>';
    // 步驟
    h += '<div class="section-h">步驟</div>';
    r.groups.forEach((g, gi) => {
      h += '<div class="glass card"><div class="row" style="gap:8px;margin-bottom:6px"><input class="field grow" data-g="' + gi + '" placeholder="分段名稱，例如：備料、烹飪" value="' + esc(g.n) + '" style="font-weight:650"><button type="button" class="faint" data-act="rcp-grp-x" data-g="' + gi + '" aria-label="刪除這段">' + icon('trash', 'sm') + '</button></div>';
      g.steps.forEach((st, si) => {
        h += '<div class="rcp-estep"><div class="row" style="gap:8px;align-items:flex-start"><span class="no">' + (si + 1) + '</span><textarea class="field grow rcp-ta" data-s="' + gi + '-' + si + '" rows="' + Math.max(2, (st.t || '').split('\n').length + Math.floor((st.t || '').length / 22)) + '" placeholder="這一步做甚麼？">' + esc(st.t) + '</textarea><button type="button" class="faint" data-act="rcp-step-x" data-g="' + gi + '" data-s="' + si + '" aria-label="刪除這步" style="padding-top:12px">' + icon('x', 'sm') + '</button></div>';
        h += '<div class="rcp-euses">' + (st.uses || []).map((u, ui2) => { const ig = ingById(r, u.i); if (!ig) return ''; return '<span class="rcp-echip"><span>' + esc(plainName(ig.n) || ig.n || '?') + '</span><input data-u="' + gi + '-' + si + '-' + ui2 + '" value="' + esc(u.q != null ? u.q : '') + '" placeholder="' + esc(ig.q || '份量') + '"><button type="button" data-act="rcp-use-x" data-g="' + gi + '" data-s="' + si + '" data-u="' + ui2 + '" aria-label="移除">' + icon('x', 'xs') + '</button></span>'; }).join('') +
          '<button type="button" class="chip add" data-act="rcp-use-add" data-g="' + gi + '" data-s="' + si + '">' + icon('plus', 'xs') + '加材料</button></div></div>';
      });
      h += '<button type="button" class="link-btn" data-act="rcp-step-add" data-g="' + gi + '" style="margin-top:4px">' + icon('plus', 'xs') + '加步驟</button></div>';
    });
    h += '<div class="row" style="gap:16px;margin:0 4px 14px"><button type="button" class="link-btn" data-act="rcp-grp-add">' + icon('plus', 'xs') + '加分段</button><button type="button" class="link-btn" data-act="rcp-auto">' + icon('spark', 'xs') + '自動找出每步用到的材料</button></div>';
    h += '<div class="rcp-actions">' + (id ? delBtn : '') + '<button class="btn" data-act="rcp-save">' + icon('check', 'sm') + '儲存食譜</button></div>';
    h += '</div><div style="height:30px"></div>';
    return h;
  }
  // 把畫面上的輸入存回草稿（每打一個字都會存）
  function collect() {
    const r = ui.draft; if (!r) return;
    const root = document.querySelector('[data-redit]'); if (!root) return;
    root.querySelectorAll('[data-f]').forEach(el => {
      if (el.dataset.ing != null) { const x = r.ings[+el.dataset.ing]; if (x) x[el.dataset.f] = el.value; }
      else r[el.dataset.f] = el.value;
    });
    root.querySelectorAll('[data-g]').forEach(el => { if (el.tagName === 'INPUT') { const g = r.groups[+el.dataset.g]; if (g) g.n = el.value; } });
    root.querySelectorAll('[data-s]').forEach(el => { if (el.tagName === 'TEXTAREA') { const [gi, si] = el.dataset.s.split('-').map(Number); const st = r.groups[gi] && r.groups[gi].steps[si]; if (st) st.t = el.value; } });
    root.querySelectorAll('[data-u]').forEach(el => { if (el.tagName === 'INPUT') { const [gi, si, k] = el.dataset.u.split('-').map(Number); const u = r.groups[gi] && r.groups[gi].steps[si] && r.groups[gi].steps[si].uses[k]; if (u) u.q = el.value; } });
  }
  const grow = ta => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
  document.addEventListener('input', e => {
    if (!(e.target.closest && e.target.closest('[data-redit]'))) return;
    if (e.target.classList.contains('rcp-ta')) grow(e.target);
    collect();
  });
  // 打開修改頁時，令每個步驟輸入框高度剛好裝得下文字
  window.addEventListener('hashchange', () => setTimeout(() => document.querySelectorAll('.rcp-ta').forEach(grow), 60));
  A.afterRender = (A.afterRender || []).concat([() => document.querySelectorAll('.rcp-ta').forEach(grow)]);
  function redraw() { collect(); if (document.activeElement) document.activeElement.blur(); A.render(); }

  // 在步驟文字裏找出提到的材料
  function autoLink(r, onlyEmpty) {
    const ings = r.ings.filter(x => !x.h && x.n);
    let n = 0;
    // 由長到短配對，配對過的字遮住，避免「洋蔥」被當成「蔥」
    const cands = [];
    ings.forEach(x => { new Set([plainName(x.n), x.n.split(/[\s（(:：]/)[0]].filter(Boolean)).forEach(nm => cands.push({ x, nm })); });
    cands.sort((a, b) => b.nm.length - a.nm.length);
    r.groups.forEach(g => g.steps.forEach(st => {
      if (onlyEmpty && st.uses && st.uses.length) return;
      const have = new Set((st.uses || []).map(u => u.i));
      st.uses = st.uses || [];
      let text = st.t;
      const found = [];
      cands.forEach(({ x, nm }) => {
        const k = text.indexOf(nm);
        if (k < 0) return;
        text = text.split(nm).join('\u0000'.repeat(nm.length));
        if (!have.has(x.id)) { found.push({ k, id: x.id }); have.add(x.id); }
      });
      found.sort((a, b) => a.k - b.k).forEach(f => { st.uses.push({ i: f.id, q: '' }); n++; }); // 按在句子出現的次序
    }));
    return n;
  }
  function pickSheet(gi, si) {
    collect();
    const r = ui.draft, ings = r.ings.filter(x => !x.h && x.n.trim());
    if (!ings.length) { toast('先在上面加材料'); return; }
    const st = r.groups[gi].steps[si];
    const used = new Set(st.uses.map(u => u.i));
    openSheet('<h2>這一步用到甚麼？</h2><p class="small muted" style="margin-top:-8px">可以揀多項。份量預設跟材料清單，加入後可以改（例如「一半」）。同一材料可以在不同步驟重複用。</p>' +
      '<div data-pick>' + ings.map(x => '<button type="button" class="opt" data-i="' + x.id + '"><span class="check' + (used.has(x.id) ? ' on' : '') + '">' + icon('check', 'xs') + '</span><span class="grow">' + esc(x.n) + '</span><span class="small muted">' + esc(x.q || '') + '</span></button>').join('') + '</div>' +
      '<div class="actions"><button class="btn" data-ok>加入</button></div>', api => {
      api.$('[data-pick]').onclick = e => { const b = e.target.closest('[data-i]'); if (b) b.querySelector('.check').classList.toggle('on'); };
      api.$('[data-ok]').onclick = () => {
        const sel = api.$$('[data-pick] .check.on').map(c => c.closest('[data-i]').dataset.i);
        // 已有的保留（連份量）；新勾選的加入；取消勾選的從這一步移除
        st.uses = st.uses.filter(u => sel.includes(u.i)).concat(sel.filter(i => !used.has(i)).map(i => ({ i, q: '' })));
        api.close(); A.render();
      };
    });
  }
  function save() {
    collect();
    const r = ui.draft;
    if (!r.title.trim()) { toast('寫個名字吧'); const t = document.querySelector('[data-f=title]'); if (t) t.focus(); return; }
    const clean = JSON.parse(JSON.stringify(r));
    clean.ings = clean.ings.filter(x => (x.n || '').trim() || (x.q || '').trim()).map(x => ({ id: x.id, n: x.n.trim(), q: (x.q || '').trim(), h: !!x.h }));
    const ids = new Set(clean.ings.map(x => x.id));
    clean.groups = clean.groups.map(g => ({ id: g.id, n: (g.n || '').trim(), steps: g.steps.filter(st => st.t.trim() || st.uses.length).map(st => ({ id: st.id, t: st.t.trim(), uses: st.uses.filter(u => ids.has(u.i)).map(u => ({ i: u.i, q: (u.q || '').trim() })) })) })).filter(g => g.n || g.steps.length);
    const existing = ui.draftFor !== 'new' ? ui.draftFor : null;
    const nid = Store.put('recipe', { title: clean.title.trim(), cuisine: clean.cuisine, serves: (clean.serves || '').trim(), note: (clean.note || '').trim(), ings: clean.ings, groups: clean.groups }, existing || undefined);
    ui.draft = null; ui.draftFor = '';
    toast('已儲存', 'check');
    location.replace('#/recipe/' + nid);
  }

  /* ---------- 匯入：貼上文字，或者從試算表複製 ---------- */
  const QTY = /(\d|適量|少許|少量|半|一|兩|二|三|幾|1\/|條|隻|片|克|g|ml|匙|茶匙|湯匙|大匙|小匙|杯|扎|根|支|個|粒|瓣)/i;
  function splitIng(line) {
    line = line.replace(/^\s*\d+[.、)\s]\s*/, '').trim();
    let m = line.match(/^(.+?)[：:]\s*(.+)$/);
    if (m) return { n: m[1].trim(), q: m[2].trim() };
    m = line.match(/^(.+?)\s+(\S.*)$/);
    if (m && QTY.test(m[2]) && !/^[-－]/.test(m[2])) return { n: m[1].trim(), q: m[2].trim() };
    return { n: line, q: '' };
  }
  function parseText(text) {
    const r = norm({ cuisine: 'cn', ings: [], groups: [] });
    const rowsRaw = text.replace(/\r/g, '').split('\n');
    const isTSV = rowsRaw.some(l => l.includes('\t'));
    let title = '';
    if (isTSV) {
      const rows = rowsRaw.map(l => l.split('\t'));
      let hi = -1, ci = -1, si = -1;
      rows.forEach((row, ri) => { row.forEach((c, k) => { if (/材料/.test(c) && ci < 0) { ci = k; hi = ri; } if (/步驟/.test(c) && si < 0) si = k; }); });
      rows.slice(0, hi < 0 ? 0 : hi).forEach(row => { const c = row.find(x => x.trim()); if (c && !title) title = c.trim(); });
      let g = null;
      rows.slice(hi + 1).forEach(row => {
        const ing = ci >= 0 ? (row[ci] || '').trim() : '';
        if (ing) r.ings.push(Object.assign({ id: uid('i') }, /[：:]$/.test(ing) ? { n: ing.replace(/[：:]$/, ''), q: '', h: true } : splitIng(ing)));
        if (si < 0) return;
        const label = row.slice(ci + 1, si).map(c => c.trim()).find(c => /[：:]$/.test(c));
        if (label) { g = { id: uid('g'), n: label.replace(/[：:]$/, ''), steps: [] }; r.groups.push(g); }
        const num = (row[si - 1] || '').trim(), t = (row[si] || '').trim();
        if (!t) return;
        if (!g) { g = { id: uid('g'), n: '', steps: [] }; r.groups.push(g); }
        if (num || !g.steps.length) g.steps.push({ id: uid('s'), t, uses: [] });
        else g.steps[g.steps.length - 1].t += '\n' + t;
      });
    } else {
      let mode = '', g = null, numbered = false;
      const lines = rowsRaw.map(l => l.trim()).filter(Boolean);
      lines.forEach(l => {
        if (/^(所需|準備)?材料[：:]?$|^材料/.test(l) && l.length <= 6) { mode = 'ing'; return; }
        if (/^(製作)?步驟[：:]?$|^做法[：:]?$/.test(l)) { mode = 'step'; return; }
        if (!mode) { if (!title) title = l.replace(/[：:]$/, ''); return; }
        if (mode === 'ing') {
          if (/[：:]$/.test(l) || (!QTY.test(l) && /料$/.test(l))) r.ings.push({ id: uid('i'), n: l.replace(/[：:]$/, ''), q: '', h: true });
          else r.ings.push(Object.assign({ id: uid('i') }, splitIng(l)));
          return;
        }
        const hasNum = /^\d+[.、)\s]/.test(l);
        const body = l.replace(/^\d+[.、)\s]\s*/, '');
        if (/[：:]$/.test(l) && body.length <= 12) { g = { id: uid('g'), n: body.replace(/[：:]$/, ''), steps: [] }; r.groups.push(g); numbered = false; return; }
        if (!g) { g = { id: uid('g'), n: '', steps: [] }; r.groups.push(g); }
        if (hasNum) numbered = true;
        if (numbered && !hasNum && g.steps.length) g.steps[g.steps.length - 1].t += '\n' + body;
        else g.steps.push({ id: uid('s'), t: body, uses: [] });
      });
    }
    r.title = title;
    autoLink(r, false);
    return r;
  }
  function importSheet() {
    openSheet('<h2>匯入食譜</h2><p class="small muted" style="margin-top:-8px">從 Google 試算表選取整個食譜複製，或者貼上文字。要有「材料」和「步驟」兩個標題；以「：」結尾的一行會當成分段（例如「備料：」）。</p>' +
      '<textarea class="field" name="t" style="min-height:40vh" placeholder="鼓油雞翼\n\n所需材料\n泰國雞翼\n頭抽 1湯匙\n…\n\n步驟\n備料：\n1 解凍\n…"></textarea>' +
      '<div class="actions"><button class="btn ghost" data-seed>匯入 5 個範例食譜</button><button class="btn" data-go>分析</button></div>', api => {
      api.$('[data-seed]').onclick = () => { api.close(); seed(); };
      api.$('[data-go]').onclick = () => {
        const t = api.$('[name=t]').value.trim(); if (!t) return;
        const r = parseText(t);
        if (!r.ings.length && !r.groups.length) { toast('看不出材料和步驟，請加上「材料」和「步驟」標題'); return; }
        api.close();
        ui.draft = r; ui.draftFor = 'new';
        toast('已分析：' + r.ings.filter(x => !x.h).length + ' 種材料、' + r.groups.reduce((a, g) => a + g.steps.length, 0) + ' 個步驟，請檢查後儲存', 'spark');
        location.hash = '#/recipe-edit/new';
      };
    });
  }
  function seed() {
    const have = new Set(Store.all('recipe').map(r => r.title));
    let n = 0;
    (window.SEED_RECIPES || []).forEach(r => { if (!have.has(r.title)) { Store.put('recipe', norm(JSON.parse(JSON.stringify(r)))); n++; } });
    toast(n ? '已匯入 ' + n + ' 個食譜' : '這些食譜已經有了', 'book');
  }

  /* ---------- 登記 ---------- */
  Object.assign(A.pages, { recipes: pageList, recipe: pageView, 'recipe-edit': pageEdit });
  Object.assign(A.acts, {
    'rcp-filter'(el) { ui.filter = el.dataset.k; A.render(); },
    'rcp-new'() { ui.draft = null; ui.draftFor = ''; location.hash = '#/recipe-edit/new'; },
    'rcp-import': importSheet,
    'rcp-seed': seed,
    'rcp-tick'(el) { const s = ui.done[el.dataset.id] = ui.done[el.dataset.id] || new Set(); const k = el.dataset.k; if (s.has(k)) s.delete(k); else s.add(k); A.render(); },
    'rcp-reset'(el) { ui.done[el.dataset.id] = new Set(); A.render(); },
    'rcp-cuis'(el) { collect(); ui.draft.cuisine = el.dataset.k; el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); },
    'rcp-ing-add'() { collect(); ui.draft.ings.push({ id: uid('i'), n: '', q: '', h: false }); redraw(); setTimeout(() => { const els = document.querySelectorAll('[data-ing][data-f=n]'); if (els.length) els[els.length - 1].focus(); }, 30); },
    'rcp-ing-head'() { collect(); ui.draft.ings.push({ id: uid('i'), n: '', q: '', h: true }); redraw(); },
    'rcp-ing-x'(el) { collect(); const x = ui.draft.ings.splice(+el.dataset.i, 1)[0]; if (x) ui.draft.groups.forEach(g => g.steps.forEach(st => { st.uses = st.uses.filter(u => u.i !== x.id); })); redraw(); },
    'rcp-grp-add'() { collect(); ui.draft.groups.push({ id: uid('g'), n: '', steps: [{ id: uid('s'), t: '', uses: [] }] }); redraw(); },
    'rcp-grp-x'(el) { collect(); ui.draft.groups.splice(+el.dataset.g, 1); redraw(); },
    'rcp-step-add'(el) { collect(); ui.draft.groups[+el.dataset.g].steps.push({ id: uid('s'), t: '', uses: [] }); redraw(); },
    'rcp-step-x'(el) { collect(); ui.draft.groups[+el.dataset.g].steps.splice(+el.dataset.s, 1); redraw(); },
    'rcp-use-add'(el) { pickSheet(+el.dataset.g, +el.dataset.s); },
    'rcp-use-x'(el) { collect(); ui.draft.groups[+el.dataset.g].steps[+el.dataset.s].uses.splice(+el.dataset.u, 1); redraw(); },
    'rcp-auto'() { collect(); const n = autoLink(ui.draft, false); redraw(); toast(n ? '找到 ' + n + ' 處用到的材料，份量可以再改' : '沒有找到新的', 'spark'); },
    'rcp-save': save,
    async 'rcp-del'() {
      const id = ui.draftFor; if (!id || id === 'new') return;
      if (!(await confirmSheet('刪除這個食譜？', '會移到垃圾筒，可以復原。', '刪除', true))) return;
      Store.remove(id); ui.draft = null; ui.draftFor = ''; location.replace('#/recipes');
    }
  });
  A.recipeCount = () => Store.all('recipe').length;
  if (typeof module !== 'undefined') module.exports = { parseText };
})();
