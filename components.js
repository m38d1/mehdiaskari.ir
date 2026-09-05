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

  function initAll(root) { initTabs(root); initAccordion(root); initDialog(root); }

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
