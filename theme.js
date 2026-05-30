/* ═══════════════════════════════════════════════════════════════════
   Theme Toggle — Dark/Light persistence with system preference fallback
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function getCurrent() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function apply(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    document.dispatchEvent(new CustomEvent('gc:themechange', { detail: { theme: theme } }));
  }

  function init() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var next = getCurrent() === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem('gc-theme', next); } catch (e) {}
    });

    // Listen to OS theme changes if user hasn't explicitly chosen
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var handler = function (e) {
        var stored;
        try { stored = localStorage.getItem('gc-theme'); } catch (err) { stored = null; }
        if (!stored) apply(e.matches ? 'dark' : 'light');
      };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
