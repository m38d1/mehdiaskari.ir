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
  ok(result.totals.weightedProgress > 0.3 && result.totals.weightedProgress < 0.7,
     'weighted progress is a sane number', 'got ' + result.totals.weightedProgress);
}

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
