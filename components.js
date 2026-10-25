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
      function close() {
        bd.classList.remove('is-open');
        // WCAG 2.4.3: hand focus back to the control that opened the dialog.
        if (bd.__opener && typeof bd.__opener.focus === 'function') {
          try { bd.__opener.focus({preventScroll:true}); } catch (e) {}
        }
      }
      bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
      var c = bd.querySelector('.dialog-close'); if (c) c.addEventListener('click', close);
      bd.__close = close;
    });
    root.querySelectorAll('[data-dialog]').forEach(function (btn) {
      if (btn.__dlgBtn) return; btn.__dlgBtn = 1;
      btn.addEventListener('click', function () {
        var bd = document.getElementById(btn.getAttribute('data-dialog'));
        if (!bd) return;
        bd.__opener = btn;
        bd.classList.add('is-open');
        var c = bd.querySelector('.dialog-close'); if (c) c.focus();
      });
    });
    if (!document.__dlgEsc) {
      document.__dlgEsc = 1;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var o = document.querySelector('.dialog-backdrop.is-open');
          if (o && o.__close) o.__close();
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
      btn.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M9 1H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z"/><path d="M13 4h-2v8a2 2 0 0 1-2 2H5v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" opacity=".5"/></svg> کپی';
      btn.addEventListener('click', function(){
        var text = raw;
        var ok = function(){ btn.classList.add('copied'); btn.innerHTML='✓ کپی شد'; setTimeout(function(){ btn.classList.remove('copied'); btn.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M9 1H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z"/><path d="M13 4h-2v8a2 2 0 0 1-2 2H5v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" opacity=".5"/></svg> کپی'; }, 1500); };
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
    var toc = document.createElement('nav'); toc.className='toc'; toc.setAttribute('aria-label','فهرست مطالب'); toc.setAttribute('data-en-aria','Table of contents');
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

  // ---------- Related posts (post pages only) ----------
  function initRelated(){
    if(document.querySelector('.related-sec')) return;
    var article = document.querySelector('article.prose');
    var cover = document.querySelector('[data-cover]');
    var foot = document.querySelector('.post-foot');
    if(!article || !cover || !foot) return;
    var slug = cover.getAttribute('data-cover') || '';
    function isEn(){ return document.documentElement.lang === 'en' || document.documentElement.dir === 'ltr'; }
    function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function pick(posts){
      var cur = null, rest = [];
      posts.forEach(function(p){ if(p.slug === slug) cur = p; else rest.push(p); });
      var curTags = (cur && cur.tags) || [];
      rest.forEach(function(p){
        var s = 0;
        (p.tags || []).forEach(function(t){ if(curTags.indexOf(t) !== -1) s++; });
        p.__score = s;
      });
      rest.sort(function(a, b){ return (b.__score - a.__score) || (String(b.date || '') < String(a.date || '') ? -1 : 1); });
      return rest.slice(0, 3);
    }
    function render(posts){
      var old = document.querySelector('.related-sec');
      if(old) old.remove();
      var list = pick(posts);
      if(!list.length) return;
      var en = isEn();
      var sec = document.createElement('section');
      sec.className = 'related-sec';
      var html = '<h2>' + (en ? 'Related posts' : 'نوشته‌های مرتبط') + '</h2><div class="post-grid">';
      list.forEach(function(p){
        var tags = (p.tags || []).slice(0, 3).map(function(t){ return '<span class="tag">' + esc(t) + '</span>'; }).join('');
        html += '<a class="post-card" href="/blog/' + esc(p.slug) + '/">'
          + '<div class="post-meta"><span class="pdate">' + esc(p.dateFa || '') + '</span>' + tags + '</div>'
          + '<h3>' + esc(p.title) + '</h3>'
          + '<p>' + esc(p.excerpt || '') + '</p>'
          + '<span class="read">' + (en ? 'Read article' : 'خواندن نوشته') + '</span></a>';
      });
      html += '</div><div class="blog-more"><a href="/blog/all/">' + (en ? 'All posts' : 'همه‌ی نوشته‌ها') + '</a></div>';
      sec.innerHTML = html;
      foot.parentNode.insertBefore(sec, foot);
    }
    fetch('/posts.json').then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
      if(!d || !d.posts) return;
      render(d.posts);
      document.querySelectorAll('.lang-opt').forEach(function(b){
        if(b.__relBound) return; b.__relBound = 1;
        b.addEventListener('click', function(){ setTimeout(function(){ render(d.posts); }, 50); });
      });
    }).catch(function(){});
  }
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

  // ---------- Card 3D tilt (blog-card on home, post-card on /blog/all/) ----------
  function initTilt(root){
    if(!(window.matchMedia
      && window.matchMedia('(pointer: fine)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var SEL = '.blog-card, .post-card';
    var els = [];
    if(root.matches && root.matches(SEL)) els.push(root);
    root.querySelectorAll(SEL).forEach(function(x){ els.push(x); });
    els.forEach(function(el){
      if(el.__tiltBound) return; el.__tiltBound = 1;
      el.classList.add('tiltable');
      var raf = 0, ev = null;
      el.addEventListener('pointermove', function(e){
        ev = e;
        if(raf) return;
        raf = requestAnimationFrame(function(){
          raf = 0;
          if(!ev) return;
          var r = el.getBoundingClientRect();
          if(!r.width || !r.height) return;
          var px = (ev.clientX - r.left) / r.width - 0.5;
          var py = (ev.clientY - r.top) / r.height - 0.5;
          el.style.setProperty('--tilt-x', (-py * 3.5).toFixed(2) + 'deg');
          el.style.setProperty('--tilt-y', (px * 3.5).toFixed(2) + 'deg');
        });
      }, {passive:true});
      el.addEventListener('pointerleave', function(){
        if(raf){ cancelAnimationFrame(raf); raf = 0; }
        el.style.setProperty('--tilt-x', '0deg');
        el.style.setProperty('--tilt-y', '0deg');
      });
    });
  }

  // ---------- Blog search / filter ----------
  function initBlogSearch(root){
    var grid = document.getElementById('post-grid');
    if(!grid || grid.__searchReady) return; grid.__searchReady = 1;
    var box = document.getElementById('blog-search');
    var chips = document.getElementById('tag-filter');
    if(!box && !chips) return;
    var empty = document.getElementById('blog-empty');
    function cards(){ return Array.prototype.slice.call(grid.querySelectorAll('.post-card')); }
    function cardText(el){
      // i18n swaps data-en into innerHTML, which also replaces the <span>s —
      // read the static tags from the source attribute so the filter still
      // sees them in English mode.
      var raw = el.getAttribute('data-search');
      if(raw === null){
        raw = (el.textContent || '');
        var src = el.querySelector('.post-meta');
        if(src) raw += ' ' + (src.getAttribute('data-fa') || '');
        el.setAttribute('data-search', raw);
      }
      return raw;
    }
    function buildChips(){
      if(!chips || chips.__built) return;
      // Only tags that appear on 2+ cards get a chip — a chip row of 31 one-off
      // tags is a wall of noise, not a filter.
      var count = {};
      cards().forEach(function(c){
        var seen = {};
        c.querySelectorAll('.tag, .badge').forEach(function(t){
          var k = (t.textContent||'').trim();
          if(k && !seen[k]){ seen[k] = 1; count[k] = (count[k]||0) + 1; }
        });
      });
      var tags = Object.keys(count).filter(function(t){ return count[t] >= 2; })
        .sort(function(a,b){ return count[b]-count[a] || (a<b?-1:1); });
      if(!tags.length) return;
      tags.forEach(function(t){
        var b=document.createElement('button'); b.className='chip'; b.setAttribute('data-tag',t); b.textContent=t; chips.appendChild(b);
      });
      var all=document.createElement('button'); all.className='chip active'; all.setAttribute('data-tag',''); all.textContent='همه';
      chips.insertBefore(all, chips.firstChild);
      // Shareable deep-link: /blog/all/?tag=شبکه pre-activates that chip.
      var want = '';
      try{ want = new URLSearchParams(location.search).get('tag') || ''; }catch(e){}
      if(want){
        var sel = '.chip[data-tag="' + (window.CSS && CSS.escape ? CSS.escape(want) : want) + '"]';
        var hit = chips.querySelector(sel);
        if(hit){
          chips.querySelector('.chip.active').classList.remove('active');
          hit.classList.add('active');
          apply();   // the deep-link must actually filter, not just light up the chip
        }
      }
      chips.__built=1;
    }
    function syncTagUrl(tag){
      // Keep the address bar honest without spamming history.
      try{
        var u = new URL(location.href);
        if(tag) u.searchParams.set('tag', tag); else u.searchParams.delete('tag');
        history.replaceState({}, '', u);
      }catch(e){}
    }
    function apply(){
      var q=(box ? box.value||'' : '').toLowerCase().trim();
      var act = chips ? chips.querySelector('.chip.active') : null;
      var tag = act ? act.getAttribute('data-tag') : '';
      var any=false;
      cards().forEach(function(card){
        var txt=cardText(card).toLowerCase();
        var mq = !q || txt.indexOf(q)!==-1;
        var mt = !tag;
        if(tag){
          mt=false;
          card.querySelectorAll('.tag, .badge').forEach(function(t){ if((t.textContent||'').trim()===tag) mt=true; });
          if(!mt) mt = txt.indexOf(tag.toLowerCase())!==-1;   // survived an i18n swap
        }
        var show = mq && mt;
        card.style.display = show ? '' : 'none';
        if(show) any=true;
      });
      if(empty) empty.style.display = any ? 'none' : 'block';
    }
    box && box.addEventListener('input', apply);
    if(chips){
      chips.addEventListener('click', function(e){
        var c=e.target.closest('.chip'); if(!c) return;
        chips.querySelectorAll('.chip').forEach(function(x){ x.classList.remove('active'); });
        c.classList.add('active');
        syncTagUrl(c.getAttribute('data-tag') || '');
        apply();
      });
    }
    if(window.MutationObserver){
      // The archive re-renders its cards from posts.json after load, so the
      // filter (and the URL deep-link) has to be re-applied to the new nodes.
      new MutationObserver(function(){ buildChips(); apply(); }).observe(grid, {childList:true});
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
      // accessible names follow the language too: <el data-en-aria="English label">
      document.querySelectorAll('[data-en-aria]').forEach(function(el){
        if(!el.dataset.faAria) el.dataset.faAria = el.getAttribute('aria-label') || '';
        el.setAttribute('aria-label', (l === 'en') ? el.dataset.enAria : el.dataset.faAria);
      });
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
    var activeIndex = 0, filtered = [], lastFocus = null;
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
    function open(){ lastFocus = document.activeElement; overlay.classList.add('open'); input.value=''; renderList(''); setTimeout(function(){ try{ input.focus(); }catch(e){} }, 50); }
    function close(){
      overlay.classList.remove('open');
      // WCAG 2.4.3: put focus back where it was when the dialog opened.
      // preventScroll keeps a "jump to section" command from being undone.
      if(lastFocus && typeof lastFocus.focus === 'function'){
        try{ lastFocus.focus({preventScroll:true}); }catch(e){}
      }
      lastFocus = null;
    }
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

  // ---------- Mobile menu: iOS-style bottom sheet ----------
  function initMenu(root){
    var menu = root.querySelector ? root.querySelector('#mobile-menu') : null;
    var toggle = document.getElementById('menu-toggle');
    if (!menu || !toggle || menu.__menuReady) return;
    menu.__menuReady = 1;

    // The grabber and the backdrop are injected so every page gets them
    // without repeating markup; the home page already ships a backdrop.
    if (!menu.querySelector('.sheet-grab')) {
      var grab = document.createElement('span');
      grab.className = 'sheet-grab';
      grab.setAttribute('aria-hidden', 'true');
      menu.insertBefore(grab, menu.firstChild);
    }
    var backdrop = document.getElementById('menu-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'menu-backdrop';
      backdrop.id = 'menu-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }

    menu.setAttribute('aria-label', 'منوی سایت');
    menu.setAttribute('data-en-aria', 'Site menu');
    if (!toggle.getAttribute('aria-controls')) toggle.setAttribute('aria-controls', 'mobile-menu');

    var lastFocus = null;
    function isOpen(){ return menu.classList.contains('open'); }
    function items(){
      return Array.prototype.slice.call(menu.querySelectorAll('a[href], button:not([disabled])'));
    }

    function open(){
      if (isOpen()) return;
      lastFocus = document.activeElement;
      menu.classList.add('open');
      backdrop.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';   // no scrolling behind the sheet
      document.body.classList.add('menu-open');  // hides the floating scroll-top
      var first = items()[0];
      if (first) setTimeout(function(){
        try { first.focus({preventScroll:true}); } catch (e) {}
      }, 60);
    }
    function close(){
      if (!isOpen()) return;
      menu.classList.remove('open', 'dragging');
      menu.style.transform = '';
      backdrop.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      document.body.classList.remove('menu-open');
      // WCAG 2.4.3: hand focus back to the trigger. A pointer-activated sheet
      // leaves lastFocus as <body>, so fall back to the button itself.
      var back = (lastFocus && lastFocus !== document.body) ? lastFocus : toggle;
      if (back && typeof back.focus === 'function') {
        try { back.focus({preventScroll:true}); } catch (e) {}
      }
      lastFocus = null;
    }

    toggle.addEventListener('click', function(){ isOpen() ? close() : open(); });
    backdrop.addEventListener('click', close);
    menu.addEventListener('click', function(e){
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (a) close();
    });
    document.addEventListener('keydown', function(e){
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var list = items();
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Swipe the grabber down to dismiss, like an iOS sheet.
    var grab2 = menu.querySelector('.sheet-grab');
    var startY = null, dy = 0;
    function onDown(e){
      if (e.button != null && e.button !== 0) return;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      dy = 0;
      menu.classList.add('dragging');
      if (e.pointerId != null && grab2.setPointerCapture) {
        try { grab2.setPointerCapture(e.pointerId); } catch (err) {}
      }
    }
    function onMove(e){
      if (startY == null) return;
      var y = e.touches ? e.touches[0].clientY : e.clientY;
      dy = Math.max(0, y - startY);
      menu.style.transform = 'translateY(' + dy + 'px)';
      if (e.cancelable) e.preventDefault();
    }
    function onUp(){
      if (startY == null) return;
      startY = null;
      menu.classList.remove('dragging');
      if (dy > 90) close();            // a real pull, not a wobble
      else menu.style.transform = '';
      dy = 0;
    }
    if (grab2) {
      grab2.addEventListener('pointerdown', onDown);
      grab2.addEventListener('pointermove', onMove);
      grab2.addEventListener('pointerup', onUp);
      grab2.addEventListener('pointercancel', onUp);
    }
  }

  /* With html{scroll-behavior:smooth} Chromium drops the initial fragment
     scroll on cross-document arrivals (post-header «تماس» -> /#contact loaded
     at the top, scrollY 0) and lazy content can shift the target mid-flight.
     Let the native scroll run; if after ~700ms we are still far from the
     target, jump there instantly. Successful smooth scrolls stay untouched. */
  function initHashJump(){
    function ensure(){
      var id = location.hash.slice(1);
      if(!id) return;
      var el = document.getElementById(id);
      if(!el) return;
      var header = document.querySelector('header');
      var off = (header ? header.offsetHeight : 0) + 10;
      var want = Math.max(0, Math.round(el.getBoundingClientRect().top + window.pageYOffset - off));
      if(Math.abs(window.pageYOffset - want) > 120) window.scrollTo({top: want, behavior: 'auto'});
    }
    // the reader scrolling away by hand wins — never yank them back
    var touched = false;
    ['wheel','touchstart','keydown'].forEach(function(ev){
      window.addEventListener(ev, function(){ touched = true; }, {passive:true, capture:true});
    });
    function watch(){
      touched = false;
      setTimeout(function(){ if(!touched) ensure(); }, 700);
    }
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', watch);
    } else { watch(); }
    window.addEventListener('load', watch);           // after late layout shifts
    window.addEventListener('hashchange', watch);     // TOC + in-page anchors
  }

  function initAll(root){
    initTabs(root); initAccordion(root); initDialog(root); initCode(root);
    initReadingBar(); initTOC(); initReadingTime(); initRelated(); initCounters(root);
    initBlogSearch(root); initTilt(root); initCursorGlow();
    initLang(); initCmdk(); initMenu(root); initHashJump();
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
