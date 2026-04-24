---
type: hub
category: hubs
title: "汉语学习路 · Learning Chinese — A Reading Path"
pinyin: "hànyǔ xué xí lù"
desc: "A staged reading path from tones and sounds through characters, grammar, and a first encounter with classical Chinese."
status: complete
content_review: 'pending'
updated: "2026-04-22"
tags: ["language","grammar","characters","learning","hub"]
stages:
  - name: "声音"
    name_en: "Sound System"
    color: teal
    note: "Start here — tones and romanisation before any characters."
    members:
      - slug: vocab/putonghua_普通话
        label_cn: "普通话 · Standard Chinese"
        label_en: "What you are learning"
        type: Vocab
        mins: 5
        note: "The standard variety based on Beijing phonology, written 普通话 (pǔtōnghuà) — 'common speech.' Understanding what Mandarin is and is not (not the only variety, not the historical literary language) clears up confusion that follows learners for years."
      - slug: vocab/shengtiao_声调
        label_cn: "声调 · Tones"
        label_en: "The hardest adjustment"
        type: Vocab
        mins: 6
        note: "Mandarin has four tones plus a neutral tone. The difficulty for English speakers is not that the tones are arbitrary — they are consistent — but that English uses pitch prosodically rather than lexically. This entry explains the distinction and gives the four tones their linguistic grounding."
      - slug: vocab/pinyin_拼音
        label_cn: "拼音 · Romanisation"
        label_en: "The scaffold, not the target"
        type: Vocab
        mins: 5
        note: "Pinyin is the official romanisation system developed in the 1950s. It is a scaffold for acquiring pronunciation — not a writing system to stay in. Read this entry to understand what pinyin represents before treating it as a crutch."
  - name: "字形"
    name_en: "The Written System"
    color: ochre
    note: "What Chinese characters are and how the system is organised."
    members:
      - slug: vocab/hanzi_汉字
        label_cn: "汉字 · Characters"
        label_en: "The system itself"
        type: Vocab
        mins: 5
        note: "The term and the history: why they are called Han characters, the traditional/simplified distinction, and a first map of the character types. Read before starting any stroke practice."
      - slug: vocab/bushou_部首
        label_cn: "部首 · Radicals"
        label_en: "The organising logic"
        type: Vocab
        mins: 6
        note: "Radicals are not decorative — they are the semantic signposts inside each character. Learning the 50–100 most common radicals transforms character learning from brute memorisation into pattern recognition."
      - slug: vocab/bihua_笔画
        label_cn: "笔画 · Stroke Order"
        label_en: "The physical grammar"
        type: Vocab
        mins: 5
        note: "Stroke order is not arbitrary. It encodes the logic of how the brush moved and determines how characters look when written at speed. Learning it early costs almost nothing; correcting it later is surprisingly difficult."
      - slug: hubs/hanzi
        label_cn: "汉字路 · Writing System Hub"
        label_en: "Go deeper"
        type: Topic
        mins: 35
        note: "The full writing system reading path — from pictographic foundations through key radicals to calligraphy. Stage 2 of this path terminates here. If the writing system is what drew you to Chinese, follow this hub before continuing."
  - name: "词"
    name_en: "Words and Meaning"
    color: sienna
    note: "How Mandarin builds words and expresses meaning."
    members:
      - slug: vocab/yisi_意思
        label_cn: "意思 · Meaning"
        label_en: "The core concept"
        type: Vocab
        mins: 5
        note: "意思 (yìsi) is the word for 'meaning,' but it carries far more: implication, suggestion, intention, and a dozen idiomatic uses. Starting with the word for 'meaning' is not accidental — it is an argument about how Mandarin encodes intention."
      - slug: vocab/dongxi_东西
        label_cn: "东西 · Thing"
        label_en: "How ordinary words carry history"
        type: Vocab
        mins: 5
        note: "东西 literally means 'east-west,' yet it means 'thing' in everyday speech. This entry is a clean example of how Chinese words carry historical and geographical memory inside them."
      - slug: vocab/bijiao_比较
        label_cn: "比较 · Comparison"
        label_en: "Core grammatical function"
        type: Vocab
        mins: 5
        note: "Comparison in Mandarin works without inflection — no comparative or superlative suffixes. 比较 (bǐjiào) is the gateway into understanding how Mandarin constructs these relationships structurally."
  - name: "语法"
    name_en: "Grammar Core"
    color: violet
    note: "The five structures that cause the most confusion for English speakers — and are worth learning in exactly this order."
    members:
      - slug: grammar/de_的得地
        label_cn: "的得地 · The de Particles"
        label_en: "Three characters, one sound"
        type: Grammar
        mins: 8
        note: "的, 得, and 地 are all pronounced 'de' but serve completely different grammatical functions. 的 marks possession and modification; 地 links adverbs to verbs; 得 introduces result or degree complements. Sorting them out early prevents errors that persist for years."
      - slug: grammar/le_了
        label_cn: "了 · Completion & Change"
        label_en: "The most misunderstood particle"
        type: Grammar
        mins: 9
        note: "了 is not a past tense marker — it indicates completion of an action or a new state of affairs. English speakers try to map it onto past tense and get confused by every exception. This entry explains what 了 is actually tracking."
      - slug: grammar/ba_把
        label_cn: "把 · Disposal Construction"
        label_en: "Object before verb"
        type: Grammar
        mins: 8
        note: "把 moves the object before the verb and implies a definitive, result-producing action. It has no English equivalent. Understanding when 把 is required (and when it is wrong) is one of the clearest markers of intermediate competence."
      - slug: grammar/bei_被
        label_cn: "被 · Passive Construction"
        label_en: "When the action happens to you"
        type: Grammar
        mins: 7
        note: "被 introduces the passive construction — but Chinese passives carry pragmatic weight that English passives don't. 被 typically implies that something unwelcome happened. Read alongside 把 to understand both sides of the result-focused construction."
      - slug: grammar/liangci_量词
        label_cn: "量词 · Measure Words"
        label_en: "The classifier system"
        type: Grammar
        mins: 7
        note: "Mandarin requires a measure word between a number and a noun: not 'three books' but 'three 本 books.' The system is large but not arbitrary — each measure word groups nouns by shape, material, or cultural association. Learning the 20 most common covers the vast majority of everyday use."
  - name: "古文"
    name_en: "Into the Classical"
    color: red
    note: "An opening door, not a level gate. Two characters and one particle that appear on nearly every classical page of this site."
    members:
      - slug: characters/zhi1_之
        label_cn: "之 · The Connective"
        label_en: "The most common classical character"
        type: Character
        mins: 6
        note: "之 is the possessive and connective particle of classical Chinese — the equivalent of 的 in a register that shaped two thousand years of poetry, philosophy, and history. Recognising it unlocks the syntax of classical passages; being able to read it transforms what the classical content on this site means."
      - slug: characters/qi2_其
        label_cn: "其 · Its / Their"
        label_en: "Classical pronoun and intensifier"
        type: Character
        mins: 5
        note: "其 functions as a third-person pronoun and a rhetorical intensifier in classical Chinese. It appears in the Analects, the Daodejing, and virtually every classical text this site covers. Knowing 其 turns skimming into reading."
      - slug: grammar/zhe_着
        label_cn: "着 · Ongoing State"
        label_en: "The bridge to classical usage"
        type: Grammar
        mins: 7
        note: "着 marks an ongoing or sustained action in modern Mandarin — but it also bridges to the classical durative, appearing in literary and formal registers. It is the one modern grammar particle that changes character when the register shifts."
---

<div class="shell">

  <aside class="sidebar" id="sidebar">
    <span class="toc-topic">汉语学习路</span>
    <span class="toc-topic-en">Learning Chinese</span>
    <div class="toc-divider"></div>
    <span class="toc-label">On this page</span>
    <ul class="toc-list">
      <li><a href="#overview">
        <span class="toc-cn">概述</span> Overview
        <span class="toc-sub">what kind of language</span>
      </a></li>
      <li><a href="#path">
        <span class="toc-cn">阅读路径</span> Reading Path
        <span class="toc-sub">17 linked entries</span>
      </a></li>
      <li><a href="#questions">
        <span class="toc-cn">问题</span> Open Questions
      </a></li>
      <li><a href="#also">
        <span class="toc-cn">延伸</span> Tools & Resources
      </a></li>
    </ul>
  </aside>

  <main class="main" id="main-content">

    <header class="topic-hero">
      <span class="topic-hero-eyebrow">Hubs · 门户 ménhù</span>
      <h1 class="topic-hero-title">汉语学习路</h1>
      <span class="topic-hero-title-py">hànyǔ xué xí lù</span>
      <p class="topic-hero-desc">A staged path from tones and sounds through characters, core grammar, and a first encounter with classical Chinese, for readers who are new to the language.</p>
    </header>

    <span class="section-anchor" id="overview"></span>
    <div class="section-head"><h2>Overview</h2></div>
    <div class="scholar" data-glyph="语">
      <div class="scholar-label">汉语 · hànyǔ — the Chinese language</div>
      <p>Mandarin is not harder than other languages. It is differently hard. The sound system requires pitch discrimination that English does not use lexically. The writing system requires learning a few thousand characters before sustained reading becomes comfortable. The grammar, on the other hand, has no verb conjugation, no noun declension, and no grammatical gender, which removes three of the largest obstacles English speakers face when learning European languages.</p>
      <p>This path is staged. Stage 1 covers the sound system before any characters, because getting tones even roughly right from the start is much easier than correcting bad habits later. Stage 2 covers the writing system at a conceptual level, then points to the dedicated <a href="hanzi.html">汉字 hub</a> for deeper coverage. Stages 3 and 4 cover words and grammar, focusing on the constructions that cause the most sustained confusion. Stage 5 is an invitation into classical Chinese, specifically the two characters (之 and 其) that appear on nearly every classical page of this site. Reading them does not require a course in literary Chinese. It requires recognising two words and their functions.</p>
      <p>A word on scope: this path covers Mandarin as a reading and listening language. Spoken fluency requires production practice (output, feedback, correction) that no reading guide can substitute for. What this path can do is build the conceptual framework so that time spent with a teacher, a tutor, or a language exchange partner is not spent re-explaining the basics.</p>
    </div>

    <span class="section-anchor" id="path"></span>

    <span class="section-anchor" id="questions"></span>
    <div class="section-head"><h2>Open Questions</h2></div>
    <div class="pattern">
      <span class="label">问题 · wèntí — questions this hub leaves open</span>
      <p><strong>Is tonal awareness innate or learned?</strong> Adults learning Mandarin as a second language develop tonal discrimination through exposure and feedback, the same mechanism that allows musicians to develop absolute pitch in adulthood, though tone-deaf adults can learn to sing. Tonal perception is a trainable skill, not a fixed cognitive capacity. Studies on heritage speakers show that even partial early exposure produces lasting phonological advantages. There is no adult who cannot learn to hear the four tones; the question is only how much deliberate practice it takes.</p>
      <p><strong>Can an adult reach genuine fluency in Mandarin?</strong> Yes, and there are enough documented cases to close this question empirically. The Foreign Service Institute classifies Mandarin as a Category IV language (the hardest tier for English speakers) and estimates 2,200 class hours for professional working proficiency. That is a real cost. The ceiling is not lower than for other languages; the investment required to reach it is higher.</p>
      <p><strong>Is written Chinese harder to learn or just differently hard?</strong> The character set is larger than any European alphabet and requires more time to reach reading fluency. But the structure of the writing system is not arbitrary: phono-semantic compounds make up roughly 80–90% of characters, and learning the radical set provides a partial phonetic and semantic key to thousands of characters. The difficulty is front-loaded. Learners who work through the radical system systematically usually find that the 2,000th character takes less time to learn than the 200th.</p>
      <p><strong>Why does classical Chinese feel so foreign to educated modern Mandarin speakers?</strong> Classical Chinese (文言文 wényánwén) was never spoken. It was a written register that diverged from colloquial speech over many centuries and was finally displaced as the official written standard only in the early twentieth century. A modern Mandarin speaker encountering the Analects is in roughly the position of an English speaker encountering Chaucer: the language is ancestrally related, the vocabulary has significant overlap, but the grammar and register feel like a different language. Recognising 之 and 其 is the beginning of narrowing that gap.</p>
    </div>

    <span class="section-anchor" id="also"></span>
    <div class="section-head"><h2>Tools &amp; Resources</h2></div>
    <div class="scholar" data-glyph="学">
      <div class="scholar-label">延伸阅读 · yánshēn yuèdú — tools, references, and companion content</div>
      <p><strong>Dictionary tools:</strong> Pleco (iOS/Android) is the standard Mandarin dictionary app, offline-capable, with handwriting input, flashcard decks, and stroke-order animation. For quick browser lookups, MDBG (mdbg.net) uses the CC-CEDICT dataset, which is the best openly licensed Chinese-English dictionary and is worth knowing by name. Outlier Linguistics (outlier-linguistics.com) provides rigorous etymological entries grounded in current scholarship; it is the right tool for questions about character origin, not just definition.</p>
      <p><strong>Listening practice:</strong> Mandarin Corner (YouTube and podcast) produces graded content at HSK 1 through HSK 6 levels, with transcripts. Comprehensible input at the right level is more efficient than vocabulary drilling for listening acquisition, and Mandarin Corner's graded approach makes level-matching straightforward.</p>
      <p><strong>The HSK framework:</strong> HSK (汉语水平考试 Hànyǔ Shuǐpíng Kǎoshì) is the official Chinese proficiency test. The 2021 revision expanded the scale to nine levels; the widely used older version had six. HSK 1–2 covers basic survival vocabulary (around 500 words). HSK 3–4 covers everyday fluency (around 2,500 words). HSK 5–6 covers academic and professional use. The framework is useful as a rough map of where you are in the landscape, but it emphasises vocabulary count over grammar depth, and the grammar entries in Stage 4 of this path are more important for reading comprehension than HSK level alignment.</p>
      <p><strong>Companion hubs on this site:</strong> The <a href="hanzi.html">汉字 — Writing System hub</a> is Stage 2's full destination: character etymology, radical logic, and calligraphy as a living practice. The <a href="zhexue.html">哲学 — Philosophy hub</a> is where 之 and 其 from Stage 5 earn their weight; nearly every classical passage in the philosophy reading path uses both.</p>
    </div>

  </main>

</div>
