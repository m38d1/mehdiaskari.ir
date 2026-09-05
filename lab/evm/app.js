/*
 * lab/evm/app.js — the EVM dashboard UI.
 * All arithmetic lives in /lab/evm-engine.js so it can be unit-tested in Node.
 */
(function () {
  'use strict';

  var E = window.EVMEngine;
  var input = document.getElementById('evm-input');
  var tbody = document.getElementById('evm-body');
  var tfoot = document.getElementById('evm-foot');
  var checksBox = document.getElementById('s-checks');
  var noticesBox = document.getElementById('s-notices');
  var runBtn = document.getElementById('evm-run');
  var csvBtn = document.getElementById('evm-csv');
  var copyBtn = document.getElementById('evm-copy');
  var printBtn = document.getElementById('evm-print');
  var clrBtn = document.getElementById('evm-clear');
  var bacInput = document.getElementById('evm-bac');
  var manualInput = document.getElementById('evm-manual');
  var manualWrap = document.getElementById('manual-wrap');

  var controls = document.getElementById('evm-controls');
  var mode = 'cumulative';
  var eacMethod = 'typical';
  var lastResult = null;
  var timer = null;

  function el(id) { return document.getElementById(id); }
  function t(fa, en) { return (document.documentElement.lang === 'en') ? en : fa; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }
  function shortMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return t((n / 1e9).toFixed(1) + ' میلیارد', (n / 1e9).toFixed(1) + 'B');
    if (a >= 1e6) return t((n / 1e6).toFixed(1) + ' میلیون', (n / 1e6).toFixed(1) + 'M');
    return money(n);
  }
  function ratio(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return n.toFixed(3);
  }
  function pct(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return (n * 100).toFixed(d === undefined ? 1 : d) + '٪';
  }
  function signed(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return (n >= 0 ? '+' : '−') + money(Math.abs(n));
  }
  function num(s) {
    var v = E ? null : null;
    var txt = String(s == null ? '' : s).trim()
      .replace(/[\u06f0-\u06f9]/g, function (d) { return String(d.charCodeAt(0) - 0x06f0); })
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[\u066c،,\s]/g, '')
      .replace(/\u066b/g, '.');
    v = Number(txt);
    return txt === '' || !isFinite(v) ? null : v;
  }

  /* ---------- compute + render ---------- */
  function recompute() {
    if (!E) return;
    var parsed = E.parse(input.value);
    var result = E.compute(parsed.rows, {
      mode: mode,
      bac: num(bacInput.value),
      eac: eacMethod,
      manualEac: num(manualInput.value)
    });
    result.parseWarnings = parsed.warnings;
    lastResult = result;
    render(result);
    saveState();
  }

  function render(r) {
    renderSummary(r);
    renderChecks(r);
    renderNotices(r);
    renderTable(r);
    renderChart(r);
    var hasRows = r.series && r.series.length > 0;
    csvBtn.disabled = !hasRows;
    copyBtn.disabled = !hasRows;
    copyBtn.classList.remove('copied');
  }

  function renderSummary(r) {
    var big = el('s-eac'), sub = el('s-vac'), label = el('s-hero-label');
    var c = r.cpe;
    if (!c || c.eac === null || c.eac === undefined) {
      big.textContent = '—';
      big.classList.add('is-empty');
      sub.textContent = (r.errors && r.errors.length)
        ? t('مشکل در داده‌ها — پایین را ببینید', 'Input problem — see notices below')
        : t('داده‌ای برای محاسبه نیست', 'Nothing to compute yet');
    } else {
      big.classList.remove('is-empty');
      big.textContent = shortMoney(c.eac);
      label.textContent = t('برآورد تا تکمیل (EAC)', 'Estimate at completion') +
        ' — ' + ({ typical: t('تیپیکال', 'typical'), atypical: t('آتایپیکال', 'atypical'),
                   composite: t('ترکیبی', 'composite'), manual: t('دستی', 'manual') }[r.eacMethod] || '');
      sub.textContent = c.vac === null ? '' :
        t('انحراف تا تکمیل (VAC): ', 'Variance at completion: ') + signed(c.vac) + ' ' + t('ریال', '') +
        ' (' + pct(c.vacPct, 1) + ')';
    }

    el('s-cpi').textContent = c ? ratio(c.cpi) : '—';
    el('s-spi').textContent = c ? ratio(c.spi) : '—';
    el('s-bac').textContent = c ? shortMoney(c.bac) : '—';
    el('s-etc').textContent = c ? shortMoney(c.etc) : '—';
    el('s-tcpi').textContent = c ? ratio(c.tcpiBac) : '—';
    el('s-periods').textContent = (r.series || []).length;

    // colour the two indices against 1.0 — that is the only meaningful reference
    tone('s-cpi', c && c.cpi);
    tone('s-spi', c && c.spi);
    tone('s-tcpi', c && c.tcpiBac === null ? null : (c && c.tcpiBac >= 1.2 ? 0 : 1));
    var bacTile = el('s-bac-label');
    if (bacTile) {
      bacTile.textContent = r.bacSource === 'plan-end'
        ? t('BAC (از برنامه)', 'BAC (from plan)')
        : (r.bacSource === 'column' ? t('BAC (از ستون)', 'BAC (from column)')
                                    : t('BAC بودجهٔ کل', 'BAC'));
    }
  }

  function tone(id, v) {
    var e = el(id);
    if (!e) return;
    e.classList.remove('good', 'bad', 'ugly');
    if (v === null || v === undefined || !isFinite(v)) return;
    if (id === 's-tcpi') { e.classList.add(v >= 1.2 ? 'ugly' : (v > 1 ? 'bad' : 'good')); return; }
    if (v >= 1) e.classList.add('good');
    else if (v >= 0.9) e.classList.add('bad');
    else e.classList.add('ugly');
  }

  function renderChecks(r) {
    var list = r.checks || [];
    if (!list.length) { checksBox.innerHTML = ''; return; }
    checksBox.innerHTML = list.map(function (c) {
      var cls = c.informational ? 'info' : (c.ok ? 'ok' : 'bad');
      var mark = c.informational ? 'i' : (c.ok ? '✓' : '!');
      return '<div class="check ' + cls + '"><div class="check-mark">' + mark + '</div>' +
             '<div><b>' + esc(c.label) + '</b><span>' + esc(c.detail) + '</span></div></div>';
    }).join('');
  }

  function renderNotices(r) {
    var msgs = [];
    (r.errors || []).forEach(function (m) { msgs.push({ k: 'err', m: m }); });
    (r.parseWarnings || []).forEach(function (m) { msgs.push({ k: 'warn', m: m }); });
    (r.warnings || []).forEach(function (m) { msgs.push({ k: 'warn', m: m }); });
    if (!msgs.length) { noticesBox.innerHTML = ''; return; }
    noticesBox.innerHTML = msgs.slice(0, 12).map(function (x) {
      return '<div class="notice ' + (x.k === 'err' ? 'err' : '') + '">' + esc(x.m) + '</div>';
    }).join('') + (msgs.length > 12 ? '<div class="notice">+ ' + (msgs.length - 12) + '</div>' : '');
  }

  function renderTable(r) {
    var s = r.series || [];
    if (!s.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="empty-state">' +
        esc(t('داده‌ای برای نمایش نیست.', 'Nothing to show yet.')) + '</td></tr>';
      tfoot.innerHTML = '';
      return;
    }
    tbody.innerHTML = s.map(function (x) {
      var isLast = x.index === s.length - 1;
      return '<tr class="' + (isLast ? 'is-cpe' : '') + '">' +
        '<td class="name">' + esc(x.period) + (isLast ? ' <span class="panel-hint">◀ CPE</span>' : '') + '</td>' +
        '<td class="num">' + money(x.pv) + '</td>' +
        '<td class="num">' + money(x.ev) + '</td>' +
        '<td class="num">' + money(x.ac) + '</td>' +
        '<td class="num dim">' + money(x.cumPV) + '</td>' +
        '<td class="num dim">' + money(x.cumEV) + '</td>' +
        '<td class="num dim">' + money(x.cumAC) + '</td>' +
        '<td class="num key">' + (x.cpi === null ? '—' : x.cpi.toFixed(3)) + '</td>' +
        '<td class="num key">' + (x.spi === null ? '—' : x.spi.toFixed(3)) + '</td>' +
        '<td class="num ' + (x.cv < 0 ? 'neg' : 'pos') + '">' + money(x.cv) + '</td>' +
        '<td class="num ' + (x.sv < 0 ? 'neg' : 'pos') + '">' + money(x.sv) + '</td>' +
      '</tr>';
    }).join('');

    var c = r.cpe;
    tfoot.innerHTML = c ? ('<tr>' +
      '<td>' + esc(t('در پایان دورهٔ گزارش', 'At CPE')) + '</td>' +
      '<td class="num">—</td><td class="num">—</td><td class="num">—</td>' +
      '<td class="num">' + money(c.pv) + '</td>' +
      '<td class="num">' + money(c.ev) + '</td>' +
      '<td class="num">' + money(c.ac) + '</td>' +
      '<td class="num key">' + ratio(c.cpi) + '</td>' +
      '<td class="num key">' + ratio(c.spi) + '</td>' +
      '<td class="num ' + (c.cv < 0 ? 'neg' : 'pos') + '">' + money(c.cv) + '</td>' +
      '<td class="num ' + (c.sv < 0 ? 'neg' : 'pos') + '">' + money(c.sv) + '</td>' +
    '</tr>') : '';
  }

  /* ---------- S-curve ---------- */
  function shortAxis(v) {
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
    return String(Math.round(v));
  }

  function renderChart(r) {
    var box = el('evm-chart');
    var s = r.series || [];
    var empty = '<div class="chart-empty">' + esc(t('برای رسم منحنی حداقل دو دوره لازم است.',
              'At least two periods are needed to draw the curve.')) + '</div>';
    if (s.length < 2) { box.innerHTML = empty; return; }

    var maxV = Math.max.apply(null, s.map(function (x) {
      return Math.max(x.cumPV, x.cumEV, x.cumAC);
    }).concat([r.cpe ? r.cpe.bac : 0]));
    if (!(maxV > 0)) { box.innerHTML = empty; return; }

    var W = 760, H = 270, P = { t: 16, r: 16, b: 36, l: 62 };
    var iw = W - P.l - P.r, ih = H - P.t - P.b;
    var X = function (i) { return P.l + i * (iw / (s.length - 1)); };
    var Y = function (v) { return P.t + ih - (v / maxV) * ih; };

    var svg = '';
    for (var g = 0; g <= 4; g++) {
      var v = maxV * g / 4, y = Y(v);
      svg += '<line class="gl" x1="' + P.l + '" y1="' + y + '" x2="' + (W - P.r) + '" y2="' + y + '"/>';
      svg += '<text class="yl" x="' + (P.l - 9) + '" y="' + (y + 4) + '" text-anchor="end">' + shortAxis(v) + '</text>';
    }
    var every = Math.max(1, Math.ceil(s.length / 9));
    s.forEach(function (x, i) {
      if (i % every === 0 || i === s.length - 1) {
        svg += '<text class="xl" x="' + X(i) + '" y="' + (H - P.b + 19) + '" text-anchor="middle">' +
               esc(String(x.period).slice(0, 9)) + '</text>';
      }
    });
    // BAC reference line: the ceiling the forecast is measured against
    if (r.cpe && r.cpe.bac > 0 && r.cpe.bac <= maxV) {
      svg += '<line class="bac" x1="' + P.l + '" y1="' + Y(r.cpe.bac) + '" x2="' + (W - P.r) + '" y2="' + Y(r.cpe.bac) + '"/>';
      svg += '<text class="bact" x="' + (W - P.r) + '" y="' + (Y(r.cpe.bac) - 6) + '" text-anchor="end">BAC</text>';
    }
    ['cumPV', 'cumEV', 'cumAC'].forEach(function (key, k) {
      var cls = ['pv', 'ev', 'ac'][k];
      svg += '<polyline class="cl ' + cls + '" points="' +
             s.map(function (x, i) { return X(i) + ',' + Y(x[key]); }).join(' ') + '"/>';
    });
    s.forEach(function (x, i) {
      svg += '<circle class="pt ev" cx="' + X(i) + '" cy="' + Y(x.cumEV) + '" r="2.6"/>';
    });
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="' + esc(t('منحنی S — PV، EV و AC', 'S-curve of PV, EV and AC')) + '">' + svg + '</svg>';
  }

  /* ---------- controls ---------- */
  function setMode(m) {
    mode = m === 'periodic' ? 'periodic' : 'cumulative';
    controls.querySelectorAll('[data-series]').forEach(function (o) {
      o.classList.toggle('is-on', o.dataset.series === mode);
    });
  }
  function setEac(m) {
    eacMethod = m || 'typical';
    document.querySelectorAll('[data-eac]').forEach(function (o) {
      o.classList.toggle('is-on', o.dataset.eac === eacMethod);
    });
    if (manualWrap) manualWrap.hidden = eacMethod !== 'manual';
  }

  function loadPreset(key) {
    var p = E && E.PRESETS[key];
    if (!p) return;
    input.value = p.tsv;
    controls.querySelectorAll('[data-preset]').forEach(function (c) {
      c.classList.toggle('active', c.dataset.preset === key);
    });
    setMode(p.mode);
    if (bacInput) bacInput.value = p.bac ? String(p.bac) : '';
    recompute();
  }

  /* ---------- persistence ---------- */
  var STORE = 'lab.evm.v1';
  function saveState() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        text: input.value, mode: mode, eac: eacMethod,
        bac: bacInput.value, manual: manualInput.value,
        preset: (controls.querySelector('[data-preset].active') || {}).dataset
                ? controls.querySelector('[data-preset].active').dataset.preset : null
      }));
    } catch (e) { /* private mode — the tool works, it just is not sticky */ }
  }
  function restoreState() {
    var raw = null;
    try { raw = localStorage.getItem(STORE); } catch (e) { return false; }
    if (!raw) return false;
    var st;
    try { st = JSON.parse(raw); } catch (e) { return false; }
    if (!st || typeof st.text !== 'string' || !st.text.trim()) return false;
    input.value = st.text;
    controls.querySelectorAll('[data-preset]').forEach(function (c) {
      c.classList.toggle('active', c.dataset.preset === st.preset);
    });
    setMode(st.mode);
    setEac(st.eac);
    if (bacInput) bacInput.value = st.bac || '';
    if (manualInput) manualInput.value = st.manual || '';
    return true;
  }

  // Scoped to #evm-controls on purpose: the shared header carries its own
  //  data-mode="dark|light" theme buttons, and an unscoped [data-mode] query
  //  made clicking the theme toggle silently reset the input shape.
  controls.querySelectorAll('[data-preset]').forEach(function (chip) {
    chip.addEventListener('click', function () { loadPreset(chip.dataset.preset); });
  });
  controls.querySelectorAll('[data-series]').forEach(function (o) {
    o.addEventListener('click', function () { setMode(o.dataset.series); recompute(); });
  });
  controls.querySelectorAll('[data-eac]').forEach(function (o) {
    o.addEventListener('click', function () { setEac(o.dataset.eac); recompute(); });
  });
  [bacInput, manualInput].forEach(function (f) {
    if (f) f.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(recompute, 350); });
  });

  runBtn.addEventListener('click', recompute);
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(recompute, 420);
    saveState();
  });
  input.addEventListener('paste', function () { setTimeout(function () { recompute(); saveState(); }, 60); });

  clrBtn.addEventListener('click', function () {
    try { localStorage.removeItem(STORE); } catch (e) {}
    var note = el('evm-restored'); if (note) note.hidden = true;
    input.value = '';
    if (bacInput) bacInput.value = '';
    if (manualInput) manualInput.value = '';
    controls.querySelectorAll('[data-preset]').forEach(function (c) { c.classList.remove('active'); });
    recompute();
    input.focus();
  });

  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

  csvBtn.addEventListener('click', function () {
    if (!lastResult || !lastResult.series.length) return;
    var csv = E.toCSV(lastResult);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'evm.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  copyBtn.addEventListener('click', function () {
    if (!lastResult || !lastResult.series.length) return;
    var rows = [['دوره', 'PV', 'EV', 'AC', 'PV تجمعی', 'EV تجمعی', 'AC تجمعی', 'CPI', 'SPI', 'CV', 'SV']];
    lastResult.series.forEach(function (x) {
      rows.push([x.period, x.pv, x.ev, x.ac, x.cumPV, x.cumEV, x.cumAC,
                 x.cpi === null ? '' : x.cpi.toFixed(3), x.spi === null ? '' : x.spi.toFixed(3),
                 Math.round(x.cv), Math.round(x.sv)]);
    });
    var text = rows.map(function (r) { return r.join('\t'); }).join('\n');
    var done = function () {
      copyBtn.classList.add('copied');
      setTimeout(function () { copyBtn.classList.remove('copied'); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text); done(); });
    } else { legacyCopy(text); done(); }
  });

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;inset-inline-start:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  // keep the rendered chrome in sync with the language toggle
  document.querySelectorAll('.lang-opt').forEach(function (b) {
    b.addEventListener('click', function () { setTimeout(recompute, 0); });
  });

  if (!restoreState()) {
    loadPreset('textbook');
  } else {
    var note = el('evm-restored');
    if (note) {
      note.hidden = false;
      var reset = note.querySelector('button');
      if (reset) reset.addEventListener('click', function () {
        try { localStorage.removeItem(STORE); } catch (e) {}
        note.hidden = true;
        loadPreset('textbook');
      });
    }
    recompute();
  }
})();
