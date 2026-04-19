/**
 * Per-entry SVG OG card + category favicon.
 * Both are SVG so they're tiny and need no image library.
 */

const CATEGORY_GLYPH = {
  characters: { glyph: '書', color: '#8b1a1a' },
  vocab:      { glyph: '词', color: '#a06428' },
  grammar:    { glyph: '法', color: '#1a5050' },
  chengyu:    { glyph: '语', color: '#6b1a2a' },
  religion:   { glyph: '宗', color: '#5c3d7a' },
  philosophy: { glyph: '哲', color: '#3a5c3a' },
  history:    { glyph: '史', color: '#6b4420' },
  geography:  { glyph: '地', color: '#2a5c6b' },
  culture:    { glyph: '文', color: '#8b3a1a' },
  culinary:   { glyph: '食', color: '#7a4a10' },
  arts:       { glyph: '艺', color: '#4a2878' },
  science:    { glyph: '科', color: '#1a4a5c' },
  daily:      { glyph: '日', color: '#5c4a1a' }
};

function escXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 1200×630 SVG OG image. Papyrus background, hero glyph centred, pinyin + title underneath.
 */
export function renderOgSvg(entry) {
  const cat = CATEGORY_GLYPH[entry.category] || { glyph: '字', color: '#8b1a1a' };
  const glyph = entry.char || (entry.title ? entry.title.split('·')[0].trim() : cat.glyph);
  const pinyin = entry.pinyin || '';
  const titleEn = entry.title
    ? (entry.title.split('·').slice(1).join('·').trim() || entry.title)
    : '';
  const isLong = glyph.length > 1;
  const glyphSize = isLong ? Math.max(140, 320 - glyph.length * 30) : 360;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <filter id="paper">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="5" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <radialGradient id="vignette" cx="50%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${cat.color}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#f2e8d5" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#f2e8d5"/>
  <rect width="1200" height="630" fill="url(#vignette)"/>
  <rect width="1200" height="630" filter="url(#paper)" opacity="0.06"/>
  <line x1="60" y1="60" x2="1140" y2="60" stroke="${cat.color}" stroke-width="3"/>
  <line x1="60" y1="570" x2="1140" y2="570" stroke="${cat.color}" stroke-width="3"/>
  <text x="80" y="100" font-family="Inconsolata, monospace" font-size="22" letter-spacing="6" fill="#6b5535" text-transform="uppercase">SHŪWŪ · 書屋</text>
  <text x="1120" y="100" font-family="Inconsolata, monospace" font-size="22" letter-spacing="3" fill="#6b5535" text-anchor="end">${escXml(entry.category)}</text>
  <text x="600" y="${isLong ? 350 : 380}" font-family="Noto Serif SC, serif" font-size="${glyphSize}" font-weight="700" fill="${cat.color}" text-anchor="middle" dominant-baseline="middle">${escXml(glyph)}</text>
  ${pinyin ? `<text x="600" y="${isLong ? 470 : 490}" font-family="Inconsolata, monospace" font-size="44" letter-spacing="4" fill="#a06428" text-anchor="middle">${escXml(pinyin)}</text>` : ''}
  ${titleEn ? `<text x="600" y="${isLong ? 530 : 550}" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-size="32" fill="#2e2010" text-anchor="middle">${escXml(titleEn)}</text>` : ''}
</svg>`;
}

/**
 * Inline SVG data-URI favicon: a single category glyph in category colour on transparent.
 */
export function categoryFaviconDataUri(category) {
  const cat = CATEGORY_GLYPH[category] || CATEGORY_GLYPH.characters;
  // Compact inline SVG; no XML decl, escape minimally
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>` +
    `<text y='.9em' font-size='90' fill='${cat.color}'>${cat.glyph}</text>` +
    `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export { CATEGORY_GLYPH };
