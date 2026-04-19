/* toc-scroll.js — TOC scroll-spy, mobile toggle, back-to-top, reading progress */
if (window.__tocScrollInit) { /* already loaded */ }
else { window.__tocScrollInit = true; (function () {

  // Ensure <main> has id="main-content" so the skip link works without per-page edits
  const mainEl = document.querySelector('main.main');
  if (mainEl && !mainEl.id) mainEl.id = 'main-content';

  // ── TOC scroll-spy ──────────────────────────────────────────────────────────
  const anchors = document.querySelectorAll('.section-anchor');
  const links   = document.querySelectorAll('.toc-list a');

  if (anchors.length && links.length) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach(function (l) {
            const isActive = l.getAttribute('href') === '#' + id;
            l.classList.toggle('active', isActive);
            if (isActive) l.setAttribute('aria-current', 'location');
            else l.removeAttribute('aria-current');
          });
        }
      });
    }, { rootMargin: '-15% 0px -75% 0px' });

    anchors.forEach(function (a) { observer.observe(a); });
  }

  // ── Mobile sidebar toggle ───────────────────────────────────────────────────
  const toggle = document.querySelector('.toc-toggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    if (!toggle.hasAttribute('aria-controls')) toggle.setAttribute('aria-controls', 'sidebar');
    toggle.setAttribute('aria-expanded', sidebar.classList.contains('open') ? 'true' : 'false');
    toggle.addEventListener('click', function () {
      const open = sidebar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Auto-close sidebar on mobile when a TOC link is clicked
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('.toc-list a') && window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── Reading progress bar ────────────────────────────────────────────────────
  const bar = document.querySelector('.reading-progress-bar');
  if (bar) {
    let raf = null;
    function update() {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
      bar.style.width = pct.toFixed(2) + '%';
      raf = null;
    }
    window.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  // ── Back-to-top button (only on long pages) ─────────────────────────────────
  if (mainEl && document.body.scrollHeight > window.innerHeight * 1.8) {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);

    let visible = false;
    function onScroll() {
      const shouldShow = window.scrollY > window.innerHeight * 0.6;
      if (shouldShow !== visible) {
        visible = shouldShow;
        btn.classList.toggle('visible', visible);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}()); }
