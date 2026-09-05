/* =========================================================
   mehdiaskari.ir — W.F engine (hierarchical / parent-relative weight factor)
   Implements exactly the method documented in
   /blog/weight-factor-excel-msp/ :

     W.F↑_i      = V_i / V_parent            (parent-relative weight)
                 = W.F_proj(i) / W.F_proj(parent)
     W.F_proj    = product of W.F↑ along the path to the root
     progress_i  = C_i / V_i                 (leaf estimate from cost)
     progress_p  = Σ W.F↑_child × progress_child   (roll-up)

   Pure, dependency-free, and side-effect free so it can be unit-tested in
   Node (tools/test-wf-engine.js) and reused by future tools.
   UMD-ish: attaches to window in the browser, module.exports in Node.
   ========================================================= */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.WFEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var EPS = 1e-9;
  var round = function (n, d) {
    var f = Math.pow(10, d === undefined ? 6 : d);
    return Math.round((Number(n) || 0) * f) / f;
  };

  /* ---------- column aliases: Persian + English, case-insensitive ---------- */
  var ALIASES = {
    id:     ['code', 'id', 'wbs', 'کد', 'شناسه', 'شماره'],
    name:   ['name', 'title', 'activity', 'عنوان', 'نام', 'فعالیت'],
    parent: ['parent', 'pid', 'parent id', 'parent code', 'والد', 'پدر', 'سطح بالادستی'],
    w:      ['w', 'weight', 'وزن'],
    v:      ['v', 'value', 'budget', 'bac', 'ارزش', 'بودجه', 'قیمت'],
    c:      ['c', 'cost', 'ac', 'acwp', 'actual', 'هزینه', 'هزینه واقعی', 'مصرف']
  };

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  function matchColumn(header) {
    var h = norm(header).replace(/[\u200c\u200e\u200f]/g, '');
    var key, list, i;
    // exact match first, so "C" cannot be captured by the "cost" alias
    for (key in ALIASES) {
      if (!Object.prototype.hasOwnProperty.call(ALIASES, key)) continue;
      list = ALIASES[key];
      for (i = 0; i < list.length; i++) if (h === list[i]) return key;
    }
    for (key in ALIASES) {
      if (!Object.prototype.hasOwnProperty.call(ALIASES, key)) continue;
      list = ALIASES[key];
      for (i = 0; i < list.length; i++) if (h.indexOf(list[i]) !== -1) return key;
    }
    return null;
  }

  function toNumber(s) {
    var t = String(s == null ? '' : s).trim()
      .replace(/[\u06f0-\u06f9]/g, function (d) { return String(d.charCodeAt(0) - 0x06f0); })
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[,،\s]/g, '')
      .replace(/%$/, '');
    if (t === '' || t === '-' || t === '—') return null;
    var n = Number(t);
    return isFinite(n) ? n : null;
  }

  /* ---------- TSV / CSV parsing ---------- */
  function splitLine(line) {
    if (line.indexOf('\t') !== -1) return line.split('\t');
    return line.split(/[,;]+/);
  }

  function parse(text) {
    var warnings = [];
    var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return { rows: [], warnings: ['ورودی خالی است.'] };

    var header = splitLine(lines[0]).map(function (c) { return c.trim(); });
    var map = header.map(matchColumn);
    var hasHeader = map.indexOf('id') !== -1 || map.indexOf('name') !== -1;

    var cols = { id: 0, name: 1, parent: 2, w: 3, v: 4, c: 5 };
    var body = lines;

    if (hasHeader) {
      body = lines.slice(1);
      for (var k in cols) {
        if (!Object.prototype.hasOwnProperty.call(cols, k)) continue;
        var idx = map.indexOf(k);
        if (idx !== -1) cols[k] = idx;
      }
    } else {
      warnings.push('سرستون پیدا نشد؛ ترتیب ستون‌ها فرض شد: کد، عنوان، والد، W، V، C');
    }

    var rows = [];
    var seen = {};
    body.forEach(function (line, i) {
      var cells = splitLine(line).map(function (c) { return c.trim(); });
      var id = cells[cols.id] !== undefined ? cells[cols.id] : '';
      if (id === '') { warnings.push('سطر ' + (i + 1) + ': کد خالی است، نادیده گرفته شد'); return; }
      if (seen[id]) { warnings.push('کد تکراری «' + id + '» در سطر ' + (i + 1) + ' نادیده گرفته شد'); return; }
      seen[id] = 1;
      rows.push({
        id: String(id),
        name: cells[cols.name] || String(id),
        parent: cells[cols.parent] ? String(cells[cols.parent]) : '',
        w: toNumber(cells[cols.w]),
        v: toNumber(cells[cols.v]),
        c: toNumber(cells[cols.c])
      });
    });
    return { rows: rows, warnings: warnings };
  }

  /* ---------- tree building ---------- */
  function buildTree(rows) {
    var byId = {};
    rows.forEach(function (r) { byId[r.id] = r; });

    var errors = [];
    rows.forEach(function (r) {
      if (!r.parent) return;
      if (r.parent === r.id) { errors.push('گره «' + r.id + '» والد خودش است.'); r.parent = ''; return; }
      if (!byId[r.parent]) { errors.push('والد «' + (r.name || r.id) + '» یعنی «' + r.parent + '» در جدول نیست؛ به‌عنوان ریشه در نظر گرفته شد.'); r.parent = ''; }
    });

    rows.forEach(function (r) {
      r.childIds = []; r.depth = 0;
    });
    rows.forEach(function (r) {
      if (r.parent && byId[r.parent]) byId[r.parent].childIds.push(r.id);
    });

    var roots = rows.filter(function (r) { return !r.parent; });

    // cycle guard + depth assignment
    function visit(node, depth, path) {
      if (path.indexOf(node.id) !== -1) {
        errors.push('حلقه در سلسله‌مراتب: ' + path.slice(path.indexOf(node.id)).concat(node.id).join(' ← '));
        return;
      }
      node.depth = Math.max(node.depth, depth);
      var next = path.concat(node.id);
      node.childIds.forEach(function (cid) { visit(byId[cid], depth + 1, next); });
    }
    roots.forEach(function (r) { visit(r, 0, []); });

    return { byId: byId, roots: roots, errors: errors };
  }

  /* ---------- roll-up of raw metrics ---------- */
  function rollup(node, field, byId) {
    if (!node.childIds.length) {
      node['_' + field] = node[field] == null ? 0 : node[field];
      node['own_' + field] = node[field] != null;
      return node['_' + field];
    }
    var sum = 0;
    node.childIds.forEach(function (cid) { sum += rollup(byId[cid], field, byId); });
    node['_' + field] = sum;
    node['own_' + field] = false;   // summary row: children win (WBS roll-up)
    return sum;
  }

  /* ---------- main computation ---------- */
  function compute(rows, options) {
    options = options || {};
    var requestedBasis = options.basis === 'W' ? 'W' : 'V';
    var built = buildTree(rows);
    var byId = built.byId, roots = built.roots;
    var errors = built.errors.slice();
    var warnings = [];

    if (!rows.length) {
      return { ok: false, errors: ['هیچ داده‌ای برای محاسبه نیست.'], warnings: [], nodes: [], totals: {} };
    }

    ['w', 'v', 'c'].forEach(function (f) {
      roots.forEach(function (r) { rollup(r, f, byId); });
    });

    var sumW = roots.reduce(function (a, r) { return a + r._w; }, 0);
    var sumV = roots.reduce(function (a, r) { return a + r._v; }, 0);
    var sumC = roots.reduce(function (a, r) { return a + r._c; }, 0);

    var basis = requestedBasis;
    if (basis === 'W' && sumW <= EPS) {
      basis = 'V';
      warnings.push('جمع ستون W صفر است؛ مبنای وزن‌دهی خودکار به V تغییر کرد.');
    }
    var field = basis === 'W' ? 'w' : 'v';          // roll-ups are stored as _w / _v / _c
    var total = field === 'w' ? sumW : sumV;
    if (total <= EPS) {
      errors.push('جمع مبنای وزن‌دهی (' + basis + ') صفر است — قابل محاسبه نیست.');
      return { ok: false, errors: errors, warnings: warnings, nodes: [], totals: {} };
    }

    // pass 1: parent-relative weight + project weight
    function walk(node, parentWeight, pathNames) {
      node.wfUp = parentWeight === null
        ? node['_' + field] / total
        : (parentWeight > EPS ? node['_' + field] / parentWeight : 0);
      node.wfProj = (node.parent && byId[node.parent] ? byId[node.parent].wfProj : 1) * node.wfUp;
      node.path = pathNames.concat(node.name || node.id);
      node.childIds.forEach(function (cid) { walk(byId[cid], node['_' + field], node.path); });
    }
    roots.forEach(function (r) { walk(r, null, []); });

    // pass 2: progress — leaves estimate from cost ratio, parents roll up
    function progress(node) {
      if (!node.childIds.length) {
        node.costRatio = (node.v != null && node.v > EPS) ? (node.c == null ? 0 : node.c) / node.v : null;
        node.progress = node.costRatio == null ? 0 : node.costRatio;
        if (node.costRatio != null && node.costRatio > 1 + EPS) {
          warnings.push('«' + (node.name || node.id) + '» هزینه‌اش از بودجه‌اش بیشتر شده (نسبت ' + round(node.costRatio, 2) + ').');
        }
        if (node.costRatio == null) {
          warnings.push('«' + (node.name || node.id) + '» ارزش (V) ندارد؛ پیشرفتش صفر گرفته شد.');
          node.progress = 0;
        }
        return node.progress;
      }
      var acc = 0;
      node.childIds.forEach(function (cid) {
        var child = byId[cid];
        acc += child.wfUp * progress(child);
      });
      node.progress = acc;
      node.costRatio = node._v > EPS ? node._c / node._v : null;
      return acc;
    }
    roots.forEach(function (r) { progress(r); });

    // weighted share of each node's own progress on the project number
    function share(node) {
      node.weightedShare = node.wfProj * (node.childIds.length ? 0 : (node.progress || 0));
      node.childIds.forEach(function (cid) { share(byId[cid]); });
    }
    roots.forEach(function (r) { share(r); });

    var leaves = rows.filter(function (r) { return !r.childIds.length; });
    var wpLeaves = leaves.reduce(function (a, r) { return a + r.wfProj * (r.progress || 0); }, 0);
    var wpRoots = roots.reduce(function (a, r) { return a + r.wfUp * (r.progress || 0); }, 0);

    // ---------- validation ----------
    var checks = [];
    var siblingBad = [];
    rows.forEach(function (r) {
      if (!r.childIds.length) return;
      var s = r.childIds.reduce(function (a, cid) { return a + byId[cid].wfUp; }, 0);
      if (Math.abs(s - 1) > 1e-6) siblingBad.push((r.name || r.id) + ' = ' + round(s, 4));
    });
    checks.push({
      ok: siblingBad.length === 0,
      label: 'مجموع W.F↑ فرزندانِ هر والد دقیقاً ۱ است',
      detail: siblingBad.length ? 'خارج از تراز: ' + siblingBad.join('، ') : 'هر سطح ۱۰۰٪ والد را می‌سازد.'
    });

    var rootSum = roots.reduce(function (a, r) { return a + r.wfProj; }, 0);
    checks.push({
      ok: Math.abs(rootSum - 1) <= 1e-6,
      label: 'مجموع وزن پروژهٔ همهٔ گره‌های ریشه = ۱',
      detail: 'Σ W.F_proj = ' + round(rootSum, 6)
    });

    var leafProjSum = leaves.reduce(function (a, r) { return a + r.wfProj; }, 0);
    checks.push({
      ok: Math.abs(leafProjSum - rootSum) <= 1e-6,
      label: 'جمع وزن پروژهٔ برگ‌ها با کل پروژه می‌خواند',
      detail: 'برگ‌ها = ' + round(leafProjSum, 6) + '، کل = ' + round(rootSum, 6)
    });

    checks.push({
      ok: Math.abs(wpLeaves - wpRoots) <= 1e-6,
      label: 'محاسبهٔ از پایین (برگ‌ها) با تجمیع از بالا (ریشه‌ها) یکی است',
      detail: round(wpLeaves, 6) + ' در برابر ' + round(wpRoots, 6)
    });

    var flat = leaves.reduce(function (a, r) { return a + (r.v == null ? 0 : r.v); }, 0);
    checks.push({
      ok: Math.abs(flat - sumV) <= Math.max(1, Math.abs(sumV) * 1e-6),
      label: 'جمع ارزش برگ‌ها با ارزش کل پروژه می‌خواند',
      detail: round(flat, 2) + ' / ' + round(sumV, 2)
    });

    var flatProgress = sumV > EPS ? sumC / sumV : 0;
    var divergence = wpLeaves - flatProgress;
    checks.push({
      ok: true,                 // informational: never a pass/fail gate
      informational: true,
      diverged: Math.abs(divergence) > 1e-4,
      label: 'مقایسه با «میانگین هزینهٔ کل»',
      detail: 'وزنی ' + round(wpLeaves * 100, 2) + '٪ در برابر هزینهٔ خام ' + round(flatProgress * 100, 2) +
              '٪ (اختلاف ' + (divergence >= 0 ? '+' : '') + round(divergence * 100, 2) + ' واحد درصد). ' +
              (Math.abs(divergence) > 1e-4
                ? 'وزن‌دهی، انحرافی را رو کرده که عدد خام پنهان می‌کرد.'
                : 'در این داده‌ها وزن با ارزش هم‌تناسب است، پس دو عدد یکی می‌شوند.')
    });

    var maxDepth = rows.reduce(function (a, r) { return Math.max(a, r.depth); }, 0);

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      checks: checks,
      basis: basis,
      requestedBasis: requestedBasis,
      nodes: rows,
      leaves: leaves,
      totals: {
        sumW: sumW, sumV: sumV, sumC: sumC,
        rootWeightSum: rootSum,
        weightedProgress: wpLeaves,
        rawCostProgress: flatProgress,
        nodeCount: rows.length,
        leafCount: leaves.length,
        depth: maxDepth + 1
      }
    };
  }

  /* ---------- export ---------- */
  function toCSV(result) {
    var head = ['code', 'name', 'parent', 'level', 'W', 'V', 'C', 'WF_up', 'WF_project', 'cost_ratio', 'progress', 'weighted_share'];
    var lines = [head.join(',')];
    result.nodes.forEach(function (n) {
      lines.push([
        n.id, '"' + String(n.name).replace(/"/g, '""') + '"', n.parent || '', n.depth,
        n.w == null ? '' : n.w, n.v == null ? '' : n.v, n.c == null ? '' : n.c,
        round(n.wfUp, 6), round(n.wfProj, 6),
        n.costRatio == null ? '' : round(n.costRatio, 6),
        round(n.progress, 6), round(n.weightedShare, 6)
      ].join(','));
    });
    lines.push('');
    lines.push('TOTAL,,,,,' + round(result.totals.sumC, 2) + ',,' + round(result.totals.rootWeightSum, 6) + ',,' + round(result.totals.weightedProgress, 6));
    return '\ufeff' + lines.join('\r\n');
  }

  /* ---------- presets: the two worked examples from the blog post ---------- */
  var PRESETS = {
    flat: {
      label: 'مثال ۱ مقاله — تخت (۵ بسته)',
      basis: 'W',
      tsv: [
        'کد\tعنوان\tوالد\tW\tV\tC',
        'A\tبسته الف\t\t20\t200\t80',
        'B\tبسته ب\t\t30\t300\t120',
        'C\tبسته ج\t\t15\t150\t60',
        'D\tبسته د\t\t25\t250\t50',
        'E\tبسته ه\t\t10\t100\t100'
      ].join('\n')
    },
    hierarchy: {
      label: 'مثال ۲ مقاله — سلسله‌مراتبی',
      basis: 'V',
      tsv: [
        'کد\tعنوان\tوالد\tW\tV\tC',
        'ENG\tمهندسی\t\t\t400\t180',
        'CON\tاجرا\t\t\t\t',
        'CON-1\tالف\tCON\t\t180\t60',
        'CON-2\tب\tCON\t\t120\t48',
        'CON-3\tج\tCON\t\t300\t150'
      ].join('\n')
    },
    epcc: {
      label: 'پروژهٔ نمونه — EPCC سه‌سطحی',
      basis: 'V',
      tsv: [
        'کد\tعنوان\tوالد\tW\tV\tC',
        '1\tمهندسی\t\t\t\t',
        '1.1\tمهندسی فرآیند\t1\t\t120\t96',
        '1.2\tمهندسی پایپینگ\t1\t\t180\t90',
        '1.3\tمهندسی برق\t1\t\t90\t27',
        '2\tتأمین\t\t\t\t',
        '2.1\tتجهیزات ثابت\t2\t\t420\t294',
        '2.2\tتجهیزات دوار\t2\t\t310\t248',
        '3\tساخت و نصب\t\t\t\t',
        '3.1\tساختار فلزی\t3\t\t150\t45',
        '3.2\tپایپینگ فیلد\t3\t\t200\t30',
        '4\tراه‌اندازی\t\t\t\t',
        '4.1\tکمیسیونینگ\t4\t\t80\t8'
      ].join('\n')
    }
  };

  return {
    parse: parse,
    compute: compute,
    toCSV: toCSV,
    PRESETS: PRESETS,
    round: round
  };
});
