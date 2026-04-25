/**
 * family-art.mjs — Inline SVG illustrations for family-index pages.
 *
 * Two surfaces per family:
 *   familyHeroArt(family)  — full-bleed illustration for the page hero
 *   familyCardArt(family)  — compact glyph-and-flourish for cards
 *
 * Design language:
 *   - Single signature glyph per family in LXGW WenKai TC (matches the
 *     site's display-Chinese stack), oversized, in the family's signature
 *     color at low opacity so it reads as a watermark behind smaller
 *     supporting glyphs / motifs.
 *   - Supporting elements are small geometric figures in ink/ochre that
 *     suggest the family's domain without literal illustration:
 *       language    — three glyphs stacked (字 词 法), seal-stamp motif
 *       topics      — compass + horizon line (place/time + thought)
 *       collections — chengyu's four-character grid + a path line
 *       explore     — three small family glyphs orbiting a central 探
 *   - All colors via CSS custom properties, so the art themes naturally
 *     with any future palette tweak.
 *
 * Output is plain SVG (no external assets) ready to be inlined into
 * the page HTML. SSR-friendly, no JS required.
 */

const PALETTES = {
  language:    { primary: 'var(--cat-grammar)',    accent: 'var(--cat-vocab)',     glyph: '语' },
  topics:      { primary: 'var(--cat-philosophy)', accent: 'var(--cat-history)',   glyph: '话' },
  collections: { primary: 'var(--cat-chengyu)',    accent: 'var(--cat-hubs)',      glyph: '集' },
  explore:     { primary: 'var(--ochre)',          accent: 'var(--red)',           glyph: '探' },
};

// ── full hero art (wide aspect, sits behind the family-hero meta block) ────

export function renderFamilyHeroArt(family) {
  const p = PALETTES[family];
  if (!p) return '';
  switch (family) {
    case 'language':    return languageHeroSvg(p);
    case 'topics':      return topicsHeroSvg(p);
    case 'collections': return collectionsHeroSvg(p);
    case 'explore':     return exploreHeroSvg(p);
    default: return '';
  }
}

// Common: a watermark glyph layer that fills the right side of the hero.
function watermarkGlyph(p, glyph) {
  return `<text x="78%" y="68%" text-anchor="middle" dominant-baseline="middle"
       font-family="LXGW WenKai TC, Noto Serif SC, serif"
       font-size="320" font-weight="700"
       fill="${p.primary}" opacity="0.07"
       style="letter-spacing: -0.02em">${glyph}</text>`;
}

function languageHeroSvg(p) {
  // Three stacked language glyphs (字 / 词 / 法) on a vertical baseline
  // with a faint seal-stamp square behind, plus the watermark 语.
  return `<svg class="family-hero-svg" viewBox="0 0 800 280" preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Language family illustration">
    <defs>
      <pattern id="grid-lang" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="${p.primary}" stroke-width="0.4" opacity="0.18"/>
      </pattern>
    </defs>
    <rect width="800" height="280" fill="url(#grid-lang)"/>
    ${watermarkGlyph(p, p.glyph)}
    <g transform="translate(120, 60)">
      <rect x="-30" y="-30" width="120" height="180" fill="none" stroke="${p.accent}" stroke-width="2.5" opacity="0.55" rx="4"/>
      <text x="30" y="20" text-anchor="middle" font-family="LXGW WenKai TC, Noto Serif SC, serif" font-size="56" font-weight="700" fill="${p.primary}">字</text>
      <text x="30" y="80" text-anchor="middle" font-family="LXGW WenKai TC, Noto Serif SC, serif" font-size="56" font-weight="700" fill="${p.primary}" opacity="0.78">词</text>
      <text x="30" y="140" text-anchor="middle" font-family="LXGW WenKai TC, Noto Serif SC, serif" font-size="56" font-weight="700" fill="${p.primary}" opacity="0.55">法</text>
    </g>
    <line x1="60" y1="245" x2="220" y2="245" stroke="${p.accent}" stroke-width="1" opacity="0.45"/>
    <text x="60" y="262" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="0.18em" fill="${p.primary}" opacity="0.62" text-transform="uppercase">zì · cí · fǎ</text>
  </svg>`;
}

function topicsHeroSvg(p) {
  // Compass rose + horizon line — thought meets place/time.
  return `<svg class="family-hero-svg" viewBox="0 0 800 280" preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Topics family illustration">
    ${watermarkGlyph(p, p.glyph)}
    <g transform="translate(170, 140)">
      <circle r="78" fill="none" stroke="${p.primary}" stroke-width="1.4" opacity="0.55"/>
      <circle r="58" fill="none" stroke="${p.primary}" stroke-width="0.8" opacity="0.32"/>
      <circle r="38" fill="none" stroke="${p.accent}" stroke-width="0.8" opacity="0.45"/>
      <circle r="3" fill="${p.accent}" opacity="0.85"/>
      <!-- 4 compass points -->
      <line x1="0" y1="-78" x2="0" y2="-58" stroke="${p.primary}" stroke-width="1.6"/>
      <line x1="0" y1="58"  x2="0" y2="78"  stroke="${p.primary}" stroke-width="1.6"/>
      <line x1="-78" y1="0" x2="-58" y2="0" stroke="${p.primary}" stroke-width="1.6"/>
      <line x1="58" y1="0"  x2="78" y2="0"  stroke="${p.primary}" stroke-width="1.6"/>
      <!-- 4 diagonal points (smaller) -->
      <line x1="-55" y1="-55" x2="-41" y2="-41" stroke="${p.accent}" stroke-width="1" opacity="0.6"/>
      <line x1="55" y1="-55"  x2="41" y2="-41"  stroke="${p.accent}" stroke-width="1" opacity="0.6"/>
      <line x1="-55" y1="55"  x2="-41" y2="41"  stroke="${p.accent}" stroke-width="1" opacity="0.6"/>
      <line x1="55" y1="55"   x2="41" y2="41"   stroke="${p.accent}" stroke-width="1" opacity="0.6"/>
      <!-- compass needle -->
      <polygon points="0,-72 6,0 0,72 -6,0" fill="${p.accent}" opacity="0.78"/>
      <text x="0" y="-90" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="0.22em" fill="${p.primary}" opacity="0.55">N</text>
    </g>
    <!-- horizon line -->
    <line x1="280" y1="180" x2="540" y2="180" stroke="${p.primary}" stroke-width="0.9" opacity="0.45"/>
    <line x1="320" y1="200" x2="500" y2="200" stroke="${p.primary}" stroke-width="0.6" opacity="0.28"/>
    <!-- two tiny mountains -->
    <path d="M 360 180 L 380 158 L 398 180 Z" fill="none" stroke="${p.accent}" stroke-width="1.2" opacity="0.6"/>
    <path d="M 420 180 L 450 144 L 478 180 Z" fill="none" stroke="${p.accent}" stroke-width="1.2" opacity="0.6"/>
  </svg>`;
}

function collectionsHeroSvg(p) {
  // 4-character chengyu grid + a meandering path line.
  return `<svg class="family-hero-svg" viewBox="0 0 800 280" preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Collections family illustration">
    ${watermarkGlyph(p, p.glyph)}
    <g transform="translate(110, 65)">
      <!-- 2x2 chengyu grid -->
      <rect x="0" y="0" width="70" height="70" fill="none" stroke="${p.primary}" stroke-width="1.6" opacity="0.7" rx="3"/>
      <rect x="78" y="0" width="70" height="70" fill="none" stroke="${p.primary}" stroke-width="1.6" opacity="0.7" rx="3"/>
      <rect x="0" y="78" width="70" height="70" fill="none" stroke="${p.primary}" stroke-width="1.6" opacity="0.7" rx="3"/>
      <rect x="78" y="78" width="70" height="70" fill="none" stroke="${p.primary}" stroke-width="1.6" opacity="0.7" rx="3"/>
      <text x="35" y="46" text-anchor="middle" font-family="LXGW WenKai TC, serif" font-size="40" font-weight="700" fill="${p.primary}">画</text>
      <text x="113" y="46" text-anchor="middle" font-family="LXGW WenKai TC, serif" font-size="40" font-weight="700" fill="${p.primary}" opacity="0.85">蛇</text>
      <text x="35" y="124" text-anchor="middle" font-family="LXGW WenKai TC, serif" font-size="40" font-weight="700" fill="${p.primary}" opacity="0.85">添</text>
      <text x="113" y="124" text-anchor="middle" font-family="LXGW WenKai TC, serif" font-size="40" font-weight="700" fill="${p.primary}" opacity="0.7">足</text>
    </g>
    <!-- path line — winding "reading path" -->
    <path d="M 290 180 Q 360 110 430 180 T 580 200 T 730 150"
          fill="none" stroke="${p.accent}" stroke-width="1.6" opacity="0.55" stroke-dasharray="4 4"/>
    <!-- waypoints on the path -->
    <circle cx="290" cy="180" r="4" fill="${p.accent}" opacity="0.78"/>
    <circle cx="430" cy="180" r="4" fill="${p.accent}" opacity="0.78"/>
    <circle cx="580" cy="200" r="4" fill="${p.accent}" opacity="0.78"/>
    <circle cx="730" cy="150" r="4" fill="${p.accent}" opacity="0.78"/>
  </svg>`;
}

function exploreHeroSvg(p) {
  // Calmer than the orbiting-glyphs draft: a single centered medallion
  // with the watermark behind. The three families are introduced visually
  // by the cards immediately below the hero, so the hero doesn't need to
  // re-state them.
  return `<svg class="family-hero-svg" viewBox="0 0 800 280" preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Explore master illustration">
    ${watermarkGlyph(p, p.glyph)}
    <g transform="translate(200, 140)">
      <circle r="60" fill="var(--papyrus)" opacity="0.6"/>
      <circle r="60" fill="none" stroke="${p.accent}" stroke-width="1.5" opacity="0.6"/>
      <circle r="72" fill="none" stroke="${p.primary}" stroke-width="0.6" opacity="0.35"/>
      <text x="0" y="0" text-anchor="middle" dominant-baseline="central"
            font-family="LXGW WenKai TC, Noto Serif SC, serif"
            font-size="68" font-weight="700" fill="${p.accent}">探</text>
    </g>
  </svg>`;
}

// ── compact card art (used on family-cards, homepage hub, crosslinks) ──────

/**
 * Render a centered CJK glyph at the geometric center of a 200×200 viewBox.
 * `dominant-baseline="central"` + y at the visual midpoint compensates for
 * the way LXGW WenKai's typographic baseline sits below the visual center;
 * combined with `text-anchor="middle"` and x at the midpoint, the glyph
 * lands true center regardless of font metrics.
 */
function centeredGlyph(glyph, fontSize, fill) {
  // Combination of dominant-baseline="central" + y at the geometric viewBox
  // center is the most reliable way to center a CJK glyph across the LXGW
  // WenKai TC + Noto Serif SC fallback stack. Avoid offset nudges — they
  // tend to push glyphs visibly low.
  return `<text x="100" y="100" text-anchor="middle" dominant-baseline="central"
       font-family="LXGW WenKai TC, Noto Serif SC, serif"
       font-size="${fontSize}" font-weight="700" fill="${fill}">${glyph}</text>`;
}

export function familyCardArt(family) {
  const p = PALETTES[family];
  if (!p) return '';
  // A single oversized glyph + a small flourish, kept simple so the card
  // reads quickly. Sized via the parent .family-card-art container.
  switch (family) {
    case 'language':
      return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="36" y="36" width="128" height="128" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.5" rx="4"/>
        ${centeredGlyph(p.glyph, 110, p.primary)}
      </svg>`;
    case 'topics':
      return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="100" cy="100" r="78" fill="none" stroke="${p.primary}" stroke-width="1.4" opacity="0.45"/>
        <circle cx="100" cy="100" r="58" fill="none" stroke="${p.accent}" stroke-width="0.8" opacity="0.4"/>
        ${centeredGlyph(p.glyph, 100, p.primary)}
      </svg>`;
    case 'collections':
      return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="40" y="40" width="55" height="55" fill="none" stroke="${p.accent}" stroke-width="1.4" opacity="0.55" rx="3"/>
        <rect x="105" y="40" width="55" height="55" fill="none" stroke="${p.accent}" stroke-width="1.4" opacity="0.55" rx="3"/>
        <rect x="40" y="105" width="55" height="55" fill="none" stroke="${p.accent}" stroke-width="1.4" opacity="0.55" rx="3"/>
        <rect x="105" y="105" width="55" height="55" fill="none" stroke="${p.accent}" stroke-width="1.4" opacity="0.55" rx="3"/>
        ${centeredGlyph(p.glyph, 92, p.primary)}
      </svg>`;
    case 'explore':
      return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="100" cy="100" rx="78" ry="42" fill="none" stroke="${p.primary}" stroke-width="0.9" opacity="0.35" transform="rotate(-12 100 100)"/>
        <ellipse cx="100" cy="100" rx="78" ry="42" fill="none" stroke="${p.accent}" stroke-width="0.7" opacity="0.3" transform="rotate(35 100 100)"/>
        ${centeredGlyph(p.glyph, 100, p.accent)}
      </svg>`;
    default:
      return '';
  }
}
