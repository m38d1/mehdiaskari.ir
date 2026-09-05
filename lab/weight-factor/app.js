/* =========================================================
   /lab/weight-factor/ — UI wiring for the W.F calculator
   Talks to /lab/wf-engine.js only; no dependencies, no network.
   ========================================================= */
(function () {
  'use strict';

  var E = window.WFEngine;
  if (!E) { console.error('wf-engine.js did not load'); return; }

  var el = function (id) { return document.getElementById(id); };
  var input   = el('wf-input');
  var runBtn  = el('wf-run');
  var csvBtn  = el('wf-csv');
  var clrBtn  = el('wf-clear');
  var copyBtn = el('wf-copy');
  var tbody   = el('wf-body');
  var tfoot   = el('wf-foot');
  var checksBox = el('s-checks');
  var noticeBox = el('s-notices');

  var basis = 'V';
  var lastResult = null;
  var timer = null;

  /* ---------- bilingual helper (chrome only; numbers stay neutral) ---------- */
  function t(fa, en) {
    return (document.documentElement.lang === 'en') ? en : fa;
  }
  function pct(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return (n * 100).toFixed(d === undefined ? 1 : d) + '٪';
  }
  function dec(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Number(n).toFixed(d === undefined ? 3 : d);
  }
  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- compute + render ---------- */
  function recompute() {
    if (!E) return;
    var parsed = E.parse(input.value);
    var result = E.compute(parsed.rows, { basis: basis });
    result.parseWarnings = parsed.warnings;
    lastResult = result;
    render(result);
  }

  function render(r) {
    renderSummary(r);
    renderChecks(r);
    renderNotices(r);
    renderTable(r);
    var hasRows = r.nodes && r.nodes.length > 0;
    csvBtn.disabled = !hasRows;
    copyBtn.disabled = !hasRows;
    if (copyBtn) copyBtn.classList.remove('copied');
  }

  function renderSummary(r) {
    var big = el('s-progress');
    var sub = el('s-diverge');
    var T = r.totals || {};
    if (!r.ok || !isFinite(T.weightedProgress)) {
      big.textContent = '—';
      big.classList.add('is-empty');
      sub.textContent = r.errors && r.errors.length
        ? t('مشکل در داده‌ها — پایین را ببینید', 'Input problem — see notices below')
        : t('داده‌ای برای محاسبه نیست', 'Nothing to compute yet');
    } else {
      big.classList.remove('is-empty');
      big.textContent = (T.weightedProgress * 100).toFixed(1) + '٪';
      var info = (r.checks || []).filter(function (c) { return c.informational; })[0];
      sub.textContent = info ? info.detail : '';
    }
    el('s-nodes').textContent  = T.nodeCount || 0;
    el('s-leaves').textContent = T.leafCount || 0;
    el('s-depth').textContent  = T.depth || 0;
    el('s-sumv').textContent   = money(T.sumV);
    el('s-sumc').textContent   = money(T.sumC);
    el('s-basis').textContent  = r.basis || '—';
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
    (r.warnings || []).forEach(function (m) { msgs.push({ k: 'warn', m: m }); });
    (r.parseWarnings || []).forEach(function (m) { msgs.push({ k: 'warn', m: m }); });
    if (!msgs.length) { noticeBox.innerHTML = ''; return; }
    noticeBox.innerHTML = msgs.slice(0, 12).map(function (x) {
      return '<div class="notice ' + (x.k === 'err' ? 'err' : '') + '">' + esc(x.m) + '</div>';
    }).join('') + (msgs.length > 12 ? '<div class="notice">+ ' + (msgs.length - 12) + '</div>' : '');
  }

  function renderTable(r) {
    if (!r.nodes || !r.nodes.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">' +
        esc(t('داده‌ای برای نمایش نیست.', 'Nothing to show yet.')) + '</td></tr>';
      tfoot.innerHTML = '';
      return;
    }
    var maxWF = Math.max.apply(null, r.nodes.map(function (n) { return n.wfProj || 0; }).concat([1e-9]));

    tbody.innerHTML = r.nodes.map(function (n) {
      var isSum = n.childIds && n.childIds.length > 0;
      var pad = 10 + n.depth * 18;
      var barW = Math.round(((n.wfProj || 0) / maxWF) * 84);
      return '<tr class="' + (isSum ? 'is-summary' : '') + '">' +
        '<td class="name" style="padding-inline-start:' + pad + 'px">' +
          '<span class="dot"></span>' + esc(n.name || n.id) +
          (isSum ? ' <span class="panel-hint">(' + n.childIds.length + ')</span>' : '') +
        '</td>' +
        '<td class="num">' + (n.w == null ? '—' : money(n.w)) + '</td>' +
        '<td class="num" ' + (isSum ? 'title="' + esc(t('جمع‌شده از فرزندان', 'rolled up from children')) + '"' : '') + '>' +
          (n._v ? money(n._v) : '—') + '</td>' +
        '<td class="num">' + (n._c ? money(n._c) : '—') + '</td>' +
        '<td class="num">' + dec(n.wfUp, 4) + '</td>' +
        '<td class="num">' + dec(n.wfProj, 4) +
          '<span class="wf-bar-track"><span class="wf-bar" style="width:' + barW + 'px"></span></span></td>' +
        '<td class="num">' + (n.costRatio == null ? '—' : pct(n.costRatio, 0)) + '</td>' +
        '<td class="num">' + pct(n.progress, 1) + '</td>' +
        '<td class="num">' + (isSum ? '—' : dec(n.weightedShare, 4)) + '</td>' +
      '</tr>';
    }).join('');

    var T = r.totals || {};
    tfoot.innerHTML = '<tr>' +
      '<td>' + esc(t('کل پروژه', 'Project total')) + '</td>' +
      '<td class="num">' + money(T.sumW) + '</td>' +
      '<td class="num">' + money(T.sumV) + '</td>' +
      '<td class="num">' + money(T.sumC) + '</td>' +
      '<td class="num">—</td>' +
      '<td class="num">' + dec(T.rootWeightSum, 4) + '</td>' +
      '<td class="num">' + pct(T.rawCostProgress, 0) + '</td>' +
      '<td class="num">' + pct(T.weightedProgress, 1) + '</td>' +
      '<td class="num">' + dec(T.weightedProgress, 4) + '</td>' +
    '</tr>';
  }

  /* ---------- controls ---------- */
  function setBasis(b) {
    basis = b;
    document.querySelectorAll('.seg-opt').forEach(function (o) {
      o.classList.toggle('is-on', o.dataset.basis === b);
    });
    recompute();
  }

  function loadPreset(key) {
    var p = E.PRESETS[key];
    if (!p) return;
    input.value = p.tsv;
    document.querySelectorAll('[data-preset]').forEach(function (c) {
      c.classList.toggle('active', c.dataset.preset === key);
    });
    setBasis(p.basis);
  }

  document.querySelectorAll('[data-preset]').forEach(function (chip) {
    chip.addEventListener('click', function () { loadPreset(chip.dataset.preset); });
  });
  document.querySelectorAll('.seg-opt').forEach(function (o) {
    o.addEventListener('click', function () { setBasis(o.dataset.basis); });
  });

  runBtn.addEventListener('click', recompute);
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(recompute, 420);
  });
  input.addEventListener('paste', function () { setTimeout(recompute, 60); });

  clrBtn.addEventListener('click', function () {
    input.value = '';
    document.querySelectorAll('[data-preset]').forEach(function (c) { c.classList.remove('active'); });
    recompute();
    input.focus();
  });

  csvBtn.addEventListener('click', function () {
    if (!lastResult || !lastResult.nodes.length) return;
    var csv = E.toCSV(lastResult);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'weight-factor.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  });

  copyBtn.addEventListener('click', function () {
    if (!lastResult || !lastResult.nodes.length) return;
    var head = ['code', 'name', 'parent', 'level', 'W', 'V', 'C', 'WF_up', 'WF_project', 'cost_ratio', 'progress', 'weighted_share'];
    var lines = [head.join('\t')].concat(lastResult.nodes.map(function (n) {
      return [n.id, n.name, n.parent || '', n.depth,
        n.w == null ? '' : n.w, n._v, n._c,
        E.round(n.wfUp, 6), E.round(n.wfProj, 6),
        n.costRatio == null ? '' : E.round(n.costRatio, 6),
        E.round(n.progress, 6), E.round(n.weightedShare, 6)].join('\t');
    }));
    var text = lines.join('\n');
    function done() {
      copyBtn.classList.add('copied');
      copyBtn.textContent = t('کپی شد ✓', 'Copied ✓');
      setTimeout(function () {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = t('کپی جدول', 'Copy table');
      }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  });

  function fallbackCopy(text) {
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

  loadPreset('flat');
})();
