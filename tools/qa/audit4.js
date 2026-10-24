(() => new Promise(resolve => {
  document.documentElement.setAttribute('data-theme', '__THEME__');
  // transitions never advance in an offscreen WKWebView — snap them so the
  // computed colours are the target theme, not the previous one
  const snap = document.createElement('style');
  snap.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(snap);

  setTimeout(() => {
    const R = {};
    const vis = el => {
      if (!el) return false;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const label = el => {
      if (el.id) return el.tagName.toLowerCase() + '#' + el.id;
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
    };

    /* ---------- colour parsing: rgb(), rgba(), color(srgb ...) ---------- */
    const parse = c => {
      const str = String(c);
      let m = str.match(/^rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(/[,\s\/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      }
      m = str.match(/^color\(srgb\s+([^)]+)\)/);
      if (m) {
        const p = m[1].split(/[\s\/]+/).filter(Boolean).map(Number);
        return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
      }
      return null;
    };
    const lum = c => {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const over = (t, b) => {
      const a = t.a + b.a * (1 - t.a);
      if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (t.r * t.a + b.r * b.a * (1 - t.a)) / a,
        g: (t.g * t.a + b.g * b.a * (1 - t.a)) / a,
        b: (t.b * t.a + b.b * b.a * (1 - t.a)) / a,
        a: a
      };
    };
    const ratio = (a, b) => {
      const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2);
      return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
    };

    // walk up collecting translucent layers; stop when a solid colour or a gradient is met
    const bgOf = el => {
      let n = el, acc = null, image = null;
      while (n) {
        const s = getComputedStyle(n);
        const c = parse(s.backgroundColor);
        if (c && c.a > 0) acc = acc ? over(acc, c) : c;
        if (acc && acc.a >= 0.999) return { c: acc, image: image };
        if (s.backgroundImage && s.backgroundImage !== 'none') image = label(n) + ' ' + s.backgroundImage.slice(0, 34);
        n = n.parentElement;
      }
      const root = parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
      return { c: acc ? over(acc, root) : root, image: image };
    };

    const fails = [], groups = {}, unparsed = [], gradient = {};
    let checked = 0;
    [...document.body.querySelectorAll('*')].forEach(el => {
      if (el.closest('svg')) return;
      const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!ownText || !vis(el)) return;
      const s = getComputedStyle(el);
      // gradient text paints with background-clip:text — colour is not the paint
      const clip = s.webkitBackgroundClip || s.backgroundClip;
      if (clip === 'text' || s.webkitTextFillColor === 'rgba(0, 0, 0, 0)') {
        const k = label(el); gradient[k] = (gradient[k] || 0) + 1; return;
      }
      const fg = parse(s.color);
      if (!fg) { unparsed.push(label(el) + ' ' + s.color); return; }
      const bg = bgOf(el);
      if (bg.image) { gradient['bg:' + label(el)] = bg.image; return; }
      checked++;
      const fgC = fg.a < 1 ? over(fg, bg.c) : fg;
      const px = +parseFloat(s.fontSize).toFixed(1);
      const w = +s.fontWeight || 400;
      const large = px >= 24 || (px >= 18.66 && w >= 700);
      const need = large ? 3 : 4.5;
      const r = ratio(fgC, bg.c);
      const key = [Math.round(fgC.r), Math.round(fgC.g), Math.round(fgC.b), px, w].join('|');
      const g = groups[key] || (groups[key] = { ratio: r, px, w, need, n: 0, fg: [Math.round(fgC.r), Math.round(fgC.g), Math.round(fgC.b)].join(','), bg: [Math.round(bg.c.r), Math.round(bg.c.g), Math.round(bg.c.b)].join(','), where: label(el), text: (el.textContent || '').trim().slice(0, 22) });
      g.n++;
      if (r < g.ratio) { g.ratio = r; g.where = label(el); g.text = (el.textContent || '').trim().slice(0, 22); }
      if (r < need) fails.push({ r, px, w, need, where: label(el), text: (el.textContent || '').trim().slice(0, 26) });
    });
    R.contrastChecked = checked;
    R.contrastFailCount = fails.length;
    R.contrastFails = fails.sort((a, b) => a.r - b.r).slice(0, 14);
    R.contrastGroups = Object.values(groups).sort((a, b) => a.ratio - b.ratio);
    R.gradientSkips = gradient;
    R.unparsed = unparsed.slice(0, 6);

    /* ---------- focus + motion ---------- */
    let focusRules = [], motionRules = [];
    const walk = (rules, inMotion) => {
      for (const r of rules) {
        if (r.selectorText) {
          if (r.selectorText.indexOf(':focus-visible') !== -1) focusRules.push(r.selectorText.slice(0, 56));
          if (inMotion) motionRules.push(r.selectorText.slice(0, 40));
        }
        if (r.cssRules) walk(r.cssRules, inMotion || !!(r.media && String(r.media.mediaText).indexOf('prefers-reduced-motion') !== -1));
      }
    };
    [...document.styleSheets].forEach(s => { try { walk(s.cssRules, false); } catch (e) {} });
    R.focusVisibleRules = focusRules.length;
    R.motionRules = motionRules.length;
    R.motionSamples = [...new Set(motionRules)].slice(0, 6);

    /* ---------- landmarks ---------- */
    const first = document.querySelector('body a');
    R.firstLink = first ? { text: (first.textContent || '').trim().slice(0, 22), href: first.getAttribute('href'), cls: first.className } : null;
    R.landmarks = {
      main: document.querySelectorAll('main').length,
      navs: [...document.querySelectorAll('nav')].map(n => n.getAttribute('aria-label') || '(unlabeled)'),
      header: document.querySelectorAll('header').length,
      footer: document.querySelectorAll('footer').length
    };
    const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(x => +x.tagName[1]);
    R.headingJumps = []; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) R.headingJumps.push(hs[i - 1] + '→' + hs[i]);
    R.h1Count = document.querySelectorAll('h1').length;

    /* ---------- icons, names, tables ---------- */
    const svgs = [...document.querySelectorAll('svg')].filter(s => !s.hasAttribute('aria-hidden') && !s.querySelector('title') && s.getAttribute('role') !== 'img');
    R.svgNoHidden = svgs.length;
    R.svgWhere = [...new Set(svgs.map(s => { const p = s.closest('[id],[class]'); return p ? label(p) : '?'; }))].slice(0, 8);
    const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
    R.inputsNoName = [...document.querySelectorAll('input:not([type=hidden]), textarea, select')]
      .filter(el => !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
        (el.id && document.querySelector('label[for="' + el.id + '"]')) || el.closest('label')))
      .map(el => el.id || el.type);
    R.buttonsNoName = [...document.querySelectorAll('button')].filter(b => !b.getAttribute('aria-label') && !txt(b)).map(b => b.id || b.className);
    R.thNoScope = document.querySelectorAll('th:not([scope])').length;
    R.tables = document.querySelectorAll('table').length;
    R.ariaHiddenFocusable = [...document.querySelectorAll('[aria-hidden="true"]')].filter(el => el.querySelector('a[href],button,input,[tabindex]')).length;
    R.smallTargets = [...document.querySelectorAll('a[href], button, [role="button"], summary')]
      .filter(vis)
      .filter(el => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; })
      .slice(0, 10)
      .map(el => label(el) + ' ' + Math.round(el.getBoundingClientRect().width) + '×' + Math.round(el.getBoundingClientRect().height));

    /* ---------- perf ---------- */
    const navE = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    const kb = re => +(res.filter(r => re.test(r.name)).reduce((s, r) => s + (r.transferSize || 0), 0) / 1024).toFixed(1);
    R.perf = {
      dcl: navE ? Math.round(navE.domContentLoadedEventEnd) : null,
      load: navE ? Math.round(navE.loadEventEnd) : null,
      req: res.length,
      totalKb: Math.round(res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
      cssKb: kb(/\.css/), jsKb: kb(/\.js/), fontKb: kb(/\.woff2/),
      blockingJs: [...document.querySelectorAll('head script[src]')].filter(s => !s.defer && !s.async).map(s => s.getAttribute('src')),
      blockingCss: [...document.querySelectorAll('head link[rel="stylesheet"]')].filter(l => !l.media || l.media === 'all').map(l => l.getAttribute('href')),
      nodes: document.querySelectorAll('*').length
    };
    R.theme = document.documentElement.getAttribute('data-theme');
    R.bodyBg = getComputedStyle(document.body).backgroundColor;
    R.title = document.title.slice(0, 34);
    resolve(R);
  }, 700);
}))()
