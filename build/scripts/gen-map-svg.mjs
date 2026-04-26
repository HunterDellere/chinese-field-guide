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

if (!existsSync(countriesPath)) {
  console.error('Missing /tmp/countries-50m.json — run the download step first.');
  process.exit(1);
}
if (!existsSync(provincesPath)) {
  console.error('Missing /tmp/ne_provinces.geojson — run the download step first.');
  process.exit(1);
}

const topo = JSON.parse(readFileSync(countriesPath, 'utf8'));
const provincesGeo = JSON.parse(readFileSync(provincesPath, 'utf8'));

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

// ── Build province label list (only provinces whose centroid is on-screen) ───
const provinceLabels = provinceData
  .filter(p => p.cx > 20 && p.cx < W - 20 && p.cy > 20 && p.cy < H - 40 && p.nameCn)
  .map(p => `            <text x="${p.cx}" y="${p.cy}">${p.nameCn}</text>`)
  .join('\n');

// ── Write reference JSON ──────────────────────────────────────────────────────
const out = {
  generated: new Date().toISOString(),
  source: 'Natural Earth 50m countries + 10m admin1 provinces',
  chinaPath,
  taiwanPath,
  provincePaths,
  provinceLabels,
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
