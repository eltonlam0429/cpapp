/* 小工具：圖示、日期、彈出窗、提示 */
window.App = window.App || { pages: {}, acts: {}, forms: {} };
(function () {
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    todo: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    chevR: '<path d="m9 6 6 6-6 6"/>',
    chevL: '<path d="m15 6-6 6 6 6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    heart: '<path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.4 0 5.5 3.1 4.3 6.3C19.5 15.4 12 20 12 20z"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-4-5.5-2S9 8 12 8zm0 0c1.5-3 5-4 5.5-2S15 8 12 8z"/>',
    cake: '<path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 5 0M12 12V8"/><path d="M12 4.5c.8.8.8 2 0 2.5-.8-.5-.8-1.7 0-2.5z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15v4M17 17h4"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.5 4.5 0 0 1-.5 9z"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
    share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    hourglass: '<path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 9 5 9 9s-9 4-9 9M16.5 3c0 5-9 5-9 9s9 4 9 9"/>',
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>',
    note: '<path d="M20 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L13 14l-4 1 1-4z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3"/>',
    userPlus: '<circle cx="10" cy="8" r="4"/><path d="M3 21c1.3-3.8 4-6 7-6s5.7 2.2 7 6M19 8v6M16 11h6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    undo: '<path d="M4 9h11a5 5 0 0 1 0 10h-3M8 5 4 9l4 4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>',
    coffee: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3v3M12 3v3"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M18 5l2 2"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    vote: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    flame: '<path d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.1 2.2-5.2 3.6-7 .4 1.6 1.3 2.7 2.4 3.3-.2-3 1.3-5.9 3.5-7.7.3 2.6 1.8 4.4 3 6 1.2 1.6 1.5 3 1.5 4.6 0 4-3.1 7.4-7 7.4z"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'
  };
  window.icon = function (n, cls) {
    return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>';
  };

  window.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  /* ---------- 日期（全部用 YYYY-MM-DD 字串，避開時區問題） ---------- */
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  const pad = n => String(n).padStart(2, '0');
  const D = {
    WD,
    key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    today() { return D.key(new Date()); },
    parse(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); },
    ymd(k) { return k.split('-').map(Number); },
    make(y, m, d) { return D.key(new Date(y, m - 1, d)); },
    add(k, n) { const d = D.parse(k); d.setDate(d.getDate() + n); return D.key(d); },
    addMonths(k, n) { const [y, m, d] = D.ymd(k); const last = new Date(y, m - 1 + n + 1, 0).getDate(); return D.key(new Date(y, m - 1 + n, Math.min(d, last))); },
    diff(a, b) { const [y1, m1, d1] = D.ymd(a), [y2, m2, d2] = D.ymd(b); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5); },
    dow(k) { return D.parse(k).getDay(); },
    weekStart(k) { const w = (D.dow(k) + 6) % 7; return D.add(k, -w); },
    md(k) { const [, m, d] = D.ymd(k); return m + '月' + d + '日'; },
    full(k) { return D.md(k) + '星期' + WD[D.dow(k)]; },
    ymdText(k) { const [y, m, d] = D.ymd(k); return y + '年' + m + '月' + d + '日'; },
    smart(k) {
      const t = D.today(), n = D.diff(t, k);
      if (n === 0) return '今天';
      if (n === 1) return '明天';
      if (n === -1) return '昨天';
      const [y] = D.ymd(k), [ty] = D.ymd(t);
      return (y !== ty ? y + '年' : '') + D.md(k) + ' 週' + WD[D.dow(k)];
    },
    daysInMonth(y, m) { return new Date(y, m, 0).getDate(); },
    valid(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k || ''); }
  };
  window.D = D;

  /* ---------- 提示 ---------- */
  let toastT;
  window.toast = function (msg, ic) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = (ic ? icon(ic, 'sm') : '') + '<span>' + esc(msg) + '</span>';
    document.body.appendChild(el);
    clearTimeout(toastT);
    toastT = setTimeout(() => el.remove(), 2400);
  };

  /* ---------- 底部彈出窗 ---------- */
  const stack = [];
  window.openSheet = function (html, onOpen, opts) {
    opts = opts || {};
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.innerHTML = '<div class="grip"></div>' + html;
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    const api = {
      el: sheet,
      closed: false,
      close() {
        if (api.closed) return;
        api.closed = true;
        sheet.classList.add('closing'); scrim.classList.add('closing');
        setTimeout(() => { sheet.remove(); scrim.remove(); }, 220);
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        if (opts.onClose) opts.onClose();
      },
      $(q) { return sheet.querySelector(q); },
      $$(q) { return Array.from(sheet.querySelectorAll(q)); }
    };
    scrim.addEventListener('click', () => api.close());
    // 向下拖動關閉
    let y0 = null, dy = 0;
    sheet.addEventListener('touchstart', e => { if (sheet.scrollTop <= 0 && e.target.closest('.grip, h2')) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
    sheet.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = 'translate(-50%,' + dy + 'px)'; }, { passive: true });
    sheet.addEventListener('touchend', () => { if (y0 == null) return; sheet.style.transform = ''; if (dy > 90) api.close(); y0 = null; });
    stack.push(api);
    if (onOpen) onOpen(api);
    const first = sheet.querySelector('[autofocus]');
    if (first && !opts.noFocus) setTimeout(() => first.focus(), 360);
    return api;
  };
  window.closeTopSheet = function () { const s = stack[stack.length - 1]; if (s) s.close(); };

  window.confirmSheet = function (title, msg, okText, danger) {
    return new Promise(resolve => {
      let done = false;
      const s = openSheet(
        '<h2>' + esc(title) + '</h2>' + (msg ? '<p class="muted" style="margin-top:-6px">' + esc(msg) + '</p>' : '') +
        '<div class="actions"><button class="btn ghost" data-no>取消</button><button class="btn ' + (danger ? 'danger' : '') + '" data-yes>' + esc(okText || '確定') + '</button></div>',
        api => {
          api.$('[data-no]').onclick = () => { done = true; resolve(false); api.close(); };
          api.$('[data-yes]').onclick = () => { done = true; resolve(true); api.close(); };
        },
        { onClose: () => { if (!done) resolve(false); } }
      );
    });
  };

  /* ---------- 下拉選單 ---------- */
  window.openMenu = function (anchor, html, onOpen) {
    const r = anchor.getBoundingClientRect();
    const scrim = document.createElement('div'); scrim.className = 'menu-scrim';
    const m = document.createElement('div'); m.className = 'menu';
    m.innerHTML = html;
    m.style.top = (r.bottom + 6) + 'px';
    m.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 270)) + 'px';
    m.style.position = 'fixed';
    document.body.appendChild(scrim); document.body.appendChild(m);
    const api = { el: m, close() { m.remove(); scrim.remove(); } };
    scrim.onclick = () => api.close();
    if (onOpen) onOpen(api);
    return api;
  };

  /* ---------- 相片壓縮 ---------- */
  window.compressImage = function (file, max, q) {
    max = max || 900; q = q || 0.72;
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const s = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', q));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  window.copyText = async function (t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {}
      ta.remove(); return ok;
    }
  };

  window.switchHTML = function (name, on) {
    return '<label class="switch"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '><span></span></label>';
  };

  window.chipsHTML = function (cats, cur, name, withAdd) {
    return '<div class="chips" data-chips="' + name + '">' + cats.map(c =>
      '<button type="button" class="chip' + (c.k === cur ? ' on' : '') + '" data-k="' + esc(c.k) + '"><span class="dot" style="background:' + (c.c || '#64748b') + '"></span>' + esc(c.n) + '</button>'
    ).join('') + (withAdd ? '<button type="button" class="chip add" data-add>' + icon('plus', 'xs') + '新增…</button>' : '') + '</div>';
  };
  // 綁定 chips；回傳取值函數
  window.bindChips = function (root, name, onAdd) {
    const box = root.querySelector('[data-chips="' + name + '"]');
    box.addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      if (b.hasAttribute('data-add')) { onAdd && onAdd(box); return; }
      box.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    });
    return () => { const on = box.querySelector('.chip.on'); return on ? on.dataset.k : ''; };
  };
})();
