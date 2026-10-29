/* 香港公眾假期：按《公眾假期條例》（第 149 章）自動計算，任何年份都適用，不用逐年更新。
 *
 * 1. 公曆固定：元旦、勞動節、香港特別行政區成立紀念日、國慶日、聖誕節、聖誕節後第一個周日（平日）
 * 2. 農曆固定：農曆年初一至初三、佛誕（四月初八）、端午節（五月初五）、中秋節翌日（八月十六）、重陽節（九月初九）
 *    —— 用瀏覽器內置的中國曆法（ICU，以東八區計算，與香港天文台一致）
 * 3. 清明節：太陽到達黃經 15° 的那一天（東八區）
 * 4. 復活節：教會曆法（Gregorian computus）；耶穌受難節、受難節翌日、復活節星期一
 * 補假：假期落在星期日，或與另一個假期同一天，就補在之後第一個本身不是假期的日子（星期六不補）。
 * 農曆新年補年初四、中秋節翌日落在星期日補八月十七、聖誕節落在星期日補聖誕節後第二個周日，都是這條規則的結果。
 * 註：2011 年修例前（2012 年以前的年份）農曆新年和中秋節的補假方法不同，這裏一律用現行規則。 */
(function (root) {
  const pad = n => String(n).padStart(2, '0');
  const key = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); };
  const addDays = (k, n) => { const [y, m, d] = k.split('-').map(Number); return key(y, m, d + n); };
  const dow = k => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

  /* ---------- 復活節（Anonymous Gregorian algorithm） ---------- */
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return key(y, month, day);
  }

  /* ---------- 清明（太陽黃經 15°，Meeus 天文算法） ---------- */
  const rad = Math.PI / 180;
  function sunLongitude(jde) {
    const T = (jde - 2451545) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    const om = (125.04 - 1934.136 * T) * rad;
    const lon = L0 + C - 0.00569 - 0.00478 * Math.sin(om);
    return ((lon % 360) + 360) % 360;
  }
  function deltaT(y) { // 秒（Espenak & Meeus）
    if (y >= 2005 && y < 2050) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (y >= 2050 && y < 2150) { const u = (y - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - y); }
    if (y >= 1986 && y < 2005) { const t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
    if (y >= 1961 && y < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
    const u = (y - 1820) / 100; return -20 + 32 * u * u;
  }
  function jdToKey(jd) { // 儒略日 → 公曆日期
    const Z = Math.floor(jd + 0.5), F = jd + 0.5 - Z;
    let A = Z;
    if (Z >= 2299161) { const al = Math.floor((Z - 1867216.25) / 36524.25); A = Z + 1 + al - Math.floor(al / 4); }
    const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
    const day = Math.floor(B - D - Math.floor(30.6001 * E) + F), month = E < 14 ? E - 1 : E - 13, year = month > 2 ? C - 4716 : C - 4715;
    return key(year, month, day);
  }
  function qingming(y) {
    let jde = Date.UTC(y, 3, 4) / 86400000 + 2440587.5; // 4 月 4 日附近
    for (let i = 0; i < 8; i++) {
      let diff = 15 - sunLongitude(jde);
      diff = ((diff + 180) % 360 + 360) % 360 - 180;
      jde += diff / 0.98564736;
      if (Math.abs(diff) < 1e-7) break;
    }
    const jdUT = jde - deltaT(y) / 86400;
    return jdToKey(jdUT + 8 / 24); // 香港時間（東八區）
  }

  /* ---------- 新月（Meeus《天文算法》第 49 章，誤差約幾秒） ---------- */
  function newMoonJDE(k) {
    const T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    const M = (2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3) * rad;
    const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * rad;
    const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * rad;
    const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * rad;
    const sin = Math.sin;
    jde += -0.40720 * sin(Mp) + 0.17241 * E * sin(M) + 0.01608 * sin(2 * Mp) + 0.01039 * sin(2 * F) + 0.00739 * E * sin(Mp - M)
      - 0.00514 * E * sin(Mp + M) + 0.00208 * E * E * sin(2 * M) - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F)
      + 0.00056 * E * sin(2 * Mp + M) - 0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F)
      - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(Om) - 0.00007 * sin(Mp + 2 * M) + 0.00004 * sin(2 * Mp - 2 * F)
      + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F) + 0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F)
      + 0.00003 * sin(Mp - M + 2 * F) - 0.00002 * sin(Mp - M - 2 * F) - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
    const A = [299.77 + 0.107408 * k - 0.009173 * T2, 251.88 + 0.016321 * k, 251.83 + 26.651886 * k, 349.42 + 36.412478 * k,
      84.66 + 18.206239 * k, 141.74 + 53.303771 * k, 207.14 + 2.453732 * k, 154.84 + 7.306860 * k, 34.52 + 27.261239 * k,
      207.19 + 0.121824 * k, 291.34 + 1.844379 * k, 161.72 + 24.198154 * k, 239.56 + 25.513099 * k, 331.55 + 3.592518 * k];
    const W = [0.000325, 0.000165, 0.000164, 0.000126, 0.000110, 0.000062, 0.000060, 0.000056, 0.000047, 0.000042, 0.000040, 0.000037, 0.000035, 0.000023];
    A.forEach((a, i) => { jde += W[i] * sin(a * rad); });
    return jde;
  }
  const nmCache = {};
  function newMoonDate(k) { // 新月那天（香港時間）
    if (nmCache[k]) return nmCache[k];
    const jde = newMoonJDE(k);
    const y = 2000 + k / 12.3685;
    return (nmCache[k] = jdToKey(jde - deltaT(y) / 86400 + 8 / 24));
  }

  /* ---------- 農曆 ----------
     每月初一 = 新月那天（自己用上面的公式計算，香港時間）。
     第幾個月、是否閏月：用瀏覽器內置中國曆法看那個月中間（初十五）的月份，避開月初交界的誤差。 */
  let fmt = null;
  try {
    fmt = new Intl.DateTimeFormat('en-u-ca-chinese', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
    if (fmt.resolvedOptions().calendar !== 'chinese') fmt = null;
  } catch (e) { fmt = null; }
  function monthOf(k) { // 新月 k 開始的那個農曆月：{ year, month, leap }
    const mid = addDays(newMoonDate(k), 14);
    const [y, m, d] = mid.split('-').map(Number);
    const p = {}; fmt.formatToParts(new Date(Date.UTC(y, m - 1, d))).forEach(x => { p[x.type] = x.value; });
    return { year: Number(p.relatedYear || p.year), month: parseInt(p.month, 10), leap: !/^\d+$/.test(p.month || '') };
  }
  const lunarCache = {};
  function lunarYear(y) { // 農曆 y 年各月的初一
    if (lunarCache[y]) return lunarCache[y];
    const map = {};
    if (fmt) {
      const k0 = Math.floor((y - 2000) * 12.3685) - 2;
      for (let k = k0; k < k0 + 17; k++) {
        const mo = monthOf(k);
        if (mo.year === y && !mo.leap && !map[mo.month]) map[mo.month] = newMoonDate(k);
      }
    }
    return (lunarCache[y] = map);
  }
  const lunar = (y, m, d) => { const first = lunarYear(y)[m]; return first ? addDays(first, d - 1) : null; };

  /* ---------- 一年的公眾假期 ---------- */
  const cache = {};
  function holidays(y) {
    if (cache[y]) return cache[y];
    const base = [];
    const add = (date, name) => { if (date) base.push({ date, name, sub: false }); };
    add(key(y, 1, 1), '元旦');
    add(lunar(y, 1, 1), '農曆年初一');
    add(lunar(y, 1, 2), '農曆年初二');
    add(lunar(y, 1, 3), '農曆年初三');
    add(qingming(y), '清明節');
    const es = easter(y);
    add(addDays(es, -2), '耶穌受難節');
    add(addDays(es, -1), '耶穌受難節翌日');
    add(addDays(es, 1), '復活節星期一');
    add(key(y, 5, 1), '勞動節');
    add(lunar(y, 4, 8), '佛誕');
    add(lunar(y, 5, 5), '端午節');
    add(key(y, 7, 1), '香港特別行政區成立紀念日');
    add(lunar(y, 8, 16), '中秋節翌日');
    add(key(y, 10, 1), '國慶日');
    add(lunar(y, 9, 9), '重陽節');
    add(key(y, 12, 25), '聖誕節');
    add(dow(key(y, 12, 26)) === 0 ? key(y, 12, 27) : key(y, 12, 26), '聖誕節後第一個周日');
    base.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    // 補假：落在星期日，或與較早列出的假期同一天
    const taken = new Set(base.map(h => h.date));
    const seen = new Set(), out = [];
    base.forEach(h => {
      const clash = seen.has(h.date);
      seen.add(h.date);
      out.push(Object.assign({}, h, { onSunday: dow(h.date) === 0 }));
      if (dow(h.date) === 0 || clash) {
        let d = addDays(h.date, 1);
        while (dow(d) === 0 || taken.has(d)) d = addDays(d, 1);
        taken.add(d);
        let nm = h.name + (d === addDays(h.date, 1) ? '翌日' : '補假');
        if (/^農曆年初/.test(h.name)) nm = '農曆年初四';
        else if (h.name === '中秋節翌日') nm = '中秋節後第二日';
        else if (h.name === '聖誕節') nm = '聖誕節後第二個周日';
        out.push({ date: d, name: nm, sub: true, of: h.date });
      }
    });
    out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    return (cache[y] = out);
  }
  // 由 from 到 to（YYYY-MM-DD）之間的假期；星期日的原本假期也列出（標記 onSunday），補假另列
  function between(from, to) {
    const out = [];
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++)
      holidays(y).forEach(h => { if (h.date >= from && h.date <= to) out.push(h); });
    return out;
  }

  const HK = { holidays, between, easter, qingming, lunar, newMoonDate, lunarSupported: !!fmt };
  root.HKHolidays = HK;
  if (typeof module !== 'undefined') module.exports = HK;
})(typeof window !== 'undefined' ? window : globalThis);
