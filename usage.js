/* FocusTube usage line: time of use, daily average and change for day, week and month.
   Counts only while the page is visible AND in focus. Data stays in this browser. */
(function () {
  // PURE-START
  const HOUR = 3600e3;
  const pad = n => String(n).padStart(2, '0');
  const hourKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours());
  const keyTs = k => { const [dt, h] = k.split('T'); const [y, m, d] = dt.split('-').map(Number); return new Date(y, m - 1, d, +h).getTime(); };
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function sumRange(h, from, to) { let s = 0; for (const k in h) { const t = keyTs(k); if (t >= from && t < to) s += h[k]; } return s; }
  // change of the last W hours against the W hours before; null while there is not enough history
  function change(data, now, W) {
    const h = data.h || {}, nowH = new Date(now); nowH.setMinutes(0, 0, 0);
    const end = nowH.getTime() + HOUR, mid = end - W * HOUR, start = mid - W * HOUR;
    if (!data.first || data.first > end - 1.5 * W * HOUR) return null;
    const a = sumRange(h, mid, end), b = sumRange(h, start, mid);
    if (b <= 0) return null;
    return (a - b) / b * 100;
  }
  function compute(data, now) {
    const h = data.h || {}, d0 = new Date(now), today = dayKey(d0);
    let todaySec = 0; for (const k in h) if (k.slice(0, 10) === today) todaySec += h[k];
    // average over the last 30 completed days since the first use (days without use count as 0)
    let avg = null;
    if (data.first) {
      const perDay = {}; for (const k in h) { const dk = k.slice(0, 10); perDay[dk] = (perDay[dk] || 0) + h[k]; }
      const first = new Date(data.first); first.setHours(0, 0, 0, 0);
      let n = 0, sum = 0;
      for (let i = 1; i <= 30; i++) {
        const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - i);
        if (d < first) break;
        n++; sum += perDay[dayKey(d)] || 0;
      }
      if (n) avg = sum / n;
    }
    return { today: todaySec, avg, day: change(data, now, 24), week: change(data, now, 168), month: change(data, now, 720) };
  }
  const fmtMin = s => { const m = Math.round(s / 60); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + pad(m % 60) + 'm'; };
  const arrow = p => p > 5 ? '▲' : p < -5 ? '▼' : '▬';
  const fmtChange = p => p == null ? '–' : arrow(p) + Math.round(Math.abs(p)) + '%';
  function line(r) {
    return '⏱ Today ' + fmtMin(r.today) + ' · Avg ' + (r.avg == null ? '–' : fmtMin(r.avg) + '/day') +
      ' · Day ' + fmtChange(r.day) + ' · Week ' + fmtChange(r.week) + ' · Month ' + fmtChange(r.month);
  }
  // PURE-END

  const KEY = 'focus-usage';
  const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.h) return d; } catch (e) {} return { v: 1, first: 0, h: {} }; };
  let pending = {};
  function flush() {
    const keys = Object.keys(pending); if (!keys.length) return;
    const data = load();
    keys.forEach(k => { data.h[k] = (data.h[k] || 0) + pending[k]; });
    if (!data.first) data.first = Date.now();
    const cut = Date.now() - 75 * 24 * HOUR;
    for (const k in data.h) if (keyTs(k) < cut) delete data.h[k];
    pending = {};
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }
  const isActive = () => document.visibilityState === 'visible' && document.hasFocus();
  let ticks = 0;
  function tick() {
    if (isActive()) { const k = hourKey(new Date()); pending[k] = (pending[k] || 0) + 1; }
    if (++ticks % 15 === 0) flush();
    if (ticks % 20 === 0) render();
  }

  const bar = document.createElement('div');
  bar.className = 'usage'; bar.setAttribute('role', 'status');
  bar.title = 'Time in the app (only while this page is open and in focus). Day = last 24 h vs the 24 h before, Week = last 7 days vs the 7 before, Month = last 30 days vs the 30 before. ▲ more than 5% up, ▼ more than 5% down, ▬ about the same, – not enough history yet.';
  const st = document.createElement('style');
  st.textContent = '.usage{font:500 12px/22px Roboto,Arial,sans-serif;color:#9b9b9b;background:#0a0a0a;text-align:center;height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px;border-bottom:1px solid #1d1d1d}';
  function render() {
    const data = load(); const mine = {};
    for (const k in pending) mine[k] = pending[k];
    for (const k in mine) data.h[k] = (data.h[k] || 0) + mine[k];
    if (!data.first && Object.keys(mine).length) data.first = Date.now();
    bar.textContent = line(compute(data, Date.now()));
  }
  function start() {
    document.head.appendChild(st); document.body.prepend(bar); render();
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); render(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.FocusUsage = { tick, flush, render, compute, line, _load: load };
})();
