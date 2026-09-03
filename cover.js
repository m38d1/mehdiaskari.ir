// ---- procedural SVG cover v3 (deep dataviz, no images): hash slug -> motif ----
function __hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function __rng(seed){let t=seed>>>0;return function(){t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};}
const __VARIANT = { 'from-code-to-gantt': 0, 'pmi-ai-project-patterns': 1, 'network-lessons-industrial-site': 2,
  'p6-power-bi-dashboard': 3 };
function coverSVG(slug, variant){
  variant = (variant !== undefined) ? variant : (__VARIANT[slug] !== undefined ? __VARIANT[slug] : __hash(slug) % 4);
  const R = __rng(__hash(slug));
  const C = ['var(--teal)','var(--teal-2)','var(--amber)'];
  const T = 'var(--text)';
  const gid = 'g' + (__hash(slug)%16777215).toString(16).padStart(6,'0');
  const pick = () => C[Math.floor(R()*3)];
  const jit = (a, b) => a + R()*(b-a);
  let d = '';
  // layered glow (no radial gradients — svglib can't render stop-opacity)
  const glow = function(cx, cy, r, col, count, om){
    for(let i=count;i>0;i--){
      const ri = r * (0.35 + 0.65*(i/count));
      d += '<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+ri.toFixed(1)+'" fill="'+col+'" opacity="'+(om*(0.4+0.6*(i/count))).toFixed(3)+'"/>';
    }
  };
  // background
  d += '<rect width="272" height="132" fill="var(--cover-bg,transparent)"/>';
  // chart-paper grid (visible but subtle)
  for(let gy=8; gy<128; gy+=16){
    d += '<line x1="6" y1="'+gy+'" x2="266" y2="'+gy+'" stroke="'+T+'" stroke-width="0.5" opacity="0.07"/>';
  }
  for(let gx=14; gx<266; gx+=18){
    d += '<line x1="'+gx+'" y1="6" x2="'+gx+'" y2="126" stroke="'+T+'" stroke-width="0.5" opacity="0.07"/>';
  }
  // ambient glow
  glow(136 + jit(-14,14), 60 + jit(-12,12), 70, C[1], 4, 0.12);

  if(variant === 0){ // Gantt hero: many bars + progress + baseline axis + data-date
    const rows = [16,32,48,64,80,96,112];
    rows.forEach(function(y, i){
      const x0 = 18 + jit(-4, 4);
      const w = 150 + jit(20, 70);
      const p = jit(0.2, 0.95), pw = w*p;
      const critical = i % 3 === 2;
      const rem = Math.max(0, 250 - (x0+w));
      d += '<rect x="'+x0.toFixed(1)+'" y="'+y+'" width="'+(w + Math.min(rem,10)).toFixed(1)+'" height="11" rx="5.5" fill="'+T+'" opacity="0.10"/>';
      d += '<rect x="'+x0.toFixed(1)+'" y="'+y+'" width="'+pw.toFixed(1)+'" height="11" rx="5.5" fill="'+(critical?'var(--amber)':(i%2===0?'url(#'+gid+'a)':'url(#'+gid+'b)'))+'" opacity="'+(critical?0.9:0.8).toFixed(2)+'"/>';
    });
    // baseline axis
    d += '<line x1="14" y1="126" x2="258" y2="126" stroke="'+T+'" stroke-width="1" opacity="0.25"/>';
    for(let tx=24; tx<=250; tx+=28){
      d += '<line x1="'+tx+'" y1="125" x2="'+tx+'" y2="129" stroke="'+T+'" stroke-width="0.8" opacity="0.2"/>';
    }
    // data date vertical line
    const dx = 170 + jit(-20, 30);
    d += '<line x1="'+dx.toFixed(1)+'" y1="10" x2="'+dx.toFixed(1)+'" y2="124" stroke="'+C[0]+'" stroke-width="1.6" opacity="0.85" stroke-dasharray="3 4"/>';
    glow(dx, 12, 12, C[0], 2, 0.18);
    d += '<circle cx="'+dx.toFixed(1)+'" cy="12" r="2.8" fill="'+C[0]+'"/>';
  } else if(variant === 1){ // Network graph: dense node grid + edges + hot node
    const pts = [];
    const cols = [38, 102, 166, 230], rows2 = [24, 56, 88, 116];
    for(let i=0;i<cols.length;i++) for(let j=0;j<rows2.length;j++){
      pts.push([cols[i] + jit(-10,10), rows2[j] + jit(-8,8)]);
    }
    for(let i=0;i<pts.length;i++){
      for(let j=i+1;j<pts.length;j++){
        const dx=pts[i][0]-pts[j][0], dy=pts[i][1]-pts[j][1];
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist < 56 && dist > 10){
          const critical = (i%5===0 && j%5===1);
          const col = critical ? C[0] : pick();
          d += '<line x1="'+pts[i][0].toFixed(1)+'" y1="'+pts[i][1].toFixed(1)+'" x2="'+pts[j][0].toFixed(1)+'" y2="'+pts[j][1].toFixed(1)+'" stroke="'+col+'" stroke-width="'+(critical?1.6:0.8).toFixed(1)+'" opacity="'+(critical?0.7:0.28).toFixed(2)+'"/>';
        }
      }
    }
    pts.forEach(function(p, i){
      const isHot = (i === 9);
      const col = isHot ? C[2] : pick();
      const r = isHot ? 9 : (4.5 + jit(0, 2));
      glow(p[0], p[1], r*2.2, col, 2, 0.16);
      d += '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+col+'" opacity="'+(isHot?0.95:0.72+jit(0,0.2)).toFixed(2)+'"/>';
      d += '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="1.4" fill="#101318" opacity="0.5"/>';
    });
  } else if(variant === 2){ // Ring topology: hub + three rings of devices
    const hx = 136 + jit(-8,8), hy = 64 + jit(-8,8);
    glow(hx, hy, 30, C[1], 3, 0.14);
    const ring = function(cx, cy, rad, n, col, op, rr){
      for(let i=0;i<n;i++){
        const a = (i/n)*Math.PI*2 - Math.PI/2 + R()*0.1;
        const x = cx + Math.cos(a)*rad, y = cy + Math.sin(a)*rad;
        d += '<line x1="'+cx.toFixed(1)+'" y1="'+cy.toFixed(1)+'" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="'+col+'" stroke-width="1" opacity="0.4"/>';
        d += '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+rr.toFixed(1)+'" fill="'+col+'" opacity="'+op.toFixed(2)+'"/>';
      }
    };
    ring(hx, hy, 22, 5, C[0], 0.85, 3.2);
    ring(hx, hy, 38, 7, C[1], 0.8, 2.6);
    ring(hx, hy, 52, 9, C[0], 0.7, 2.2);
    d += '<circle cx="'+hx.toFixed(1)+'" cy="'+hy.toFixed(1)+'" r="15" fill="url(#'+gid+'a)" opacity="0.95"/>';
    d += '<circle cx="'+hx.toFixed(1)+'" cy="'+hy.toFixed(1)+'" r="5" fill="#101318" opacity="0.4"/>';
    d += '<path d="M '+(hx-52).toFixed(1)+' '+(hy-6).toFixed(1)+' A 52 52 0 0 1 '+(hx-52).toFixed(1)+' '+(hy+6).toFixed(1)+'" fill="none" stroke="'+C[2]+'" stroke-width="1.4" opacity="0.65" stroke-dasharray="2 5"/>';
  } else { // Dashboard hero: KPI cards + dense bar chart + dual sparkline
    const cards = [[14, 14, 76, 30, 'a'], [96, 14, 76, 30, 'b'], [178, 14, 76, 30, 'a']];
    cards.forEach(function(c){
      d += '<rect x="'+c[0]+'" y="'+c[1]+'" width="'+c[2]+'" height="'+c[3]+'" rx="7" fill="'+T+'" opacity="0.08"/>';
      d += '<line x1="'+(c[0]+9)+'" y1="'+(c[1]+10)+'" x2="'+(c[0]+c[2]-9)+'" y2="'+(c[1]+10)+'" stroke="'+C[0]+'" stroke-width="2.5" opacity="0.9"/>';
      d += '<line x1="'+(c[0]+9)+'" y1="'+(c[1]+19)+'" x2="'+(c[0]+c[2]-24)+'" y2="'+(c[1]+19)+'" stroke="'+T+'" stroke-width="2.5" opacity="0.28"/>';
    });
    const by = 96;
    for(let i=0;i<9;i++){
      const bx = 18 + i*22, bh = 14 + i*8.5 + jit(-3,3);
      d += '<rect x="'+bx+'" y="'+(by-bh)+'" width="14" height="'+bh.toFixed(1)+'" rx="3" fill="'+(i>=7?C[2]:C[0])+'" opacity="'+(i>=7?0.95:0.45+i*0.05).toFixed(2)+'"/>';
    }
    d += '<line x1="14" y1="'+by+'" x2="240" y2="'+by+'" stroke="'+T+'" stroke-width="0.8" opacity="0.25"/>';
    let d1 = 'M 176 124'; let d2 = 'M 176 124';
    for(let x=182; x<=258; x+=10){
      const t = (x-176)/82;
      const y1 = 124 - 40*Math.pow(t,1.5), y2 = 124 - 30*Math.pow(t,0.9);
      d1 += ' L'+x+' '+y1.toFixed(1); d2 += ' L'+x+' '+y2.toFixed(1);
    }
    d += '<path d="'+d1+'" fill="none" stroke="'+C[0]+'" stroke-width="1.8" opacity="0.9"/>';
    d += '<path d="'+d2+'" fill="none" stroke="'+C[1]+'" stroke-width="1.4" opacity="0.7" stroke-dasharray="4 3"/>';
  }

  d += '<defs>' +
       '<linearGradient id="'+gid+'a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--teal)"/><stop offset="1" stop-color="var(--teal-2)"/></linearGradient>' +
       '<linearGradient id="'+gid+'b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--teal-2)"/><stop offset="1" stop-color="var(--teal)"/></linearGradient>' +
       '</defs>';

  return '<svg class="cover-art" viewBox="0 0 272 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + d + '</svg>';
}
window.__coverSVG = coverSVG;

document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('[data-cover]').forEach(function(el){
    if(el.__coverDone) return; el.__coverDone = 1;
    el.innerHTML = __coverSVG(el.getAttribute('data-cover'));
  });
});