// mehdiaskari.ir — shared UI components behavior (vanilla, no deps)
(function () {
  // ---------- Tabs ----------
  function initTabs(root) {
    root.querySelectorAll('.tabs').forEach(function (group) {
      if (group.__tabsReady) return; group.__tabsReady = 1;
      var tabs = group.querySelectorAll('.tab');
      var panels = group.querySelectorAll('.tab-panel');
      function activate(tab) {
        var id = tab.getAttribute('data-tab');
        tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
        panels.forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-panel') === id); });
      }
      tabs.forEach(function (t, i) {
        t.setAttribute('role', 'tab');
        t.addEventListener('click', function () { activate(t); });
        t.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          var n = e.key === 'ArrowLeft' ? i + 1 : i - 1; // RTL: Left = next
          if (n < 0) n = tabs.length - 1;
          if (n >= tabs.length) n = 0;
          tabs[n].focus(); activate(tabs[n]); e.preventDefault();
        });
      });
      var sel = group.querySelector('.tab[aria-selected="true"]') || tabs[0];
      if (sel) activate(sel);
    });
  }

  // ---------- Accordion ----------
  function setBody(item, open) {
    var body = item.querySelector('.acc-body');
    if (!body) return;
    body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px';
  }
  function initAccordion(root) {
    root.querySelectorAll('.accordion').forEach(function (acc) {
      if (acc.__accReady) return; acc.__accReady = 1;
      var single = acc.hasAttribute('data-single');
      acc.querySelectorAll('.acc-item').forEach(function (item) {
        var head = item.querySelector('.acc-head');
        if (!head) return;
        head.setAttribute('aria-expanded', 'false');
        head.addEventListener('click', function () {
          var willOpen = !item.classList.contains('is-open');
          if (single) {
            acc.querySelectorAll('.acc-item.is-open').forEach(function (o) {
              o.classList.remove('is-open'); setBody(o, false);
              if (o.querySelector('.acc-head')) o.querySelector('.acc-head').setAttribute('aria-expanded', 'false');
            });
          }
          item.classList.toggle('is-open', willOpen);
          setBody(item, willOpen);
          head.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
        setBody(item, false);
      });
    });
  }

  // ---------- Dialog ----------
  function initDialog(root) {
    root.querySelectorAll('.dialog-backdrop').forEach(function (bd) {
      if (bd.__dlgReady) return; bd.__dlgReady = 1;
      function close() { bd.classList.remove('is-open'); }
      bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
      var c = bd.querySelector('.dialog-close'); if (c) c.addEventListener('click', close);
    });
    root.querySelectorAll('[data-dialog]').forEach(function (btn) {
      if (btn.__dlgBtn) return; btn.__dlgBtn = 1;
      btn.addEventListener('click', function () {
        var bd = document.getElementById(btn.getAttribute('data-dialog'));
        if (!bd) return;
        bd.classList.add('is-open');
        var c = bd.querySelector('.dialog-close'); if (c) c.focus();
      });
    });
    if (!document.__dlgEsc) {
      document.__dlgEsc = 1;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var o = document.querySelector('.dialog-backdrop.is-open');
          if (o) o.classList.remove('is-open');
        }
      });
    }
  }

  // ---------- Code: copy + highlight ----------
  function escapeHTML(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function highlightCode(raw){
    var lines = String(raw).replace(/\r/g,'').split('\n');
    var re = /(\/\/[^\n]*|'[^'\n]*|"[^"\n]*"|\b[A-Za-z_][A-Za-z0-9_]*\s*(?=\()|\b\d+(?:\.\d+)?\b)/g;
    function hl(line){
      return escapeHTML(line).replace(re, function(m){
        if(/^[\/\'"]/.test(m)) return '<span class="tok-com">'+m+'</span>';
        if(/^\d/.test(m)) return '<span class="tok-num">'+m+'</span>';
        return '<span class="tok-fn">'+m+'</span>';
      });
    }
    return lines.map(function(ln){ return '<span class="cl">' + (hl(ln) || '&#8203;') + '</span>'; }).join('');
  }
  function initCode(root){
    root.querySelectorAll('.prose pre, pre[data-lang]').forEach(function(pre){
      if(pre.__codeReady) return; pre.__codeReady = 1;
      var raw = pre.textContent;
      try { pre.innerHTML = highlightCode(raw); } catch(e){}
      var btn = document.createElement('button');
      btn.type='button'; btn.className='copy-btn'; btn.setAttribute('aria-label','کپی کد');
      btn.innerHTML='<svg viewBox="0 0 16 16"><path d="M9 1H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z"/><path d="M13 4h-2v8a2 2 0 0 1-2 2H5v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" opacity=".5"/></svg> کپی';
      btn.addEventListener('click', function(){
        var text = raw;
        var ok = function(){ btn.classList.add('copied'); btn.innerHTML='✓ کپی شد'; setTimeout(function(){ btn.classList.remove('copied'); btn.innerHTML='<svg viewBox="0 0 16 16"><path d="M9 1H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z"/><path d="M13 4h-2v8a2 2 0 0 1-2 2H5v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" opacity=".5"/></svg> کپی'; }, 1500); };
        if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok, function(){ fallback(text); }); }
        else fallback(text);
        function fallback(t){ var ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.focus(); ta.select(); try{ document.execCommand('copy'); }catch(e){} document.body.removeChild(ta); ok(); }
      });
      pre.appendChild(btn);
    });
  }

  // ---------- Reading progress bar ----------
  function initReadingBar(){
    if(document.getElementById('reading-bar')) return;
    var article = document.querySelector('.prose');
    if(!article) return;
    var bar = document.createElement('div'); bar.id='reading-bar'; bar.className='reading-bar';
    document.body.appendChild(bar);
    function update(){
      var rect = article.getBoundingClientRect();
      var total = article.offsetHeight - window.innerHeight;
      var scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total,0));
      var pct = total > 0 ? scrolled/total : 0;
      bar.style.width = (pct*100).toFixed(2)+'%';
    }
    window.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update, {passive:true});
    update();
  }

  // ---------- Table of contents ----------
  function initTOC(){
    var article = document.querySelector('.prose');
    if(!article || article.querySelector('.toc')) return;
    var heads = article.querySelectorAll('h2, h3');
    if(heads.length < 2) return;
    var toc = document.createElement('nav'); toc.className='toc';
    var title = document.createElement('div'); title.className='toc-title'; title.textContent='فهرست مطالب';
    var ol = document.createElement('ol');
    heads.forEach(function(h, i){
      if(!h.id) h.id='sec-'+i;
      var li=document.createElement('li'); li.className = h.tagName==='H3' ? 'lvl-3' : 'lvl-2';
      var a=document.createElement('a'); a.href='#'+h.id; a.textContent=h.textContent;
      li.appendChild(a); ol.appendChild(li);
    });
    toc.appendChild(title); toc.appendChild(ol);
    article.insertBefore(toc, article.firstChild);
    var links = toc.querySelectorAll('a');
    if(window.IntersectionObserver){
      var spy = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(en.isIntersecting){
            links.forEach(function(l){ l.classList.remove('active'); });
            var act = toc.querySelector('a[href="#'+en.target.id+'"]'); if(act) act.classList.add('active');
          }
        });
      }, {rootMargin:'-12% 0px -80% 0px'});
      heads.forEach(function(h){ spy.observe(h); });
    }
  }

  // ---------- Reading time ----------
  function initReadingTime(){
    var article = document.querySelector('.prose');
    var meta = document.querySelector('.post-meta');
    if(!article || !meta || document.getElementById('reading-time')) return;
    var words = (article.textContent||'').replace(/\s+/g,' ').trim().split(' ').length;
    var mins = Math.max(1, Math.round(words/200));
    var rt = document.createElement('span'); rt.id='reading-time'; rt.className='reading-time'; rt.textContent='زمان مطالعه: '+mins+' دقیقه';
    meta.appendChild(rt);
  }

  // ---------- Stat counters ----------
  function animateCount(el){
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1400, start = null;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min((ts-start)/dur, 1);
      var eased = 1 - Math.pow(1-p, 3);
      el.textContent = Math.round(target*eased);
      if(p<1) requestAnimationFrame(step);
      else el.textContent = target + suffix;
    }
    requestAnimationFrame(step);
  }
  function initCounters(root){
    var nums = root.querySelectorAll('[data-count]');
    if(!nums.length) return;
    if(!window.IntersectionObserver){ nums.forEach(animateCount); return; }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ animateCount(en.target); io.unobserve(en.target); } });
    }, {threshold:0.4});
    nums.forEach(function(n){ io.observe(n); });
  }

  // ---------- Blog search / filter ----------
  function initBlogSearch(root){
    var grid = document.getElementById('post-grid');
    if(!grid || grid.__searchReady) return; grid.__searchReady = 1;
    var box = document.getElementById('blog-search');
    var chips = document.getElementById('tag-filter');
    if(!box) return;
    var empty = document.getElementById('blog-empty');
    function cards(){ return Array.prototype.slice.call(grid.querySelectorAll('.post-card')); }
    function buildChips(){
      if(chips.__built || !chips) return;
      var set = {};
      cards().forEach(function(c){ c.querySelectorAll('.tag, .badge').forEach(function(t){ set[(t.textContent||'').trim()]=1; }); });
      var tags = Object.keys(set); if(!tags.length) return;
      tags.forEach(function(t){
        var b=document.createElement('button'); b.className='chip'; b.setAttribute('data-tag',t); b.textContent=t; chips.appendChild(b);
      });
      var all=document.createElement('button'); all.className='chip active'; all.setAttribute('data-tag',''); all.textContent='همه';
      chips.insertBefore(all, chips.firstChild);
      chips.__built=1;
    }
    function apply(){
      var q=(box.value||'').toLowerCase().trim();
      var act = chips ? chips.querySelector('.chip.active') : null;
      var tag = act ? act.getAttribute('data-tag') : '';
      var any=false;
      cards().forEach(function(card){
        var txt=(card.textContent||'').toLowerCase();
        var mq = !q || txt.indexOf(q)!==-1;
        var mt = !tag;
        if(tag){ mt=false; card.querySelectorAll('.tag, .badge').forEach(function(t){ if((t.textContent||'').trim()===tag) mt=true; }); }
        var show = mq && mt;
        card.style.display = show ? '' : 'none';
        if(show) any=true;
      });
      if(empty) empty.style.display = any ? 'none' : 'block';
    }
    box.addEventListener('input', apply);
    if(chips){
      chips.addEventListener('click', function(e){
        var c=e.target.closest('.chip'); if(!c) return;
        chips.querySelectorAll('.chip').forEach(function(x){ x.classList.remove('active'); });
        c.classList.add('active'); apply();
      });
    }
    if(window.MutationObserver){
      new MutationObserver(function(){ buildChips(); }).observe(grid, {childList:true, subtree:true});
    }
    buildChips(); apply();
  }

  // ---------- Cursor glow ----------
  function initCursorGlow(){
    if(window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    var g = document.querySelector('.cursor-glow');
    if(!g) return;
    g.classList.add('on');
    window.addEventListener('mousemove', function(e){
      g.style.setProperty('--mx', e.clientX+'px');
      g.style.setProperty('--my', e.clientY+'px');
    }, {passive:true});
  }

  // ---------- Language toggle (wire only if page has no own handler) ----------
  function initLang(){
    if(window.__siteHasPalette || window.__langBound) return;
    window.__langBound = 1;
    // index.html / blog/all already define setLang(); just expose helpers for the palette.
    if(window.setLang){
      window.__setLang = function(l){ window.setLang(l); };
      window.__getLang = function(){ return document.documentElement.dir === 'ltr' ? 'en' : 'fa'; };
      return;
    }
    var langButtons = document.querySelectorAll('.lang-opt');
    if(!langButtons.length) return;
    var i18nEls = document.querySelectorAll('[data-en]');
    i18nEls.forEach(function(el){ if(!el.dataset.fa) el.dataset.fa = el.innerHTML; });
    var lang = 'fa';
    function setLang(l){
      lang = l;
      document.documentElement.lang = l;
      document.documentElement.dir = (l === 'en') ? 'ltr' : 'rtl';
      i18nEls.forEach(function(el){ el.innerHTML = (l === 'en') ? el.dataset.en : el.dataset.fa; });
      langButtons.forEach(function(b){ b.classList.toggle('active', b.dataset.lang === l); });
    }
    langButtons.forEach(function(b){ b.addEventListener('click', function(){ setLang(b.dataset.lang); }); });
    window.__setLang = setLang;
    window.__getLang = function(){ return lang; };
  }

  // ---------- Command palette (Ctrl/Cmd+K) ----------
  function initCmdk(){
    if(window.__siteHasPalette || window.__cmdkBound) return;
    var overlay = document.getElementById('cmdk-overlay');
    var input = document.getElementById('cmdk-input');
    var list = document.getElementById('cmdk-list');
    var hintBtn = document.getElementById('cmdk-hint');
    if(!overlay || !input || !list || !hintBtn) return;
    window.__cmdkBound = 1;
    var activeIndex = 0, filtered = [];
    function getLang(){ return window.__getLang ? window.__getLang() : 'fa'; }
    function L(fa, en){ return getLang() === 'en' ? en : fa; }
    function isDark(){ return document.documentElement.getAttribute('data-theme') === 'dark'; }
    function toggleTheme(){
      var next = isDark() ? 'light' : 'dark';
      if(window.applyTheme) window.applyTheme(next, innerWidth/2, innerHeight/2);
      else document.documentElement.setAttribute('data-theme', next);
    }
    function copyText(text, labelEl){
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).catch(function(){}); }
      if(labelEl){ var o = labelEl.textContent; labelEl.textContent = L('کپی شد!','Copied!'); setTimeout(function(){ labelEl.textContent = o; }, 1200); }
    }
    function commands(){
      var cmds = [];
      document.querySelectorAll('header nav a').forEach(function(a){
        var href = a.getAttribute('href');
        var fa = (a.textContent||'').trim();
        var en = a.getAttribute('data-en') || fa;
        cmds.push({ icon:'i-arrow-up', group:L('برو به','Go to'), fa:fa, en:en, run:function(){ location.href = href; } });
      });
      cmds.push({ icon: isDark()?'i-sun':'i-moon', group:L('عملیات','Action'), fa: isDark()?'حالت روشن':'حالت تاریک', en: isDark()?'Light mode':'Dark mode', run:toggleTheme });
      cmds.push({ icon:'i-globe', group:L('عملیات','Action'), fa:'تغییر زبان به انگلیسی', en:'Switch language to English', run:function(){ if(window.__setLang) window.__setLang(getLang()==='en'?'fa':'en'); } });
      cmds.push({ icon:'i-copy', group:L('کپی','Copy'), fa:'کپی ایمیل', en:'Copy email', run:function(el){ copyText('me@mehdiaskari.ir', el); } });
      cmds.push({ icon:'i-github', group:L('باز کردن','Open'), fa:'باز کردن گیت‌هاب', en:'Open GitHub', run:function(){ window.open('https://github.com/m38d1','_blank'); } });
      cmds.push({ icon:'i-download', group:L('عملیات','Action'), fa:'دانلود رزومه (PDF)', en:'Download resume (PDF)', run:function(){ location.href='/resume-fa.pdf'; } });
      cmds.push({ icon:'i-arrow-up', group:L('عملیات','Action'), fa:'برو به بالای صفحه', en:'Scroll to top', run:function(){ window.scrollTo({top:0, behavior:'smooth'}); } });
      return cmds;
    }
    function renderList(query){
      var q = (query||'').trim().toLowerCase();
      var all = commands();
      filtered = !q ? all : all.filter(function(c){ return c.fa.indexOf(q)!==-1 || c.en.toLowerCase().indexOf(q)!==-1; });
      activeIndex = 0;
      if(!filtered.length){ list.innerHTML = '<div class="cmdk-empty">'+L('نتیجه‌ای پیدا نشد','No results')+'</div>'; return; }
      list.innerHTML = filtered.map(function(c,i){
        return '<div class="cmdk-item'+(i===0?' active':'')+'" data-i="'+i+'">'+
          '<span class="cmdk-ic"><svg class="ic" aria-hidden="true"><use href="#'+c.icon+'"/></svg></span>'+
          '<span class="cmdk-label">'+(getLang()==='en'?c.en:c.fa)+'</span>'+
          '<span class="cmdk-group">'+c.group+'</span>'+
        '</div>';
      }).join('');
    }
    function setActive(i){
      var items = list.querySelectorAll('.cmdk-item');
      items.forEach(function(el){ el.classList.remove('active'); });
      if(items[i]){ items[i].classList.add('active'); items[i].scrollIntoView({block:'nearest'}); }
      activeIndex = i;
    }
    function execute(i){
      var cmd = filtered[i]; if(!cmd) return;
      var el = list.querySelector('.cmdk-item[data-i="'+i+'"] .cmdk-label');
      cmd.run(el);
      if(!/copy|کپی/i.test(cmd.group)) close();
    }
    function open(){ overlay.classList.add('open'); input.value=''; renderList(''); setTimeout(function(){ try{ input.focus(); }catch(e){} }, 50); }
    function close(){ overlay.classList.remove('open'); }
    window.addEventListener('keydown', function(e){
      if((e.ctrlKey||e.metaKey) && (e.key==='k'||e.key==='K')){ e.preventDefault(); overlay.classList.contains('open')?close():open(); }
      else if(e.key==='Escape' && overlay.classList.contains('open')){ close(); }
    });
    hintBtn.addEventListener('click', open);
    overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
    input.addEventListener('input', function(){ renderList(input.value); });
    input.addEventListener('keydown', function(e){
      if(e.key==='ArrowDown'){ e.preventDefault(); setActive(Math.min(activeIndex+1, filtered.length-1)); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); setActive(Math.max(activeIndex-1, 0)); }
      else if(e.key==='Enter'){ e.preventDefault(); execute(activeIndex); }
    });
    list.addEventListener('click', function(e){ var it=e.target.closest('.cmdk-item'); if(it) execute(parseInt(it.dataset.i,10)); });
  }

  function initAll(root){
    initTabs(root); initAccordion(root); initDialog(root); initCode(root);
    initReadingBar(); initTOC(); initReadingTime(); initCounters(root);
    initBlogSearch(root); initCursorGlow();
    initLang(); initCmdk();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(document); });
  } else { initAll(document); }

  // expose + observe dynamically injected content
  window.__initComponents = initAll;
  if (window.MutationObserver) {
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && n.querySelectorAll) initAll(n);
        });
      });
    });
    document.addEventListener('DOMContentLoaded', function () {
      if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
