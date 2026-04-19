/* toc-scroll.js — shared TOC scroll-spy + mobile toggle */
if (window.__tocScrollInit) { /* already loaded */ }
else { window.__tocScrollInit = true; (function () {
  const anchors = document.querySelectorAll('.section-anchor');
  const links   = document.querySelectorAll('.toc-list a');

  if (anchors.length && links.length) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach(function (l) {
            l.classList.toggle('active', l.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-15% 0px -75% 0px' });

    anchors.forEach(function (a) { observer.observe(a); });
  }

  const toggle = document.querySelector('.toc-toggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }
}()); }
