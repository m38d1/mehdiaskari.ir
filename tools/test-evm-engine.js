#!/usr/bin/env node
/*
 * test-evm-engine.js — pins lab/evm-engine.js to published EVM arithmetic.
 *
 * The textbook case is the one every PMBOK study guide uses, so if these numbers
 * move, the tool is quietly wrong in front of clients. The cumulative-vs-periodic
 * equivalence test is the one that guards the mode toggle.
 *
 *   node tools/test-evm-engine.js
 */
const path = require('path');
const E = require(path.join(__dirname, '..', 'lab', 'evm-engine.js'));

let passes = 0, failures = 0;
function ok(cond, label, detail) {
  if (cond) { passes++; console.log('  ok    ' + label); }
  else { failures++; console.log('  FAIL  ' + label + (detail ? '\n          ' + detail : '')); }
}
function near(a, b, tol) {
  if (a === null || a === undefined) return b === null || b === undefined;
  return Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);
}
function gated(r) { return r.checks.filter(c => !c.informational); }
function allGreen(r) { const g = gated(r); return g.length > 0 && g.every(c => c.ok); }
function run(preset, over) {
  const p = E.PRESETS[preset];
  const parsed = E.parse(p.tsv);
  const opts = Object.assign({ mode: p.mode, bac: p.bac, eac: 'typical' }, over || {});
  return { parsed, r: E.compute(parsed.rows, opts) };
}

console.log('\n== textbook case — BAC 100k, PV 40k, EV 30k, AC 35k ==');
{
  const { r } = run('textbook');
  const c = r.cpe;
  ok(r.errors.length === 0, 'no errors', r.errors.join(' | '));
  ok(c.bac === 100000 && c.pv === 40000 && c.ev === 30000 && c.ac === 35000,
     'CPE totals read correctly', JSON.stringify([c.bac, c.pv, c.ev, c.ac]));
  ok(c.cv === -5000, 'CV = EV − AC = −5,000', 'got ' + c.cv);
  ok(c.sv === -10000, 'SV = EV − PV = −10,000', 'got ' + c.sv);
  ok(near(c.cpi, 6 / 7), 'CPI = 0.857143', 'got ' + c.cpi);
  ok(near(c.spi, 0.75), 'SPI = 0.75', 'got ' + c.spi);
  ok(near(c.eac, 350000 / 3), 'EAC(typical) = BAC/CPI = 116,666.67', 'got ' + c.eac);
  ok(near(c.etc, 350000 / 3 - 35000), 'ETC = EAC − AC = 81,666.67', 'got ' + c.etc);
  ok(near(c.vac, -(350000 / 3) + 100000), 'VAC = BAC − EAC = −16,666.67', 'got ' + c.vac);
  ok(near(c.tcpiBac, 70000 / 65000), 'TCPI(BAC) = 1.076923', 'got ' + c.tcpiBac);
  ok(near(c.pctComplete, 0.30), 'percent complete = 30%', 'got ' + c.pctComplete);
  ok(near(c.pctSpent, 0.35), 'percent spent = 35%', 'got ' + c.pctSpent);
  ok(near(c.pctPlanned, 0.40), 'percent planned = 40%', 'got ' + c.pctPlanned);
  ok(allGreen(r), 'every gating check passes');
}

console.log('\n== the three EAC methods agree with their formulas ==');
{
  const typical = run('textbook', { eac: 'typical' }).r.cpe;
  const atypical = run('textbook', { eac: 'atypical' }).r.cpe;
  const composite = run('textbook', { eac: 'composite' }).r.cpe;
  ok(near(typical.eac, 100000 / (6 / 7)), 'typical: BAC / CPI', 'got ' + typical.eac);
  ok(near(atypical.eac, 105000), 'atypical: AC + (BAC − EV) = 105,000', 'got ' + atypical.eac);
  ok(near(composite.eac, 35000 + 70000 / ((6 / 7) * 0.75)),
     'composite: AC + (BAC−EV)/(CPI×SPI) = 143,888.89', 'got ' + composite.eac);
  ok(composite.eac > typical.eac && typical.eac > atypical.eac,
     'composite ≥ typical ≥ atypical when both indices are below 1');
  // an invariant: if EAC = BAC/CPI then TCPI against that EAC must equal CPI
  ok(near(typical.tcpiEac, typical.cpi),
     'TCPI(EAC) collapses onto CPI when EAC was derived as BAC/CPI',
     'tcpiEac=' + typical.tcpiEac + ' cpi=' + typical.cpi);
}

console.log('\n== manual EAC wins, and falls back when absent ==');
{
  const m = run('textbook', { eac: 'manual', manualEac: 110000 }).r;
  ok(m.cpe.eac === 110000, 'manual EAC used verbatim', 'got ' + m.cpe.eac);
  ok(m.eacMethod === 'manual', 'method reported as manual', 'got ' + m.eacMethod);
  ok(near(m.cpe.vac, -10000), 'VAC follows the manual figure', 'got ' + m.cpe.vac);
  const fb = run('textbook', { eac: 'manual' }).r;
  ok(fb.eacMethod === 'typical', 'manual with no figure falls back to typical', 'got ' + fb.eacMethod);
  ok(fb.warnings.some(w => w.indexOf('دستی') !== -1), 'and says so in a warning');
}

console.log('\n== cumulative and periodic input describe the same project ==');
{
  const cum = run('textbook').r;
  const periodicRows = E.parse([
    'دوره\tPV\tEV\tAC',
    'ماه ۱\t10000\t8000\t9000',
    'ماه ۲\t15000\t10000\t14000',
    'ماه ۳\t15000\t12000\t12000'
  ].join('\n')).rows;
  const per = E.compute(periodicRows, { mode: 'periodic', bac: 100000, eac: 'typical' });
  ['pv', 'ev', 'ac', 'cv', 'sv', 'cpi', 'spi', 'eac', 'etc', 'vac', 'tcpiBac'].forEach(k => {
    ok(near(cum.cpe[k], per.cpe[k], 1e-9), 'same ' + k + ' from either input shape',
       'cumulative=' + cum.cpe[k] + ' periodic=' + per.cpe[k]);
  });
  ok(cum.series.length === per.series.length, 'same number of periods');
  ok(cum.series.every((s, i) => near(s.cumPV, per.series[i].cumPV, 1e-9) &&
                               near(s.cumEV, per.series[i].cumEV, 1e-9) &&
                               near(s.cumAC, per.series[i].cumAC, 1e-9)),
     'the whole S-curve series matches, not just the endpoint');
}

console.log('\n== the mode toggle is detectable, not silent ==');
{
  // cumulative figures fed in as "periodic" still compute, but the totals balloon
  const wrong = E.compute(E.parse(E.PRESETS.textbook.tsv).rows,
                          { mode: 'periodic', bac: 100000, eac: 'typical' });
  ok(wrong.cpe.pv === 75000, 'mis-labelled cumulative data sums to 75,000 — visibly wrong',
     'got ' + wrong.cpe.pv);
  // cumulative data that dips must warn
  const dips = E.compute(E.parse('دوره\tPV\tEV\tAC\n1\t40000\t30000\t35000\n2\t25000\t20000\t23000').rows,
                         { mode: 'cumulative', bac: 100000, eac: 'typical' });
  ok(dips.warnings.some(w => w.indexOf('افت') !== -1), 'a dip in cumulative data is reported');
  ok(dips.warnings.some(w => w.indexOf('دوره‌ای') !== -1), 'and it names the fix');
}

console.log('\n== BAC resolution order ==');
{
  const withCol = E.compute(E.parse('دوره\tPV\tEV\tAC\tBAC\n1\t40000\t30000\t35000\t200000').rows,
                            { mode: 'cumulative', bac: 100000, eac: 'typical' });
  ok(withCol.cpe.bac === 200000, 'a BAC column beats the manual field', 'got ' + withCol.cpe.bac);
  ok(withCol.bacSource === 'column', 'and the source is reported', 'got ' + withCol.bacSource);

  const fallback = E.compute(E.parse('دوره\tPV\tEV\tAC\n1\t40000\t30000\t35000').rows,
                             { mode: 'cumulative', eac: 'typical' });
  ok(fallback.cpe.bac === 40000, 'with neither, BAC falls back to the plan end', 'got ' + fallback.cpe.bac);
  ok(fallback.bacSource === 'plan-end', 'source is plan-end');
  ok(fallback.warnings.some(w => w.indexOf('کم‌برآورد') !== -1),
     'and it warns the figure is likely an under-estimate');
}

console.log('\n== degenerate data cannot produce NaN or Infinity ==');
{
  const zeroCost = E.compute(E.parse('دوره\tPV\tEV\tAC\n1\t40000\t30000\t0').rows,
                             { mode: 'cumulative', bac: 100000, eac: 'typical' });
  ok(zeroCost.cpe.cpi === null, 'CPI is null when AC is 0, not Infinity', 'got ' + zeroCost.cpi);
  ok(zeroCost.cpe.eac === null, 'so EAC is null too');
  ok(gated(zeroCost).some(c => !c.ok), 'and a gating check fails instead of hiding it');

  const overEarned = E.compute(E.parse('دوره\tPV\tEV\tAC\n1\t40000\t150000\t35000').rows,
                               { mode: 'cumulative', bac: 100000, eac: 'typical' });
  ok(overEarned.checks.some(c => c.label.indexOf('بیشتر نیست') !== -1 && !c.ok),
     'EV above BAC is flagged as a failure');

  const equalAC = E.compute(E.parse('دوره\tPV\tEV\tAC\n1\t40000\t40000\t100000').rows,
                            { mode: 'cumulative', bac: 100000, eac: 'typical' });
  ok(equalAC.cpe.tcpiBac === null, 'TCPI is null when AC has caught up with BAC',
     'got ' + equalAC.cpe.tcpiBac);

  [zeroCost, overEarned, equalAC].forEach((r, i) => {
    const vals = Object.keys(r.cpe).filter(k => k !== 'forecast');
    ok(vals.every(k => {
      const v = r.cpe[k];
      return v === null || v === undefined || typeof v === 'string' || isFinite(v);
    }), 'case ' + i + ': no NaN/Infinity leaks into the result');
  });
}

console.log('\n== header parsing ==');
{
  const paren = E.parse('دوره\tPV (تجمعی)\tEV (تجمعی)\tAC (تجمعی)\n1\t40000\t30000\t35000').rows[0];
  ok(paren.pv === 40000 && paren.ev === 30000 && paren.ac === 35000,
     'parenthesised qualifiers are stripped before matching', JSON.stringify(paren));

  const eng = E.parse('Status Date\tPlanned Value\tEarned Value\tActual Cost\n2026-09-01\t40000\t30000\t35000').rows[0];
  ok(eng.pv === 40000 && eng.ev === 30000 && eng.ac === 35000,
     'long English names resolve', JSON.stringify(eng));

  const bacHeader = E.parse('دوره\tPV\tEV\tAC\tBudget at Completion\n1\t1\t1\t1\t99999').rows[0];
  ok(bacHeader.bac === 99999, '"Budget at Completion" maps to BAC', 'got ' + bacHeader.bac);
  ok(bacHeader.ac === 1, 'and is not stolen by the greedy "ac" alias', 'got ' + bacHeader.ac);

  const fa = E.parse('دوره\tPV\tEV\tAC\n۱\t۴۰٬۰۰۰\t۳۰٬۰۰۰\t۳۵٬۰۰۰').rows[0];
  ok(fa.pv === 40000 && fa.ev === 30000 && fa.ac === 35000,
     'Persian digits and thousands separators parse', JSON.stringify(fa));
  ok(fa.period === '۱', 'the period label keeps its original text', 'got ' + fa.period);

  const noHeader = E.parse('1\t40000\t30000\t35000').rows[0];
  ok(noHeader.pv === 40000 && noHeader.ac === 35000, 'headerless rows use the positional shape');

  const blankParsed = E.parse('دوره\tPV\tEV\tAC\n1\t10\t8\t9\n2\t\t\t\n3\t40\t30\t35');
  ok(blankParsed.rows.length === 3, 'a named-but-empty period is kept, not dropped',
     'got ' + blankParsed.rows.length);
  const blankSeries = E.compute(blankParsed.rows, { mode: 'cumulative', bac: 100, eac: 'typical' }).series;
  ok(blankSeries[1].cumPV === 10 && blankSeries[1].cumEV === 8 && blankSeries[1].cumAC === 9,
     'and the totals carry forward across it', JSON.stringify(blankSeries[1]));
  ok(blankSeries.length === 3, 'the S-curve keeps all three periods');
}

console.log('\n== export ==');
{
  const { r } = run('textbook');
  const csv = E.toCSV(r);
  ok(csv.charCodeAt(0) === 0xFEFF, 'CSV starts with a BOM for Excel');
  ok(csv.indexOf('\r\n') !== -1, 'CRLF line endings');
  ok(csv.indexOf('EAC (typical),116666.67') !== -1, 'the EAC line carries the chosen method',
     csv.split('\r\n').slice(-7).join(' | '));
  ok(csv.split('\r\n').length === 12, 'header + 3 periods + blank + 7 summary rows = 12 lines',
     'got ' + csv.split('\r\n').length);
}

console.log('\n== the periodic preset tells a story ==');
{
  const { r } = run('periodic');
  ok(near(r.cpe.pctComplete, 2 / 3, 1e-9), 'ends at 66.7% complete', 'got ' + r.cpe.pctComplete);
  ok(near(r.cpe.tcpiBac, 5 / 3), 'TCPI(BAC) = 1.67 — must perform at 167% to finish on budget',
     'got ' + r.cpe.tcpiBac);
  ok(r.cpe.tcpiBac > 1.5, 'the preset is a case where recovery is implausible, which is the point');
  ok(allGreen(r), 'and it is still structurally valid data');
}

console.log('\n' + passes + ' passed, ' + failures + ' failed.');
process.exit(failures ? 1 : 0);
