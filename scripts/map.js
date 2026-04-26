/* map.js — Interactive China map: layer toggles, pin rendering, tooltips */
(function () {
  'use strict';

  const BASE = (() => {
    const s = document.querySelector('script[data-map-base]');
    return s ? s.dataset.mapBase : '../../';
  })();

  const SVG_W = 800;
  const SVG_H = 700;

  // Mercator projection parameters — must match build/scripts/gen-map-svg.mjs
  // exactly so pins land where they belong on the rendered geodata.
  const PROJ = {
    centerLon: 103,
    centerLat: 36,
    scale:     820,
    tx:        368,   // translate x (W * 0.46)
    ty:        350,   // translate y (H * 0.50)
  };

  // Forward Mercator: (lon, lat) → (x, y) in SVG-viewBox coordinates.
  function projectLonLat(lon, lat) {
    const lambda = (lon - PROJ.centerLon) * Math.PI / 180;
    const phi    = lat * Math.PI / 180;
    const phi0   = PROJ.centerLat * Math.PI / 180;
    // Standard spherical Mercator with center-at-phi0 vertical offset
    const mercY  = Math.log(Math.tan(Math.PI / 4 + phi  / 2));
    const mercY0 = Math.log(Math.tan(Math.PI / 4 + phi0 / 2));
    const x = PROJ.tx + PROJ.scale * lambda;
    const y = PROJ.ty - PROJ.scale * (mercY - mercY0);
    return [x, y];
  }

  /* ── State ─────────────────────────────────────────────── */
  let entries = {};          // slug → entry object
  let annotations = [];     // from map-annotations.json
  let activeLayers = new Set(['modern']);
  let activeDynasty = null;  // for dynasty extent highlight
  let tooltip = null;
  let svgEl = null;
  let svgRect = null;

  /* ── Boot ───────────────────────────────────────────────── */
  async function init() {
    svgEl = document.getElementById('china-map-svg');
    if (!svgEl) return;

    // Load data in parallel
    const [entryData, annoData] = await Promise.all([
      fetch(BASE + 'data/entries.json').then(r => r.json()).catch(() => []),
      fetch(BASE + 'data/map-annotations.json').then(r => r.json()).catch(() => ({ annotations: [], layers: [] }))
    ]);

    // Index entries by slug
    entryData.forEach(e => {
      if (e.path) {
        // strip pages/ prefix and .html suffix to get slug
        const slug = e.path.replace(/^pages\//, '').replace(/\.html$/, '');
        entries[slug] = e;
      }
    });

    annotations = annoData.annotations || [];

    buildTooltip();
    renderPins();
    wireLayerToggles();
    wireDynastySelector();
    applyLayers();
    wireMapInteractions();
    wireResizeObserver();

    svgEl.setAttribute('aria-label', 'Interactive map of China — click a marker to open the linked entry');
  }

  /* ── Tooltip DOM ────────────────────────────────────────── */
  function buildTooltip() {
    tooltip = document.createElement('div');
    tooltip.className = 'map-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-live', 'polite');
    tooltip.hidden = true;
    document.getElementById('map-container').appendChild(tooltip);
  }

  function showTooltip(anno, pinEl, opts) {
    const entry = entries[anno.entry] || {};
    const title = entry.title || (anno.label_cn + ' · ' + anno.label_en);
    const desc = entry.desc || '';
    const cat = entry.category || anno.category || '';

    tooltip.innerHTML = `
      <span class="map-tt-cn">${anno.label_cn}</span>
      <span class="map-tt-py">${anno.label_py}</span>
      <span class="map-tt-title">${title.replace(/^[^·]+·\s*/, '')}</span>
      ${desc ? `<span class="map-tt-desc">${desc}</span>` : ''}
      ${cat ? `<span class="map-tt-cat" data-category="${cat}">${cat}</span>` : ''}
      <span class="map-tt-cta">View entry →</span>
    `;
    tooltip.dataset.category = cat;
    tooltip.hidden = false;

    // First show after a hidden state should snap to position (not slide
    // from previous pin). Subsequent show() while already visible animates.
    const wasVisible = tooltip.classList.contains('is-visible');
    if (!wasVisible || (opts && opts.snap)) {
      tooltip.classList.add('no-slide');
      // double rAF to let the browser commit position before re-enabling
      // transitions
      positionTooltip(pinEl);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        tooltip.classList.remove('no-slide');
        tooltip.classList.add('is-visible');
      }));
    } else {
      positionTooltip(pinEl);
      tooltip.classList.add('is-visible');
    }
  }

  function hideTooltip() {
    tooltip.classList.remove('is-visible');
    // keep `hidden` off so the visibility transition can complete; the
    // CSS visibility:hidden after fade prevents pointer-leakage
  }

  // Convert an SVG-local point (px in viewBox space) to a container-relative
  // pixel position by mapping through the SVG's CTM. Far more reliable than
  // getBoundingClientRect on a transformed <g>, which returns the bbox of the
  // element's painted area only.
  function pinScreenPoint(pinEl) {
    const m = pinEl.getCTM();
    if (!m) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = 0; pt.y = 0;
    const screenPt = pt.matrixTransform(m); // svg-element-relative px
    const svgRectNow = svgEl.getBoundingClientRect();
    const containerRect = document.getElementById('map-container').getBoundingClientRect();
    // Convert from svg-content coords to container coords:
    //   svgRectNow gives where SVG sits on screen; screenPt is in SVG coords
    //   relative to its own viewBox origin scaled to its rendered size.
    const scaleX = svgRectNow.width  / svgEl.viewBox.baseVal.width;
    const scaleY = svgRectNow.height / svgEl.viewBox.baseVal.height;
    const x = (svgRectNow.left - containerRect.left) + screenPt.x * scaleX;
    const y = (svgRectNow.top  - containerRect.top ) + screenPt.y * scaleY;
    return { x, y, scaleY };
  }

  function positionTooltip(pinEl) {
    const container = document.getElementById('map-container');
    const cr = container.getBoundingClientRect();
    const pt = pinScreenPoint(pinEl);
    if (!pt) return;

    // Tooltip width unknown until in DOM; measure
    const tr = tooltip.getBoundingClientRect();
    const tipW = tr.width || 200;
    const tipH = tr.height || 80;

    // Default: centered above the pin
    let left = pt.x;
    let top  = pt.y;
    let below = false;

    // Flip below if there's not enough room above (account for tooltip + caret)
    if (top - tipH - 14 < 6) {
      below = true;
    }

    // Clamp horizontally so tooltip doesn't run off the container edges
    const margin = 8;
    const halfW = tipW / 2;
    if (left - halfW < margin) left = halfW + margin;
    if (left + halfW > cr.width - margin) left = cr.width - halfW - margin;

    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
    tooltip.classList.toggle('map-tooltip--below', below);
  }

  /* ── Pin rendering ──────────────────────────────────────── */
  const ICONS = {
    city:              'M0,-8 L5,0 L8,6 L0,10 L-8,6 L-5,0 Z',  // diamond
    region:            null,                                    // circle
    island:            null,                                    // circle
    river:             'M-6,0 Q0,-8 6,0 Q0,8 -6,0 Z',          // oval
    'dynasty-capital': 'M0,-9 L2,-3 L9,-3 L3,1 L5,8 L0,4 L-5,8 L-3,1 L-9,-3 L-2,-3 Z', // star
    'dialect-zone':    null,                                    // circle
    cultural:          'M0,-7 L7,7 L-7,7 Z',                    // triangle
    // New types for Phase 2.3–2.5
    mountain:          'M-9,7 L-3,-3 L0,1 L4,-7 L9,7 Z',        // mountain peak silhouette
    cuisine:           'M-7,-1 L7,-1 A 7 7 0 0 1 -7 -1 Z M-2,-4 L-2,-1 M2,-4 L2,-1', // rice bowl with chopsticks
    philosopher:       'M-6,-7 L6,-7 L6,7 L-6,7 Z M-3,-4 L3,-4 M-3,-1 L3,-1 M-3,2 L1,2', // scroll
    temple:            'M0,-9 L8,-3 L8,7 L-8,7 L-8,-3 Z M-3,7 L-3,1 L3,1 L3,7', // temple with door
  };

  const CATEGORY_COLORS = {
    geography:  '#2a5c6b',
    history:    '#6b4420',
    culture:    '#8e4a6e',
    religion:   '#5c3d7a',
    philosophy: '#7a5828',
    culinary:   '#a04030',
    default:    '#8b1a1a',
  };

  function pinColor(anno) {
    return CATEGORY_COLORS[anno.category] || CATEGORY_COLORS.default;
  }

  function renderPins() {
    // Clear all pin groups
    ['sites','dynasties','rivers','dialects','modern','greatwall','silkroads'].forEach(layer => {
      const g = document.getElementById('map-pins-' + layer);
      if (g) g.innerHTML = '';
    });

    annotations.forEach(anno => {
      // Prefer projected lon/lat; fall back to legacy x/y percent for any
      // annotation that hasn't been migrated yet.
      let cx, cy;
      if (typeof anno.lon === 'number' && typeof anno.lat === 'number') {
        [cx, cy] = projectLonLat(anno.lon, anno.lat);
      } else {
        cx = (anno.x / 100) * SVG_W;
        cy = (anno.y / 100) * SVG_H;
      }
      const color = pinColor(anno);
      const icon = ICONS[anno.type] || null;

      // Outer pin group: holds the static translate(cx, cy). Never animated
      // (animating an SVG <g> with both translate AND CSS transform creates
      // the teleport-on-hover bug we used to have).
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'map-pin map-pin--' + (anno.type || 'default'));
      g.setAttribute('data-annotation-id', anno.id);
      g.setAttribute('data-entry', anno.entry);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', anno.label_cn + ' ' + anno.label_en);
      g.setAttribute('transform', `translate(${cx},${cy})`);

      // Inner scale group: this is the element CSS animates on hover.
      const scaleG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      scaleG.setAttribute('class', 'map-pin-scale');
      g.appendChild(scaleG);

      // Outer glow ring — visual only, no hit-testing.
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('r', '10');
      ring.setAttribute('fill', color);
      ring.setAttribute('opacity', '0.18');
      ring.setAttribute('class', 'pin-ring');
      ring.setAttribute('pointer-events', 'none');
      scaleG.appendChild(ring);

      // Body shape — visual only.
      if (icon) {
        const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shape.setAttribute('d', icon);
        shape.setAttribute('fill', color);
        shape.setAttribute('stroke', '#f2e8d5');
        shape.setAttribute('stroke-width', '0.8');
        shape.setAttribute('class', 'pin-body');
        shape.setAttribute('pointer-events', 'none');
        scaleG.appendChild(shape);
      } else {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', '5');
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', '#f2e8d5');
        circle.setAttribute('stroke-width', '1');
        circle.setAttribute('class', 'pin-body');
        circle.setAttribute('pointer-events', 'none');
        scaleG.appendChild(circle);
      }

      // Generous, static hit target on the OUTER group (not the scaling
      // inner group), so hover state never depends on whatever scale the
      // pin is currently animating to. Constant 14px radius gives a
      // forgiving target without overlapping neighbors.
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      hit.setAttribute('r', '14');
      hit.setAttribute('fill', 'transparent');
      hit.setAttribute('class', 'pin-hit');
      g.appendChild(hit);

      // Title for SVG accessibility
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = anno.label_cn + ' · ' + anno.label_en;
      g.appendChild(title);

      // Append to the correct layer group(s)
      anno.layers.forEach(layerId => {
        const layerGroup = document.getElementById('map-pins-' + layerId);
        if (layerGroup) layerGroup.appendChild(layerId === anno.layers[0] ? g : g.cloneNode(true));
      });
    });
  }

  /* ── Layer toggle wiring ────────────────────────────────── */
  function wireLayerToggles() {
    document.querySelectorAll('.map-layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        if (activeLayers.has(layer)) {
          activeLayers.delete(layer);
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          activeLayers.add(layer);
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        }
        applyLayers();
      });
    });
  }

  function applyLayers() {
    // Toggle SVG layer groups
    svgEl.querySelectorAll('.map-layer').forEach(g => {
      const layer = g.dataset.layer;
      g.style.display = activeLayers.has(layer) ? '' : 'none';
    });
    // Also toggle JS-rendered pin groups
    ['sites','dynasties','rivers','dialects','modern','greatwall','silkroads'].forEach(layer => {
      const g = document.getElementById('map-pins-' + layer);
      if (g) g.style.display = activeLayers.has(layer) ? '' : 'none';
    });
    // Clear any active tooltip — its anchor pin may have just been hidden.
    if (tooltip) {
      tooltip.classList.remove('is-visible');
      svgEl.querySelectorAll('.map-pin.is-active').forEach(p => p.classList.remove('is-active'));
    }
  }

  /* ── Dynasty selector ───────────────────────────────────── */
  function wireDynastySelector() {
    document.querySelectorAll('.dynasty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.dynasty;
        if (activeDynasty === d) {
          // toggle off
          activeDynasty = null;
          btn.classList.remove('active');
        } else {
          activeDynasty = d;
          document.querySelectorAll('.dynasty-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        applyDynastyHighlight();
      });
    });
  }

  function applyDynastyHighlight() {
    svgEl.querySelectorAll('.dynasty-extent').forEach(el => {
      const d = el.dataset.dynasty;
      el.style.opacity = (activeDynasty === d) ? '1' : '0';
      el.style.transition = 'opacity 0.35s ease';
    });
  }

  /* ── Interaction: hover/click/tap on pins ──────────────── */
  function wireMapInteractions() {
    let activePinId = null;
    let activePinEl = null;
    let hideTimer  = null;
    const isTouch  = window.matchMedia('(hover: none)').matches;

    function clearActiveClass() {
      svgEl.querySelectorAll('.map-pin.is-active').forEach(p => p.classList.remove('is-active'));
    }

    function activate(pinEl, anno, opts) {
      // If activating the same pin, no-op.
      if (activePinId === anno.id && activePinEl && activePinEl.isConnected) return;
      // Cancel any pending hide
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      clearActiveClass();
      pinEl.classList.add('is-active');
      activePinId = anno.id;
      activePinEl = pinEl;
      showTooltip(anno, pinEl, opts);
    }

    function scheduleHide(delay) {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        clearActiveClass();
        activePinId = null;
        activePinEl = null;
        hideTooltip();
        hideTimer = null;
      }, delay);
    }

    // Use `pointerenter` / `pointerleave` on the SVG via event delegation
    // through the descendant phase. These don't bubble like over/out, but we
    // can detect transitions by comparing `target` ancestor on `pointermove`.
    // Simplest reliable approach: listen on the SVG, look at e.target, and
    // recompute activePin only when it actually changes.
    svgEl.addEventListener('pointermove', e => {
      if (isTouch) return; // touch handled separately by tap
      const pin = e.target.closest && e.target.closest('.map-pin');
      if (pin) {
        const id = pin.dataset.annotationId;
        if (id === activePinId) return;
        const anno = annotations.find(a => a.id === id);
        if (!anno) return;
        activate(pin, anno);
      } else if (activePinId) {
        // Cursor moved off all pins — schedule a small-delay hide so brief
        // gaps between adjacent pins don't visibly fade out and back in.
        scheduleHide(120);
      }
    });

    svgEl.addEventListener('pointerleave', () => {
      if (isTouch) return;
      if (activePinId) scheduleHide(120);
    });

    // Click / tap: first interaction on touch shows tooltip, second on the
    // same pin navigates. On hover devices, click navigates immediately.
    svgEl.addEventListener('click', e => {
      const pin = e.target.closest('.map-pin');
      if (!pin) return;
      const id = pin.dataset.annotationId;
      const anno = annotations.find(a => a.id === id);
      if (!anno) return;
      const entry = pin.dataset.entry;

      if (isTouch) {
        if (activePinId !== id) {
          activate(pin, anno, { snap: true });
          return; // require second tap to navigate
        }
      }
      if (entry) window.location.href = BASE + 'pages/' + entry + '.html';
    });

    // Tap outside any pin (touch only): dismiss tooltip
    if (isTouch) {
      document.addEventListener('click', e => {
        if (!activePinId) return;
        if (e.target.closest('.map-pin') || e.target.closest('.map-tooltip')) return;
        clearActiveClass();
        activePinId = null;
        activePinEl = null;
        hideTooltip();
      });
    }

    // Keyboard: Enter activates pin or navigates if already active
    svgEl.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const pin = e.target.closest && e.target.closest('.map-pin');
      if (!pin) return;
      e.preventDefault();
      const id = pin.dataset.annotationId;
      const anno = annotations.find(a => a.id === id);
      if (!anno) return;
      if (activePinId !== id) {
        activate(pin, anno, { snap: true });
        return;
      }
      const entry = pin.dataset.entry;
      if (entry && e.key === 'Enter') {
        window.location.href = BASE + 'pages/' + entry + '.html';
      }
    });

    svgEl.addEventListener('focusin', e => {
      const pin = e.target.closest && e.target.closest('.map-pin');
      if (!pin) return;
      const id = pin.dataset.annotationId;
      const anno = annotations.find(a => a.id === id);
      if (anno) activate(pin, anno, { snap: true });
    });

    svgEl.addEventListener('focusout', () => {
      // Brief delay so tab between pins doesn't flicker
      if (activePinId) scheduleHide(80);
    });
  }

  /* ── Resize: re-cache SVG rect ──────────────────────────── */
  function wireResizeObserver() {
    if (!window.ResizeObserver) return;
    new ResizeObserver(() => { svgRect = null; }).observe(document.getElementById('map-container'));
  }

  /* ── Mobile: layer dropdown ─────────────────────────────── */
  function initMobileToggle() {
    const toggle = document.getElementById('map-layers-toggle');
    const panel = document.getElementById('map-layers-panel');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ── Run ────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); initMobileToggle(); });
  } else {
    init();
    initMobileToggle();
  }
})();
