/**
 * export-slices.mjs — slice the corpus along multiple dimensions for
 * targeted Anki / Pleco decks.
 *
 * Dimensions:
 *   - type: characters / vocab / chengyu / grammar
 *   - hsk:  1..6 (authored when present; inferred from constituent hanzi
 *           when absent — max(HSK of each unique hanzi the entry contains)
 *           with `inferred: true` flagged so reviewers can audit).
 *   - topic: religion / philosophy / history / geography / culture /
 *           daily / culinary / arts / science (folder category).
 *   - tag:   semantic chip (emotion, time, family, food, …) — only tags
 *           that hit a usefulness floor become slices, to avoid
 *           hundred-deck fragmentation.
 *   - intent: hand-curated learning goals (Survival Mandarin, Buddhist
 *           Reader, Ordering Food, …) defined as predicate functions
 *           against (card, charHskMap).
 *
 * The caller (build-exports.mjs) provides extracted cards already
 * normalized with hanzi/pinyin/english/desc/hsk/tags/category. We stay
 * pure: no I/O here, no formatter coupling. Returns a list of slices
 * [{slug, name, dimension, criterion, description?, cards, intent?}].
 */

// Minimum cards a tag must have to graduate into a real slice. Tags with
// fewer than this end up only in the global combined deck. 5 keeps the
// slice list tight; bump if you want more granular tag decks.
const TAG_FLOOR = 5;

// Topics surfaced as standalone slices. Keyed by category folder.
const TOPIC_LABELS = {
  religion:    { cn: '宗教', py: 'zōngjiào',   en: 'Religion' },
  philosophy:  { cn: '哲学', py: 'zhéxué',     en: 'Philosophy' },
  history:     { cn: '历史', py: 'lìshǐ',      en: 'History' },
  geography:   { cn: '地理', py: 'dìlǐ',       en: 'Geography' },
  culture:     { cn: '文化', py: 'wénhuà',     en: 'Culture' },
  daily:       { cn: '日常', py: 'rìcháng',    en: 'Daily life' },
  culinary:    { cn: '饮食', py: 'yǐnshí',     en: 'Food & drink' },
  arts:        { cn: '艺术', py: 'yìshù',      en: 'Arts' },
  science:     { cn: '科学', py: 'kēxué',      en: 'Science' },
};

// Tag whitelist — only these graduate to a slice when they hit TAG_FLOOR.
// Keeps the surfaced list focused on tags a learner would actually search
// for. Other tags still appear in the combined deck and the manifest's
// per-card metadata — they just don't get their own slice.
const TAG_LABELS = {
  emotion:     { cn: '情感',     en: 'Emotion' },
  time:        { cn: '时间',     en: 'Time' },
  family:      { cn: '家',       en: 'Family' },
  food:        { cn: '食物',     en: 'Food' },
  body:        { cn: '身体',     en: 'Body' },
  color:       { cn: '颜色',     en: 'Color' },
  direction:   { cn: '方向',     en: 'Direction' },
  motion:      { cn: '动作',     en: 'Motion' },
  measure:     { cn: '量词',     en: 'Measure words' },
  'measure-words': { cn: '量词', en: 'Measure words' },
  classifiers: { cn: '量词',     en: 'Classifiers' },
  modal:       { cn: '情态',     en: 'Modals' },
  particle:    { cn: '语助词',   en: 'Particles' },
  particles:   { cn: '语助词',   en: 'Particles' },
  negation:    { cn: '否定',     en: 'Negation' },
  comparison:  { cn: '比较',     en: 'Comparison' },
  aspect:      { cn: '体貌',     en: 'Aspect' },
  tense:       { cn: '时态',     en: 'Tense' },
  buddhism:    { cn: '佛教',     en: 'Buddhism' },
  daoism:      { cn: '道教',     en: 'Daoism' },
  confucianism:{ cn: '儒家',     en: 'Confucianism' },
  tea:         { cn: '茶',       en: 'Tea' },
  poetry:      { cn: '诗',       en: 'Poetry' },
  classical:   { cn: '古典',     en: 'Classical' },
  daily:       { cn: '日常',     en: 'Daily life' },
  numbers:     { cn: '数字',     en: 'Numbers' },
  business:    { cn: '生意',     en: 'Business' },
  commerce:    { cn: '商业',     en: 'Commerce' },
  technology:  { cn: '科技',     en: 'Technology' },
  science:     { cn: '科学',     en: 'Science' },
  mathematics: { cn: '数学',     en: 'Mathematics' },
  engineering: { cn: '工程',     en: 'Engineering' },
  physics:     { cn: '物理',     en: 'Physics' },
  chemistry:   { cn: '化学',     en: 'Chemistry' },
  astronomy:   { cn: '天文',     en: 'Astronomy' },
  biology:     { cn: '生物',     en: 'Biology' },
  health:      { cn: '健康',     en: 'Health' },
  medicine:    { cn: '医',       en: 'Medicine' },
  weather:     { cn: '天气',     en: 'Weather' },
  learning:    { cn: '学习',     en: 'Learning & school' },
  social:      { cn: '社交',     en: 'Social' },
};

// ────────────────────── HSK inference ──────────────────────

/**
 * Normalize an HSK field to a single integer level (or null).
 * - Scalar 1..6 → that integer.
 * - {from, to} range → the `to` value (the level the entry reaches up to —
 *   matches what a learner working up the ladder would expect).
 * - Anything else → null.
 */
export function normalizeHsk(hsk) {
  if (hsk == null) return null;
  if (typeof hsk === 'number' && hsk >= 1 && hsk <= 6) return hsk;
  if (typeof hsk === 'string') {
    const n = parseInt(hsk, 10);
    return Number.isFinite(n) && n >= 1 && n <= 6 ? n : null;
  }
  if (typeof hsk === 'object' && typeof hsk.to === 'number') return hsk.to;
  return null;
}

/**
 * Build a map {hanzi → HSK level} from character-type entries. Used to
 * infer HSK for vocab/chengyu/grammar entries that don't carry their own.
 */
export function buildCharHskMap(allEntries) {
  const map = new Map();
  for (const e of allEntries) {
    if (e.type !== 'character' || !e.char) continue;
    const lvl = normalizeHsk(e.hsk);
    if (lvl != null) map.set(e.char, lvl);
  }
  return map;
}

/**
 * Resolve a card's effective HSK level. Returns {level, inferred} where
 * level is 1..6 or null, and `inferred` is true when we computed it from
 * constituent hanzi rather than reading an authored value.
 *
 * Inference rule: max(HSK of each hanzi in the card's CN form). The most
 * advanced character determines the level the learner needs to know first.
 * A vocab made of HSK 1 + HSK 4 hanzi is HSK 4 — you can't read it earlier.
 */
export function resolveHsk(card, charHskMap) {
  const authored = normalizeHsk(card.hsk);
  if (authored != null) return { level: authored, inferred: false };
  if (!card.hanzi) return { level: null, inferred: false };
  let max = null;
  for (const ch of card.hanzi) {
    const lvl = charHskMap.get(ch);
    if (lvl != null && (max == null || lvl > max)) max = lvl;
  }
  return { level: max, inferred: max != null };
}

// ────────────────────── Slice predicates ──────────────────────

// Intent decks. Each entry is { slug, name, description, predicate }.
// Predicate receives ({ card, hsk, hskMap, type }) and returns boolean.
// Keep these focused — a deck only earns a spot if it accelerates a
// concrete learning intent.
const INTENT_DECKS = [
  {
    slug: 'survival-mandarin',
    name: 'Survival Mandarin',
    cn: '生存中文',
    description: 'Everything an absolute beginner needs in week one: HSK 1 vocab, basic characters, foundational grammar (是/不是, 有/没有, 在), question words, numbers.',
    predicate: ({ card, hsk, type }) => {
      if (hsk != null && hsk <= 1) return true;
      // HSK 2 grammar is also survival-tier.
      if (type === 'grammar' && hsk != null && hsk <= 2) return true;
      return false;
    },
  },
  {
    slug: 'buddhist-reader',
    name: 'Buddhist Reader',
    cn: '佛教读本',
    description: 'Vocabulary, characters, and chengyu needed to read a sutra: 空, 色, 般若, 菩萨, 涅槃, plus core Buddhist topic terms.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      return tags.some(t => ['buddhism', 'pure-land', 'chan', 'zen', 'amitabha', 'meditation', 'compassion'].includes(t))
        || (card.category === 'religion' && /佛|空|色|般若|菩萨|涅槃|禅|净土|阿弥陀|观音/.test(card.hanzi || ''));
    },
  },
  {
    slug: 'taoist-classics',
    name: 'Taoist Classics',
    cn: '道家典籍',
    description: 'Read the Daodejing and Zhuangzi: 道, 德, 无为, 阴阳, 五行, plus the topic vocabulary that surrounds them.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      return tags.some(t => ['daoism', 'taoism', 'daoist', 'wuwei', 'wuxing', 'yin-yang', 'daodejing', 'laozi', 'zhuangzi'].includes(t));
    },
  },
  {
    slug: 'confucian-core',
    name: 'Confucian Core',
    cn: '儒家核心',
    description: '仁, 义, 礼, 智, 信 and the rest of the Confucian moral vocabulary, plus terms from the Analects and the Five Classics.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      return tags.some(t => ['confucianism', 'confucius', 'analects', 'mencius', 'xunzi', 'wang-yangming', 'zhuxi', 'neo-confucianism'].includes(t));
    },
  },
  {
    slug: 'ordering-food',
    name: 'Ordering Food',
    cn: '点菜',
    description: 'Get fed: food and drink characters (吃 喝 饭 茶 菜 …), dining verbs (要 想 来), and culinary vocabulary.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      if (tags.some(t => ['food', 'culinary', 'drink', 'tea', 'brewing', 'tisane', 'teaware'].includes(t))) return true;
      if (card.category === 'culinary') return true;
      // Hanzi-content match: cards whose CN contains common food/drink hanzi.
      // Letters one a learner ordering at a restaurant would actually use.
      const foodHanzi = '吃喝饭茶菜米肉水鱼鸡牛羊猪面包饺汤酒咖啡甜辣咸酸苦烧炒煮蒸炸';
      if (card.hanzi) {
        for (const ch of card.hanzi) if (foodHanzi.includes(ch)) return true;
      }
      return false;
    },
  },
  {
    slug: 'travel-directions',
    name: 'Travel & Directions',
    cn: '旅行方向',
    description: 'Place words, geography terms, direction vocabulary (东南西北 上下左右), and the grammar of asking how to get somewhere.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      if (tags.some(t => ['direction', 'directions', 'directional', 'geography', 'motion', 'path', 'border', 'coast', 'river'].includes(t))) return true;
      if (card.category === 'geography') return true;
      const travelHanzi = '东南西北上下左右前后里外去来到走开车机场票路口街道桥山河海';
      if (card.hanzi) {
        for (const ch of card.hanzi) if (travelHanzi.includes(ch)) return true;
      }
      return false;
    },
  },
  {
    slug: 'family-relationships',
    name: 'Family & Relationships',
    cn: '家庭关系',
    description: 'Kinship vocabulary (爸 妈 儿 女 哥 姐 弟 妹), the 的 grammar of possession, and family-tag entries.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      if (tags.some(t => ['family', 'kinship', 'home', 'birth'].includes(t))) return true;
      const familyHanzi = '爸妈父母儿女子孩哥姐弟妹叔伯姨舅奶爷亲戚夫妻男女老婆夫人朋友';
      if (card.hanzi) {
        for (const ch of card.hanzi) if (familyHanzi.includes(ch)) return true;
      }
      return false;
    },
  },
  {
    slug: 'time-and-tense',
    name: 'Time & Tense',
    cn: '时间时态',
    description: 'Time-of-day vocab, calendar terms, aspect markers (了, 过, 着), tense particles, and the chengyu that compress time concepts.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      return tags.some(t => ['time', 'aspect', 'tense', 'past-tense', 'past', 'calendar', 'festival', 'timing'].includes(t));
    },
  },
  {
    slug: 'measure-word-drill',
    name: 'Measure Word Drill',
    cn: '量词练习',
    description: '个 只 张 本 条 位 家 件 杯 块 — the classifiers Chinese forces you to learn when you count anything.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      if (tags.some(t => ['measure-words', 'classifiers', 'measure'].includes(t))) return true;
      // Single-character classifier match. The drill deck wants the
      // measure word itself plus any vocab that compounds it.
      const classifiers = ['个', '只', '张', '本', '条', '位', '家', '件', '杯', '块', '把', '次', '辆', '种', '些', '点', '口', '门', '间', '层'];
      if (card._type === 'character' && classifiers.includes(card.hanzi)) return true;
      return false;
    },
  },
  {
    slug: 'modal-verbs',
    name: 'Modal Verbs',
    cn: '情态动词',
    description: '能 会 可以 应该 必须 得 想 要 — the modals that distinguish ability, permission, obligation, and politeness.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      if (tags.some(t => ['modal', 'ability', 'permission'].includes(t))) return true;
      const modals = ['能', '会', '可以', '应该', '必须', '得', '想', '要', '愿意', '可能', '需要'];
      if (card.hanzi && modals.includes(card.hanzi)) return true;
      return false;
    },
  },
  {
    slug: 'classical-foundations',
    name: 'Classical Foundations',
    cn: '古典基础',
    description: 'Classical-tagged characters, vocabulary, and chengyu — the literary register that underlies modern formal Chinese.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      return tags.some(t => ['classical', 'literary', 'classics', 'ancient'].includes(t));
    },
  },
  {
    slug: 'high-frequency-chengyu',
    name: 'Conversational Chengyu',
    cn: '常用成语',
    description: 'The chengyu that actually show up in daily conversation, news, and casual writing — not the obscure ones.',
    predicate: ({ card }) => {
      if (card.category !== 'chengyu') return false;
      const tags = card.tags || [];
      // High-frequency proxy: tagged with daily-life themes OR has been
      // surfaced as colloquial / popular vs. tagged 'literary' (which we
      // treat as the niche bucket).
      if (tags.includes('literary') && !tags.includes('idioms')) return false;
      return true;
    },
  },
  {
    slug: 'numbers-and-money',
    name: 'Numbers & Money',
    cn: '数字与钱',
    description: 'Count, pay, and bargain: the number system, market units (斤 两 块), money verbs (赚 赔 花), prices, and discounts.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      if (tags.some(t => ['numbers', 'scale', 'counting'].includes(t))) return true;
      const moneyHanzi = '零一二三四五六七八九十百千万亿两半斤块钱元角分价买卖付账费赚赔折';
      const cn = card.hanzi || '';
      if (cn.length <= 4) {
        let hits = 0;
        for (const ch of cn) if (moneyHanzi.includes(ch)) hits++;
        if (hits && hits >= Math.ceil(cn.length / 2)) return true;
      }
      return false;
    },
  },
  {
    slug: 'doing-business',
    name: 'Doing Business',
    cn: '生意场',
    description: 'The office, the deal, and the banquet: company words (公司 老板 客户), contracts and negotiation, money verbs, and the etiquette vocabulary that closes deals.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      return tags.some(t => ['business', 'commerce', 'trade', 'industry', 'production', 'legal'].includes(t));
    },
  },
  {
    slug: 'clinic-visit',
    name: 'Clinic Visit',
    cn: '看病就医',
    description: 'Get through a Chinese hospital: registration (挂号), symptoms (发烧 咳嗽 疼), body parts, medicine words, and the TCM vocabulary a doctor may use.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      return tags.some(t => ['health', 'medicine', 'body', 'tcm'].includes(t));
    },
  },
  {
    slug: 'digital-life',
    name: 'Digital Life',
    cn: '数字生活',
    description: 'Phones, computers, and the Chinese internet: the 电 and 网 word families, apps and payments, and the durable core of online slang.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      if (tags.some(t => ['technology', 'communication', 'media', 'modern'].includes(t))) return true;
      const cn = card.hanzi || '';
      return /[网电]/.test(cn) && cn.length >= 2 && cn.length <= 4;
    },
  },
  {
    slug: 'stem-vocabulary',
    name: 'STEM Vocabulary',
    cn: '理科词汇',
    description: 'Math, physics, chemistry, astronomy, biology, and engineering terms — the transparent compounds Chinese built its scientific lexicon from.',
    predicate: ({ card }) => {
      const tags = card.tags || [];
      return tags.some(t => ['mathematics', 'physics', 'chemistry', 'astronomy', 'biology', 'engineering', 'geometry', 'science'].includes(t));
    },
  },
];

// ────────────────────── Slice extraction ──────────────────────

/**
 * Build the full slice list from already-extracted normalized cards.
 *
 * Input shape (cards): array of { hanzi, pinyin, english, desc, hsk,
 * radical?, tags, category, _type, path } where _type is one of
 * 'character'|'vocab'|'chengyu'|'grammar'.
 *
 * Returns array of slices, each:
 *   { slug, name, cn?, dimension, criterion, description?, cards }
 *
 * Where dimension ∈ 'type'|'hsk'|'topic'|'tag'|'intent' and criterion
 * is the value within that dimension (e.g. dimension='hsk' criterion=3).
 *
 * Cards retain their original objects (no copy) so downstream formatters
 * can read all fields. Each card additionally gets `_resolvedHsk` so
 * formatters can render the level without re-running inference.
 */
export function buildSlices(cards, charHskMap) {
  // First pass: enrich every card with its resolved HSK so all subsequent
  // grouping uses the same number.
  for (const c of cards) {
    const r = resolveHsk(c, charHskMap);
    c._resolvedHsk = r.level;
    c._hskInferred = r.inferred;
  }

  const slices = [];

  // Type slices — already shipped today as the per-type apkgs, but include
  // them in the new manifest format so the exports page can render them
  // alongside the new slices uniformly.
  const byType = groupBy(cards, c => c._type);
  for (const [t, items] of byType) {
    slices.push({
      slug: `type-${t}`,
      dimension: 'type',
      criterion: t,
      name: titleCase(t === 'characters' ? 'Characters' : t === 'vocab' ? 'Vocabulary' : t === 'chengyu' ? 'Chengyu' : t === 'grammar' ? 'Grammar' : t === 'compound' ? 'Compounds' : t),
      cn: t === 'characters' ? '字' : t === 'vocab' ? '词汇' : t === 'chengyu' ? '成语' : t === 'grammar' ? '语法' : t === 'compound' ? '词组' : t,
      description: `All ${items.length} ${t} cards in the corpus.`,
      cards: items,
    });
  }

  // HSK slices — group by resolved level. Skip nulls (uncategorized stays
  // accessible through the type/topic slices and the global deck).
  const byHsk = groupBy(cards.filter(c => c._resolvedHsk != null), c => c._resolvedHsk);
  for (const [lvl, items] of byHsk) {
    slices.push({
      slug: `hsk-${lvl}`,
      dimension: 'hsk',
      criterion: lvl,
      name: `HSK ${lvl}`,
      cn: '级', // 'jí' — level / grade
      description: `Just HSK level ${lvl} on its own (authored or inferred from constituent characters).`,
      cards: items,
    });
  }

  // HSK 1→N cumulative ladders — common learner ask: "give me everything
  // through HSK 3 so I can plateau-review." Emit ladder slices for 1..6.
  for (let upper = 1; upper <= 6; upper++) {
    const items = cards.filter(c => c._resolvedHsk != null && c._resolvedHsk <= upper);
    if (items.length === 0) continue;
    const label = upper === 1 ? 'HSK 1' : `HSK 1–${upper}`;
    slices.push({
      slug: `hsk-up-to-${upper}`,
      dimension: 'hsk-ladder',
      criterion: upper,
      name: label,
      cn: '阶', // 'jiē' — step / rung
      description: upper === 1
        ? 'Just HSK 1 — the foundation deck for absolute beginners.'
        : `Cumulative deck: every card from HSK 1 up to and including HSK ${upper}.`,
      cards: items,
    });
  }

  // Topic dimension — currently no-op. Cards live under structural
  // categories (vocab/chengyu/characters/grammar) not topic categories;
  // topic association comes through tags. The tag slices below cover the
  // topic angle (tag-buddhism, tag-confucianism, tag-daoism, etc.). When
  // we add cross-page relations from topic prose to vocab/character
  // entries, this is the place to surface a real topic dimension.

  // Tag slices — only whitelisted tags that hit the floor.
  const tagBuckets = new Map();
  for (const c of cards) {
    for (const tag of (c.tags || [])) {
      if (!TAG_LABELS[tag]) continue;
      if (!tagBuckets.has(tag)) tagBuckets.set(tag, []);
      tagBuckets.get(tag).push(c);
    }
  }
  for (const [tag, items] of tagBuckets) {
    if (items.length < TAG_FLOOR) continue;
    const label = TAG_LABELS[tag];
    slices.push({
      slug: `tag-${tag}`,
      dimension: 'tag',
      criterion: tag,
      name: label.en,
      cn: label.cn,
      description: `Cards tagged ${tag} — ${items.length} entries.`,
      cards: items,
    });
  }

  // Intent slices — run each predicate over the corpus.
  for (const intent of INTENT_DECKS) {
    const items = cards.filter(c => intent.predicate({
      card: c,
      hsk: c._resolvedHsk,
      type: c._type,
      hskMap: charHskMap,
    }));
    if (items.length === 0) continue;
    slices.push({
      slug: `intent-${intent.slug}`,
      dimension: 'intent',
      criterion: intent.slug,
      name: intent.name,
      cn: intent.cn,
      description: intent.description,
      cards: items,
    });
  }

  return slices;
}

// ────────────────────── helpers ──────────────────────

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function titleCase(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { TOPIC_LABELS, TAG_LABELS, INTENT_DECKS, TAG_FLOOR };
