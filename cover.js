// ---- procedural SVG cover (no images): hash slug -> deterministic motif ----
function __hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function __rng(seed){let t=seed>>>0;return function(){t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};}
const __VARIANT = { 'from-code-to-gantt': 0, 'pmi-ai-project-patterns': 1, 'network-lessons-industrial-site': 2,
  'p6-power-bi-dashboard': 3 };
function coverSVG(slug, variant){
  variant = (variant !== undefined) ? variant : (__VARIANT[slug] !== undefined ? __VARIANT[slug] : __hash(slug) % 3);
  const R = __rng(__hash(slug));
  const C = ['var(--teal)','var(--teal-2)','var(--amber)'];
  const pick = () => C[Math.floor(R()*3)];
  let inner = '';
  if(variant === 0){ // gantt bars
    let y = 14;
    while(y < 118){
      const w = 40 + R()*150, x = 12 + R()*140, o = .18 + R()*.5;
      inner += '<rect x="'+x.toFixed(1)+'" y="'+y+'" width="'+w.toFixed(1)+'" height="9" rx="4.5" fill="'+pick()+'" opacity="'+o.toFixed(2)+'"/>';
      y += 16 + R()*8;
    }
  } else if(variant === 1){ // network graph
    const pts = [];
    for(let i=0;i<9;i++) pts.push([24+R()*240, 22+R()*84]);
    for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
      const dx=pts[i][0]-pts[j][0], dy=pts[i][1]-pts[j][1];
      if(dx*dx+dy*dy < 6400) inner += '<line x1="'+pts[i][0].toFixed(1)+'" y1="'+pts[i][1].toFixed(1)+'" x2="'+pts[j][0].toFixed(1)+'" y2="'+pts[j][1].toFixed(1)+'" stroke="'+pick()+'" stroke-width="1.1" opacity="0.35"/>';
    }
    pts.forEach(p=>{ inner += '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="'+(2.2+R()*2.6).toFixed(1)+'" fill="'+pick()+'" opacity="'+(0.5+R()*0.5).toFixed(2)+'"/>'; });
  } else if(variant === 3){ // dashboard tiles
    for(let i=0;i<6;i++){
      const x=14+R()*244, y=18+R()*96, w=30+R()*50, h=15+R()*20;
      inner+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="3" fill="'+pick()+'" opacity="'+(.2+R()*.3).toFixed(2)+'"/><line x1="'+(x+4).toFixed(1)+'" y1="'+(y+h-5).toFixed(1)+'" x2="'+(x+w-4).toFixed(1)+'" y2="'+(y+h-5).toFixed(1)+'" stroke="'+pick()+'" stroke-width=".8" opacity="'+(.6+R()*.4).toFixed(2)+'"/>';
    }
  } else { // milestone wave (curve + diamonds)
    let d = 'M0 96';
    for(let x=0; x<=270; x+=27){ d += ' L'+x+' '+(96 - 30*Math.sin(x/43 + R()*0.6)).toFixed(1); }
    inner += '<path d="'+d+'" fill="none" stroke="'+C[0]+'" stroke-width="1.6" opacity="0.75"/>';
    for(let i=0;i<4;i++){
      const x = 30+R()*210, y = 60+R()*40;
      inner += '<rect x="'+(x-4).toFixed(1)+'" y="'+(y-4).toFixed(1)+'" width="8" height="8" fill="'+pick()+'" opacity="0.8" transform="rotate(45 '+x.toFixed(1)+' '+y.toFixed(1)+')"/>';
    }
  }
  return '<svg class="cover-art" viewBox="0 0 272 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
         '<rect width="272" height="132" fill="var(--cover-bg,transparent)"/>' + inner + '</svg>';
}
window.__coverSVG = coverSVG;

document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('[data-cover]').forEach(function(el){
    if(el.__coverDone) return; el.__coverDone = 1;
    el.innerHTML = __coverSVG(el.getAttribute('data-cover'));
  });
});
