/* 要知道的事、計劃（儲錢）、筆記、我們的一年 */
(function () {
  const A = window.App;
  const ui = { knowWho: 'me', planTab: 'open', year: null };
  const delBtn = '<button class="btn ghost" data-del style="flex:0 0 auto;width:50px;padding:0;color:var(--danger)">' + icon('trash', 'sm') + '</button>';
  const money = n => { const s = A.S().currency || '$'; const v = Math.round(Number(n) || 0); return (v < 0 ? '-' : '') + s + Math.abs(v).toLocaleString('en-US'); };

  /* ================= 要知道的事 ================= */
  const KNOW_CATS = [
    { k: 'size', n: '尺碼', c: '#2f6bff', sug: ['上衣', '褲', '裙', '鞋', '戒指', '內衣', '手錶帶'] },
    { k: 'like', n: '喜歡的', c: '#22b07d', sug: ['食物', '飲品', '甜品', '花', '顏色', '香水', '品牌', '咖啡怎樣喝'] },
    { k: 'dislike', n: '不喜歡的', c: '#ef4444', sug: ['不吃的東西', '氣味', '禮物', '說話'] },
    { k: 'health', n: '健康', c: '#f59e0b', sug: ['過敏', '常用藥', '血型', '近視度數'] },
    { k: 'other', n: '其他', c: '#64748b', sug: ['手機型號', '電話殼款式', '想去的地方'] }
  ];
  function pageKnow() {
    const me = A.ME(), ot = A.OT();
    const who = ui.knowWho === 'me' ? me : ot;
    const mine = who === me;
    const items = Store.all('know').filter(x => x.who === who);
    let h = A.head('要知道的事', '尺碼、喜好，還有不喜歡的', { back: true });
    h += '<div class="hint-bar">各人填自己那半。你的另一半看得到，但改不了。</div>';
    h += '<div class="seg" style="margin-bottom:16px"><button data-act="know-who" data-k="me" class="' + (mine ? 'on' : '') + '">關於我</button><button data-act="know-who" data-k="ot" class="' + (!mine ? 'on' : '') + '">關於 ' + esc(A.nm(ot)) + '</button></div>';
    if (!items.length) {
      h += mine ? A.emptyHTML('note', '把基本的告訴對方', '尺碼、你喜歡甚麼、不喜歡甚麼。這樣對方就不用猜，也不用問第二次。')
        : A.emptyHTML('note', esc(A.nm(ot)) + ' 還沒有填', '叫對方填一填，你就不用再猜了。');
    } else {
      KNOW_CATS.forEach(c => {
        const its = items.filter(x => x.cat === c.k).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        if (!its.length) return;
        h += '<div class="label"><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + c.c + ';margin-right:6px"></span>' + c.n + '</div><div class="glass card tight list no-icon">' +
          its.map(x => '<' + (mine ? 'button data-act="know-edit" data-id="' + x.id + '"' : 'div') + ' class="li"><span class="grow"><div class="ts">' + esc(x.label) + '</div><div class="tt">' + esc(x.value) + '</div></span>' + (mine ? '<span class="chev">' + icon('chevR', 'sm') + '</span></button>' : '</div>')).join('') + '</div>';
      });
    }
    if (mine) h += '<button class="btn fab" data-act="know-new">' + icon('plus') + '加一項</button>';
    return h;
  }
  function knowSheet(id) {
    const x = id ? Store.get(id) : { cat: 'size', label: '', value: '' };
    const sugHTML = cat => (KNOW_CATS.find(c => c.k === cat) || KNOW_CATS[4]).sug.map(s => '<button type="button" class="chip" data-s="' + esc(s) + '">' + esc(s) + '</button>').join('');
    openSheet('<h2>' + (id ? '改一項' : '加一項') + '</h2>' + chipsHTML(KNOW_CATS, x.cat, 'cat') +
      '<div class="label">是甚麼</div><input class="field" name="label" maxlength="40" placeholder="例如：鞋" value="' + esc(x.label) + '">' +
      '<div class="chips" data-sug style="margin-top:8px">' + sugHTML(x.cat) + '</div>' +
      '<div class="label">答案</div><input class="field" name="value" maxlength="200" placeholder="例如：EU 37" value="' + esc(x.value) + '">' +
      '<div class="actions">' + (id ? delBtn : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      const getCat = bindChips(api.el, 'cat');
      api.$('[data-chips="cat"]').addEventListener('click', () => setTimeout(() => { api.$('[data-sug]').innerHTML = sugHTML(getCat()); }, 0));
      api.$('[data-sug]').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; api.$('[name=label]').value = b.dataset.s; api.$('[name=value]').focus(); };
      api.$('[data-save]').onclick = () => {
        const label = api.$('[name=label]').value.trim(), value = api.$('[name=value]').value.trim();
        if (!label) { api.$('[name=label]').focus(); return; }
        if (!value) { api.$('[name=value]').focus(); return; }
        Store.put('know', { who: A.ME(), cat: getCat() || 'other', label, value }, id); api.close();
      };
      if (id) api.$('[data-del]').onclick = () => { Store.remove(id); api.close(); };
    });
  }

  /* ================= 計劃（儲錢目標） ================= */
  function saved(planId) { return Store.all('dep').filter(d => d.planId === planId).reduce((a, d) => a + (Number(d.amt) || 0), 0); }
  function pagePlans() {
    const plans = Store.all('plan');
    const open = ui.planTab === 'open';
    const shown = plans.filter(p => !!p.ended !== open).sort((a, b) => (b._at || 0) - (a._at || 0));
    let h = A.head('計劃', '一個目標、已經存了多少、還差多少。', { back: true });
    h += '<div class="chips" style="margin-bottom:16px"><button class="chip' + (open ? ' on' : '') + '" data-act="plan-tab" data-k="open">計劃</button><button class="chip' + (!open ? ' on' : '') + '" data-act="plan-tab" data-k="ended">已結束</button></div>';
    if (!shown.length) {
      h += open ? A.emptyHTML('card', '還沒有任何計劃。', '一趟旅行、一件傢具、一次維修：寫下金額，開始存。')
        : A.emptyHTML('card', '這裏還是空的', '你們當作結束的計劃會留在這裏。');
    } else {
      const t = D.today();
      h += shown.map(p => {
        const sv = saved(p.id), tg = Number(p.target) || 0;
        const pct = tg ? Math.min(100, Math.round(sv * 100 / tg)) : 0;
        const left = Math.max(0, tg - sv);
        let sub = tg ? (left ? '還差 ' + money(left) : '已經存夠了 🎉') : '';
        if (p.due && D.valid(p.due) && left && !p.ended) {
          const days = D.diff(t, p.due);
          if (days > 0) { const months = Math.max(1, days / 30.4); sub += ' · 每月大約 ' + money(left / months); }
          else sub += ' · 已過目標日期';
        }
        return '<div class="glass card"><button data-act="plan-edit" data-id="' + p.id + '" style="display:block;width:100%;text-align:left"><div class="row between"><div style="font-size:18px;font-weight:700">' + esc(p.title) + '</div><span class="faint">' + icon('pencil', 'xs') + '</span></div>' +
          '<div class="row" style="gap:6px;margin-top:6px;align-items:baseline"><span style="font-size:24px;font-weight:750">' + money(sv) + '</span>' + (tg ? '<span class="muted">/ ' + money(tg) + '</span>' : '') + '</div>' +
          (tg ? '<div class="progress"><i style="width:' + pct + '%"></i></div>' : '') +
          '<div class="small muted" style="margin-top:8px">' + sub + (p.due ? (sub ? '<br>' : '') + '目標日期 ' + D.ymdText(p.due) : '') + '</div></button>' +
          (!p.ended ? '<div class="row" style="gap:16px;margin-top:12px"><button class="link-btn" data-act="dep-new" data-id="' + p.id + '">' + icon('plus', 'xs') + '存一筆</button><button class="link-btn" data-act="dep-list" data-id="' + p.id + '">' + icon('list', 'xs') + '紀錄</button></div>' : '') + '</div>';
      }).join('');
    }
    if (open) h += '<button class="btn fab" data-act="plan-new">' + icon('plus') + '新計劃</button>';
    return h;
  }
  function planSheet(id) {
    const x = id ? Store.get(id) : { title: '', target: '', due: '', ended: false };
    openSheet('<h2>' + (id ? '計劃' : '新計劃') + '</h2>' +
      '<div class="field-wrap"><input class="field" name="title" maxlength="80" placeholder="存錢做甚麼？例如：日本旅行" value="' + esc(x.title) + '"' + (id ? '' : ' autofocus') + '></div>' +
      '<div class="field-wrap"><input class="field" name="target" inputmode="decimal" placeholder="目標金額" value="' + esc(x.target) + '"></div>' +
      '<div class="label">目標日期（可選）</div><input type="date" class="field" name="due" value="' + esc(x.due || '') + '">' +
      (id ? '<div class="set-row" style="margin-top:8px"><div style="font-weight:600">當作結束</div>' + switchHTML('ended', x.ended) + '</div>' : '') +
      '<div class="actions">' + (id ? delBtn : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      api.$('[data-save]').onclick = () => {
        const title = api.$('[name=title]').value.trim(); if (!title) { api.$('[name=title]').focus(); return; }
        const target = Number(String(api.$('[name=target]').value).replace(/[^\d.]/g, '')) || 0;
        const ended = id ? api.$('[name=ended]').checked : false;
        Store.put('plan', Object.assign({}, x, { title, target, due: api.$('[name=due]').value || '', ended, endedAt: ended ? (x.endedAt || D.today()) : '' }), id);
        api.close();
      };
      if (id) api.$('[data-del]').onclick = async () => {
        api.close();
        if (!(await confirmSheet('刪除這個計劃？', '存款紀錄也會一起刪除，7 天內可以還原。', '刪除', true))) return;
        Store.all('dep').filter(d => d.planId === id).forEach(d => Store.remove(d.id, { silent: true }));
        Store.remove(id);
      };
    });
  }
  function depSheet(planId) {
    const p = Store.get(planId); if (!p) return;
    openSheet('<h2>存一筆 · ' + esc(p.title) + '</h2><div class="seg" data-sign style="margin-bottom:12px"><button type="button" data-k="1" class="on">存入</button><button type="button" data-k="-1">取出</button></div>' +
      '<input class="field" name="amt" inputmode="decimal" placeholder="金額" autofocus><div class="label">備註（可選）</div><input class="field" name="note" maxlength="80" placeholder="例如：十月份">' +
      '<div class="actions"><button class="btn" data-save>儲存</button></div>', api => {
      let sign = 1;
      api.$('[data-sign]').onclick = e => { const b = e.target.closest('button'); if (!b) return; sign = Number(b.dataset.k); api.$$('[data-sign] button').forEach(z => z.classList.toggle('on', z === b)); };
      api.$('[data-save]').onclick = () => {
        const v = Number(String(api.$('[name=amt]').value).replace(/[^\d.]/g, ''));
        if (!v) { api.$('[name=amt]').focus(); return; }
        Store.put('dep', { planId, amt: sign * v, date: D.today(), note: api.$('[name=note]').value.trim() });
        api.close(); toast(sign > 0 ? '已存入 ' + money(v) : '已取出 ' + money(v), 'check');
      };
    });
  }
  function depList(planId) {
    const p = Store.get(planId); if (!p) return;
    const deps = Store.all('dep').filter(d => d.planId === planId).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b._at - a._at);
    openSheet('<h2>' + esc(p.title) + '</h2><p class="muted" style="margin-top:-8px">共 ' + money(saved(planId)) + '</p>' +
      (deps.length ? '<div class="list">' + deps.map(d => '<div class="li" style="padding:12px 2px">' + A.avatar(d._by || A.ME(), 'xs') + '<span class="grow"><div class="tt" style="color:' + (d.amt < 0 ? 'var(--danger)' : 'inherit') + '">' + (d.amt < 0 ? '' : '+') + money(d.amt) + '</div><div class="ts">' + D.smart(d.date) + (d.note ? ' · ' + esc(d.note) : '') + '</div></span><button class="faint" data-rm="' + d.id + '" style="padding:4px">' + icon('x', 'sm') + '</button></div>').join('') + '</div>' : '<p class="muted">還沒有紀錄。</p>') +
      '<div class="actions"><button class="btn" data-x>完成</button></div>', api => {
      api.el.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { Store.remove(b.dataset.rm); b.closest('.li').remove(); } };
      api.$('[data-x]').onclick = () => api.close();
    });
  }

  /* ================= 筆記 ================= */
  function pageJots() {
    const jots = Store.all('jot').sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b._at || 0) - (a._at || 0));
    let h = A.head('筆記', '你們兩個的本子：待辦事項和重要日子以外的一切。', { back: true });
    if (!jots.length) h += A.emptyHTML('note', '本子還是空的。', '一個主意、腦裏的一張清單、醫生說過的話：放在這裏不礙着誰。');
    else h += jots.map(j => {
      const first = (j.title || (j.body || '').split('\n')[0] || '（沒有標題）').slice(0, 60);
      const body = j.title ? (j.body || '') : (j.body || '').split('\n').slice(1).join(' ');
      return '<button class="glass card" style="display:block;width:100%;text-align:left" data-act="jot-edit" data-id="' + j.id + '"><div class="row between"><div style="font-weight:700;font-size:17px">' + (j.pin ? '📌 ' : '') + esc(first) + '</div>' + A.avatar(j._by || A.ME(), 'xs') + '</div>' +
        (body.trim() ? '<div class="small muted" style="margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap">' + esc(body.slice(0, 300)) + '</div>' : '') +
        '<div class="small faint" style="margin-top:6px">' + D.smart(D.key(new Date(j._at))) + '</div></button>';
    }).join('');
    h += '<button class="btn fab" data-act="jot-new">' + icon('plus') + '寫一則</button>';
    return h;
  }
  function jotSheet(id) {
    const x = id ? Store.get(id) : { title: '', body: '', pin: false, created: D.today() };
    openSheet('<h2>' + (id ? '筆記' : '寫一則') + '</h2><input class="field" name="title" maxlength="100" placeholder="標題（可選）" value="' + esc(x.title) + '">' +
      '<textarea class="field" name="body" placeholder="寫點甚麼…" style="min-height:42vh;margin-top:10px"' + (id ? '' : ' autofocus') + '>' + esc(x.body) + '</textarea>' +
      '<div class="set-row"><div style="font-weight:600">📌 置頂</div>' + switchHTML('pin', x.pin) + '</div>' +
      '<div class="actions">' + (id ? delBtn : '') + '<button class="btn" data-save>儲存</button></div>', api => {
      api.$('[data-save]').onclick = () => {
        const title = api.$('[name=title]').value.trim(), body = api.$('[name=body]').value.replace(/\s+$/, '');
        if (!title && !body.trim()) { api.close(); return; }
        Store.put('jot', Object.assign({}, x, { title, body, pin: api.$('[name=pin]').checked, created: x.created || D.today() }), id);
        api.close();
      };
      if (id) api.$('[data-del]').onclick = () => { Store.remove(id); api.close(); toast('已刪除，可以在「最近刪除」還原', 'trash'); };
    });
  }

  /* ================= 我們的一年 ================= */
  function yearOf(k) { return k && D.valid(k) ? Number(k.slice(0, 4)) : null; }
  function yearOfTs(ts) { return ts ? new Date(ts).getFullYear() : null; }
  function yearStats(Y) {
    const from = Y + '-01-01', to = Y + '-12-31';
    const months = Array(12).fill(0);
    const mo = k => Number(k.slice(5, 7)) - 1;
    const todos = Store.all('todo').filter(t => t.done && yearOf(t.doneAt) === Y);
    todos.forEach(t => months[mo(t.doneAt)]++);
    const ev = A.markers(from, to).filter(m => m.kind === 'event');
    ev.forEach(m => months[mo(m.date)]++);
    const catCount = {};
    Store.all('event').forEach(e => { const n = ev.filter(m => m.id === e.id).length; if (n) catCount[e.cat || 'other'] = (catCount[e.cat || 'other'] || 0) + n; });
    const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    // 兩人都答的日子 + 最長連續
    const ansDays = {};
    Store.all('answer').forEach(a => { if (yearOf(a.day) === Y && a.text) (ansDays[a.day] = ansDays[a.day] || new Set()).add(a.who); });
    const both = Object.keys(ansDays).filter(d => ansDays[d].size >= 2).sort();
    let best = 0, run = 0, prev = null;
    both.forEach(d => { run = prev && D.diff(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; });
    const wishes = Store.all('wish').filter(w => w.done && yearOf(w.doneAt) === Y);
    const items = Store.all('item').filter(i => i.done && yearOfTs(i._at) === Y);
    const deps = Store.all('dep').filter(d => yearOf(d.date) === Y && d.amt > 0).reduce((a, d) => a + Number(d.amt), 0);
    const jots = Store.all('jot').filter(j => yearOf(j.created) === Y || (!j.created && yearOfTs(j._at) === Y));
    const plansDone = Store.all('plan').filter(p => p.ended && yearOf(p.endedAt) === Y);
    return { months, todos: todos.length, events: ev.length, topCat, both: both.length, best, wishes, items: items.length, deps, jots: jots.length, plansDone: plansDone.length };
  }
  function pageYear() {
    const ty = D.ymd(D.today())[0];
    const s = A.S();
    let minY = ty;
    const consider = y => { if (y && y < minY && y > 1970) minY = y; };
    consider(yearOf(s.together));
    Object.values(Store.s.records).forEach(r => { if (!r.deleted) consider(yearOfTs(r.updatedAt)); });
    Store.all('event').forEach(e => consider(yearOf(e.date)));
    Store.all('answer').forEach(a => consider(yearOf(a.day)));
    minY = Math.max(minY, ty - 30);
    if (!ui.year) ui.year = ty;
    const Y = ui.year;
    let h = A.head('我們的一年', '這十二個月你們做過的，都是從你們自己記下的東西算出來的。', { back: true });
    const years = []; for (let y = ty; y >= minY; y--) years.push(y);
    h += '<div class="chips" style="margin-bottom:16px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px">' + years.map(y => '<button class="chip' + (y === Y ? ' on' : '') + '" data-act="year-pick" data-k="' + y + '" style="flex:none">' + y + ' 年</button>').join('') + '</div>';
    const st = yearStats(Y);
    const total = st.todos + st.events + st.both + st.wishes.length + st.items + st.jots + st.plansDone + (st.deps ? 1 : 0);
    if (!total) return h + A.emptyHTML('spark', '還沒有甚麼可以說。', '記下待辦事項、日子和計劃：到十二月，這裏自己就滿了。');
    if (D.valid(s.together) && yearOf(s.together) <= Y) {
      const n = Y - yearOf(s.together) + 1;
      h += '<div class="glass card hero"><div class="eyebrow">' + icon('heart', 'xs') + Y + '</div><div class="q-title">' + (n === 1 ? '你們在一起的第一年' : '你們在一起的第 ' + n + ' 年') + '</div><div class="muted small">' + (n > 1 ? D.md(s.together) + ' 是 ' + (n - 1) + ' 週年' : '從 ' + D.md(s.together) + ' 開始') + '</div></div>';
    }
    const tile = (n, t, ic) => '<div class="glass card" style="margin:0;padding:16px"><div class="faint">' + icon(ic, 'sm') + '</div><div style="font-size:28px;font-weight:750;margin-top:6px">' + n + '</div><div class="small muted">' + t + '</div></div>';
    const tiles = [];
    if (st.events) tiles.push(tile(st.events, '日曆上的活動', 'cal'));
    if (st.todos) tiles.push(tile(st.todos, '一起完成的待辦', 'todo'));
    if (st.both) tiles.push(tile(st.both, '兩個人都答了的問題', 'help'));
    if (st.best > 1) tiles.push(tile(st.best + ' 天', '最長一起回答的連續', 'flame'));
    if (st.wishes.length) tiles.push(tile(st.wishes.length, '實現了的願望', 'star'));
    if (st.items) tiles.push(tile(st.items, '清單上劃掉的', 'list'));
    if (st.deps) tiles.push(tile(money(st.deps), '一起存下的錢', 'card'));
    if (st.plansDone) tiles.push(tile(st.plansDone, '完成的計劃', 'flag'));
    if (st.jots) tiles.push(tile(st.jots, '寫下的筆記', 'note'));
    h += '<div class="tile-grid">' + tiles.join('') + '</div>';
    const mx = Math.max(...st.months);
    if (mx > 0) {
      const busy = st.months.indexOf(mx);
      h += '<div class="glass card"><div class="row between"><b>每個月</b><span class="small muted">最忙：' + (busy + 1) + '月</span></div><div class="ybars">' +
        st.months.map((v, i) => '<div><i style="height:' + Math.max(4, Math.round(v / mx * 100)) + '%;' + (i === busy ? '' : 'opacity:.45') + '"></i><span>' + (i + 1) + '</span></div>').join('') + '</div><div class="small faint">活動和完成的待辦</div></div>';
    }
    if (st.topCat) {
      const c = EVENT_CATS.find(x => x.k === st.topCat[0]);
      h += '<div class="glass card"><div class="small muted">最常一起做的</div><div style="font-size:20px;font-weight:700;margin-top:4px">' + esc(c ? c.n : '其他') + ' · ' + st.topCat[1] + ' 次</div></div>';
    }
    if (st.wishes.length) h += '<div class="label">今年實現的願望</div><div class="glass card tight list">' + st.wishes.map(w => A.row({ ic: 'star', t: esc(w.title), s: w.doneAt ? D.md(w.doneAt) : '', noChev: true })).join('') + '</div>';
    return h;
  }

  /* ---------- 主頁卡片用 ---------- */
  A.extraTiles = function () {
    const on = A.on, out = [];
    if (on('know')) {
      const n = Store.all('know').filter(x => x.who === A.OT()).length;
      out.push(['#/know', 'note', '要知道的事', n ? A.nm(A.OT()) + ' 填了 ' + n + ' 項' : '尺碼、喜歡的、不喜歡的']);
    }
    if (on('plans')) {
      const ps = Store.all('plan').filter(p => !p.ended);
      out.push(['#/plans', 'card', '計劃', ps.length ? ps.length + ' 個在存' : '一個目標，一起存']);
    }
    if (on('jots')) {
      const n = Store.all('jot').length;
      out.push(['#/jots', 'pencil', '筆記', n ? n + ' 則' : '本子還是空的']);
    }
    if (on('year')) out.push(['#/year', 'spark', '我們的一年', D.ymd(D.today())[0] + ' 年回顧']);
    return out;
  };

  Object.assign(A.pages, { know: pageKnow, plans: pagePlans, jots: pageJots, year: pageYear });
  Object.assign(A.acts, {
    'know-who'(el) { ui.knowWho = el.dataset.k; A.render(); },
    'know-new'() { knowSheet(); },
    'know-edit'(el) { knowSheet(el.dataset.id); },
    'plan-tab'(el) { ui.planTab = el.dataset.k; A.render(); },
    'plan-new'() { planSheet(); },
    'plan-edit'(el) { planSheet(el.dataset.id); },
    'dep-new'(el) { depSheet(el.dataset.id); },
    'dep-list'(el) { depList(el.dataset.id); },
    'jot-new'() { jotSheet(); },
    'jot-edit'(el) { jotSheet(el.dataset.id); },
    'year-pick'(el) { ui.year = Number(el.dataset.k); A.render(); }
  });
})();
