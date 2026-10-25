/* 垃圾筒：按部分分類，可以多選復原或永久刪除，不會自動清走 */
(function () {
  const A = window.App;
  const GROUPS = [
    { k: 'todo', n: '待辦事項', ic: 'todo', cols: ['todo'] },
    { k: 'dolist', n: '一起做', ic: 'coffee', cols: ['dodo', 'list', 'item', 'wish'] },
    { k: 'calendar', n: '日曆', ic: 'cal', cols: ['event', 'day'] },
    { k: 'trips', n: '旅行清單', ic: 'flag', cols: ['trip', 'tci'] },
    { k: 'know', n: '要知道的事', ic: 'note', cols: ['know'] },
    { k: 'plans', n: '計劃', ic: 'card', cols: ['plan', 'dep'] },
    { k: 'jots', n: '筆記', ic: 'pencil', cols: ['jot'] },
    { k: 'capsule', n: '時間囊', ic: 'hourglass', cols: ['capsule'] },
    { k: 'vault', n: '保險箱', ic: 'lock', cols: ['vault', 'vfile'] },
    { k: 'period', n: '經期', ic: 'drop', cols: ['period', 'pday'] },
    { k: 'other', n: '其他', ic: 'grid', cols: ['note', 'answer'] }
  ];
  const COL = { todo: '待辦', dodo: '一起做', list: '清單', item: '清單項目', wish: '願望', event: '活動', day: '紀念日', trip: '旅行', tci: '旅行清單項目', know: '要知道的事', plan: '計劃', dep: '存款紀錄', jot: '筆記', capsule: '時間囊', vault: '保險箱項目', vfile: '保險箱相片', period: '經期記錄', pday: '經期感覺', note: '便條', answer: '答案' };
  // 刪除父項目時，子項目會一起（靜靜地）刪除；復原或永久刪除時一起處理
  const CHILDREN = { list: ['item', 'listId'], trip: ['tci', 'tripId'], plan: ['dep', 'planId'], vault: ['vfile', 'itemId'] };
  const groupOf = col => GROUPS.find(g => g.cols.includes(col));
  const ui = { group: '', sel: new Set(), lastRoute: '' };

  function items(groupKey) {
    return Store.trash().filter(r => { const g = groupOf(r.col); return g && (!groupKey || g.k === groupKey); }).sort((a, b) => b.deleted - a.deleted);
  }
  A.trashCount = g => items(g).length;

  function titleOf(r) {
    const d = r.data || {};
    const parentName = (id, col) => { const p = Store.rec(id); return p && p.data ? (p.data.name || p.data.title || '') : ''; };
    switch (r.col) {
      case 'vault': return '已加密的保險箱項目';
      case 'vfile': return '保險箱裏的一張相片';
      case 'dep': return (Number(d.amt) < 0 ? '取出 ' : '存入 ') + Math.abs(Number(d.amt) || 0).toLocaleString('en-US') + (d.note ? ' · ' + d.note : '');
      case 'pday': return D.valid(d.date) ? D.ymdText(d.date) + ' 的感覺' : '經期感覺';
      case 'period': return D.valid(d.start) ? D.ymdText(d.start) + (d.end ? ' – ' + D.md(d.end) : '') : '經期記錄';
      case 'tci': { const n = parentName(d.tripId); return (d.t || '') + (n ? ' · ' + n : ''); }
      case 'item': { const n = parentName(d.listId); return (d.text || '') + (n ? ' · ' + n : ''); }
      case 'answer': return (d.day ? D.md(d.day) + '：' : '') + (d.text || '');
      case 'note': return d.text || '一張相片';
      default: return d.title || d.name || d.t || d.text || d.label || '（沒有名字）';
    }
  }
  function children(r, onlyHidden) {
    const c = CHILDREN[r.col]; if (!c) return [];
    return Object.values(Store.s.records).filter(x => x.col === c[0] && x.deleted && x.data && x.data[c[1]] === r.id && (!onlyHidden || x.data._hidden));
  }
  function restore(id) {
    const r = Store.rec(id); if (!r) return;
    children(r, true).forEach(x => { if (Math.abs(x.deleted - r.deleted) < 15000) { delete x.data._hidden; Store.restore(x.id); } });
    Store.restore(id);
  }
  function purge(id) {
    const r = Store.rec(id); if (!r) return;
    children(r, true).forEach(x => Store.purge(x.id));
    Store.purge(id);
  }

  function page(arg) {
    const route = 'trash/' + (arg || '');
    if (ui.lastRoute !== route) { ui.sel.clear(); ui.group = arg || ''; ui.lastRoute = route; }
    const all = items('');
    const fromSection = !!arg;
    const g0 = GROUPS.find(g => g.k === arg);
    let h = A.head(fromSection && g0 ? g0.n + '的垃圾筒' : '垃圾筒',
      '刪除的東西會留在這裏，直到你永久刪除。可以勾選一項或多項。', { back: true });
    // 類別篩選
    const counts = {}; all.forEach(r => { const g = groupOf(r.col).k; counts[g] = (counts[g] || 0) + 1; });
    h += '<div class="chips" style="margin-bottom:14px"><button class="chip' + (!ui.group ? ' on' : '') + '" data-act="trash-group" data-k="">全部 ' + all.length + '</button>' +
      GROUPS.filter(g => counts[g.k] || ui.group === g.k).map(g => '<button class="chip' + (ui.group === g.k ? ' on' : '') + '" data-act="trash-group" data-k="' + g.k + '">' + g.n + ' ' + (counts[g.k] || 0) + '</button>').join('') + '</div>';
    const shown = items(ui.group);
    if (!shown.length) return h + '<div class="empty"><div class="bubble glass">' + icon('trash', 'lg') + '</div><h3>垃圾筒是空的</h3><p>刪除的東西會放在這裏。</p></div>';
    // 按類別排列
    GROUPS.forEach(g => {
      const its = shown.filter(r => groupOf(r.col).k === g.k);
      if (!its.length) return;
      const allSel = its.every(r => ui.sel.has(r.id));
      h += '<div class="label row between" style="margin-right:6px"><span>' + icon(g.ic, 'xs') + ' ' + g.n + ' · ' + its.length + '</span><button class="link-btn small" data-act="trash-selall" data-k="' + g.k + '">' + (allSel ? '取消全選' : '全選') + '</button></div>';
      h += '<div class="glass card tight list">' + its.map(r => {
        const on = ui.sel.has(r.id);
        return '<button class="li" data-act="trash-pick" data-id="' + r.id + '" style="text-align:left"><span class="check' + (on ? ' on' : '') + '">' + icon('check', 'xs') + '</span>' +
          '<span class="grow"><div class="tt" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(String(titleOf(r)).slice(0, 80)) + '</div><div class="ts">' + (COL[r.col] || r.col) + ' · ' + D.smart(D.key(new Date(r.deleted))) + ' 刪除</div></span></button>';
      }).join('') + '</div>';
    });
    const n = ui.sel.size;
    h += '<div style="height:70px"></div>';
    h += '<div class="trash-bar' + (n ? ' show' : '') + '"><span class="small"><b>' + n + '</b> 項已選</span><div class="row" style="gap:8px"><button class="btn sm ghost" data-act="trash-restore"' + (n ? '' : ' disabled') + '>' + icon('undo', 'sm') + '復原</button><button class="btn sm danger" data-act="trash-purge"' + (n ? '' : ' disabled') + '>' + icon('trash', 'sm') + '永久刪除</button></div></div>';
    return h;
  }

  A.pages.trash = page;
  Object.assign(A.acts, {
    'trash-group'(el) { ui.group = el.dataset.k; ui.sel.clear(); A.render(); },
    'trash-pick'(el) { const id = el.dataset.id; if (ui.sel.has(id)) ui.sel.delete(id); else ui.sel.add(id); A.render(); },
    'trash-selall'(el) {
      const its = items(ui.group).filter(r => groupOf(r.col).k === el.dataset.k);
      const allSel = its.every(r => ui.sel.has(r.id));
      its.forEach(r => allSel ? ui.sel.delete(r.id) : ui.sel.add(r.id));
      A.render();
    },
    'trash-restore'() {
      const ids = Array.from(ui.sel); if (!ids.length) return;
      ids.forEach(restore); ui.sel.clear();
      toast('已復原 ' + ids.length + ' 項', 'undo');
    },
    async 'trash-purge'() {
      const ids = Array.from(ui.sel); if (!ids.length) return;
      if (!(await confirmSheet('永久刪除 ' + ids.length + ' 項？', '刪除之後不能再復原，兩部手機都會一起刪除。', '永久刪除', true))) return;
      ids.forEach(purge); ui.sel.clear();
      toast('已永久刪除', 'trash');
    }
  });
})();
