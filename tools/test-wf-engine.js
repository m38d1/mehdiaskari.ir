#!/usr/bin/env node
/*
  test-wf-engine.js — regression guard for lab/wf-engine.js

  Asserts the engine reproduces the worked examples published in
  /blog/weight-factor-excel-msp/ , plus the structural guards
  (orphan parents, self-parenting, cycles, empty basis).

  Run:  node tools/test-wf-engine.js      (exit 1 on any failure)
*/
'use strict';

const path = require('path');
const Engine = require(path.join(__dirname, '..', 'lab', 'wf-engine.js'));

let failures = 0;
let passes = 0;

function ok(cond, label, detail) {
  if (cond) { passes++; console.log('  ok    ' + label); }
  else { failures++; console.log('  FAIL  ' + label + (detail ? '\n          ' + detail : '')); }
}
function near(a, b, tol) {
  return Math.abs((a || 0) - b) <= (tol === undefined ? 1e-9 : tol);
}
function run(preset, basis) {
  const p = Engine.PRESETS[preset];
  const parsed = Engine.parse(p.tsv);
  return { parsed, result: Engine.compute(parsed.rows, { basis: basis || p.basis }) };
}
function byId(result, id) {
  return result.nodes.find(n => n.id === id);
}
// informational checks are commentary, never a gate — exclude them from "all green"
function allGreen(result) {
  const gated = result.checks.filter(c => !c.informational);
  return gated.length > 0 && gated.every(c => c.ok);
}

console.log('\n== preset: flat (example 1 of the article) ==');
{
  const { parsed, result } = run('flat');
  ok(parsed.warnings.length === 0, 'parses without warnings', parsed.warnings.join(' | '));
  ok(result.ok, 'computes without errors', result.errors.join(' | '));
  ok(result.basis === 'W', 'basis honoured (W)');

  const expectWF = { A: 0.20, B: 0.30, C: 0.15, D: 0.25, E: 0.10 };
  Object.keys(expectWF).forEach(id => {
    const n = byId(result, id);
    ok(n && near(n.wfProj, expectWF[id], 1e-9), `W.F(${id}) = ${expectWF[id]}`, n && 'got ' + n.wfProj);
  });
  ok(near(result.totals.weightedProgress, 0.41, 1e-9), 'weighted progress = 0.41 (41%)',
     'got ' + result.totals.weightedProgress);
  ok(near(result.totals.sumW, 100) && near(result.totals.sumV, 1000) && near(result.totals.sumC, 410),
     'totals W=100 V=1000 C=410',
     JSON.stringify([result.totals.sumW, result.totals.sumV, result.totals.sumC]));

  const ratios = { A: 0.40, B: 0.40, C: 0.40, D: 0.20, E: 1.00 };
  Object.keys(ratios).forEach(id => {
    const n = byId(result, id);
    ok(n && near(n.costRatio, ratios[id], 1e-9), `cost ratio ${id} = ${ratios[id]}`, n && 'got ' + n.costRatio);
  });
  ok(allGreen(result), 'every gating validation check passes');
  const info = result.checks.find(c => c.informational);
  ok(!!info, 'divergence comparison is reported');
  ok(info && info.diverged === false, 'flat preset: weighted progress equals the raw cost ratio (W is proportional to V)');
  ok(near(result.totals.rawCostProgress, 0.41, 1e-9), 'raw cost progress = 0.41');
}

console.log('\n== preset: hierarchy (example 2 of the article) ==');
{
  const { result } = run('hierarchy');
  ok(result.ok, 'computes without errors', result.errors.join(' | '));

  const con = byId(result, 'CON');
  ok(near(con._v, 600, 1e-9), 'summary row rolls up from children (V اجرا = 180+120+300 = 600)', 'got ' + con._v);
  ok(con.own_v === false, 'summary row ignores its own V (children win)');

  ok(near(byId(result, 'CON-1').wfUp, 0.30, 1e-9), 'W.F↑ الف = 0.30', 'got ' + byId(result, 'CON-1').wfUp);
  ok(near(byId(result, 'CON-2').wfUp, 0.20, 1e-9), 'W.F↑ ب = 0.20', 'got ' + byId(result, 'CON-2').wfUp);
  ok(near(byId(result, 'CON-3').wfUp, 0.50, 1e-9), 'W.F↑ ج = 0.50', 'got ' + byId(result, 'CON-3').wfUp);

  ok(near(byId(result, 'CON-1').wfProj, 0.18, 1e-9), 'W.F project الف = 0.18', 'got ' + byId(result, 'CON-1').wfProj);
  ok(near(byId(result, 'CON-2').wfProj, 0.12, 1e-9), 'W.F project ب = 0.12', 'got ' + byId(result, 'CON-2').wfProj);
  ok(near(byId(result, 'CON-3').wfProj, 0.30, 1e-9), 'W.F project ج = 0.30', 'got ' + byId(result, 'CON-3').wfProj);
  ok(near(byId(result, 'ENG').wfProj, 0.40, 1e-9), 'W.F project مهندسی = 0.40', 'got ' + byId(result, 'ENG').wfProj);
  ok(near(byId(result, 'CON').wfProj, 0.60, 1e-9), 'W.F project اجرا = 0.60', 'got ' + byId(result, 'CON').wfProj);

  const kids = ['CON-1', 'CON-2', 'CON-3'].reduce((a, id) => a + byId(result, id).wfUp, 0);
  ok(near(kids, 1, 1e-9), 'siblings under اجرا sum to exactly 1', 'got ' + kids);
  ok(near(result.totals.rootWeightSum, 1, 1e-9), 'root weights sum to 1');

  // roll-up consistency: parent progress == weighted mean of children
  const manual = ['CON-1', 'CON-2', 'CON-3']
    .map(id => byId(result, id))
    .reduce((a, n) => a + n.wfUp * (n.c / n.v), 0);
  ok(near(con.progress, manual, 1e-9), 'اجرا progress = Σ W.F↑ × progress(children)',
     con.progress + ' vs ' + manual);
  ok(allGreen(result), 'every gating validation check passes');
}

console.log('\n== preset: epcc (3 levels) ==');
{
  const { result } = run('epcc');
  ok(result.ok, 'computes without errors', result.errors.join(' | '));
  ok(result.totals.depth === 2, 'tree depth = 2 levels', 'got ' + result.totals.depth);
  ok(result.leaves.length === 8, 'eight leaf activities', 'got ' + result.leaves.length);
  ok(near(result.totals.rootWeightSum, 1, 1e-9), 'root weights sum to 1');
  const sum = result.leaves.reduce((a, n) => a + n.wfProj, 0);
  ok(near(sum, 1, 1e-9), 'leaf weights sum to 1 (no weight lost in the tree)', 'got ' + sum);
  ok(result.basis === 'W', 'basis is W (importance), not V');
  ok(near(result.totals.weightedProgress, 0.3716981132075472, 1e-9),
     'weighted progress = 37.17%', 'got ' + result.totals.weightedProgress);
  ok(near(result.totals.rawCostProgress, 838 / 1550, 1e-9),
     'raw cost progress = 54.06%', 'got ' + result.totals.rawCostProgress);

  // The point of the whole method: with W != V, weighting must reveal a gap.
  const info = result.checks.find(c => c.informational);
  ok(info && info.diverged === true, 'weighted and raw cost progress DIVERGE on this preset');
  ok(result.totals.weightedProgress < result.totals.rawCostProgress - 0.15,
     'the gap is large (>15 pts): spend ran ahead of physical work',
     'gap = ' + ((result.totals.rawCostProgress - result.totals.weightedProgress) * 100).toFixed(2) + ' pts');
  ok(allGreen(result), 'every gating validation check passes');
}

console.log('\n== the V-basis identity (weighted == raw cost) ==');
{
  const { result } = run('hierarchy');
  const info = result.checks.find(c => c.informational);
  ok(result.basis === 'V', 'hierarchy preset uses V');
  ok(near(result.totals.weightedProgress, result.totals.rawCostProgress, 1e-12),
     'with basis V the two numbers are algebraically identical');
  ok(info && info.diverged === false, 'and the engine reports no divergence');
  ok(info && info.detail.indexOf('\u03a3(V') !== -1,
     'the note explains the identity rather than blaming the data', info && info.detail);
}

console.log("\n== preset: rial (amounts only — the tool's default) ==");
{
  const { result } = run('rial');

  ok(result.basis === 'V', 'basis stays V');
  ok(result.hasCost === false, 'no cost column -> hasCost false');
  ok(result.hasWeight === false, 'no W column -> hasWeight false (the amount must NOT leak into W)');
  ok(result.errors.length === 0, 'no errors', result.errors.join(' | '));
  ok(result.totals.sumV === 14500000000, 'total = 14,500,000,000 rial', 'got ' + result.totals.sumV);

  // a parent whose amount cell is blank is rolled up from its children
  ok(byId(result, '2')._v === 6500000000, 'parent 2 rolls up to 6,500,000,000', 'got ' + byId(result, '2')._v);
  ok(byId(result, '3')._v === 4000000000, 'parent 3 rolls up to 4,000,000,000', 'got ' + byId(result, '3')._v);

  // the two percentages the tool exists to produce
  ok(near(byId(result, '2.1').wfUp, 2500 / 6500, 1e-12),
     '2.1 share of PARENT = 38.46%', 'got ' + byId(result, '2.1').wfUp);
  ok(near(byId(result, '2.1').wfProj, 2500 / 14500, 1e-12),
     '2.1 share of PROJECT = 17.24%', 'got ' + byId(result, '2.1').wfProj);
  ok(near(byId(result, '3.3').wfUp, 0.125, 1e-12), '3.3 share of parent = 12.50%');
  ok(near(byId(result, '4').wfProj, 1000 / 14500, 1e-12), 'root 4 share of project = 6.90%');

  ok(near(result.totals.rootWeightSum, 1, 1e-12), 'sum of root shares = 1');
  ok(near(result.leaves.reduce((a, n) => a + n.wfProj, 0), 1, 1e-12), 'sum of leaf shares = 1');

  const perParent = {};
  result.nodes.forEach(function (n) {
    if (!n.parent) return;
    perParent[n.parent] = (perParent[n.parent] || 0) + n.wfUp;
  });
  Object.keys(perParent).forEach(function (k) {
    ok(near(perParent[k], 1, 1e-12), 'children of ' + k + ' add to exactly 100%', 'got ' + perParent[k]);
  });
  ok(allGreen(result), 'every gating validation check passes');
}

console.log('\n== header parsing: an undeclared column must stay empty ==');
{
  const rial = Engine.parse('کد\tعنوان\tوالد\tمبلغ (ریال)\nA\tالف\t\t1,000,000').rows[0];
  ok(rial.v === 1000000, 'مبلغ (ریال) maps to V', 'got ' + rial.v);
  ok(rial.w === null, 'W is NOT filled from the positional default', 'got ' + rial.w);
  ok(rial.c === null, 'C is NOT filled from the positional default', 'got ' + rial.c);

  const cost = Engine.parse('کد\tعنوان\tوالد\tهزینه (ریال)\nA\tالف\t\t500').rows[0];
  ok(cost.c === 500, 'هزینه (ریال) maps to C, not V', 'got c=' + cost.c + ' v=' + cost.v);
  ok(cost.v === null, 'and V stays empty', 'got ' + cost.v);

  const all3 = Engine.parse('کد\tعنوان\tوالد\tW\tمبلغ (ریال)\tهزینه (ریال)\nA\tالف\t\t4\t9,000\t3,000').rows[0];
  ok(all3.w === 4 && all3.v === 9000 && all3.c === 3000,
     'W / V / C resolve independently', JSON.stringify(all3));
}
console.log('\n== real-world paste shapes ==');
{
  function weights(tsv) {
    const parsed = Engine.parse(tsv);
    const r = Engine.compute(parsed.rows, { basis: 'V' });
    return {
      r: r,
      pairs: r.nodes.map(n => n.id + ':' + (n.wfProj * 100).toFixed(2)),
      sum: r.totals.rootWeightSum
    };
  }
  const shapes = [
    ['Persian headers + Persian digits',
     'شماره\tشرح فعالیت\tسطح بالادستی\tمبلغ ریالی\n۱\tخاکبرداری\t\t۱۲,۵۰۰,۰۰۰\n۲\tفونداسیون\t\t۳۷,۵۰۰,۰۰۰'],
    ['no header, 4 columns (amount is V, not W)',
     'A\tالف\t\t50000000\nB\tب\t\t150000000'],
    ['P6 English export',
     'Activity ID\tActivity Name\tParent\tBudget at Completion\n1000\tEarthworks\t\t12500000\n1010\tFoundation\t\t37500000'],
    ['code that merely contains the word Activity',
     'Activity-1\tخاکبرداری\t\t5000\nActivity-2\tفونداسیون\t\t15000']
  ];
  shapes.forEach(function (sh) {
    const w = weights(sh[1]);
    ok(w.r.errors.length === 0, sh[0] + ': parses cleanly', w.r.errors.join(' | '));
    ok(w.pairs.map(function (x) { return x.split(':')[1]; }).join(' ') === '25.00 75.00',
       sh[0] + ': weights are 25% / 75%', 'got ' + w.pairs.join(' '));
    ok(near(w.sum, 1, 1e-12), sh[0] + ': shares add to 100%');
  });

  // "Budget at Completion" must not be captured by the single-letter 'c' alias
  const p6 = Engine.parse('Activity ID\tActivity Name\tParent\tBudget at Completion\n1000\tEarthworks\t\t12500000').rows[0];
  ok(p6.v === 12500000, 'Budget at Completion resolves to V', 'got v=' + p6.v);
  ok(p6.c === null, 'and NOT to C', 'got c=' + p6.c);
}

  // a Persian-digit code must still link to a Latin-digit parent reference
  const mixed = Engine.parse('کد\tعنوان\tوالد\tمبلغ\n1\tکل\t\t\n۲\tفرزند\t1\t400000000');
  const mr = Engine.compute(mixed.rows, { basis: 'V' });
  ok(mixed.rows[1].id === '2', '۲ is stored as "2"', 'got ' + JSON.stringify(mixed.rows[1].id));
  ok(mr.nodes.length === 2 && byId(mr, '2') && byId(mr, '2').parent === '1',
     '۲ links to parent 1 across digit systems', JSON.stringify(mr.nodes.map(n => n.id + '->' + n.parent)));
  ok(near(byId(mr, '2').wfUp, 1, 1e-12), 'and the child is 100% of that parent');

console.log('\n== structural guards ==');
{
  const bad = Engine.parse('کد\tعنوان\tوالد\tV\tC\n1\tالف\tZZZ\t100\t50').rows;
  const r1 = Engine.compute(bad, { basis: 'V' });
  ok(r1.errors.some(e => e.includes('ZZZ')), 'unknown parent is reported');
  ok(near(r1.totals.rootWeightSum, 1, 1e-9), 'orphan still treated as a root (weights stay normalised)');

  const self = Engine.parse('کد\tعنوان\tوالد\tV\tC\n1\tالف\t1\t100\t50').rows;
  const r2 = Engine.compute(self, { basis: 'V' });
  ok(r2.errors.some(e => e.includes('والد خودش')), 'self-parenting is reported');

  const cyc = Engine.parse('کد\tعنوان\tوالد\tV\tC\n1\tالف\t2\t100\t50\n2\tب\t1\t200\t80').rows;
  const r3 = Engine.compute(cyc, { basis: 'V' });
  ok(r3.errors.length > 0, 'a cycle cannot hang the engine');

  const zero = Engine.parse('کد\tعنوان\tوالد\tW\tV\tC\n1\tالف\t\t0\t0\t0').rows;
  const r4 = Engine.compute(zero, { basis: 'W' });
  ok(!r4.ok && r4.errors.length > 0, 'all-zero basis fails loudly instead of dividing by zero');
  ok(r4.warnings.some(w => w.includes('V')), 'auto-fallback to V is announced');

  const unbalanced = Engine.parse(
    'کد\tعنوان\tوالد\tV\tC\nP\tوالد\t\t\t\nA\tالف\tP\t100\t50\nB\tب\tP\t50\t20').rows;
  const r5 = Engine.compute(unbalanced, { basis: 'V' });
  const sib = r5.checks.find(c => c.label.indexOf('فرزندان') !== -1);
  ok(sib && sib.ok, 'balanced siblings pass');

  const dup = Engine.parse('کد\tعنوان\tوالد\tV\tC\n1\tالف\t\t100\t50\n1\tالف تکراری\t\t100\t50');
  ok(dup.warnings.some(w => w.includes('تکراری')), 'duplicate codes are dropped with a warning');
  ok(dup.rows.length === 1, 'duplicate row not counted twice', 'got ' + dup.rows.length);

  const noHeader = Engine.parse('A\tبسته الف\t\t20\t200\t80').rows;
  const r6 = Engine.compute(noHeader, { basis: 'W' });
  ok(r6.ok && near(byId(r6, 'A').wfProj, 1, 1e-9), 'headerless TSV still parses positionally');
}

console.log('\n== export ==');
{
  const { result } = run('flat');
  const csv = Engine.toCSV(result);
  ok(csv.charCodeAt(0) === 0xFEFF, 'CSV carries a BOM (Excel opens Persian correctly)');
  ok(csv.split('\r\n').length === 8, 'CSV has header + 5 rows + blank + total', 'got ' + csv.split('\r\n').length);
  ok(/0\.41/.test(csv), 'CSV carries the weighted progress');
}

console.log(`\n${passes} passed, ${failures} failed.\n`);
process.exit(failures ? 1 : 0);
