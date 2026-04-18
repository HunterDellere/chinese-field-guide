/* ─────────────────────────────────────────────────────────────────────────
 * entries.js — Chinese Field Guide manifest
 *
 * Single source of truth for every page on the site.
 * index.html reads window.ENTRIES and renders all category grids automatically.
 *
 * To add a page:
 *   1. Create the HTML file in the appropriate subfolder.
 *   2. Append one object to the correct category array below.
 *   3. Set status: "complete" when the page is fully authored.
 *
 * status: "complete" → rendered as a full clickable card
 *         "stub"     → rendered greyed-out with a "coming soon" chip
 * ───────────────────────────────────────────────────────────────────────── */

window.ENTRIES = [

  /* ── LANGUAGE: CHARACTERS ──────────────────────────────────────────── */
  {
    path: "pages/characters/gan3_感.html",
    type: "character", category: "characters",
    char: "感", pinyin: "gǎn", tone: 3, hsk: "2–4", radical: "心",
    title: "感 · to feel, to resonate",
    desc: "Feeling, perception, gratitude, and the cosmology of sympathetic resonance.",
    tags: ["emotion", "perception", "gratitude"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/characters/shi4_是.html",
    type: "character", category: "characters",
    char: "是", pinyin: "shì", tone: 4, hsk: 1, radical: "日",
    title: "是 · to be",
    desc: "The copula, the cleft construction, classical 是非 right-and-wrong.",
    tags: ["grammar", "copula", "logic"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/characters/you3_有.html",
    type: "character", category: "characters",
    char: "有", pinyin: "yǒu", tone: 3, hsk: 1, radical: "月",
    title: "有 · to have, to exist",
    desc: "Possession, existence, and the have/be distinction that reshapes grammar.",
    tags: ["grammar", "existence", "possession"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/characters/xin1_心.html",
    type: "character", category: "characters",
    char: "心", pinyin: "xīn", tone: 1, hsk: 2, radical: "心",
    title: "心 · heart, mind",
    desc: "The radical at the root of all feeling — and the Chinese conception of thought itself.",
    tags: ["radical", "emotion", "mind"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/characters/ren2_人.html",
    type: "character", category: "characters",
    char: "人", pinyin: "rén", tone: 2, hsk: 1, radical: "人",
    title: "人 · person, humanity",
    desc: "The character for human being, and its echo in 仁 rén — Confucian benevolence.",
    tags: ["humanity", "confucianism", "radical"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/characters/qi4_气.html",
    type: "character", category: "characters",
    char: "气", pinyin: "qì", tone: 4, hsk: 3, radical: "气",
    title: "气 · breath, vital energy",
    desc: "From weather to anger to the cosmic force underlying TCM and martial arts.",
    tags: ["cosmology", "tcm", "energy"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/characters/dao4_道.html",
    type: "character", category: "characters",
    char: "道", pinyin: "dào", tone: 4, hsk: 3, radical: "辶",
    title: "道 · way, path",
    desc: "The word that gave Daoism its name — and underlies every Chinese 'ism'.",
    tags: ["daoism", "philosophy", "path"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/characters/tian1_天.html",
    type: "character", category: "characters",
    char: "天", pinyin: "tiān", tone: 1, hsk: 1, radical: "大",
    title: "天 · sky, heaven, day",
    desc: "Heaven as moral authority, weather, time, and the ground of 天命 the Mandate of Heaven.",
    tags: ["cosmology", "heaven", "mandate"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/characters/jia1_家.html",
    type: "character", category: "characters",
    char: "家", pinyin: "jiā", tone: 1, hsk: 1, radical: "宀",
    title: "家 · home, family",
    desc: "House, family, school of thought, nation (国家) — the fractal of belonging.",
    tags: ["family", "society", "home"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/characters/zi4_字.html",
    type: "character", category: "characters",
    char: "字", pinyin: "zì", tone: 4, hsk: 1, radical: "子",
    title: "字 · character, written word",
    desc: "The character that names itself — and the whole system of 汉字.",
    tags: ["writing", "language", "meta"],
    updated: "2026-04-18",
    status: "complete"
  },

  /* ── LANGUAGE: VOCAB ───────────────────────────────────────────────── */
  {
    path: "pages/vocab/dongxi_东西.html",
    type: "vocab", category: "vocab",
    title: "东西 · things",
    pinyin: "dōngxi",
    desc: "East-west as the word for 'stuff' — a window into directional cosmology.",
    tags: ["directions", "colloquial", "things"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/vocab/yisi_意思.html",
    type: "vocab", category: "vocab",
    title: "意思 · meaning, intention",
    pinyin: "yìsi",
    desc: "Meaning, interest, charm, and the gift-giving idiom 意思意思.",
    tags: ["meaning", "gift", "register"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/vocab/guanxi_关系.html",
    type: "vocab", category: "vocab",
    title: "关系 · relationship, connections",
    pinyin: "guānxi",
    desc: "The untranslatable social fabric — relational leverage, it matters.",
    tags: ["social", "connections", "culture"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/vocab/mianzi_面子.html",
    type: "vocab", category: "vocab",
    title: "面子 · face, honor",
    pinyin: "miànzi",
    desc: "Giving, losing, and saving face — the social grammar of dignity.",
    tags: ["social", "honor", "culture"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/vocab/yuanfen_缘分.html",
    type: "vocab", category: "vocab",
    title: "缘分 · karmic connection",
    pinyin: "yuánfèn",
    desc: "Buddhist-rooted fate that ties strangers, lovers, and old friends.",
    tags: ["buddhism", "fate", "romance"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/vocab/jianghu_江湖.html",
    type: "vocab", category: "vocab",
    title: "江湖 · rivers and lakes",
    pinyin: "jiānghú",
    desc: "The outsider world of wanderers, martial artists, and street wisdom.",
    tags: ["wuxia", "culture", "society"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/vocab/gongfu_功夫.html",
    type: "vocab", category: "vocab",
    title: "功夫 · effort, skill over time",
    pinyin: "gōngfu",
    desc: "Not just martial arts — the original meaning is mastery earned through time.",
    tags: ["mastery", "time", "martial-arts"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/vocab/fengshui_风水.html",
    type: "vocab", category: "vocab",
    title: "风水 · wind and water",
    pinyin: "fēngshuǐ",
    desc: "Geomancy, qi flow, and the cosmological logic of favorable siting.",
    tags: ["cosmology", "geomancy", "space"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/vocab/yinyang_阴阳.html",
    type: "vocab", category: "vocab",
    title: "阴阳 · yin and yang",
    pinyin: "yīnyáng",
    desc: "The binary engine of all classical Chinese thought.",
    tags: ["cosmology", "philosophy", "binary"],
    updated: "2026-04-18",
    status: "complete"
  },
  {
    path: "pages/vocab/tianxia_天下.html",
    type: "vocab", category: "vocab",
    title: "天下 · all under heaven",
    pinyin: "tiānxià",
    desc: "The pre-nation-state Chinese political imagination — the civilized world.",
    tags: ["politics", "history", "worldview"],
    updated: "2026-04-18",
    status: "complete"
  },

  /* ── LANGUAGE: GRAMMAR ─────────────────────────────────────────────── */
  {
    path: "pages/grammar/le_了.html",
    type: "grammar", category: "grammar",
    title: "了 · the perfective particle",
    pinyin: "le",
    desc: "Perfective aspect vs. change-of-state — the single most-confused particle.",
    tags: ["aspect", "particle", "tense"],
    status: "complete"
  },
  {
    path: "pages/grammar/ba_把.html",
    type: "grammar", category: "grammar",
    title: "把 · the disposal construction",
    pinyin: "bǎ",
    desc: "Moving the object before the verb — when and why.",
    tags: ["syntax", "object", "disposal"],
    status: "complete"
  },
  {
    path: "pages/grammar/bei_被.html",
    type: "grammar", category: "grammar",
    title: "被 · the passive",
    pinyin: "bèi",
    desc: "Agentive passive, unmarked passive, and the adversarial connotation.",
    tags: ["passive", "syntax", "agent"],
    status: "complete"
  },
  {
    path: "pages/grammar/shide_是的.html",
    type: "grammar", category: "grammar",
    title: "是…的 · the cleft construction",
    pinyin: "shì…de",
    desc: "Focus and past-detail marking — the construction that trips every learner.",
    tags: ["focus", "cleft", "past"],
    status: "complete"
  },
  {
    path: "pages/grammar/jiu_cai_就才.html",
    type: "grammar", category: "grammar",
    title: "就 vs. 才 · sooner vs. later",
    pinyin: "jiù / cái",
    desc: "The timing and emphasis pair — speaker attitude encoded in one syllable.",
    tags: ["adverb", "timing", "emphasis"],
    status: "complete"
  },
  {
    path: "pages/grammar/de_的得地.html",
    type: "grammar", category: "grammar",
    title: "的 · 得 · 地 · the three de's",
    pinyin: "de / dé / dì",
    desc: "Attribution, result complement, and adverbial marker — distinguished once and for all.",
    tags: ["particle", "complement", "adverb"],
    status: "complete"
  },
  {
    path: "pages/grammar/liangci_量词.html",
    type: "grammar", category: "grammar",
    title: "量词 · measure words",
    pinyin: "liàngcí",
    desc: "个, 只, 条, 本, 张 — the classifier taxonomy and the logic behind it.",
    tags: ["measure-words", "classifiers", "nouns"],
    status: "complete"
  },
  {
    path: "pages/grammar/hui_neng_keyi_会能可以.html",
    type: "grammar", category: "grammar",
    title: "会 · 能 · 可以 · the three 'can's",
    pinyin: "huì / néng / kěyǐ",
    desc: "Learned ability vs. situational capacity vs. permission — not interchangeable.",
    tags: ["modal", "ability", "permission"],
    status: "complete"
  },
  {
    path: "pages/grammar/directional_来去.html",
    type: "grammar", category: "grammar",
    title: "来 · 去 · directional complements",
    pinyin: "lái / qù",
    desc: "上来, 下去, 出去, 进来 — the motion complement system mapped.",
    tags: ["direction", "complement", "motion"],
    status: "complete"
  },
  {
    path: "pages/grammar/lian_dou_连都.html",
    type: "grammar", category: "grammar",
    title: "连…都/也 · even X",
    pinyin: "lián…dōu/yě",
    desc: "The intensifier construction — raising the stakes of a claim.",
    tags: ["intensifier", "even", "emphasis"],
    status: "complete"
  },

  /* ── RELIGION ──────────────────────────────────────────────────────── */
  {
    path: "pages/religion/topic_rujia.html",
    type: "topic", category: "religion",
    title: "儒家 · Confucianism",
    pinyin: "rújiā",
    desc: "The school of the ru — ritual, hierarchy, and moral cultivation as state religion.",
    tags: ["confucianism", "ritual", "ethics"],
    status: "complete"
  },
  {
    path: "pages/religion/topic_daojiao.html",
    type: "topic", category: "religion",
    title: "道教 · Daoism",
    pinyin: "dàojiào",
    desc: "Daoism as organized religion — distinct from Daoist philosophy.",
    tags: ["daoism", "religion", "immortality"],
    status: "complete"
  },
  {
    path: "pages/religion/topic_fojiao.html",
    type: "topic", category: "religion",
    title: "佛教 · Buddhism in China",
    pinyin: "fójiào",
    desc: "Two thousand years of transmission, transformation, and sinicization.",
    tags: ["buddhism", "transmission", "history"],
    status: "complete"
  },
  {
    path: "pages/religion/topic_chan.html",
    type: "topic", category: "religion",
    title: "禅宗 · Chán Buddhism",
    pinyin: "chán zōng",
    desc: "The meditative school that became Japanese Zen — sudden enlightenment and the patriarchs.",
    tags: ["chan", "zen", "meditation"],
    status: "complete"
  },
  {
    path: "pages/religion/topic_jingtu.html",
    type: "topic", category: "religion",
    title: "净土宗 · Pure Land",
    pinyin: "jìngtǔ zōng",
    desc: "The most widely practiced Buddhism in China — faith, Amitabha, and the Western Paradise.",
    tags: ["pure-land", "amitabha", "faith"],
    status: "complete"
  },
  {
    path: "pages/religion/topic_minjian.html",
    type: "topic", category: "religion",
    title: "民间信仰 · Folk Religion",
    pinyin: "mínjiān xìnyǎng",
    desc: "Kitchen gods, city gods, and the living popular religion beneath Buddhism and Daoism.",
    tags: ["folk-religion", "gods", "popular"],
    status: "complete"
  },
  {
    path: "pages/religion/topic_zuxian.html",
    type: "topic", category: "religion",
    title: "祖先崇拜 · Ancestor Veneration",
    pinyin: "zǔxiān chóngbài",
    desc: "The deep continuity — tablets, offerings, and the living debt to the dead.",
    tags: ["ancestors", "ritual", "family"],
    status: "complete"
  },
  {
    path: "pages/religion/topic_mazu.html",
    type: "topic", category: "religion",
    title: "妈祖 · the Sea Goddess",
    pinyin: "māzǔ",
    desc: "Coastal goddess of sailors, fishermen, and the overseas Chinese diaspora.",
    tags: ["mazu", "goddess", "coast"],
    status: "complete"
  },
  {
    path: "pages/religion/topic_yisilan.html",
    type: "topic", category: "religion",
    title: "伊斯兰教 · Islam in China",
    pinyin: "yīsīlán jiào",
    desc: "Hui Muslims, Uyghur traditions, and 1400 years of Islamic presence.",
    tags: ["islam", "hui", "uyghur"],
    status: "complete"
  },
  {
    path: "pages/religion/topic_saman.html",
    type: "topic", category: "religion",
    title: "萨满教 · Shamanism",
    pinyin: "sàmǎn jiào",
    desc: "Manchu, Mongol, and northern indigenous shamanic traditions.",
    tags: ["shamanism", "manchu", "indigenous"],
    status: "complete"
  },

  /* ── PHILOSOPHY ────────────────────────────────────────────────────── */
  {
    path: "pages/philosophy/topic_kongzi.html",
    type: "topic", category: "philosophy",
    title: "孔子 · Confucius",
    pinyin: "kǒngzǐ",
    desc: "His life, the Analects 论语, and the civilization he shaped.",
    tags: ["confucius", "analects", "ethics"],
    status: "complete"
  },
  {
    path: "pages/philosophy/topic_laozi.html",
    type: "topic", category: "philosophy",
    title: "老子 · Laozi & the Daodejing",
    pinyin: "lǎozǐ",
    desc: "The 81 chapters, wu wei 无为, and the paradox at the heart of Daoist thought.",
    tags: ["laozi", "daodejing", "wuwei"],
    status: "complete"
  },
  {
    path: "pages/philosophy/topic_zhuangzi.html",
    type: "topic", category: "philosophy",
    title: "庄子 · Zhuangzi",
    pinyin: "zhuāngzǐ",
    desc: "The butterfly dream, Cook Ding, and Daoist freedom from convention.",
    tags: ["zhuangzi", "freedom", "daoist"],
    status: "complete"
  },
  {
    path: "pages/philosophy/topic_mengzi.html",
    type: "topic", category: "philosophy",
    title: "孟子 · Mencius",
    pinyin: "mèngzǐ",
    desc: "Human nature as inherently good — the sprouts of virtue.",
    tags: ["mencius", "human-nature", "virtue"],
    status: "complete"
  },
  {
    path: "pages/philosophy/topic_xunzi.html",
    type: "topic", category: "philosophy",
    title: "荀子 · Xunzi",
    pinyin: "xúnzǐ",
    desc: "Human nature as bad — ritual and education as correction.",
    tags: ["xunzi", "ritual", "human-nature"],
    status: "complete"
  },
  {
    path: "pages/philosophy/topic_mojia.html",
    type: "topic", category: "philosophy",
    title: "墨家 · Mohism",
    pinyin: "mòjiā",
    desc: "Universal love, anti-war, and the utilitarian logic China nearly chose.",
    tags: ["mohism", "universal-love", "logic"],
    status: "complete"
  },
  {
    path: "pages/philosophy/topic_fajia.html",
    type: "topic", category: "philosophy",
    title: "法家 · Legalism",
    pinyin: "fǎjiā",
    desc: "Han Feizi, statecraft, and the realpolitik that unified China.",
    tags: ["legalism", "statecraft", "power"],
    status: "complete"
  },
  {
    path: "pages/philosophy/topic_yinyang_wuxing.html",
    type: "topic", category: "philosophy",
    title: "阴阳五行 · Yin-Yang and the Five Phases",
    pinyin: "yīnyáng wǔxíng",
    desc: "The cosmological engine of classical thought — correspondence, resonance, and transformation.",
    tags: ["yin-yang", "five-phases", "cosmology"],
    status: "complete"
  },
  {
    path: "pages/philosophy/topic_lixue.html",
    type: "topic", category: "philosophy",
    title: "理学 · Neo-Confucianism",
    pinyin: "lǐxué",
    desc: "Zhu Xi, the Great Ultimate 太极, and the Song-Ming synthesis.",
    tags: ["neo-confucianism", "zhuxi", "principle"],
    status: "complete"
  },
  {
    path: "pages/philosophy/topic_xinxue.html",
    type: "topic", category: "philosophy",
    title: "心学 · Wang Yangming",
    pinyin: "xīnxué",
    desc: "Innate knowing 良知 and the unity of knowledge and action.",
    tags: ["wang-yangming", "mind", "knowing"],
    status: "complete"
  },

  /* ── HISTORY ───────────────────────────────────────────────────────── */
  {
    path: "pages/history/topic_xia_shang_zhou.html",
    type: "topic", category: "history",
    title: "夏商周 · The Three Dynasties",
    pinyin: "xià shāng zhōu",
    desc: "The legendary and early historical origins of Chinese civilization.",
    tags: ["ancient", "bronze-age", "origins"],
    status: "stub"
  },
  {
    path: "pages/history/topic_qin_shihuang.html",
    type: "topic", category: "history",
    title: "秦始皇 · The First Emperor",
    pinyin: "qín shǐhuáng",
    desc: "Unification, standardization, and the terror that made China.",
    tags: ["qin", "unification", "first-emperor"],
    status: "stub"
  },
  {
    path: "pages/history/topic_hanchao.html",
    type: "topic", category: "history",
    title: "汉朝 · The Han Dynasty",
    pinyin: "hàncháo",
    desc: "Why Chinese call themselves 汉人 — the dynasty that defined the civilization.",
    tags: ["han", "dynasty", "identity"],
    status: "stub"
  },
  {
    path: "pages/history/topic_tangchao.html",
    type: "topic", category: "history",
    title: "唐朝 · The Tang Dynasty",
    pinyin: "tángcháo",
    desc: "The cosmopolitan golden age — poetry, Buddhism, and the Silk Road.",
    tags: ["tang", "golden-age", "cosmopolitan"],
    status: "stub"
  },
  {
    path: "pages/history/topic_songchao.html",
    type: "topic", category: "history",
    title: "宋朝 · The Song Dynasty",
    pinyin: "sòngcháo",
    desc: "Economic revolution, printing, compass — the dynasty modernity missed.",
    tags: ["song", "economy", "innovation"],
    status: "stub"
  },
  {
    path: "pages/history/topic_yuanchao.html",
    type: "topic", category: "history",
    title: "元朝 · The Yuan Dynasty",
    pinyin: "yuáncháo",
    desc: "Kublai Khan, Mongol rule, and China as the center of a world empire.",
    tags: ["yuan", "mongol", "kublai"],
    status: "stub"
  },
  {
    path: "pages/history/topic_mingchao.html",
    type: "topic", category: "history",
    title: "明朝 · The Ming Dynasty",
    pinyin: "míngcháo",
    desc: "The Great Wall rebuilt, Zheng He's voyages, and the inward turn.",
    tags: ["ming", "great-wall", "zhenghe"],
    status: "stub"
  },
  {
    path: "pages/history/topic_qingchao.html",
    type: "topic", category: "history",
    title: "清朝 · The Qing Dynasty",
    pinyin: "qīngcháo",
    desc: "Manchu rule, the long peace, and the slow unraveling before 1911.",
    tags: ["qing", "manchu", "decline"],
    status: "stub"
  },
  {
    path: "pages/history/topic_xinhai.html",
    type: "topic", category: "history",
    title: "辛亥革命 · The 1911 Revolution",
    pinyin: "xīnhài gémìng",
    desc: "The end of empire, Sun Yat-sen, and the birth of the Republic.",
    tags: ["1911", "republic", "sun-yatsen"],
    status: "stub"
  },
  {
    path: "pages/history/topic_wenge.html",
    type: "topic", category: "history",
    title: "文化大革命 · The Cultural Revolution",
    pinyin: "wénhuà dà gémìng",
    desc: "1966–76: Red Guards, struggle sessions, and the destruction of the past.",
    tags: ["cultural-revolution", "mao", "1966"],
    status: "stub"
  },

  /* ── GEOGRAPHY ─────────────────────────────────────────────────────── */
  {
    path: "pages/geography/topic_huanghe.html",
    type: "topic", category: "geography",
    title: "黄河 · The Yellow River",
    pinyin: "huánghé",
    desc: "The mother river — cradle of civilization, flood, and the northern heartland.",
    tags: ["river", "north", "civilization"],
    status: "stub"
  },
  {
    path: "pages/geography/topic_changjiang.html",
    type: "topic", category: "geography",
    title: "长江 · The Yangtze",
    pinyin: "chángjiāng",
    desc: "The great divide between north and south — rice, tea, and the gorges.",
    tags: ["river", "south", "divide"],
    status: "stub"
  },
  {
    path: "pages/geography/topic_beijing.html",
    type: "topic", category: "geography",
    title: "北京 · Beijing",
    pinyin: "běijīng",
    desc: "Capital geography — the hutong grid, the Forbidden City, and the northern axis.",
    tags: ["beijing", "capital", "north"],
    status: "stub"
  },
  {
    path: "pages/geography/topic_shanghai.html",
    type: "topic", category: "geography",
    title: "上海 · Shanghai",
    pinyin: "shànghǎi",
    desc: "The estuary metropolis — treaty port, modernity, and the Yangtze delta.",
    tags: ["shanghai", "coast", "modern"],
    status: "stub"
  },
  {
    path: "pages/geography/topic_xizang.html",
    type: "topic", category: "geography",
    title: "西藏 · Tibet",
    pinyin: "xīzàng",
    desc: "The high plateau — Lhasa, Tibetan Buddhism, and the roof of the world.",
    tags: ["tibet", "plateau", "buddhism"],
    status: "stub"
  },
  {
    path: "pages/geography/topic_xinjiang.html",
    type: "topic", category: "geography",
    title: "新疆 · Xinjiang",
    pinyin: "xīnjiāng",
    desc: "The Silk Road west — Uyghur culture, desert, and the ancient oasis cities.",
    tags: ["xinjiang", "uyghur", "silk-road"],
    status: "stub"
  },
  {
    path: "pages/geography/topic_xianggang.html",
    type: "topic", category: "geography",
    title: "香港 · Hong Kong",
    pinyin: "xiānggǎng",
    desc: "The treaty port city — Cantonese culture, harbor, and the handover.",
    tags: ["hong-kong", "cantonese", "coast"],
    status: "stub"
  },
  {
    path: "pages/geography/topic_taiwan.html",
    type: "topic", category: "geography",
    title: "台湾 · Taiwan",
    pinyin: "táiwān",
    desc: "The island — Aboriginal peoples, Min Nan culture, and the complex crossing.",
    tags: ["taiwan", "island", "culture"],
    status: "stub"
  },
  {
    path: "pages/geography/topic_fangyan.html",
    type: "topic", category: "geography",
    title: "方言 · The Dialect Map",
    pinyin: "fāngyán",
    desc: "Mandarin, Cantonese, Wu, Min, Hakka — the topology of Chinese languages.",
    tags: ["dialects", "cantonese", "min"],
    status: "stub"
  },
  {
    path: "pages/geography/topic_caixi_geography.html",
    type: "topic", category: "geography",
    title: "八大菜系 · Cuisines as Geography",
    pinyin: "bā dà càixì",
    desc: "Eight regional cuisines mapped onto terrain, climate, and history.",
    tags: ["cuisines", "regions", "food-geography"],
    status: "stub"
  },

  /* ── CULTURE ───────────────────────────────────────────────────────── */
  {
    path: "pages/culture/topic_chunjie.html",
    type: "topic", category: "culture",
    title: "春节 · Spring Festival",
    pinyin: "chūnjié",
    desc: "Lunar New Year — the world's largest annual human migration.",
    tags: ["new-year", "festival", "lunar"],
    status: "stub"
  },
  {
    path: "pages/culture/topic_zhongqiu.html",
    type: "topic", category: "culture",
    title: "中秋节 · Mid-Autumn Festival",
    pinyin: "zhōngqiū jié",
    desc: "Moon cakes, the harvest moon, and the mythology of Chang'e.",
    tags: ["mid-autumn", "moon", "festival"],
    status: "stub"
  },
  {
    path: "pages/culture/topic_qingming.html",
    type: "topic", category: "culture",
    title: "清明节 · Tomb-Sweeping Festival",
    pinyin: "qīngmíng jié",
    desc: "Honoring the dead, sweeping graves, and the spring solar term.",
    tags: ["qingming", "ancestors", "spring"],
    status: "stub"
  },
  {
    path: "pages/culture/topic_shufa.html",
    type: "topic", category: "culture",
    title: "书法 · Calligraphy",
    pinyin: "shūfǎ",
    desc: "The highest art — brushwork as moral cultivation and aesthetic practice.",
    tags: ["calligraphy", "art", "brush"],
    status: "stub"
  },
  {
    path: "pages/culture/topic_jingju.html",
    type: "topic", category: "culture",
    title: "京剧 · Peking Opera",
    pinyin: "jīngjù",
    desc: "Roles, painted faces, and the conventions of China's classical theater.",
    tags: ["opera", "theater", "art"],
    status: "stub"
  },
  {
    path: "pages/culture/topic_taiji.html",
    type: "topic", category: "culture",
    title: "太极 · Tai Chi",
    pinyin: "tàijí",
    desc: "Moving philosophy — internal martial art, health practice, and cosmology in motion.",
    tags: ["taichi", "martial-arts", "health"],
    status: "stub"
  },
  {
    path: "pages/culture/topic_hanfu.html",
    type: "topic", category: "culture",
    title: "汉服 · Traditional Dress",
    pinyin: "hànfú",
    desc: "The revival of Han dynasty clothing — identity, aesthetics, and the hanfu movement.",
    tags: ["clothing", "identity", "revival"],
    status: "stub"
  },
  {
    path: "pages/culture/topic_cha_wenhua.html",
    type: "topic", category: "culture",
    title: "茶文化 · Tea Culture",
    pinyin: "chá wénhuà",
    desc: "Tea as social practice — gongfu tea ceremony, teahouse culture, and hospitality.",
    tags: ["tea", "ceremony", "social"],
    status: "stub"
  },
  {
    path: "pages/culture/topic_hongbao.html",
    type: "topic", category: "culture",
    title: "红包 · Red Envelopes",
    pinyin: "hóngbāo",
    desc: "The grammar of money-gifts — amounts, occasions, and the digital red envelope.",
    tags: ["gifts", "money", "social"],
    status: "stub"
  },
  {
    path: "pages/culture/topic_shengxiao.html",
    type: "topic", category: "culture",
    title: "生肖 · The Twelve Zodiac Animals",
    pinyin: "shēngxiào",
    desc: "Rat to Pig — the twelve-year cycle, character associations, and compatibility.",
    tags: ["zodiac", "animals", "fortune"],
    status: "stub"
  },

  /* ── CULINARY ──────────────────────────────────────────────────────── */
  {
    path: "pages/culinary/topic_cha.html",
    type: "topic", category: "culinary",
    title: "茶 · Tea",
    pinyin: "chá",
    desc: "Six tea categories, production, and the cup that connects China to the world.",
    tags: ["tea", "green", "oolong"],
    status: "stub"
  },
  {
    path: "pages/culinary/topic_caixi.html",
    type: "topic", category: "culinary",
    title: "八大菜系 · The Eight Great Cuisines",
    pinyin: "bā dà càixì",
    desc: "Shandong to Cantonese — the regional culinary traditions and their logic.",
    tags: ["cuisines", "regional", "overview"],
    status: "stub"
  },
  {
    path: "pages/culinary/topic_chuancai.html",
    type: "topic", category: "culinary",
    title: "川菜 · Sichuan Cuisine",
    pinyin: "chuāncài",
    desc: "麻辣 numbing-spicy, Sichuan peppercorn, and the boldest flavor profile in China.",
    tags: ["sichuan", "spicy", "mala"],
    status: "stub"
  },
  {
    path: "pages/culinary/topic_yuecai.html",
    type: "topic", category: "culinary",
    title: "粤菜 · Cantonese Cuisine",
    pinyin: "yuècài",
    desc: "Dim sum 点心, fresh ingredients, and the cuisine that introduced Chinese food to the world.",
    tags: ["cantonese", "dim-sum", "guangdong"],
    status: "stub"
  },
  {
    path: "pages/culinary/topic_lucai.html",
    type: "topic", category: "culinary",
    title: "鲁菜 · Shandong Cuisine",
    pinyin: "lǔcài",
    desc: "The imperial foundation cuisine — braising, soy, and the flavor of the north.",
    tags: ["shandong", "imperial", "north"],
    status: "stub"
  },
  {
    path: "pages/culinary/topic_miantiao.html",
    type: "topic", category: "culinary",
    title: "面条 · Noodles",
    pinyin: "miàntiáo",
    desc: "The noodle map — from Lanzhou pulled to Cantonese wonton to knife-cut.",
    tags: ["noodles", "wheat", "north"],
    status: "stub"
  },
  {
    path: "pages/culinary/topic_jiaozi.html",
    type: "topic", category: "culinary",
    title: "饺子 · Dumplings",
    pinyin: "jiǎozi",
    desc: "Wrappers, fillings, and the regional variations from boiled to pan-fried.",
    tags: ["dumplings", "north", "new-year"],
    status: "stub"
  },
  {
    path: "pages/culinary/topic_huoguo.html",
    type: "topic", category: "culinary",
    title: "火锅 · Hotpot",
    pinyin: "huǒguō",
    desc: "Communal cooking, Chongqing broth, and the social ritual of the shared pot.",
    tags: ["hotpot", "communal", "sichuan"],
    status: "stub"
  },
  {
    path: "pages/culinary/topic_doufu.html",
    type: "topic", category: "culinary",
    title: "豆腐 · Tofu",
    pinyin: "dòufu",
    desc: "From Han invention to ubiquity — mapo tofu, silken, firm, and everything between.",
    tags: ["tofu", "soy", "protein"],
    status: "stub"
  },
  {
    path: "pages/culinary/topic_baijiu.html",
    type: "topic", category: "culinary",
    title: "白酒 · Baijiu",
    pinyin: "báijiǔ",
    desc: "The world's most-consumed spirit — sorghum, aroma types, and the banquet ritual.",
    tags: ["baijiu", "alcohol", "banquet"],
    status: "stub"
  },

  /* ── ARTS & LITERATURE ─────────────────────────────────────────────── */
  {
    path: "pages/arts/topic_shijing.html",
    type: "topic", category: "arts",
    title: "诗经 · Book of Songs",
    pinyin: "shījīng",
    desc: "The oldest anthology in the world — 305 poems from the Zhou dynasty.",
    tags: ["poetry", "ancient", "zhou"],
    status: "stub"
  },
  {
    path: "pages/arts/topic_chuci.html",
    type: "topic", category: "arts",
    title: "楚辞 · Songs of Chu",
    pinyin: "chǔcí",
    desc: "Qu Yuan, the dragon boat, and the shamanic southern poetic tradition.",
    tags: ["poetry", "southern", "qu-yuan"],
    status: "stub"
  },
  {
    path: "pages/arts/topic_tangshi.html",
    type: "topic", category: "arts",
    title: "唐诗 · Tang Poetry",
    pinyin: "tángshī",
    desc: "Li Bai, Du Fu, and the golden age of regulated verse.",
    tags: ["poetry", "tang", "li-bai"],
    status: "stub"
  },
  {
    path: "pages/arts/topic_songci.html",
    type: "topic", category: "arts",
    title: "宋词 · Song Lyric",
    pinyin: "sòngcí",
    desc: "The ci 词 form — music, meter, and the bittersweet mood of the Song.",
    tags: ["ci", "song", "lyric"],
    status: "stub"
  },
  {
    path: "pages/arts/topic_sidaimingzhu.html",
    type: "topic", category: "arts",
    title: "四大名著 · The Four Great Novels",
    pinyin: "sì dà míngzhù",
    desc: "Water Margin, Three Kingdoms, Journey to the West, Dream of the Red Chamber.",
    tags: ["novels", "classical", "fiction"],
    status: "stub"
  },
  {
    path: "pages/arts/topic_shuimohua.html",
    type: "topic", category: "arts",
    title: "水墨画 · Ink-Wash Painting",
    pinyin: "shuǐmòhuà",
    desc: "Brush, ink, and void — the aesthetics of Chinese landscape painting.",
    tags: ["painting", "ink", "landscape"],
    status: "stub"
  },
  {
    path: "pages/arts/topic_wenfangsibao.html",
    type: "topic", category: "arts",
    title: "文房四宝 · Four Treasures of the Study",
    pinyin: "wénfáng sìbǎo",
    desc: "Brush, ink, paper, inkstone — the scholar's tools as cultural objects.",
    tags: ["scholar", "brush", "tools"],
    status: "stub"
  },
  {
    path: "pages/arts/topic_zhuanke.html",
    type: "topic", category: "arts",
    title: "篆刻 · Seal Carving",
    pinyin: "zhuànkè",
    desc: "The red square — seal script, name seals, and the art of the impression.",
    tags: ["seal", "carving", "script"],
    status: "stub"
  },
  {
    path: "pages/arts/topic_kunqu.html",
    type: "topic", category: "arts",
    title: "昆曲 · Kun Opera",
    pinyin: "kūnqǔ",
    desc: "The oldest surviving Chinese opera — slower, more refined, the ancestor of Peking Opera.",
    tags: ["opera", "kun", "theater"],
    status: "stub"
  },
  {
    path: "pages/arts/topic_luxun.html",
    type: "topic", category: "arts",
    title: "鲁迅 · Lu Xun",
    pinyin: "lǔ xùn",
    desc: "The founding father of modern Chinese literature — Ah Q, A Madman's Diary.",
    tags: ["literature", "modern", "lu-xun"],
    status: "stub"
  },

  /* ── SCIENCE & MEDICINE ────────────────────────────────────────────── */
  {
    path: "pages/science/topic_zhongyi.html",
    type: "topic", category: "science",
    title: "中医 · Traditional Chinese Medicine",
    pinyin: "zhōngyī",
    desc: "Qi, meridians, yin-yang diagnosis, and the classical medical system.",
    tags: ["tcm", "medicine", "qi"],
    status: "stub"
  },
  {
    path: "pages/science/topic_zhenjiu.html",
    type: "topic", category: "science",
    title: "针灸 · Acupuncture & Moxibustion",
    pinyin: "zhēnjiǔ",
    desc: "Needles, meridians, and the therapeutic system rooted in qi theory.",
    tags: ["acupuncture", "meridians", "tcm"],
    status: "stub"
  },
  {
    path: "pages/science/topic_bencao.html",
    type: "topic", category: "science",
    title: "本草纲目 · The Great Pharmacopeia",
    pinyin: "běncǎo gāngmù",
    desc: "Li Shizhen's 1578 masterwork — 1,892 drugs catalogued in 52 volumes.",
    tags: ["pharmacopeia", "li-shizhen", "medicine"],
    status: "stub"
  },
  {
    path: "pages/science/topic_sidafaming.html",
    type: "topic", category: "science",
    title: "四大发明 · The Four Great Inventions",
    pinyin: "sì dà fāmíng",
    desc: "Compass, gunpowder, paper, printing — the technologies that changed the world.",
    tags: ["inventions", "compass", "printing"],
    status: "stub"
  },
  {
    path: "pages/science/topic_suanpan.html",
    type: "topic", category: "science",
    title: "算盘 · The Abacus",
    pinyin: "suànpán",
    desc: "Chinese mathematics — the abacus, rod numerals, and early algebra.",
    tags: ["mathematics", "abacus", "computation"],
    status: "stub"
  },
  {
    path: "pages/science/topic_lifa.html",
    type: "topic", category: "science",
    title: "历法 · The Lunisolar Calendar",
    pinyin: "lìfǎ",
    desc: "How the Chinese calendar works — lunar months, intercalation, and solar terms.",
    tags: ["calendar", "lunar", "solar-terms"],
    status: "stub"
  },
  {
    path: "pages/science/topic_jieqi.html",
    type: "topic", category: "science",
    title: "二十四节气 · The 24 Solar Terms",
    pinyin: "èrshísì jiéqì",
    desc: "From 立春 to 大寒 — the agricultural and cosmological calendar.",
    tags: ["solar-terms", "agriculture", "calendar"],
    status: "stub"
  },
  {
    path: "pages/science/topic_fengshui_science.html",
    type: "topic", category: "science",
    title: "风水 · Geomancy as Proto-Science",
    pinyin: "fēngshuǐ",
    desc: "The systematic theory of qi flow in landscape — between cosmology and empiricism.",
    tags: ["fengshui", "geomancy", "qi"],
    status: "stub"
  },
  {
    path: "pages/science/topic_xingxiu.html",
    type: "topic", category: "science",
    title: "星宿 · Chinese Constellations",
    pinyin: "xīngxiù",
    desc: "The 28 lunar mansions and the Chinese sky — different names, different stories.",
    tags: ["astronomy", "constellations", "sky"],
    status: "stub"
  },
  {
    path: "pages/science/topic_sichou.html",
    type: "topic", category: "science",
    title: "丝绸 · Silk",
    pinyin: "sīchóu",
    desc: "The technology that named the road — sericulture, weaving, and global trade.",
    tags: ["silk", "technology", "trade"],
    status: "stub"
  },

  /* ── EVERYDAY LIFE & CUSTOMS ───────────────────────────────────────── */
  {
    path: "pages/daily/topic_hongbai.html",
    type: "topic", category: "daily",
    title: "红白喜事 · Weddings & Funerals",
    pinyin: "hóngbái xǐshì",
    desc: "Red events and white events — the ritual grammar of life's two great passages.",
    tags: ["weddings", "funerals", "ritual"],
    status: "stub"
  },
  {
    path: "pages/daily/topic_songli.html",
    type: "topic", category: "daily",
    title: "送礼 · Gift-Giving",
    pinyin: "sònglǐ",
    desc: "Taboos, pairings, and the social logic of giving and receiving.",
    tags: ["gifts", "etiquette", "taboos"],
    status: "stub"
  },
  {
    path: "pages/daily/topic_qingke.html",
    type: "topic", category: "daily",
    title: "请客吃饭 · Treating to a Meal",
    pinyin: "qǐngkè chīfàn",
    desc: "Who pays, how to refuse, and the ritual of hosting at the Chinese table.",
    tags: ["dining", "hosting", "etiquette"],
    status: "stub"
  },
  {
    path: "pages/daily/topic_chenghu.html",
    type: "topic", category: "daily",
    title: "称呼 · Forms of Address",
    pinyin: "chēnghū",
    desc: "Family kinship terms, titles, and the grammar of social hierarchy in address.",
    tags: ["address", "family", "hierarchy"],
    status: "stub"
  },
  {
    path: "pages/daily/topic_xingming.html",
    type: "topic", category: "daily",
    title: "姓名 · Names & Surnames",
    pinyin: "xìngmíng",
    desc: "The hundred family names, name order, meaning, and how Chinese names work.",
    tags: ["names", "surnames", "identity"],
    status: "stub"
  },
  {
    path: "pages/daily/topic_shuzi.html",
    type: "topic", category: "daily",
    title: "数字 · Lucky & Unlucky Numbers",
    pinyin: "shùzì",
    desc: "Eight is great, four is death — the phonetic logic of Chinese numerology.",
    tags: ["numbers", "luck", "phonetics"],
    status: "stub"
  },
  {
    path: "pages/daily/topic_yanse.html",
    type: "topic", category: "daily",
    title: "颜色 · Color Symbolism",
    pinyin: "yánsè",
    desc: "Red for luck, white for death, yellow for emperors — color as cultural code.",
    tags: ["color", "symbolism", "culture"],
    status: "stub"
  },
  {
    path: "pages/daily/topic_jingjiu.html",
    type: "topic", category: "daily",
    title: "敬酒 · Toasting Culture",
    pinyin: "jìngjiǔ",
    desc: "Ganbei, the order of toasting, and the ritual of the Chinese banquet table.",
    tags: ["toasting", "banquet", "alcohol"],
    status: "stub"
  },
  {
    path: "pages/daily/topic_mixin.html",
    type: "topic", category: "daily",
    title: "迷信 · Superstitions",
    pinyin: "míxìn",
    desc: "Daily taboos — don't gift clocks, avoid the number four, watch the broom.",
    tags: ["superstition", "taboo", "daily"],
    status: "stub"
  },
  {
    path: "pages/daily/topic_kuaizi.html",
    type: "topic", category: "daily",
    title: "筷子礼仪 · Chopstick Etiquette",
    pinyin: "kuàizi lǐyí",
    desc: "What not to do — the rules that mark insider from outsider at the table.",
    tags: ["chopsticks", "etiquette", "dining"],
    status: "stub"
  }

];
