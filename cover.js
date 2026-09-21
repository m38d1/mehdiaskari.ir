// ---- procedural SVG cover v5 (mesh + hero word, no images): tags -> hue family ----
function __hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function __rng(seed){let t=seed>>>0;return function(){t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};}
// slug -> {tags, title} mirror of posts.json (offline, no fetch);
// [data-tags="a,b"] / [data-title="..."] attributes on the element override this map.
const __SLUG_META = {
  'schedule-health-checks': {tags: ['کنترل پروژه','MS Project','Primavera P6'], title: 'پنج چک سلامت برنامه که قبل از هر به‌روزرسانی باید بگیرید'},
  'mikrotik-load-balancing-filters': {tags: ['MikroTik','شبکه','لود بالانسینگ'], title: 'لود بالانسینگ و فیلترهای پیشرفته در MikroTik'},
  'msp-power-tricks': {tags: ['MS Project','برنامه‌ریزی','کنترل پروژه'], title: 'هفت ترفند MS Project که برنامهٔ شما را نجات می‌دهد'},
  'p6-global-change': {tags: ['Primavera P6','کنترل پروژه','اتوماسیون'], title: 'Global Change در Primavera P6؛ دستیار خاموشِ برنامه‌ریز'},
  'power-query-site-progress': {tags: ['Power Query','اکسل','کنترل پروژه','داده'], title: 'Power Query؛ خط تولید دادهٔ پیشرفت کارگاهی'},
  'gale-openwrt-custom-firmware': {tags: ['OpenWrt','Google Wifi','PassWall','mwan3','شبکه'], title: 'فریمور سفارشی Google Wifi (Gale): پس‌وال، مالتی‌WAN و وای‌فای دایرکت'},
  'weight-factor-excel-msp': {tags: ['Excel','MS Project','کنترل پروژه','پیشرفت وزنی'], title: 'محاسبه ضریب وزن (W.F) و پیشرفت وزنی فقط با هزینه، وزن و ارزش — در اکسل و MSP'},
  'p6-power-bi-dashboard': {tags: ['Power BI','Primavera P6','کنترل پروژه','داشبورد'], title: 'اتصال Primavera P6 به Power BI — راهنمای عملی داشبورد کنترل پروژه'},
  'pmi-ai-project-patterns': {tags: ['مدیریت پروژه','هوش مصنوعی','PMI'], title: 'چرا مدیریت پروژه هوش مصنوعی را جدی گرفته است'},
  'from-code-to-gantt': {tags: ['مسیر شغلی','توسعه وب'], title: 'از کد تا گانت‌چارت: داستان یک تغییر مسیر'},
  'network-lessons-industrial-site': {tags: ['شبکه','زیرساخت'], title: 'پنج درس شبکه‌ای که در سایت صنعتی یاد گرفتم'}
};
const __HUE_FAMILY = [
  {re: /primavera|p6\b|ms project|\bmsp\b|برنامه‌ریزی|کنترل پروژه|مسیر|توسعه وب|مدیریت پروژه/i, c: 0}, // teal
  {re: /mikrotik|network|شبکه|openwrt|mwan3|passwall|balanc|توازن|زیرساخت|infrastruct|rout|wifi|وای‌فای/i, c: 1}, // blue
  {re: /power bi|dashboard|داشبورد|excel|اکسل|power query|داده|evm|weight|وزن|report|گزارش|هوش مصنوعی|\bai\b|pmi/i, c: 2} // amber
];
function hueFor(slug, tags){
  tags = tags || (__SLUG_META[slug] && __SLUG_META[slug].tags) || [];
  for(let i=0;i<tags.length;i++){
    for(let j=0;j<__HUE_FAMILY.length;j++){
      if(__HUE_FAMILY[j].re.test(tags[i])) return __HUE_FAMILY[j].c;
    }
  }
  return __hash(slug) % 3;
}
function titleFor(slug, title){
  if(title) return title;
  var tags = (__SLUG_META[slug] && __SLUG_META[slug].tags) || [];
  return tags[0] || slug;
}
// kept for back-compat (v4 callers); v5 renders one mesh design, hue varies.
function motifFor(slug, tags){ return hueFor(slug, tags); }
function escXml(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// NOTE: var() does NOT resolve inside SVG presentation attributes (fill="var(--x)"
// paints black in Chrome), so resolve theme colors to real values here.
var __themeCache = null;
function hexRgb(h){
  h = h.replace('#','');
  if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function mixHex(a, b, t){
  var A = hexRgb(a), B = hexRgb(b);
  var m = A.map(function(v, i){ return Math.round(v + (B[i]-v)*t); });
  return '#'+m.map(function(v){ return v.toString(16).padStart(2,'0'); }).join('');
}
function themeColors(){
  if(__themeCache) return __themeCache;
  var teal = '#2FE0C4', teal2 = '#5B8CFF', amber = '#F6B255', text = '#F3F5F7', dark = true;
  try{
    var el = document.documentElement;
    var cs = getComputedStyle(el);
    teal = cs.getPropertyValue('--teal').trim() || teal;
    teal2 = cs.getPropertyValue('--teal-2').trim() || teal2;
    amber = cs.getPropertyValue('--amber').trim() || amber;
    text = cs.getPropertyValue('--text').trim() || text;
    dark = el.getAttribute('data-theme') !== 'light';
  }catch(e){}
  // solid tinted backdrop per family (set later once base is known)
  __themeCache = {teal: teal, teal2: teal2, amber: amber, text: text, dark: dark};
  return __themeCache;
}
function coverBg(base, dark){
  return dark ? mixHex(base, '#10131A', 0.80) : mixHex(base, '#FFFFFF', 0.80);
}
function coverSVG(slug, variant, tags, title){
  const R = __rng(__hash(slug + '|v5'));
  const TC = themeColors();
  const C = [TC.teal, TC.teal2, TC.amber];
  const T = TC.text;
  const jit = (a, b) => a + R()*(b-a);
  const fam = hueFor(slug, tags);
  const base = C[fam], soft1 = C[(fam+1)%3], soft2 = C[(fam+2)%3];
  const word = escXml(titleFor(slug, title));
  let d = '';
  // soft mesh blobs: layered circles read as one blurred wash (no filters — max compat)
  const blob = function(cx, cy, r, col, om){
    for(let i=4;i>0;i--){
      const ri = r * (0.4 + 0.6*(i/4));
      d += '<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+ri.toFixed(1)+'" fill="'+col+'" opacity="'+(om*(0.35+0.65*(i/4))).toFixed(3)+'"/>';
    }
  };
  // background: solid tinted wash in the family hue (fully covers the grey card bg)
  d += '<rect width="272" height="132" fill="'+coverBg(base, TC.dark)+'"/>';
  // dot texture
  for(let gy=10; gy<128; gy+=16){
    for(let gx=12; gx<268; gx+=16){
      d += '<circle cx="'+gx+'" cy="'+gy+'" r="0.9" fill="'+T+'" opacity="0.055"/>';
    }
  }
  // mesh: one dominant wash + two companion accents, seeded positions
  blob(196 + jit(-24,24), 62 + jit(-22,22), 64, base, 0.30);
  blob(96 + jit(-20,20), 40 + jit(-16,16), 42, soft1, 0.20);
  blob(150 + jit(-30,30), 104 + jit(-12,12), 36, soft2, 0.16);
  // crisp core dot on the dominant wash
  d += '<circle cx="'+(196 + jit(-10,10)).toFixed(1)+'" cy="'+(62 + jit(-10,10)).toFixed(1)+'" r="3" fill="'+base+'" opacity="0.9"/>';
  // topic motif (subtle, behind the word): 0 = gantt · 1 = constellation · 2 = bars
  if(fam === 0){
    [96, 106, 116].forEach(function(y, i){
      const x0 = 30 + jit(0, 40), w = 120 + jit(0, 90);
      d += '<rect x="'+x0.toFixed(1)+'" y="'+y+'" width="'+w.toFixed(1)+'" height="5" rx="2.5" fill="'+T+'" opacity="0.12"/>';
      d += '<rect x="'+x0.toFixed(1)+'" y="'+y+'" width="'+(w*jit(0.3,0.9)).toFixed(1)+'" height="5" rx="2.5" fill="'+(i===1?soft2:base)+'" opacity="0.45"/>';
    });
  } else if(fam === 1){
    const pts = [];
    for(let i=0;i<7;i++){ pts.push([30 + R()*212, 88 + R()*34]); }
    for(let i=0;i<pts.length;i++){
      for(let j=i+1;j<pts.length;j++){
        const dx=pts[i][0]-pts[j][0], dy=pts[i][1]-pts[j][1];
        if(Math.sqrt(dx*dx+dy*dy) < 80){
          d += '<line x1="'+pts[i][0].toFixed(1)+'" y1="'+pts[i][1].toFixed(1)+'" x2="'+pts[j][0].toFixed(1)+'" y2="'+pts[j][1].toFixed(1)+'" stroke="'+base+'" stroke-width="0.9" opacity="0.35"/>';
        }
      }
      d += '<circle cx="'+pts[i][0].toFixed(1)+'" cy="'+pts[i][1].toFixed(1)+'" r="2.4" fill="'+soft1+'" opacity="0.7"/>';
    }
  } else {
    for(let i=0;i<8;i++){
      const bx = 34 + i*24, bh = 10 + i*3.4 + jit(-2,2);
      d += '<rect x="'+bx+'" y="'+(124-bh).toFixed(1)+'" width="12" height="'+bh.toFixed(1)+'" rx="3" fill="'+(i>=6?soft2:base)+'" opacity="0.4"/>';
    }
  }
  // hero word: most important word (first tag), fitted size, readable ink
  const ink = TC.dark ? '#FFFFFF' : '#10151C';
  const fs = word.length <= 5 ? 40 : word.length <= 8 ? 32 : word.length <= 12 ? 26 : 21;
  d += '<text x="137" y="80" text-anchor="middle" font-size="'+fs+'" font-weight="800"'
    + ' font-family="Vazirmatn, Tahoma, sans-serif" fill="#000000" opacity="0.25">'
    + word + '</text>';
  d += '<text x="136" y="78" text-anchor="middle" font-size="'+fs+'" font-weight="800"'
    + ' font-family="Vazirmatn, Tahoma, sans-serif" fill="'+ink+'" opacity="0.95">'
    + word + '</text>';
  // small baseline accent under the word
  d += '<rect x="118" y="92" width="36" height="3" rx="1.5" fill="'+base+'" opacity="0.9"/>';
  d += '<circle cx="160" cy="93.5" r="1.6" fill="'+soft2+'" opacity="0.9"/>';

  return '<svg class="cover-art" viewBox="0 0 272 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + d + '</svg>';
}
window.__coverSVG = coverSVG;
window.__fillCovers = __fillCovers;

// Fill any [data-cover] element once. Used both at load and for
// cards injected later (e.g. the home page's async "latest posts" grid).
function __fillCovers(root){
  if(!root) return;
  var els = root.querySelectorAll ? root.querySelectorAll('[data-cover]') : [];
  for(var i=0;i<els.length;i++){
    var el = els[i];
    if(el.__coverDone) continue; el.__coverDone = 1;
    var dt = el.getAttribute('data-tags');
    var tt = el.getAttribute('data-title');
    el.innerHTML = __coverSVG(el.getAttribute('data-cover'), undefined, dt ? dt.split(',') : undefined, tt || undefined);
  }
}

document.addEventListener('DOMContentLoaded', function(){
  __fillCovers(document);
  if(window.MutationObserver && document.body){
    var mo = new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var m = muts[i];
        for(var j=0;j<m.addedNodes.length;j++){
          var n = m.addedNodes[j];
          if(n.nodeType !== 1) continue;
          if(n.matches && n.matches('[data-cover]')) __fillCovers(n);
          else if(n.querySelectorAll) __fillCovers(n);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  // Re-paint covers on theme switch so light/dark hues stay correct.
  if(window.MutationObserver){
    var to = new MutationObserver(function(){
      __themeCache = null;
      var els = document.querySelectorAll('[data-cover]');
      for(var i=0;i<els.length;i++){ els[i].__coverDone = 0; }
      __fillCovers(document);
    });
    to.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
});
