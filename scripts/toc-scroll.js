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
    // Detection band: upper third of the viewport. A section becomes "active"
    // once its anchor crosses ~10% from the top and stays active until the next
    // anchor enters the band. Previous setting (-15% / -75%) kept the old link
    // active too long on short sections.
    }, { rootMargin: '-10% 0px -60% 0px' });

    anchors.forEach(function (a) { observer.observe(a); });
  }

  // ── Mobile sidebar toggle ───────────────────────────────────────────────────
  const toggle = document.querySelector('.toc-toggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    if (!toggle.hasAttribute('aria-controls')) toggle.setAttribute('aria-controls', 'sidebar');
    if (!toggle.hasAttribute('aria-label')) toggle.setAttribute('aria-label', 'Toggle contents');
    toggle.setAttribute('aria-expanded', 'false');

    // Stable markup: a label + a chevron glyph that rotates via CSS when
    // aria-expanded="true". Replaces the old text-swap ("Contents ▾" ↔
    // "Close ✕") which made the button feel like a different control.
    if (!toggle.querySelector('.toc-toggle-label')) {
      toggle.innerHTML = '<span class="toc-toggle-label">目录 Contents</span><span class="toc-toggle-chevron" aria-hidden="true">▾</span>';
    }

    // Create a backdrop that only shows when the sheet is open on mobile
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    function openSidebar() {
      sidebar.classList.add('open');
      backdrop.classList.add('visible');
      toggle.setAttribute('aria-expanded', 'true');
    }
    function closeSidebar() {
      sidebar.classList.remove('open');
      backdrop.classList.remove('visible');
      toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      if (sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
    });
    backdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
    });
    // Auto-close sidebar on mobile when a TOC link is clicked
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('.toc-list a') && window.innerWidth <= 768) {
        // Let the anchor navigation happen, then close
        setTimeout(closeSidebar, 10);
      }
    });
    // Close if resized to desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth > 768 && sidebar.classList.contains('open')) closeSidebar();
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
