/* 隨手寫一句 → 活動
 * 例如「10月30日要去迪士尼玩全日」、「下星期六晚上7點半同媽媽食飯」、「12月24日至26日去台北」
 * 回傳 { title, date, time, end, endTime, allDay, found } ；日期格式 YYYY-MM-DD */
(function (root) {
  const CN = { '零': 0, '〇': 0, '一': 1, '二': 2, '兩': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  function cnNum(s) {
    if (/^\d+$/.test(s)) return Number(s);
    if (s === '十') return 10;
    let m = s.match(/^([一二兩三四五六七八九])?十([一二三四五六七八九])?$/);
    if (m) return (m[1] ? CN[m[1]] : 1) * 10 + (m[2] ? CN[m[2]] : 0);
    if (s.length === 1 && s in CN) return CN[s];
    // 二〇二六 這類逐字
    if ([...s].every(c => c in CN)) return Number([...s].map(c => CN[c]).join(''));
    return null;
  }
  // 把「十月三十日」「三點半」中的中文數字換成阿拉伯數字（只換緊接單位的）
  function normalize(t) {
    t = t.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/：/g, ':').replace(/／/g, '/');
    return t.replace(/([零〇一二兩两三四五六七八九十]+)(?=\s*(年|月|日|號|号|點|点|時|时|分|個月))/g, m => { const n = cnNum(m); return n == null ? m : String(n); });
  }
  const pad = n => String(n).padStart(2, '0');
  const key = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
  const WD = { '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
  function validYMD(y, m, d) { if (m < 1 || m > 12 || d < 1) return false; return d <= new Date(y, m, 0).getDate(); }

  function parseEvent(text, today) {
    today = today || key(new Date());
    const [ty, tm] = today.split('-').map(Number);
    let t = normalize(String(text || '').trim());
    const res = { title: '', date: '', time: '', end: '', endTime: '', allDay: false, found: { date: false, time: false } };
    const cut = []; // [start, end] 要從標題刪掉的位置
    const take = (m, re) => { cut.push([m.index, m.index + m[0].length]); };

    const mkDate = (y, m, d, explicitYear) => {
      if (!validYMD(y, m, d)) return '';
      let k = y + '-' + pad(m) + '-' + pad(d);
      if (!explicitYear && k < today) { if (validYMD(y + 1, m, d)) k = (y + 1) + '-' + pad(m) + '-' + pad(d); }
      return k;
    };
    let pm = false; // 由「今晚」等推斷的下午
    const eveningHint = /晚飯|晚餐|夜|晚上|宵夜|派對|party/i.test(t);

    // 1) 日期範圍：10月30日至11月2日 / 10月30至31日 / 30-31號
    let m = t.match(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日號号]?\s*(?:至|到|－|-|~|～|—)\s*(?:(\d{1,2})\s*月\s*)?(\d{1,2})\s*[日號号]/);
    if (m) {
      const y = m[1] ? Number(m[1]) : ty;
      res.date = mkDate(y, Number(m[2]), Number(m[3]), !!m[1]);
      if (res.date) {
        const ey = Number(res.date.slice(0, 4));
        let e = mkDate(ey, Number(m[4] || m[2]), Number(m[5]), true);
        if (e && e < res.date) e = mkDate(ey + 1, Number(m[4] || m[2]), Number(m[5]), true);
        if (e && e > res.date) res.end = e;
        take(m);
      }
    }
    // 2) 單一日期：2026年10月30日 / 10月30號
    if (!res.date && (m = t.match(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日號号]?/))) {
      const y = m[1] ? Number(m[1]) : ty;
      res.date = mkDate(y, Number(m[2]), Number(m[3]), !!m[1]);
      if (res.date) take(m);
    }
    // 3) 30/10（日/月，香港及英國寫法）
    if (!res.date && (m = t.match(/(?<![\d:])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d:])/))) {
      let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : ty;
      res.date = mkDate(y, Number(m[2]), Number(m[1]), !!m[3]);
      if (res.date) take(m);
    }
    // 4) 下個月5號 / 下月5日
    if (!res.date && (m = t.match(/下(?:個|个)?月\s*(\d{1,2})\s*[日號号]/))) {
      const d = new Date(ty, tm, 1);
      res.date = mkDate(d.getFullYear(), d.getMonth() + 1, Number(m[1]), true);
      if (res.date) take(m);
    }
    // 5) 今天/明天/後天/大後天/今晚/聽日
    if (!res.date && (m = t.match(/(大後天|大后天|大後日|後天|后天|後日|明天|明日|聽日|听日|今天|今日|今晚|今夜|明晚|聽晚|听晚)/))) {
      const w = m[1];
      const n = /大/.test(w) ? 3 : /後|后/.test(w) ? 2 : /明|聽|听/.test(w) ? 1 : 0;
      res.date = addDays(today, n);
      if (/晚|夜/.test(w)) pm = true;
      // 「今晚」保留在句子裏讓時間判斷，標題則刪掉
      take(m);
    }
    // 6) 星期X / 週X / 禮拜X，可帶「下」「這」「今個」
    if (!res.date && (m = t.match(/(下下|下|這|这|今個|今个|呢個|本)?\s*(?:個|个)?\s*(?:星期|週|周|禮拜|礼拜)([一二三四五六日天])/))) {
      const target = WD[m[2]];
      const dow = parse(today).getDay();
      const mondayOffset = (dow + 6) % 7; // 今天距離這星期一
      const tIdx = (target + 6) % 7;      // 星期一=0
      let diff;
      if (m[1] && /下下/.test(m[1])) diff = 14 - mondayOffset + tIdx;
      else if (m[1] && /下/.test(m[1])) diff = 7 - mondayOffset + tIdx;
      else if (m[1]) { diff = tIdx - mondayOffset; if (diff < 0) diff += 7; }
      else { diff = tIdx - mondayOffset; if (diff < 0) diff += 7; }
      res.date = addDays(today, diff);
      take(m);
    }
    // 7) 只有日子：30號 / 30日（這個月，過了就下個月）
    if (!res.date && (m = t.match(/(?<![\d月])(\d{1,2})\s*[號号日](?![子])/))) {
      const d = Number(m[1]);
      let y = ty, mo = tm;
      let k = validYMD(y, mo, d) ? y + '-' + pad(mo) + '-' + pad(d) : '';
      if (!k || k < today) { const nx = new Date(ty, tm, 1); y = nx.getFullYear(); mo = nx.getMonth() + 1; k = validYMD(y, mo, d) ? y + '-' + pad(mo) + '-' + pad(d) : ''; }
      if (k) { res.date = k; take(m); }
    }
    if (res.date) res.found.date = true;

    // 全日
    if ((m = t.match(/(全日|全天|成日|一整天|整天|一整日|成個白天)/))) { res.allDay = true; take(m); }

    // 時間（可以是範圍）
    const PERIOD = '(上午|早上|朝早|朝頭早|早晨|中午|下午|晏晝|晏昼|傍晚|晚上|夜晚|夜晚黑|今晚|今夜|凌晨|半夜|am|AM|pm|PM)?';
    const TIME = PERIOD + '\\s*(\\d{1,2})\\s*(?::(\\d{2})|[點点時时]\\s*(半|正|踏(\\d{1,2})|(\\d{1,2})\\s*分?)?)\\s*(am|pm|AM|PM)?';
    const toHM = (per, h, mm, half, ta, mins, suf) => {
      h = Number(h);
      let min = mm != null ? Number(mm) : half === '半' ? 30 : ta ? Number(ta) * 5 : mins != null ? Number(mins) : 0;
      const p = (per || '') + (suf || '');
      if (/下午|晏|傍晚|晚|夜|pm|PM/.test(p) || (!p && pm)) { if (h < 12) h += 12; }
      else if (/中午/.test(p)) { if (h < 11) h += 12; }
      else if (/凌晨|半夜/.test(p)) { if (h === 12) h = 0; }
      else if (/上午|早|朝|am|AM/.test(p)) { if (h === 12) h = 0; }
      else if (h < 12 && (eveningHint || h <= 6)) h += 12; // 沒寫上午下午：晚飯之類或 1–6 點當成下午
      if (h > 23 || min > 59) return '';
      return pad(h) + ':' + pad(min);
    };
    const reRange = new RegExp(TIME + '\\s*(?:至|到|－|-|~|～|—)\\s*' + TIME);
    if ((m = t.match(reRange))) {
      const a = toHM(m[1], m[2], m[3], m[4], m[5], m[6], m[7]);
      const b = toHM(m[8] || (/下午|晚|夜|pm|PM/.test((m[1] || '') + (m[7] || '')) ? m[1] || m[7] : ''), m[9], m[10], m[11], m[12], m[13], m[14]);
      if (a) { res.time = a; res.found.time = true; take(m); }
      if (b && b > a) res.endTime = b;
    } else if ((m = t.match(new RegExp(TIME)))) {
      const a = toHM(m[1], m[2], m[3], m[4], m[5], m[6], m[7]);
      if (a) { res.time = a; res.found.time = true; take(m); }
    } else if ((m = t.match(/(?<![\d.])(\d{1,2})\s*(am|pm|AM|PM)/))) {
      const a = toHM('', m[1], null, null, null, null, m[2]);
      if (a) { res.time = a; res.found.time = true; take(m); }
    }
    // 只說「今晚」「中午」等沒有鐘數
    if (!res.time && !res.allDay) {
      const rough = t.match(/(早上|朝早|上午|中午|下午|晚上|今晚|夜晚)/);
      if (rough) {
        res.time = { '早上': '09:00', '朝早': '09:00', '上午': '10:00', '中午': '12:30', '下午': '15:00', '晚上': '19:30', '今晚': '19:30', '夜晚': '20:00' }[rough[1]];
        res.found.time = true;
        take(rough);
      }
    }
    if (res.endTime && !res.end) { /* 同一天內的時間範圍 */ }

    // 標題：刪掉日期時間，再修剪語氣詞
    const keep = [...t].map((c, i) => cut.some(([a, b]) => i >= a && i < b) ? ' ' : c).join('');
    let title = keep.replace(/\s+/g, ' ').trim();
    title = title.replace(/^(?:[，,。.、\s]|在|喺|係|是|的|嘅|要|會|会|將|将|打算|準備|准备|記得|记得)+/, '');
    title = title.replace(/(?:[，,。.!！、\s]|左右|嘅|的)+$/, '');
    title = title.replace(/\s*[，,]\s*/g, '，').replace(/\s{2,}/g, ' ').trim();
    res.title = title || '';
    return res;
  }

  root.parseEvent = parseEvent;
  if (typeof module !== 'undefined') module.exports = { parseEvent };
})(typeof window !== 'undefined' ? window : globalThis);
