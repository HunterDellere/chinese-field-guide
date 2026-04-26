/**
 * gen-map-svg.mjs — Generate accurate SVG path data for china.html
 *
 * Uses Natural Earth 50m country TopoJSON + 10m province GeoJSON.
 * Outputs a JS object with path strings ready to paste into china.html.
 *
 * Usage:
 *   node build/scripts/gen-map-svg.mjs
 *
 * Writes results to data/_reference/map-paths.json for inspection,
 * then patches pages/maps/china.html in place.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { geoPath, geoMercator } from 'd3-geo';
import { feature } from 'topojson-client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── Config ────────────────────────────────────────────────────────────────────
// SVG canvas matching china.html viewBox="0 0 800 700"
const W = 800;
const H = 700;

// Mercator center & scale tuned to frame China well in 800×700
// China spans roughly lon 73–135, lat 18–53
const PROJECTION_CONFIG = {
  center:    [103, 36],   // central meridian and parallel
  scale:     820,
  translate: [W * 0.46, H * 0.50],
};

// ISO numeric codes: China = 156, Taiwan = 158
const CHINA_ISO = 156;
const TAIWAN_ISO = 158;

// Province admin0 name in Natural Earth
const CHINA_NAME = 'China';

// ── Load data ─────────────────────────────────────────────────────────────────
const countriesPath = '/tmp/countries-50m.json';
const provincesPath = '/tmp/ne_provinces.geojson';
const riversPath    = '/tmp/ne_rivers.geojson';

if (!existsSync(countriesPath)) {
  console.error('Missing /tmp/countries-50m.json — run the download step first.');
  process.exit(1);
}
if (!existsSync(provincesPath)) {
  console.error('Missing /tmp/ne_provinces.geojson — run the download step first.');
  process.exit(1);
}
if (!existsSync(riversPath)) {
  console.error('Missing /tmp/ne_rivers.geojson — run the download step first.');
  process.exit(1);
}

const topo = JSON.parse(readFileSync(countriesPath, 'utf8'));
const provincesGeo = JSON.parse(readFileSync(provincesPath, 'utf8'));
const riversGeo    = JSON.parse(readFileSync(riversPath, 'utf8'));

// ── Projection ────────────────────────────────────────────────────────────────
const projection = geoMercator()
  .center(PROJECTION_CONFIG.center)
  .scale(PROJECTION_CONFIG.scale)
  .translate(PROJECTION_CONFIG.translate);

const path = geoPath(projection);

// ── Extract country features ──────────────────────────────────────────────────
const countries = feature(topo, topo.objects.countries);

const chinaFeature   = countries.features.find(f => +f.id === CHINA_ISO);
const taiwanFeature  = countries.features.find(f => +f.id === TAIWAN_ISO);

if (!chinaFeature) { console.error('China feature not found in TopoJSON'); process.exit(1); }
if (!taiwanFeature) { console.warn('Taiwan feature not found — will skip'); }

const chinaPath  = path(chinaFeature);
const taiwanPath = taiwanFeature ? path(taiwanFeature) : null;

// ── Extract province features for China ──────────────────────────────────────
const chinaProvinces = provincesGeo.features.filter(
  f => f.properties.admin === CHINA_NAME || f.properties.adm0_a3 === 'CHN'
);

// Short simplified Chinese names for provinces (override messy NE data)
const PROV_NAMES = {
  'Xinjiang':                      '新疆',
  'Tibet':                         '西藏',
  'Xizang':                        '西藏',
  'Inner Mongol':                  '内蒙古',
  'Inner Mongolia':                '内蒙古',
  'Gansu':                         '甘肃',
  'Yunnan':                        '云南',
  'Heilongjiang':                  '黑龙江',
  'Jilin':                         '吉林',
  'Liaoning':                      '辽宁',
  'Guangxi':                       '广西',
  'Guangdong':                     '广东',
  'Hainan':                        '海南',
  'Fujian':                        '福建',
  'Zhejiang':                      '浙江',
  'Shanghai':                      '上海',
  'Jiangsu':                       '江苏',
  'Shandong':                      '山东',
  'Hebei':                         '河北',
  'Tianjin':                       '天津',
  'Beijing':                       '北京',
  'Sichuan':                       '四川',
  'Chongqing':                     '重庆',
  'Guizhou':                       '贵州',
  'Hunan':                         '湖南',
  'Ningxia':                       '宁夏',
  'Shaanxi':                       '陕西',
  'Qinghai':                       '青海',
  'Shanxi':                        '山西',
  'Jiangxi':                       '江西',
  'Henan':                         '河南',
  'Hubei':                         '湖北',
  'Anhui':                         '安徽',
  'Ningxia Hui':                   '宁夏',
};

// Provinces to skip (island groups, SCS features that clutter the map)
const SKIP_PROVINCES = new Set(['Paracel Islands', 'Spratly Islands', 'West Island Group', 'Xisha', '西沙群岛']);

// Build per-province paths + collect province centroids for labels
const provinceData = chinaProvinces.map(f => {
  const nameEn = f.properties.name || f.properties.name_en || '';
  if (SKIP_PROVINCES.has(nameEn)) return null;

  const d = path(f);
  if (!d || d.length < 10) return null;

  const centroid = path.centroid(f);
  const cx = Math.round(centroid[0]);
  const cy = Math.round(centroid[1]);

  // Resolve short CN name: try lookup table first, then strip pipe variants from NE data
  let nameCn = PROV_NAMES[nameEn] || '';
  if (!nameCn) {
    const raw = f.properties.name_local || f.properties.name_zh || '';
    // NE stores "trad|simp" or just one form — take the simpler (shorter) side
    nameCn = raw.includes('|') ? raw.split('|').sort((a, b) => a.length - b.length)[0] : raw;
    // Strip trailing 省/自治区/市 for display brevity where lookup didn't cover it
    nameCn = nameCn.replace(/省$|市$/, '');
  }

  return { nameEn, nameCn, d, cx, cy };
}).filter(Boolean);

// Merge all province outlines into a single <path> for internal borders
// (we'll use them as separate paths for stroke-only rendering)
const provincePaths = provinceData.map(p => p.d).join(' ');

// ── Rivers ────────────────────────────────────────────────────────────────────
// Natural Earth 10m rivers come as many disconnected segments; we group them
// by `rivernum` (their FID for a continuous river system) so each major river
// renders as one continuous styled path, plus we relabel only the principal
// rivers in the Chinese cultural geography. Anything inside the China bbox
// from a curated set of `rivernum` values gets included.
//
// Curated principal rivers, with display name, color tier, and label position
// hint (lon/lat for label placement; resolved via `projection`).
const RIVERS = [
  // Tier 1 — name + label, prominent stroke
  { ids: [1, 18],   nameCn: '长江', nameEn: 'Yangtze',         color: '#2a7090', width: 2.6, opacity: 0.92, tier: 1, labelLon: 110, labelLat: 30.4 },
  { ids: [66, 95],  nameCn: '黄河', nameEn: 'Yellow River',    color: '#c8a830', width: 2.4, opacity: 0.95, tier: 1, labelLon: 109, labelLat: 38.4 },
  { ids: [40, 46],  nameCn: '澜沧江', nameEn: 'Mekong',         color: '#3a8c70', width: 1.8, opacity: 0.85, tier: 1, labelLon: 99,  labelLat: 27 },
  { ids: [42, 47, 51], nameCn: '雅鲁藏布江', nameEn: 'Yarlung Tsangpo', color: '#5a78a8', width: 1.8, opacity: 0.85, tier: 1, labelLon: 88, labelLat: 29.5 },
  { ids: [134, 146, 153], nameCn: '怒江', nameEn: 'Salween',    color: '#3a8c70', width: 1.6, opacity: 0.80, tier: 1, labelLon: 98.5, labelLat: 30 },
  { ids: [72, 84, 93], nameCn: '黑龙江', nameEn: 'Amur',        color: '#5a78a8', width: 2.0, opacity: 0.85, tier: 1, labelLon: 128, labelLat: 50 },
  // Tier 2 — name + label, lighter stroke
  { ids: [96],      nameCn: '西江',   nameEn: 'Pearl River',    color: '#4a8050', width: 1.8, opacity: 0.80, tier: 2, labelLon: 112, labelLat: 23.3 },
  { ids: [349],     nameCn: '塔里木河', nameEn: 'Tarim',         color: '#a08858', width: 1.4, opacity: 0.72, tier: 2, labelLon: 84.5, labelLat: 41 },
  { ids: [246, 360], nameCn: '辽河',   nameEn: 'Liao',          color: '#5a78a8', width: 1.4, opacity: 0.72, tier: 2, labelLon: 122, labelLat: 43 },
  { ids: [366, 646, 967], nameCn: '松花江', nameEn: 'Songhua',  color: '#5a78a8', width: 1.4, opacity: 0.72, tier: 2, labelLon: 127, labelLat: 46.5 },
  // Tier 3 — stroke only, no label (tributaries / smaller)
  { ids: [873],     nameCn: '渭河',   nameEn: 'Wei',            color: '#c8a830', width: 1.0, opacity: 0.55, tier: 3 },
  { ids: [457],     nameCn: '湘江',   nameEn: 'Xiang',          color: '#4a8050', width: 1.0, opacity: 0.55, tier: 3 },
  { ids: [367],     nameCn: '岷江',   nameEn: 'Min',            color: '#2a7090', width: 1.0, opacity: 0.55, tier: 3 },
  { ids: [270],     nameCn: '汉江',   nameEn: 'Han',            color: '#2a7090', width: 1.0, opacity: 0.55, tier: 3 },
  { ids: [680],     nameCn: '鸭绿江', nameEn: 'Yalu',           color: '#5a78a8', width: 1.0, opacity: 0.55, tier: 3 },
];

// Index river features by rivernum so each curated entry can pull every
// segment that shares an id and concatenate them into a single path.
const riverFeaturesByNum = new Map();
for (const f of riversGeo.features) {
  const num = f.properties.rivernum;
  if (num == null) continue;
  if (!riverFeaturesByNum.has(num)) riverFeaturesByNum.set(num, []);
  riverFeaturesByNum.get(num).push(f);
}

function projectFeatureToPath(feature) {
  // Use d3-geo's path() — Mercator-projects the feature's coords into the
  // same space as country/province paths, so rivers register exactly.
  return path(feature) || '';
}

const riverData = RIVERS.map(r => {
  const segs = [];
  for (const id of r.ids) {
    const fs = riverFeaturesByNum.get(id);
    if (!fs) continue;
    for (const f of fs) {
      const d = projectFeatureToPath(f);
      if (d) segs.push(d);
    }
  }
  if (!segs.length) return null;
  // Project label point if provided
  let labelXY = null;
  if (r.labelLon != null && r.labelLat != null) {
    const p = projection([r.labelLon, r.labelLat]);
    if (p) labelXY = { x: Math.round(p[0]), y: Math.round(p[1]) };
  }
  return { ...r, d: segs.join(' '), labelXY };
}).filter(Boolean);

// ── Grand Canal ──────────────────────────────────────────────────────────────
// Natural Earth doesn't include the Grand Canal as a feature; we hand-trace
// the historical route from documented endpoints (Hangzhou → Suzhou → Yangzhou
// → Huai'an → Xuzhou → Linqing → Tianjin → Beijing) using their lon/lat.
// It's a polyline, not a polygon, so this is the canonical path.
const GRAND_CANAL_LONLAT = [
  [120.16, 30.27], // Hangzhou
  [120.21, 30.62], // outflow north
  [120.62, 31.30], // Suzhou
  [120.30, 31.86], // Wuxi
  [119.94, 32.20], // Zhenjiang (Yangzi crossing)
  [119.42, 32.39], // Yangzhou
  [119.16, 33.00], // Huai'an
  [117.60, 34.27], // Xuzhou
  [116.34, 35.40], // Jining
  [115.69, 36.51], // Linqing (Wei-Yu canal junction)
  [115.99, 37.43], // Dezhou
  [116.51, 38.32], // Cangzhou
  [117.20, 39.13], // Tianjin
  [116.69, 39.55], // Tongzhou (Beijing terminus)
  [116.41, 39.91], // Beijing
];
const grandCanalPath = (() => {
  const pts = GRAND_CANAL_LONLAT.map(([lon, lat]) => projection([lon, lat])).filter(Boolean);
  if (!pts.length) return '';
  return 'M' + pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L');
})();

// ── Build province label list (only provinces whose centroid is on-screen) ───
const provinceLabels = provinceData
  .filter(p => p.cx > 20 && p.cx < W - 20 && p.cy > 20 && p.cy < H - 40 && p.nameCn)
  .map(p => `            <text x="${p.cx}" y="${p.cy}">${p.nameCn}</text>`)
  .join('\n');

// ── Write reference JSON ──────────────────────────────────────────────────────
const out = {
  generated: new Date().toISOString(),
  source: 'Natural Earth 50m countries + 10m admin1 provinces + 10m rivers',
  chinaPath,
  taiwanPath,
  provincePaths,
  provinceLabels,
  rivers: riverData.map(r => ({
    nameCn: r.nameCn, nameEn: r.nameEn, tier: r.tier,
    color: r.color, width: r.width, opacity: r.opacity,
    d: r.d, label: r.labelXY,
  })),
  grandCanalPath,
  projection: PROJECTION_CONFIG,
};
const refPath = join(ROOT, 'data/_reference/map-paths.json');
writeFileSync(refPath, JSON.stringify(out, null, 2));
console.log(`Wrote map-paths.json (${Math.round(chinaPath.length / 1024)}KB china path, ${provinceData.length} provinces)`);

// ── Patch china.html ──────────────────────────────────────────────────────────
const htmlPath = join(ROOT, 'pages/maps/china.html');
let html = readFileSync(htmlPath, 'utf8');

// Find the first index of any of the given prefix strings (handles first-run and re-run sentinels)
function findFirst(h, ...prefixes) {
  for (const p of prefixes) {
    const i = h.indexOf(p);
    if (i !== -1) return i;
  }
  return -1;
}

// ── Replace mainland fill ─────────────────────────────────────────────────────
{
  const s = findFirst(html, '<!-- Mainland China fill');
  const e = findFirst(html, '<!-- Internal province dividers');
  if (s === -1 || e === -1) { console.error('Sentinel "Mainland China fill" or "Internal province dividers" not found'); process.exit(1); }
  const block = `<!-- Mainland China fill — generated by build/scripts/gen-map-svg.mjs from Natural Earth 50m data -->
          <path d="${chinaPath}" fill="#e8dcc8" stroke="#b8a888" stroke-width="1.2"/>`;
  html = html.slice(0, s) + block + '\n\n          ' + html.slice(e);
}

// ── Replace province divider paths ───────────────────────────────────────────
{
  const s = findFirst(html, '<!-- Internal province dividers');
  const e = findFirst(html, '<!-- Province name labels');
  if (s !== -1 && e !== -1) {
    const provinceStrokePaths = provinceData.map(p => `            <path d="${p.d}"/>`).join('\n');
    const block = `<!-- Internal province dividers — generated from Natural Earth 10m admin1 -->
          <g fill="none" stroke="#b8a888" stroke-width="0.5" stroke-dasharray="3,2" opacity="0.65">
${provinceStrokePaths}
          </g>`;
    html = html.slice(0, s) + block + '\n\n          ' + html.slice(e);
  }
}

// ── Replace province labels ───────────────────────────────────────────────────
{
  const s = findFirst(html, '<!-- Province name labels');
  const e = findFirst(html, '<!-- Taiwan');
  if (s !== -1 && e !== -1) {
    const block = `<!-- Province name labels — centroids from Natural Earth 10m admin1 -->
          <g font-family="Noto Serif SC, serif" font-size="9" fill="#5a4428" opacity="0.6" text-anchor="middle">
${provinceLabels}
          </g>`;
    html = html.slice(0, s) + block + '\n\n          ' + html.slice(e);
  }
}

// ── Replace rivers layer ─────────────────────────────────────────────────────
{
  const s = findFirst(html, '<!-- ── LAYER: rivers ───────────────────────────────── -->');
  const e = findFirst(html, '<!-- ── LAYER: dynasties');
  if (s !== -1 && e !== -1) {
    // Build river path SVG, sorted so larger tiers paint behind smaller (so
    // labels and tier-1 strokes sit on top).
    const sorted = [...riverData].sort((a, b) => b.tier - a.tier);
    const riverSvg = sorted.map(r => {
      const styled = `<path d="${r.d}" fill="none" stroke="${r.color}" stroke-width="${r.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${r.opacity}"/>`;
      if (r.tier <= 2 && r.labelXY) {
        const labelFill =
          r.color === '#c8a830' ? '#8b6a15' :
          r.color === '#2a7090' ? '#1a5060' :
          r.color === '#3a8c70' ? '#1d5a48' :
          r.color === '#5a78a8' ? '#3a527a' :
          r.color === '#4a8050' ? '#2a5030' :
          r.color === '#a08858' ? '#604628' :
          '#3a3020';
        const labelSize = r.tier === 1 ? 10 : 9;
        const cn = `<text x="${r.labelXY.x}" y="${r.labelXY.y}" font-family="Noto Serif SC, serif" font-size="${labelSize}" fill="${labelFill}" opacity="0.92">${r.nameCn}</text>`;
        const en = `<text x="${r.labelXY.x}" y="${r.labelXY.y + labelSize + 1}" font-family="EB Garamond, serif" font-size="${labelSize - 1}" font-style="italic" fill="${labelFill}" opacity="0.78">${r.nameEn}</text>`;
        return `          ${styled}\n          ${cn}\n          ${en}`;
      }
      return `          ${styled}`;
    }).join('\n');

    const canalSvg = grandCanalPath
      ? `\n          <!-- Grand Canal (大运河) — historical hand-traced route -->\n          <path d="${grandCanalPath}" fill="none" stroke="#7a5838" stroke-width="1.6" stroke-dasharray="6,4" stroke-linecap="round" opacity="0.78"/>`
      : '';

    const block = `<!-- ── LAYER: rivers ───────────────────────────────── -->
        <g class="map-layer layer-rivers" data-layer="rivers" style="display:none">
          <!-- Rivers — Natural Earth 10m rivers_lake_centerlines, projected via Mercator (center 103,36 / scale 820) -->
${riverSvg}
${canalSvg}
        </g>

        `;
    html = html.slice(0, s) + block + html.slice(e);
  }
}

// ── Replace Taiwan path ───────────────────────────────────────────────────────
if (taiwanPath) {
  const s = findFirst(html, '<!-- Taiwan');
  const e = findFirst(html, '<!-- Hainan');
  if (s !== -1 && e !== -1) {
    const block = `<!-- Taiwan — Natural Earth 50m -->
          <path d="${taiwanPath}" fill="#e8dcc8" stroke="#b8a888" stroke-width="1"/>
          <text x="620" y="390" text-anchor="middle" font-family="Noto Serif SC, serif" font-size="8" fill="#5a4428" opacity="0.6">台湾</text>`;
    html = html.slice(0, s) + block + '\n\n          ' + html.slice(e);
  }
}

writeFileSync(htmlPath, html);
console.log('Patched pages/maps/china.html');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\nProjection: center=${PROJECTION_CONFIG.center}, scale=${PROJECTION_CONFIG.scale}`);
console.log(`China path: ${chinaPath.length} chars`);
console.log(`Taiwan path: ${taiwanPath ? taiwanPath.length : 0} chars`);
console.log(`Provinces: ${provinceData.length} features with labels`);
