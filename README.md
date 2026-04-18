# Chinese Field Guide

A personal HTML/CSS/JS bilingual field guide to Chinese language and civilization. Characters, vocabulary, grammar, religion, philosophy, history, geography, culture, culinary traditions, arts and literature, science and medicine, and everyday life.

No build system. Pure static HTML. Open in a browser.

---

## For AI Agents — Read This First

This repo is set up for incremental authoring across many sessions. The key rules:

1. **Never edit `index.html` to add entries.** All cards are auto-rendered from `entries.js`. Adding a page means: create the HTML file + append one object to `entries.js`. That is all.
2. **All content pages live under `pages/[category]/`** — two levels deep. Paths from any content page: `../../style.css`, `../../index.html`, `../../scripts/toc-scroll.js`.
3. **Flip `status` in `entries.js`** from `"stub"` to `"complete"` when a page is fully authored.
4. **HSK pages are deferred** — `pages/hsk/` is reserved but empty. Do not create HSK content without being explicitly asked.
5. **Full project conventions are in `CLAUDE.md`** — read it before creating or editing any content page.

The one fully-authored reference page is `pages/characters/gan3_感.html`. Use it as the exemplar for character pages.

---

## Local Development

```bash
cd ~/Projects/Learning/chinese-field-guide
python3 -m http.server 8080
# open http://localhost:8080
```

---

## Hosting

**GitHub Pages** (recommended — free, zero config):
1. Push this repo to GitHub.
2. Go to Settings → Pages → Source: Deploy from branch `main`, folder `/`.
3. Site lives at `https://[username].github.io/chinese-field-guide/`.

Alternatives: **Cloudflare Pages** or **Netlify** (free tier, drag-and-drop). All three work identically — this is just static HTML.

---

## File Conventions

### Path depth
All content pages are at `pages/[category]/filename.html` — two levels from root:
- Stylesheet: `../../style.css`
- Index: `../../index.html`
- Shared script: `../../scripts/toc-scroll.js`

### Stylesheet
Always `style.css` at the repo root. Never rename it.

### Shared script
`scripts/toc-scroll.js` handles TOC scroll-spy and mobile sidebar toggle. Include at end of `<body>` on every content page — do not duplicate inline.

### Metadata comment
Immediately after `<!DOCTYPE html>`, before `<html>`:
```html
<!DOCTYPE html>
<!-- {"type":"character","char":"感","pinyin":"gǎn","tone":3,...,"status":"complete"} -->
<html lang="zh-Hans">
```

### Naming
- Character pages: `[pinyin][tone]_[char].html` → `pages/characters/gan3_感.html`
- Vocab pages: `[pinyin-ascii]_[char].html` → `pages/vocab/mianzi_面子.html`
- Grammar pages: short descriptor → `pages/grammar/le_了.html`
- Topic pages: `topic_[slug].html` → `pages/religion/topic_chan.html`

ASCII-only filenames — no toned vowels (ā á ǎ à etc.).

### Adding a new page
1. Create the HTML file in `pages/[category]/`.
2. Append one object to `entries.js` with `status: "stub"`.
3. `index.html` auto-renders. Done.

### Authoring a stub
Open the stub. Replace the placeholder scholar box with real sections:
- Section anchors + section heads
- Etymology scholar box (character pages)
- Word-formation pattern box (character/vocab/grammar)
- Vocab card groups (`.cards` > `.card.c-*`)
- 成语 chengyu grid
- Adjacent vocab adj-chips
- Retention image scholar box (character pages)

Then flip `status: "stub"` → `status: "complete"` in `entries.js`.

---

## Authoring Queue

`[x]` = complete · `[ ]` = stub

### Language — Characters (`pages/characters/`)
- [x] `gan3_感.html` — 感 gǎn · to feel, resonate
- [ ] `shi4_是.html` — 是 shì · to be, the copula
- [ ] `you3_有.html` — 有 yǒu · to have, to exist
- [ ] `xin1_心.html` — 心 xīn · heart, mind
- [ ] `ren2_人.html` — 人 rén · person, humanity
- [ ] `qi4_气.html` — 气 qì · breath, vital energy
- [ ] `dao4_道.html` — 道 dào · way, path
- [ ] `tian1_天.html` — 天 tiān · sky, heaven, day
- [ ] `jia1_家.html` — 家 jiā · home, family
- [ ] `zi4_字.html` — 字 zì · character, written word

### Language — Vocabulary (`pages/vocab/`)
- [ ] `dongxi_东西.html` — 东西 dōngxi · things
- [ ] `yisi_意思.html` — 意思 yìsi · meaning, intention
- [ ] `guanxi_关系.html` — 关系 guānxi · relationship, connections
- [ ] `mianzi_面子.html` — 面子 miànzi · face, honor
- [ ] `yuanfen_缘分.html` — 缘分 yuánfèn · karmic connection
- [ ] `jianghu_江湖.html` — 江湖 jiānghú · rivers and lakes
- [ ] `gongfu_功夫.html` — 功夫 gōngfu · effort, skill over time
- [ ] `fengshui_风水.html` — 风水 fēngshuǐ · wind and water
- [ ] `yinyang_阴阳.html` — 阴阳 yīnyáng · yin and yang
- [ ] `tianxia_天下.html` — 天下 tiānxià · all under heaven

### Language — Grammar (`pages/grammar/`)
- [ ] `le_了.html` — 了 le · perfective particle
- [ ] `ba_把.html` — 把 bǎ · disposal construction
- [ ] `bei_被.html` — 被 bèi · the passive
- [ ] `shide_是的.html` — 是…的 shì…de · cleft construction
- [ ] `jiu_cai_就才.html` — 就 vs. 才 · timing and emphasis
- [ ] `de_的得地.html` — 的 / 得 / 地 · the three de's
- [ ] `liangci_量词.html` — 量词 liàngcí · measure words
- [ ] `hui_neng_keyi_会能可以.html` — 会 / 能 / 可以 · the three "can"s
- [ ] `directional_来去.html` — 来 / 去 · directional complements
- [ ] `lian_dou_连都.html` — 连…都/也 · even X

### Religion (`pages/religion/`)
- [ ] `topic_rujia.html` — 儒家 Rújiā · Confucianism
- [ ] `topic_daojiao.html` — 道教 Dàojiào · Daoism
- [ ] `topic_fojiao.html` — 佛教 Fójiào · Buddhism in China
- [ ] `topic_chan.html` — 禅宗 Chán · Chán Buddhism
- [ ] `topic_jingtu.html` — 净土宗 Jìngtǔ · Pure Land
- [ ] `topic_minjian.html` — 民间信仰 · Folk Religion
- [ ] `topic_zuxian.html` — 祖先崇拜 · Ancestor Veneration
- [ ] `topic_mazu.html` — 妈祖 Māzǔ · the Sea Goddess
- [ ] `topic_yisilan.html` — 伊斯兰教 · Islam in China
- [ ] `topic_saman.html` — 萨满教 · Shamanism

### Philosophy (`pages/philosophy/`)
- [ ] `topic_kongzi.html` — 孔子 Kǒngzǐ · Confucius
- [ ] `topic_laozi.html` — 老子 Lǎozǐ · Laozi & the Daodejing
- [ ] `topic_zhuangzi.html` — 庄子 Zhuāngzǐ · Zhuangzi
- [ ] `topic_mengzi.html` — 孟子 Mèngzǐ · Mencius
- [ ] `topic_xunzi.html` — 荀子 Xúnzǐ · Xunzi
- [ ] `topic_mojia.html` — 墨家 Mòjiā · Mohism
- [ ] `topic_fajia.html` — 法家 Fǎjiā · Legalism
- [ ] `topic_yinyang_wuxing.html` — 阴阳五行 · Yin-Yang & Five Phases
- [ ] `topic_lixue.html` — 理学 Lǐxué · Neo-Confucianism
- [ ] `topic_xinxue.html` — 心学 Xīnxué · Wang Yangming

### History (`pages/history/`)
- [ ] `topic_xia_shang_zhou.html` — 夏商周 · The Three Dynasties
- [ ] `topic_qin_shihuang.html` — 秦始皇 · The First Emperor
- [ ] `topic_hanchao.html` — 汉朝 · The Han Dynasty
- [ ] `topic_tangchao.html` — 唐朝 · The Tang Dynasty
- [ ] `topic_songchao.html` — 宋朝 · The Song Dynasty
- [ ] `topic_yuanchao.html` — 元朝 · The Yuan Dynasty
- [ ] `topic_mingchao.html` — 明朝 · The Ming Dynasty
- [ ] `topic_qingchao.html` — 清朝 · The Qing Dynasty
- [ ] `topic_xinhai.html` — 辛亥革命 · The 1911 Revolution
- [ ] `topic_wenge.html` — 文化大革命 · The Cultural Revolution

### Geography (`pages/geography/`)
- [ ] `topic_huanghe.html` — 黄河 Huánghé · Yellow River
- [ ] `topic_changjiang.html` — 长江 Chángjiāng · Yangtze
- [ ] `topic_beijing.html` — 北京 Běijīng · Beijing
- [ ] `topic_shanghai.html` — 上海 Shànghǎi · Shanghai
- [ ] `topic_xizang.html` — 西藏 Xīzàng · Tibet
- [ ] `topic_xinjiang.html` — 新疆 Xīnjiāng · Xinjiang
- [ ] `topic_xianggang.html` — 香港 Xiānggǎng · Hong Kong
- [ ] `topic_taiwan.html` — 台湾 Táiwān · Taiwan
- [ ] `topic_fangyan.html` — 方言 Fāngyán · The Dialect Map
- [ ] `topic_caixi_geography.html` — 八大菜系 · Cuisines as Geography

### Culture (`pages/culture/`)
- [ ] `topic_chunjie.html` — 春节 Chūnjié · Spring Festival
- [ ] `topic_zhongqiu.html` — 中秋节 Zhōngqiūjié · Mid-Autumn Festival
- [ ] `topic_qingming.html` — 清明节 Qīngmíngjié · Tomb-Sweeping
- [ ] `topic_shufa.html` — 书法 Shūfǎ · Calligraphy
- [ ] `topic_jingju.html` — 京剧 Jīngjù · Peking Opera
- [ ] `topic_taiji.html` — 太极 Tàijí · Tai Chi
- [ ] `topic_hanfu.html` — 汉服 Hànfú · Traditional Dress
- [ ] `topic_cha_wenhua.html` — 茶文化 · Tea Culture
- [ ] `topic_hongbao.html` — 红包 Hóngbāo · Red Envelopes
- [ ] `topic_shengxiao.html` — 生肖 Shēngxiào · Zodiac Animals

### Culinary (`pages/culinary/`)
- [ ] `topic_cha.html` — 茶 Chá · Tea
- [ ] `topic_caixi.html` — 八大菜系 · Eight Great Cuisines
- [ ] `topic_chuancai.html` — 川菜 Chuāncài · Sichuan Cuisine
- [ ] `topic_yuecai.html` — 粤菜 Yuècài · Cantonese Cuisine
- [ ] `topic_lucai.html` — 鲁菜 Lǔcài · Shandong Cuisine
- [ ] `topic_miantiao.html` — 面条 Miàntiáo · Noodles
- [ ] `topic_jiaozi.html` — 饺子 Jiǎozi · Dumplings
- [ ] `topic_huoguo.html` — 火锅 Huǒguō · Hotpot
- [ ] `topic_doufu.html` — 豆腐 Dòufu · Tofu
- [ ] `topic_baijiu.html` — 白酒 Báijiǔ · Baijiu

### Arts & Literature (`pages/arts/`)
- [ ] `topic_shijing.html` — 诗经 Shījīng · Book of Songs
- [ ] `topic_chuci.html` — 楚辞 Chǔcí · Songs of Chu
- [ ] `topic_tangshi.html` — 唐诗 Tángshī · Tang Poetry
- [ ] `topic_songci.html` — 宋词 Sòngcí · Song Lyric
- [ ] `topic_sidaimingzhu.html` — 四大名著 · Four Great Novels
- [ ] `topic_shuimohua.html` — 水墨画 · Ink-Wash Painting
- [ ] `topic_wenfangsibao.html` — 文房四宝 · Four Treasures of the Study
- [ ] `topic_zhuanke.html` — 篆刻 Zhuànkè · Seal Carving
- [ ] `topic_kunqu.html` — 昆曲 Kūnqǔ · Kun Opera
- [ ] `topic_luxun.html` — 鲁迅 Lǔ Xùn · Lu Xun

### Science & Medicine (`pages/science/`)
- [ ] `topic_zhongyi.html` — 中医 Zhōngyī · Traditional Chinese Medicine
- [ ] `topic_zhenjiu.html` — 针灸 Zhēnjiǔ · Acupuncture
- [ ] `topic_bencao.html` — 本草纲目 · The Great Pharmacopeia
- [ ] `topic_sidafaming.html` — 四大发明 · Four Great Inventions
- [ ] `topic_suanpan.html` — 算盘 Suànpán · The Abacus
- [ ] `topic_lifa.html` — 历法 Lìfǎ · The Lunisolar Calendar
- [ ] `topic_jieqi.html` — 二十四节气 · 24 Solar Terms
- [ ] `topic_fengshui_science.html` — 风水 · Geomancy as Proto-Science
- [ ] `topic_xingxiu.html` — 星宿 Xīngxiù · Chinese Constellations
- [ ] `topic_sichou.html` — 丝绸 Sīchóu · Silk

### Everyday Life & Customs (`pages/daily/`)
- [ ] `topic_hongbai.html` — 红白喜事 · Weddings & Funerals
- [ ] `topic_songli.html` — 送礼 · Gift-Giving
- [ ] `topic_qingke.html` — 请客吃饭 · Treating to a Meal
- [ ] `topic_chenghu.html` — 称呼 · Forms of Address
- [ ] `topic_xingming.html` — 姓名 · Names & Surnames
- [ ] `topic_shuzi.html` — 数字 · Lucky & Unlucky Numbers
- [ ] `topic_yanse.html` — 颜色 · Color Symbolism
- [ ] `topic_jingjiu.html` — 敬酒 · Toasting Culture
- [ ] `topic_mixin.html` — 迷信 · Superstitions
- [ ] `topic_kuaizi.html` — 筷子礼仪 · Chopstick Etiquette
