/*
 * evm-engine.js — earned-value management, dependency-free.
 *
 * UMD: module.exports under Node (so tools/test-evm-engine.js can pin the
 * arithmetic), window.EVMEngine in the browser.
 *
 * Input is a time series of PV / EV / AC. The single most common way to get
 * wrong EVM numbers is to feed cumulative figures to a tool expecting period
 * figures, or the other way round, so `mode` is an explicit argument and the
 * engine validates the monotonicity that the chosen mode implies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EVMEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EPS = 1e-9;

  // Substring matching only ever uses aliases of 3+ characters, and headers are
  // normalised by dropping parenthesised qualifiers first. Two-letter names like
  // "ac" are far too greedy for substring work ("Budget at Completion" contains
  // a 'c'), so they are exact-only by construction.
  var ALIASES = {
    period: ['period', 'date', 'time', 'week', 'month', 'status',
             'دوره', 'تاریخ', 'هفته', 'ماه', 'زمان', 'وضعیت', 'فاز'],
    pv:     ['pv', 'planned', 'bcws', 'bcwp', 'plan', 'baseline',
             'برنامه', 'کالبد', 'ارزش برنامه‌ریزی‌شده', 'بودجه مصوب دوره'],
    ev:     ['ev', 'earned', 'bcwp', 'performance',
             'عملکرد', 'ارزش عملکرد', 'ارزش کسب‌شده', 'پیشرفت', 'ارزش افزوده'],
    ac:     ['ac', 'acwp', 'actual', 'cost',
             'هزینه', 'مصرف', 'هزینه واقعی', 'ارزش دریافتی'],
    bac:    ['bac', 'budget', 'total', 'tender',
             'بودجه کل', 'کل بودجه', 'ارزش در تکمیل', 'مبلغ کل']
  };
  var FIELDS = ['period', 'pv', 'ev', 'ac', 'bac'];

  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[\u200c\u200e\u200f]/g, '')
      .replace(/[([\uFF08{][^\])\uFF09}]*[\])\uFF09}]/g, ' ')   // drop "(تجمعی)" etc.
      .trim().toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function matchColumn(header) {
    var h = norm(header);
    if (!h) return null;
    var key, list, i;
    for (key in ALIASES) {
      if (!Object.prototype.hasOwnProperty.call(ALIASES, key)) continue;
      list = ALIASES[key];
      for (i = 0; i < list.length; i++) if (h === list[i]) return key;
    }
    for (key in ALIASES) {
      if (!Object.prototype.hasOwnProperty.call(ALIASES, key)) continue;
      list = ALIASES[key];
      for (i = 0; i < list.length; i++) {
        if (list[i].length < 3) continue;
        if (h.indexOf(list[i]) !== -1) return key;
      }
    }
    return null;
  }

  function toNumber(s) {
    var t = String(s == null ? '' : s).trim()
      .replace(/[\u06f0-\u06f9]/g, function (d) { return String(d.charCodeAt(0) - 0x06f0); })
      .replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      // Excel in a Persian locale uses U+066C for thousands and U+066B as the
      // decimal mark; without these, ۴۰٬۰۰۰ parses as NaN and the row vanishes.
      .replace(/[\u066c،,\s]/g, '')
      .replace(/\u066b/g, '.')
      .replace(/[٪%]$/, '');
    if (t === '' || t === '-' || t === '—') return null;
    var n = Number(t);
    return isFinite(n) ? n : null;
  }

  function splitLine(line) {
    if (line.indexOf('\t') !== -1) return line.split('\t');
    return line.split(/[,;]+/);
  }

  /* ---------- parse ---------- */
  function parse(text) {
    var warnings = [];
    var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return { rows: [], warnings: ['ورودی خالی است.'] };

    var header = splitLine(lines[0]).map(function (c) { return c.trim(); });
    var map = header.map(matchColumn);
    var recognised = map.filter(function (m) { return !!m; });
    // two recognised columns minimum before trusting a header row
    var hasHeader = recognised.length >= 2;

    var cols = { period: -1, pv: -1, ev: -1, ac: -1, bac: -1 };
    var body = lines;

    if (hasHeader) {
      body = lines.slice(1);
      FIELDS.forEach(function (k) { cols[k] = map.indexOf(k); });
    } else {
      // no header: period, PV, EV, AC is the shape people actually keep
      cols = { period: 0, pv: 1, ev: 2, ac: 3, bac: -1 };
      warnings.push('سرستون پیدا نشد؛ ترتیب فرض شد: دوره، PV، EV، AC');
    }

    function cell(cells, key) {
      var i = cols[key];
      return i >= 0 && cells[i] !== undefined ? cells[i] : '';
    }

    var rows = [];
    body.forEach(function (line, i) {
      var cells = splitLine(line).map(function (c) { return c.trim(); });
      var pv = toNumber(cell(cells, 'pv'));
      var ev = toNumber(cell(cells, 'ev'));
      var ac = toNumber(cell(cells, 'ac'));
      var bac = toNumber(cell(cells, 'bac'));
      var period = cell(cells, 'period');
      if (pv === null && ev === null && ac === null && period === '') {
        warnings.push('سطر ' + (i + 1) + ': نه برچسب دوره داشت نه عدد، نادیده گرفته شد');
        return;
      }
      // A row that names a period but carries no figures is a real idle period:
      // keep it so the S-curve stays flat across it instead of skipping a month.
      if (pv === null && ev === null && ac === null) {
        warnings.push('سطر ' + (i + 1) + ' («' + period + '») خالی است؛ از دورهٔ قبل ادامه می‌یابد');
      }
      rows.push({
        period: period !== '' ? String(period) : ('دوره ' + (rows.length + 1)),
        pv: pv, ev: ev, ac: ac, bac: bac
      });
    });
    return { rows: rows, warnings: warnings };
  }

  /* ---------- helpers ---------- */
  function ratio(a, b) { return b > EPS ? a / b : null; }
  function last(a) { return a.length ? a[a.length - 1] : null; }
  function round(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return null;
    var p = Math.pow(10, d || 0);
    return Math.round(n * p) / p;
  }

  /* ---------- compute ---------- */
  function compute(rows, opts) {
    opts = opts || {};
    var mode = opts.mode === 'periodic' ? 'periodic' : 'cumulative';
    var errors = [], warnings = [], checks = [];

    rows = (rows || []).slice();
    if (!rows.length) return { ok: false, errors: ['داده‌ای نیست.'], warnings: [], checks: [], series: [] };

    // fill blanks with the previous value so a half-entered table still reads
    ['pv', 'ev', 'ac'].forEach(function (k) {
      var prev = 0;
      rows.forEach(function (r) {
        if (r[k] === null || r[k] === undefined) { r[k] = prev; }
        else prev = r[k];
      });
    });

    var series = [];
    var runPV = 0, runEV = 0, runAC = 0;
    rows.forEach(function (r, i) {
      var p, e, a;
      if (mode === 'periodic') {
        runPV += r.pv; runEV += r.ev; runAC += r.ac;
        p = r.pv; e = r.ev; a = r.ac;
      } else {
        p = i === 0 ? r.pv : r.pv - rows[i - 1].pv;
        e = i === 0 ? r.ev : r.ev - rows[i - 1].ev;
        a = i === 0 ? r.ac : r.ac - rows[i - 1].ac;
        runPV = r.pv; runEV = r.ev; runAC = r.ac;
      }
      series.push({
        index: i, period: r.period,
        pv: p, ev: e, ac: a,
        cumPV: runPV, cumEV: runEV, cumAC: runAC,
        cpi: ratio(e, a), spi: ratio(e, p),
        cv: e - a, sv: e - p
      });
    });

    // monotonicity is implied by "cumulative"; a decrease means the mode is wrong
    if (mode === 'cumulative') {
      var dips = [];
      ['pv', 'ev', 'ac'].forEach(function (k) {
        for (var i = 1; i < rows.length; i++) {
          if (rows[i][k] < rows[i - 1][k] - EPS) {
            dips.push(k.toUpperCase() + ' در «' + rows[i].period + '» از ' +
                      rows[i - 1][k] + ' به ' + rows[i][k] + ' افت کرده');
          }
        }
      });
      if (dips.length) {
        warnings.push(dips.slice(0, 4).join(' · ') +
          (dips.length > 4 ? ' · +' + (dips.length - 4) : ''));
        warnings.push('اگر ارقام دوره‌ای‌اند نه تجمعی، حالت را روی «دوره‌ای» بگذارید.');
      }
    } else {
      var neg = series.filter(function (s) { return s.pv < -EPS || s.ev < -EPS || s.ac < -EPS; });
      if (neg.length) warnings.push('بعضی دوره‌ها عدد منفی دارند؛ اگر داده تجمعی است حالت را عوض کنید.');
    }

    var cpe = last(series);
    if (!cpe) return { ok: false, errors: ['هیچ دورهٔ معتبری نیست.'], warnings: warnings, checks: [], series: [] };

    /* BAC: an explicit column wins, then a manual figure, then the plan's own end. */
    var bacCol = null;
    for (var b = rows.length - 1; b >= 0; b--) {
      if (rows[b].bac !== null && rows[b].bac !== undefined) { bacCol = rows[b].bac; break; }
    }
    var bacSource, bac;
    if (bacCol !== null && bacCol > 0) { bac = bacCol; bacSource = 'column'; }
    else if (opts.bac !== null && opts.bac !== undefined && isFinite(opts.bac) && opts.bac > 0) {
      bac = opts.bac; bacSource = 'manual';
    } else {
      bac = Math.max(cpe.cumPV, Math.max.apply(null, series.map(function (s) { return s.cumPV; })));
      bacSource = 'plan-end';
      warnings.push('BAC داده نشده؛ مجموع برنامهٔ کل (= ' + round(bac, 0) + ') به‌عنوان بودجهٔ در تکمیل فرض شد. ' +
                    'اگر پروژه هنوز به پایان برنامه نرسیده، این عدد کم‌برآورد است.');
    }

    var EV = cpe.cumEV, AC = cpe.cumAC, PV = cpe.cumPV;
    var CV = EV - AC, SV = EV - PV;
    var CPI = ratio(EV, AC), SPI = ratio(EV, PV);

    var eacMethod = opts.eac || 'typical';
    var eac = null;
    if (eacMethod === 'manual') {
      eac = (opts.manualEac && opts.manualEac > 0) ? opts.manualEac : null;
      if (eac === null) { warnings.push('EAC دستی وارد نشده؛ به روش «تیپیکال» برگشت.'); eacMethod = 'typical'; }
    }
    if (eac === null) {
      if (eacMethod === 'atypical') eac = AC + (bac - EV);
      else if (eacMethod === 'composite') eac = (CPI && SPI) ? AC + (bac - EV) / (CPI * SPI) : null;
      else eac = CPI ? bac / CPI : null;
    }
    if (eac === null) {
      warnings.push('برای محاسبهٔ EAC به CPI (و در روش ترکیبی SPI) نیاز است؛ هنوز هزینه‌ای ثبت نشده است.');
    }

    var etc = eac !== null ? eac - AC : null;
    var vac = eac !== null ? bac - eac : null;
    var tcpiBac = ratio(bac - EV, bac - AC);
    var tcpiEac = eac !== null ? ratio(bac - EV, eac - AC) : null;

    /* ---------- validation ---------- */
    function check(label, ok, detail) { checks.push({ ok: !!ok, label: label, detail: detail }); }

    check('BAC مثبت است', bac > EPS, 'BAC = ' + round(bac, 0));
    check('ارزش عملکرد از کل بودجه بیشتر نیست', EV <= bac + EPS,
          'EV = ' + round(EV, 0) + ' در برابر BAC = ' + round(bac, 0) +
          (EV > bac + EPS ? ' — یعنی بیش از ۱۰۰٪ کار برنامه‌ریزی‌شده گزارش شده.' : ''));
    check('هیچ‌یک از ارقام منفی نیست',
          series.every(function (s) { return s.cumPV >= -EPS && s.cumEV >= -EPS && s.cumAC >= -EPS; }),
          'مقادیر منفی در PV/EV/AC معمولاً نشانهٔ اشتباه در حالت تجمعی/دوره‌ای است.');
    check('CPI و SPI محاسبه‌شدنی‌اند', CPI !== null && SPI !== null,
          'CPI = ' + (CPI === null ? '—' : round(CPI, 3)) + ' · SPI = ' + (SPI === null ? '—' : round(SPI, 3)) +
          ' (مخرج صفر است اگر هنوز هزینه یا برنامه‌ای ثبت نشده)');
    check('ETC منفی نشود', etc === null || etc >= -EPS,
          etc !== null && etc < -EPS
            ? 'ETC = ' + round(etc, 0) + ' — با این روش EAC از هزینهٔ واقعی کمتر درمی‌آید؛ روش دیگری را امتحان کنید.'
            : 'ETC = ' + (etc === null ? '—' : round(etc, 0)));

    var planDone = PV >= bac - EPS;
    checks.push({
      ok: true, informational: true,
      label: 'پایان برنامهٔ گزارش‌شده با BAC می‌خواند؟',
      detail: planDone
        ? 'بله؛ PV تجمعی در آخرین دوره برابر BAC است.'
        : 'خیر؛ تا اینجا ' + round(ratio(PV, bac) * 100 || 0, 1) + '٪ از برنامه زمان‌بندی گذشته است. ' +
          'برای پیش‌بینی تا پایان کار، BAC کل پروژه را وارد کنید.'
    });

    var forecast = eac === null ? null : (function () {
      var alt = {};
      alt.typical = CPI ? bac / CPI : null;
      alt.atypical = AC + (bac - EV);
      alt.composite = (CPI && SPI) ? AC + (bac - EV) / (CPI * SPI) : null;
      return alt;
    })();

    /* trend over the last three periods, on period figures not cumulative ones */
    var tail = series.slice(-3);
    function dir(vals) {
      if (vals.length < 2) return 'flat';
      var d = vals[vals.length - 1] - vals[0];
      return d > 0.005 ? 'up' : (d < -0.005 ? 'down' : 'flat');
    }
    var cpiVals = tail.map(function (s) { return s.cpi; }).filter(function (v) { return v !== null; });
    var spiVals = tail.map(function (s) { return s.spi; }).filter(function (v) { return v !== null; });

    return {
      ok: errors.length === 0,
      errors: errors, warnings: warnings, checks: checks,
      mode: mode, eacMethod: eacMethod, bacSource: bacSource,
      series: series,
      cpe: {
        period: cpe.period,
        bac: bac, pv: PV, ev: EV, ac: AC,
        cv: CV, sv: SV,
        cvPct: ratio(CV, EV), svPct: ratio(SV, PV),
        cpi: CPI, spi: SPI,
        pctComplete: ratio(EV, bac), pctSpent: ratio(AC, bac), pctPlanned: ratio(PV, bac),
        eac: eac, etc: etc, vac: vac, vacPct: ratio(vac, bac),
        tcpiBac: tcpiBac, tcpiEac: tcpiEac,
        forecast: forecast
      },
      trend: { cpi: dir(cpiVals), spi: dir(spiVals), periods: tail.length }
    };
  }

  /* ---------- export ---------- */
  function toCSV(result) {
    if (!result || !result.series || !result.series.length) return '';
    var head = ['دوره', 'PV تجمعی', 'EV تجمعی', 'AC تجمعی', 'CPI دوره', 'SPI دوره', 'CV دوره', 'SV دوره'];
    var lines = [head.join(',')];
    result.series.forEach(function (s) {
      lines.push([
        '"' + String(s.period).replace(/"/g, '""') + '"',
        round(s.cumPV, 2), round(s.cumEV, 2), round(s.cumAC, 2),
        s.cpi === null ? '' : round(s.cpi, 4),
        s.spi === null ? '' : round(s.spi, 4),
        round(s.cv, 2), round(s.sv, 2)
      ].join(','));
    });
    var c = result.cpe;
    if (c) {
      lines.push('');
      lines.push('BAC,' + round(c.bac, 2));
      lines.push('CPI,' + (c.cpi === null ? '' : round(c.cpi, 4)));
      lines.push('SPI,' + (c.spi === null ? '' : round(c.spi, 4)));
      lines.push('EAC (' + result.eacMethod + '),' + round(c.eac, 2));
      lines.push('ETC,' + round(c.etc, 2));
      lines.push('VAC,' + round(c.vac, 2));
      lines.push('TCPI (BAC),' + (c.tcpiBac === null ? '' : round(c.tcpiBac, 4)));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  /* ---------- presets ---------- */
  var PRESETS = {
    textbook: {
      label: 'مثال کلاسیک PMBOK (تجمعی)',
      mode: 'cumulative',
      bac: 100000,
      tsv: [
        'دوره\tPV\tEV\tAC',
        'ماه ۱\t10000\t8000\t9000',
        'ماه ۲\t25000\t18000\t23000',
        'ماه ۳\t40000\t30000\t35000'
      ].join('\n')
    },
    slowstart: {
      label: 'پروژهٔ ساختمانی — شروع کند، انحراف منفی',
      mode: 'cumulative',
      bac: 48000000000,
      tsv: [
        'دوره\tPV\tEV\tAC',
        'فاز ۱\t6000000000\t4800000000\t5400000000',
        'فاز ۲\t14000000000\t11200000000\t12900000000',
        'فاز ۳\t24000000000\t19000000000\t22500000000',
        'فاز ۴\t33000000000\t26000000000\t31200000000'
      ].join('\n')
    },
    periodic: {
      label: 'ورودی دوره‌ای (نه تجمعی)',
      mode: 'periodic',
      bac: 120000,
      tsv: [
        'دوره\tPV\tEV\tAC',
        'هفته ۱\t10000\t9000\t11000',
        'هفته ۲\t20000\t18000\t20000',
        'هفته ۳\t30000\t22000\t25000',
        'هفته ۴\t30000\t18000\t22000',
        'هفته ۵\t30000\t13000\t18000'
      ].join('\n')
    }
  };

  return {
    parse: parse,
    compute: compute,
    toCSV: toCSV,
    PRESETS: PRESETS
  };
}));
