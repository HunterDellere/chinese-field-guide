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

// ── Dynasty extents ──────────────────────────────────────────────────────────
// Hand-traced lon/lat polygons for each dynasty's approximate maximum extent,
// cross-checked against Cambridge History of China, Britannica historical
// territory maps, and standard scholarly references. Projected through the
// same Mercator so they register against the modern coastline.
//
// These are simplified outlines — 12–20 vertices each — meant to convey
// scale and direction of imperial reach, not the exact frontier of any
// given year. For precise borders see the linked entries.
const DYNASTIES = [
  {
    id: 'han', nameCn: '汉', nameEn: 'Han', years: '202 BCE – 220 CE',
    color: '#a06428', // ochre-brown
    // Han at ~100 BCE under Wudi: from Korean peninsula edge through Hexi
    // Corridor (Gansu) to Tarim Basin oases, north to Ordos, south to
    // northern Vietnam.
    ring: [
      [124.5, 41.5], [127.0, 40.5], [125.5, 38.5], [122.0, 36.0],
      [121.0, 33.0], [120.5, 30.0], [114.0, 22.5], [108.5, 21.5],
      [104.0, 22.0], [102.0, 24.0], [99.0, 27.0], [97.5, 30.5],
      [98.0, 35.0], [95.0, 38.0], [88.0, 41.0], [82.0, 41.5],
      [77.5, 41.0], [82.0, 43.5], [90.0, 44.5], [98.0, 43.0],
      [105.0, 42.5], [112.0, 42.0], [119.0, 42.0], [124.5, 41.5],
    ],
  },
  {
    id: 'tang', nameCn: '唐', nameEn: 'Tang', years: '618 – 907 CE',
    color: '#a06428',
    // Tang at ~660 CE peak under Gaozong: westward reach to Aral Sea,
    // protectorates over Tarim + Tianshan, northern Korean peninsula,
    // northern Vietnam.
    ring: [
      [126.0, 42.5], [128.5, 41.0], [128.0, 38.5], [122.5, 35.5],
      [121.0, 32.5], [121.5, 28.5], [118.0, 24.0], [112.0, 21.0],
      [106.0, 21.5], [102.0, 23.0], [99.0, 26.0], [97.0, 30.5],
      [95.0, 34.0], [88.0, 36.5], [80.0, 37.0], [73.0, 39.5],
      [70.0, 42.5], [68.0, 45.0], [73.0, 47.5], [82.0, 47.0],
      [92.0, 47.5], [102.0, 47.5], [113.0, 46.5], [120.0, 45.0],
      [126.0, 42.5],
    ],
  },
  {
    id: 'song', nameCn: '宋', nameEn: 'Song', years: '960 – 1279 CE',
    color: '#5c8a78', // teal-green (different from Tang to read clearly)
    // Northern Song extent before 1127: south of Jin (Jurchen) territory,
    // not extending into the steppe or NE. After 1127 Southern Song was
    // even smaller (south of Huai River).
    ring: [
      [120.0, 40.5], [121.0, 39.0], [120.5, 36.0], [121.5, 33.0],
      [121.5, 30.0], [120.5, 27.5], [118.5, 24.5], [115.0, 22.5],
      [110.0, 21.5], [105.5, 22.0], [102.5, 23.5], [99.5, 25.5],
      [99.5, 28.0], [102.0, 31.0], [104.0, 33.5], [105.0, 36.5],
      [108.5, 39.0], [113.0, 40.5], [120.0, 40.5],
    ],
  },
  {
    id: 'yuan', nameCn: '元', nameEn: 'Yuan', years: '1271 – 1368 CE',
    color: '#5c3d7a', // deep purple
    // Mongol Yuan: vastly larger than any predecessor — all of modern China
    // plus all of Mongolia, Manchuria, Tibet, parts of Burma, edges of
    // Korea / Russia. (Excludes the broader Mongol khanates.)
    ring: [
      [130.0, 53.0], [134.0, 47.5], [131.0, 43.0], [127.0, 40.5],
      [128.5, 38.5], [122.5, 35.0], [122.0, 32.0], [122.0, 28.5],
      [119.0, 25.0], [115.0, 22.0], [108.0, 20.5], [102.0, 22.0],
      [98.0, 24.5], [97.0, 28.5], [94.0, 28.0], [89.0, 28.5],
      [82.0, 31.0], [78.0, 35.0], [75.0, 38.0], [78.0, 42.0],
      [85.0, 47.0], [92.0, 50.5], [104.0, 51.5], [114.0, 50.0],
      [124.0, 51.5], [130.0, 53.0],
    ],
  },
  {
    id: 'ming', nameCn: '明', nameEn: 'Ming', years: '1368 – 1644 CE',
    color: '#2a5c6b', // teal — scholarly Ming convention
    // Ming after consolidation: roughly modern China south of the Great
    // Wall, plus protectorate-level reach into Manchuria's Liaodong and
    // Yunnan. No Mongolia, Xinjiang, Tibet (as in modern PRC).
    ring: [
      [124.5, 42.5], [125.5, 40.5], [122.0, 38.5], [121.5, 35.0],
      [122.0, 31.5], [121.5, 28.5], [119.0, 24.5], [115.0, 22.0],
      [110.0, 21.0], [105.5, 21.5], [102.0, 23.0], [99.0, 25.0],
      [98.0, 27.5], [99.0, 31.0], [102.5, 33.5], [104.0, 36.0],
      [104.5, 39.0], [109.0, 41.5], [114.0, 42.5], [119.0, 42.0],
      [124.5, 42.5],
    ],
  },
  {
    id: 'qing', nameCn: '清', nameEn: 'Qing', years: '1644 – 1912 CE',
    color: '#8e4a6e', // mulberry
    // Qing at ~1820 peak (after Qianlong's expansions): all of modern PRC
    // + Mongolia + Taiwan + Outer Manchuria (later ceded to Russia 1860) +
    // suzerainty over Korea, Vietnam, Burma (suzerainty not territorial,
    // so not drawn). Includes Xinjiang and Tibet.
    ring: [
      [135.0, 53.0], [140.0, 49.0], [135.0, 45.0], [131.0, 42.5],
      [128.0, 40.0], [125.0, 38.5], [122.0, 35.0], [122.5, 31.0],
      [122.0, 27.0], [120.5, 24.0], [115.0, 21.5], [110.0, 20.5],
      [108.0, 18.5], [108.5, 21.0], [105.5, 22.0], [102.5, 23.5],
      [99.0, 25.5], [97.5, 28.5], [94.5, 28.0], [88.0, 28.0],
      [80.0, 31.0], [75.0, 35.5], [73.5, 39.5], [78.0, 44.0],
      [86.0, 49.0], [98.0, 52.5], [110.0, 53.0], [122.0, 54.0],
      [130.0, 54.5], [135.0, 53.0],
    ],
  },
];

// ── Great Wall (Ming era) ────────────────────────────────────────────────────
// Hand-traced from authoritative scholarly maps following the Ming-era Great
// Wall route: Jiayuguan (west terminus) → Yumen → Hexi Corridor → Yinchuan →
// crossing the Yellow River loop → Ordos south rim → Yanmen → Datong →
// Zhangjiakou → Beijing-area passes (Juyongguan, Gubeikou) → Shanhaiguan
// (east terminus, where it meets the Bohai Sea). 28 waypoints.
const GREAT_WALL_LONLAT = [
  [98.30, 39.80],   // Jiayuguan (west terminus, Gansu)
  [98.95, 40.00],
  [100.40, 40.55],
  [102.30, 40.10],
  [103.85, 38.70],
  [104.95, 37.85],
  [105.90, 37.60],
  [106.30, 37.85],
  [106.85, 38.30],
  [107.60, 38.95],
  [108.65, 39.05],
  [109.55, 38.85],
  [110.50, 38.65],
  [111.30, 39.20],
  [112.30, 39.40],   // Pianguan (Yellow River crossing)
  [112.90, 39.65],
  [113.30, 40.00],   // Yanmen Pass
  [113.30, 40.20],   // Datong area
  [114.20, 40.55],
  [115.00, 40.65],   // Zhangjiakou area
  [115.95, 40.80],
  [116.55, 40.55],   // Juyongguan / Badaling
  [117.10, 40.35],
  [117.55, 40.45],   // Gubeikou
  [118.30, 40.30],
  [118.85, 40.05],
  [119.55, 40.05],   // Jinshanling / Simatai sections
  [119.80, 40.00],   // Shanhaiguan (east terminus, where wall meets sea)
];
const greatWallPath = (() => {
  const pts = GREAT_WALL_LONLAT.map(([lon, lat]) => projection([lon, lat])).filter(Boolean);
  if (!pts.length) return '';
  return 'M' + pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L');
})();

// ── Silk Roads ───────────────────────────────────────────────────────────────
// Land Silk Road: hand-traced from Chang'an (Xi'an) through the Hexi Corridor
// to Dunhuang where it splits into northern + southern Tarim routes converging
// at Kashgar before crossing into Central Asia.
// Maritime Silk Road: from Quanzhou/Guangzhou southward through the South
// China Sea — drawn only to the edge of the China-framed viewBox.
const SILK_ROAD_LAND_MAIN = [
  [108.95, 34.27], // Chang'an (Xi'an)
  [104.65, 34.50], // Tianshui
  [103.85, 36.07], // Lanzhou
  [102.65, 37.95], // Wuwei
  [100.45, 38.95], // Zhangye
  [98.30, 39.80],  // Jiayuguan
  [97.05, 40.15],  // Anxi (Guazhou)
  [94.65, 40.15],  // Dunhuang (split point)
];
// Northern route: Dunhuang → Hami → Turpan → Karashahr → Kucha → Aksu → Kashgar
const SILK_ROAD_LAND_NORTH = [
  [94.65, 40.15],  // Dunhuang
  [93.50, 42.83],  // Hami
  [89.20, 42.95],  // Turpan
  [86.55, 41.75],  // Karashahr (Yanqi)
  [82.95, 41.72],  // Kucha (Kuqa)
  [80.25, 41.17],  // Aksu
  [75.99, 39.47],  // Kashgar
];
// Southern route: Dunhuang → Miran → Khotan → Yarkand → Kashgar
const SILK_ROAD_LAND_SOUTH = [
  [94.65, 40.15],  // Dunhuang
  [89.05, 38.65],  // Miran
  [85.20, 37.10],  // Qarqan (Cherchen)
  [80.95, 37.10],  // Khotan
  [77.25, 38.42],  // Yarkand
  [75.99, 39.47],  // Kashgar
];
// Maritime: Quanzhou → outflow southward, plus Guangzhou → SCS edge
const SILK_ROAD_SEA_QUANZHOU = [
  [118.68, 24.87], // Quanzhou
  [118.30, 23.00],
  [117.50, 21.50],
  [116.00, 19.80],
  [114.00, 17.50],
  [112.00, 14.50],
];
const SILK_ROAD_SEA_GUANGZHOU = [
  [113.27, 23.13], // Guangzhou
  [113.50, 21.50],
  [113.00, 19.50],
  [111.00, 16.00],
  [109.00, 13.00],
];

// ── Dialect zones ────────────────────────────────────────────────────────────
// Boundary precision is genuinely contested — the Wurm/Li Language Atlas of
// China and Glottolog disagree, and field linguists continue to refine. Rather
// than render unreliable polygons, we place labeled centroids at the cultural
// heart of each major dialect group. The note explicitly flags that boundaries
// are debated.
const DIALECTS = [
  { id: 'guanhua',  cn: '官话',   en: 'Mandarin (Guānhuà)',     lon: 113.0, lat: 35.5, color: '#a06428', tier: 1 },
  { id: 'wu',       cn: '吴语',   en: 'Wu (Shanghainese)',       lon: 120.6, lat: 31.0, color: '#1a5050', tier: 1 },
  { id: 'yue',      cn: '粤语',   en: 'Yue (Cantonese)',         lon: 113.3, lat: 23.1, color: '#8e4a6e', tier: 1 },
  { id: 'min',      cn: '闽语',   en: 'Min',                     lon: 119.3, lat: 25.3, color: '#4a2878', tier: 1 },
  { id: 'kejia',    cn: '客家话', en: 'Hakka (Kèjiā)',           lon: 115.5, lat: 25.8, color: '#7a3a18', tier: 1 },
  { id: 'xiang',    cn: '湘语',   en: 'Xiang (Hunanese)',        lon: 112.9, lat: 28.0, color: '#386b3a', tier: 2 },
  { id: 'gan',      cn: '赣语',   en: 'Gan (Jiangxinese)',       lon: 115.9, lat: 28.7, color: '#5a6a8a', tier: 2 },
  { id: 'jin',      cn: '晋语',   en: 'Jin (sometimes split from Mandarin)', lon: 112.5, lat: 37.8, color: '#8a6a40', tier: 2 },
];
const dialectMarkers = DIALECTS.map(d => {
  const p = projection([d.lon, d.lat]);
  if (!p) return null;
  return { ...d, x: Math.round(p[0]), y: Math.round(p[1]) };
}).filter(Boolean);

function lonLatChainToPath(chain) {
  const pts = chain.map(([lon, lat]) => projection([lon, lat])).filter(Boolean);
  if (!pts.length) return '';
  return 'M' + pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L');
}
const silkRoadLandMain   = lonLatChainToPath(SILK_ROAD_LAND_MAIN);
const silkRoadLandNorth  = lonLatChainToPath(SILK_ROAD_LAND_NORTH);
const silkRoadLandSouth  = lonLatChainToPath(SILK_ROAD_LAND_SOUTH);
const silkRoadSeaQz      = lonLatChainToPath(SILK_ROAD_SEA_QUANZHOU);
const silkRoadSeaGz      = lonLatChainToPath(SILK_ROAD_SEA_GUANGZHOU);

const dynastyExtents = DYNASTIES.map(d => {
  const projectedRing = d.ring
    .map(([lon, lat]) => projection([lon, lat]))
    .filter(Boolean);
  if (!projectedRing.length) return null;
  const path = 'M' + projectedRing.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' L') + ' Z';
  return { ...d, path };
}).filter(Boolean);

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

// ── Replace dynasties layer ──────────────────────────────────────────────────
{
  const s = findFirst(html, '<!-- ── LAYER: dynasties ────────────────────────────── -->');
  const e = findFirst(html, '<!-- ── LAYER: dialects');
  if (s !== -1 && e !== -1) {
    const paths = dynastyExtents.map(d =>
      `          <path class="dynasty-extent dynasty-${d.id}" data-dynasty="${d.id}" ` +
      `d="${d.path}" fill="${d.color}" fill-opacity="0.18" stroke="${d.color}" ` +
      `stroke-width="1.8" stroke-dasharray="5,3" opacity="0"/>`
    ).join('\n');

    // Dynasty key — list all 6 with year ranges
    const keyRows = dynastyExtents.map((d, i) => {
      const y = 28 + i * 16;
      return `            <rect x="10" y="${y}" width="16" height="8" rx="1" fill="${d.color}" fill-opacity="0.35" stroke="${d.color}" stroke-width="1" stroke-dasharray="3,2"/>\n` +
             `            <text x="32" y="${y + 8}" font-family="EB Garamond, serif" font-size="10" fill="#5a4428">${d.nameCn} ${d.nameEn} (${d.years})</text>`;
    }).join('\n');
    const keyHeight = 28 + dynastyExtents.length * 16 + 22;
    const keyY = 700 - keyHeight - 18;

    const block = `<!-- ── LAYER: dynasties ────────────────────────────── -->
        <g class="map-layer layer-dynasties" data-layer="dynasties" style="display:none" clip-path="inset(0)">
          <!-- Dynasty extents — hand-traced lon/lat polygons cross-checked against Cambridge History of China and Britannica historical maps; projected via Mercator (center 103,36 / scale 820). clip-path keeps overflow within viewBox bounds for dynasties that extended beyond the current frame (Yuan/Qing). -->
${paths}

          <!-- Dynasty key -->
          <g transform="translate(28,${keyY})">
            <rect width="200" height="${keyHeight}" rx="4" fill="#f0e8d5" stroke="#c8b898" stroke-width="1" opacity="0.96"/>
            <text x="10" y="18" font-family="Noto Serif SC, serif" font-size="10" font-weight="600" fill="#3d2e18">朝代 Dynasty Key</text>
${keyRows}
            <text x="10" y="${keyHeight - 8}" font-family="EB Garamond, serif" font-size="9" fill="#8a7060" font-style="italic">Select above to highlight extent.</text>
          </g>
        </g>

        `;
    html = html.slice(0, s) + block + html.slice(e);
  }
}

// ── Replace dialects layer ───────────────────────────────────────────────────
{
  const s = findFirst(html, '<!-- ── LAYER: dialects ─────────────────────────────── -->');
  // End boundary: the dialects block runs until the JS-rendered pin groups
  // marker. Try a few likely sentinels.
  let e = findFirst(html,
    '<!-- ── JS-rendered pin groups',
    '<!-- ── LAYER: greatwall',
    '<!-- ── LAYER: silkroads',
  );
  if (s !== -1 && e !== -1) {
    const markerSvg = dialectMarkers.map(d => {
      const fontSize = d.tier === 1 ? 11 : 10;
      const subSize  = d.tier === 1 ? 9  : 8;
      // Small dot + CN label below + EN label below CN
      return `          <g class="dialect-marker">\n` +
             `            <circle cx="${d.x}" cy="${d.y}" r="3.5" fill="${d.color}" opacity="0.85" stroke="#f2e8d5" stroke-width="0.8"/>\n` +
             `            <text x="${d.x}" y="${d.y + 14}" text-anchor="middle" font-family="Noto Serif SC, serif" font-size="${fontSize}" fill="${d.color}" opacity="0.95">${d.cn}</text>\n` +
             `            <text x="${d.x}" y="${d.y + 14 + subSize + 2}" text-anchor="middle" font-family="EB Garamond, serif" font-size="${subSize}" font-style="italic" fill="${d.color}" opacity="0.78">${d.en}</text>\n` +
             `          </g>`;
    }).join('\n');

    const block = `<!-- ── LAYER: dialects ─────────────────────────────── -->
        <g class="map-layer layer-dialects" data-layer="dialects" style="display:none">
          <!-- Major Sinitic dialect groups — labeled centroids only, since boundary precision is genuinely linguistically debated (Wurm/Li atlas vs Glottolog vs field-current refinements). For approximate zones, see the 方言 entry. -->
${markerSvg}

          <!-- Honest note about boundaries -->
          <g transform="translate(28,548)">
            <rect width="184" height="46" rx="4" fill="#f0e8d5" stroke="#c8b898" stroke-width="1" opacity="0.95"/>
            <text x="8" y="14" font-family="Noto Serif SC, serif" font-size="9" font-weight="600" fill="#3d2e18">方言 Dialect groups</text>
            <text x="8" y="26" font-family="EB Garamond, serif" font-size="9" fill="#5a4428" font-style="italic">Boundaries are linguistically</text>
            <text x="8" y="38" font-family="EB Garamond, serif" font-size="9" fill="#5a4428" font-style="italic">debated; see 方言 entry.</text>
          </g>
        </g>

        `;
    html = html.slice(0, s) + block + html.slice(e);
  }
}

// ── Add SVG layer groups for Great Wall + Silk Roads (order matters: SVG first
//    so the toggle-button block below can detect already-shipped layers) ─────
{
  // Great Wall layer — keyed on the SVG layer marker comment, not the button
  const wallMarker = '<!-- ── LAYER: greatwall';
  if (!html.includes(wallMarker)) {
    const anchor = '<!-- ── LAYER: dialects';
    const i = html.indexOf(anchor);
    if (i !== -1) {
      const block =
        `<!-- ── LAYER: greatwall ─────────────────────────── -->\n` +
        `        <g class="map-layer layer-greatwall" data-layer="greatwall" style="display:none">\n` +
        `          <!-- Great Wall (Ming era) — hand-traced from authoritative scholarly maps following the Ming-era route from Jiayuguan to Shanhaiguan; lon/lat projected via Mercator -->\n` +
        `          <path d="${greatWallPath}" fill="none" stroke="#3d2e18" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>\n` +
        `          <path d="${greatWallPath}" fill="none" stroke="#8b6a40" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2,2" opacity="0.72"/>\n` +
        // Endpoint labels
        (() => {
          const west = projection([98.30, 39.80]);
          const east = projection([119.80, 40.00]);
          if (!west || !east) return '';
          return `          <circle cx="${west[0].toFixed(2)}" cy="${west[1].toFixed(2)}" r="3" fill="#3d2e18"/>\n` +
                 `          <text x="${(west[0] - 6).toFixed(2)}" y="${(west[1] + 4).toFixed(2)}" text-anchor="end" font-family="Noto Serif SC, serif" font-size="10" fill="#3d2e18">嘉峪关</text>\n` +
                 `          <circle cx="${east[0].toFixed(2)}" cy="${east[1].toFixed(2)}" r="3" fill="#3d2e18"/>\n` +
                 `          <text x="${(east[0] + 6).toFixed(2)}" y="${(east[1] + 4).toFixed(2)}" text-anchor="start" font-family="Noto Serif SC, serif" font-size="10" fill="#3d2e18">山海关</text>\n`;
        })() +
        `        </g>\n\n        `;
      html = html.slice(0, i) + block + html.slice(i);
    }
  }

  // Silk Roads layer
  const silkMarker = '<!-- ── LAYER: silkroads';
  if (!html.includes(silkMarker)) {
    const anchor = '<!-- ── LAYER: dialects';
    const i = html.indexOf(anchor);
    if (i !== -1) {
      // Style: solid for main land trunk, dashed for the two Tarim alternatives,
      // dot-dash for maritime
      const block =
        `<!-- ── LAYER: silkroads ─────────────────────────── -->\n` +
        `        <g class="map-layer layer-silkroads" data-layer="silkroads" style="display:none">\n` +
        `          <!-- Silk Roads — land routes from Chang'an through Hexi Corridor to Kashgar (with N+S Tarim variants); maritime routes from Quanzhou and Guangzhou southward into the South China Sea. Hand-traced from canonical waypoints. -->\n` +
        `          <path d="${silkRoadLandMain}" fill="none" stroke="#a06428" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>\n` +
        `          <path d="${silkRoadLandNorth}" fill="none" stroke="#a06428" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6,3" opacity="0.78"/>\n` +
        `          <path d="${silkRoadLandSouth}" fill="none" stroke="#a06428" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6,3" opacity="0.78"/>\n` +
        `          <path d="${silkRoadSeaQz}" fill="none" stroke="#2a5c6b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2,4" opacity="0.78"/>\n` +
        `          <path d="${silkRoadSeaGz}" fill="none" stroke="#2a5c6b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2,4" opacity="0.78"/>\n` +
        // Key/legend
        (() => {
          // Position legend in upper-right corner of viewBox
          const x = 600, y = 580;
          return `          <g transform="translate(${x},${y})">\n` +
                 `            <rect width="184" height="78" rx="4" fill="#f0e8d5" stroke="#c8b898" stroke-width="1" opacity="0.96"/>\n` +
                 `            <text x="10" y="18" font-family="Noto Serif SC, serif" font-size="10" font-weight="600" fill="#3d2e18">丝绸之路 Silk Roads</text>\n` +
                 `            <line x1="10" y1="32" x2="32" y2="32" stroke="#a06428" stroke-width="2"/>\n` +
                 `            <text x="40" y="36" font-family="EB Garamond, serif" font-size="10" fill="#5a4428">Land trunk</text>\n` +
                 `            <line x1="10" y1="48" x2="32" y2="48" stroke="#a06428" stroke-width="1.6" stroke-dasharray="6,3"/>\n` +
                 `            <text x="40" y="52" font-family="EB Garamond, serif" font-size="10" fill="#5a4428">Tarim variants</text>\n` +
                 `            <line x1="10" y1="64" x2="32" y2="64" stroke="#2a5c6b" stroke-width="1.8" stroke-dasharray="2,4"/>\n` +
                 `            <text x="40" y="68" font-family="EB Garamond, serif" font-size="10" fill="#5a4428">Maritime</text>\n` +
                 `          </g>\n`;
        })() +
        `        </g>\n\n        `;
      html = html.slice(0, i) + block + html.slice(i);
    }
  }
}

// ── Add layer toggle buttons for Great Wall + Silk Roads (idempotent) ────────
{
  const NEW_TOGGLES = [
    { layer: 'greatwall', cn: '长城',     en: 'Great Wall' },
    { layer: 'silkroads', cn: '丝绸之路', en: 'Silk Roads' },
  ];
  for (const t of NEW_TOGGLES) {
    // Idempotency check: look for the toggle button specifically (matches the
    // exact button signature so SVG-layer mentions don't false-positive).
    const buttonSig = `<button class="map-layer-btn" data-layer="${t.layer}"`;
    if (html.includes(buttonSig)) continue;
    const anchor = '<button class="map-layer-btn" data-layer="sites"';
    const i = html.indexOf(anchor);
    if (i === -1) continue;
    const btn =
      `<button class="map-layer-btn" data-layer="${t.layer}" aria-pressed="false" type="button">\n` +
      `            <span class="btn-cn">${t.cn}</span> ${t.en}\n` +
      `          </button>\n          `;
    html = html.slice(0, i) + btn + html.slice(i);
  }
}

// ── Update dynasty selector buttons (the row above the map) ──────────────────
{
  const s = findFirst(html, '<div class="map-dynasty-row" id="dynasty-selector"');
  if (s !== -1) {
    const e = html.indexOf('</div>', s);
    if (e !== -1) {
      const buttons = dynastyExtents
        .map(d => `        <button class="dynasty-btn" data-dynasty="${d.id}" type="button">${d.nameCn} ${d.nameEn}</button>`)
        .join('\n');
      const block =
        `<div class="map-dynasty-row" id="dynasty-selector" hidden>\n` +
        `        <span class="map-dynasty-row-label">Highlight extent · 版图</span>\n` +
        `${buttons}\n      `;
      html = html.slice(0, s) + block + html.slice(e);
    }
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
