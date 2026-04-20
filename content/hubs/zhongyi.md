---
type: hub
category: hubs
title: "中医 · Traditional Chinese Medicine — A Reading Path"
pinyin: "zhōngyī"
desc: "A guided walk through the philosophy, practice, and vocabulary of Chinese medicine — from yin-yang and qi to acupuncture, herbology, and the five phases."
status: complete
updated: "2026-04-19"
tags: ["tcm","health","hub"]
stages:
  - name: "基础"
    name_en: "Foundations"
    color: teal
    note: "Start here — the two concepts without which nothing else in TCM makes sense."
    members:
      - slug: vocab/yinyang_阴阳
        label_cn: "阴阳 · Yin-Yang"
        label_en: "The foundational polarity"
        type: Vocab
        mins: 7
        note: "The foundational polarity underlying all of Chinese cosmology, medicine, and philosophy. Nothing in 中医 makes sense without it."
      - slug: vocab/zhongyi_中医
        label_cn: "中医 · Vocabulary"
        label_en: "The conceptual grammar"
        type: Vocab
        mins: 8
        note: "The core vocabulary of the system: the key terms, their relationships, and the conceptual grammar that ties the whole framework together."
  - name: "理论"
    name_en: "Theory"
    color: ochre
    note: "The theoretical pillars — qi, the five phases, and the philosophical bedrock."
    members:
      - slug: characters/qi4_气
        label_cn: "气 · Qi"
        label_en: "The vital force"
        type: Character
        mins: 6
        note: "The vital force that circulates through the body along meridians. Understanding qi is prerequisite to understanding acupuncture, qigong, and diagnosis alike."
      - slug: science/topic_wuxing
        label_cn: "五行 · Five Phases"
        label_en: "The diagnostic grid"
        type: Topic
        mins: 9
        note: "Wood, Fire, Earth, Metal, Water: the organizational framework that maps seasons, organs, emotions, flavours, and directions onto a single diagnostic grid."
      - slug: philosophy/topic_yinyang_wuxing
        label_cn: "阴阳五行 · Philosophy"
        label_en: "The cosmological bedrock"
        type: Topic
        mins: 9
        note: "How the two frameworks merged into the unified cosmological theory that underlies Chinese medicine, statecraft, and art. Read after the five-phases entry to see the synthesis."
  - name: "实践"
    name_en: "Practice"
    color: sienna
    note: "The three primary therapeutic modalities."
    members:
      - slug: science/topic_zhenjiu
        label_cn: "针灸 · Acupuncture"
        label_en: "Needles and moxibustion"
        type: Topic
        mins: 9
        note: "The two oldest physical interventions: needles that redirect qi through meridians, and the burning of mugwort to warm and tonify. Clinic, theory, and history together."
      - slug: science/topic_bencao
        label_cn: "本草 · Herbology"
        label_en: "The pharmacopoeia"
        type: Topic
        mins: 8
        note: "Thousands of plant, mineral, and animal substances classified by flavour, temperature, and channel affinity. The Bencao Gangmu of Li Shizhen (1596) is the canonical text."
      - slug: vocab/qigong_气功
        label_cn: "气功 · Qigong"
        label_en: "Self-cultivation from within"
        type: Vocab
        mins: 6
        note: "Where acupuncture acts on the body from outside, qigong trains the practitioner to regulate their own flow from within — through coordinated movement, breath, and intention."
  - name: "历史与全貌"
    name_en: "History & Depth"
    color: violet
    note: "The full clinical and historical scope — canonical texts to contemporary practice."
    members:
      - slug: science/topic_zhongyi
        label_cn: "中医 · Clinical Depth"
        label_en: "From the Yellow Emperor to today"
        type: Topic
        mins: 12
        note: "Canonical texts (黄帝内经, 伤寒论, 本草纲目), diagnostic methods (pulse, tongue, pattern differentiation), and the history of the medicine from classical origins to contemporary practice."
  - name: "宇宙论的延伸"
    name_en: "Cosmology Applied"
    color: red
    note: "The same framework extended beyond the body into built space."
    members:
      - slug: vocab/fengshui_风水
        label_cn: "风水 · Feng Shui"
        label_en: "TCM theory in the landscape"
        type: Vocab
        mins: 6
        note: "The same cosmological principles of qi, yin-yang, and the five phases applied to built space and landscape. A natural extension for readers who want to see how TCM theory radiates outward."
---

<div class="shell">

  <aside class="sidebar" id="sidebar">
    <span class="toc-topic">中医</span>
    <span class="toc-topic-en">Traditional Chinese Medicine</span>
    <div class="toc-divider"></div>
    <span class="toc-label">On this page</span>
    <ul class="toc-list">
      <li><a href="#overview">
        <span class="toc-cn">中医</span> The System
        <span class="toc-sub">cosmology as medicine</span>
      </a></li>
      <li><a href="#path">
        <span class="toc-cn">阅读路径</span> Reading Path
        <span class="toc-sub">10 linked entries</span>
      </a></li>
      <li><a href="#questions">
        <span class="toc-cn">问题</span> Open Questions
      </a></li>
      <li><a href="#also">
        <span class="toc-cn">延伸</span> Further Reading
      </a></li>
    </ul>
  </aside>

  <main class="main" id="main-content">

    <header class="topic-hero">
      <span class="topic-hero-eyebrow">Hubs · 门户 ménhù</span>
      <h1 class="topic-hero-title">中医</h1>
      <span class="topic-hero-title-py">zhōng yī</span>
      <p class="topic-hero-desc">A complete theoretical system developed over 2,500 years — its own anatomy, physiology, diagnosis, and pharmacology, all grounded in the same cosmological principles that govern the universe. This path starts with foundational theory and builds toward practice.</p>
    </header>

    <span class="section-anchor" id="overview"></span>
    <div class="section-head"><h2>The System</h2></div>
    <div class="scholar" data-glyph="医">
      <div class="scholar-label">中医 · zhōng yī</div>
      <p>中医 zhōngyī (中 = Chinese/central; 医 = medicine) is not a collection of folk remedies — it is a complete theoretical system developed over 2,500 years, with its own anatomy, physiology, pathology, diagnosis, and pharmacology. Its foundations are not empirical in the Western sense; they are cosmological: the human body is a microcosm of the universe, governed by the same principles of yin-yang, qi, and the five phases that govern everything else.</p>
      <p>Where Western medicine asks "what is broken and how do we fix it?", Chinese medicine asks "where is the flow disrupted, and how do we restore it?" The difference is not just methodological but ontological: Western medicine is built on the concept of discrete structures (organs, tissues, cells) that can be isolated and repaired; Chinese medicine is built on the concept of patterns of relationship — qi flowing through meridians that have no anatomical correlate that a Western pathologist would recognise.</p>
      <p>The canonical texts tell the history of that system: the <em>Huangdi Neijing</em> (黄帝内经, Yellow Emperor's Classic of Internal Medicine, c. 200 BCE) established the theoretical framework; Zhang Zhongjing's <em>Shanghan Lun</em> (伤寒论, Treatise on Cold Damage, c. 200 CE) systematised clinical diagnosis; and Li Shizhen's <em>Bencao Gangmu</em> (本草纲目, Compendium of Materia Medica, 1596 CE) catalogued nearly 1,900 medicinal substances. Two thousand years of clinical refinement sit between the theory and the practice this path describes.</p>
    </div>

    <span class="section-anchor" id="path"></span>

    <span class="section-anchor" id="questions"></span>
    <div class="section-head"><h2>Open Questions</h2></div>
    <div class="pattern">
      <span class="label">问题 · wèntí — questions this hub leaves open</span>
      <p><strong>Does qi exist?</strong> The honest answer is: not as a physical substance that instruments can detect. But the functional concept — that the body has regulatory systems whose disruption manifests as illness before structural damage occurs — maps imperfectly onto what Western medicine now calls homeostatic regulatory networks, autonomic function, and the gut-brain axis. The question of whether qi is a pre-scientific description of real phenomena, a metaphor that guides effective clinical reasoning, or something else entirely, is genuinely open.</p>
      <p><strong>What is the status of acupuncture?</strong> The evidence base for acupuncture is contested in a specific way: large controlled trials consistently show effects greater than no-treatment, but the effects are frequently not larger than sham acupuncture (needling at non-acupoint locations). This suggests either that the meridian theory is wrong but needling itself has physiological effects, or that the acupoint/non-acupoint distinction is more nuanced than the trials capture.</p>
      <p><strong>Is TCM a unified system or a family of traditions?</strong> The term 中医 was only standardised and unified in the twentieth century, partly as a political project. Classical Chinese medicine encompasses many regional traditions, lineage-based schools, and competing theoretical frameworks. What is now taught in TCM universities is a systematised, standardised version that differs in important ways from classical or folk practice.</p>
    </div>

    <span class="section-anchor" id="also"></span>
    <div class="section-head"><h2>Further Reading</h2></div>
    <div class="scholar" data-glyph="医">
      <div class="scholar-label">延伸阅读 · yánshēn yuèdú — companion hubs &amp; references</div>
      <p><strong>Companion hubs on this site:</strong> The <a href="../../pages/hubs/zhexue.html">哲学 — Philosophy hub</a> provides the yin-yang and five-phase cosmology in its original philosophical context; the medicine hub applies that cosmology clinically. The <a href="../../pages/hubs/tea.html">六大茶类 — Tea hub</a> shows how the TCM classification of foods by temperature and flavour property directly shapes tea culture: a 'cooling' tea is a medical category before it is a tasting note.</p>
      <p><strong>Key texts:</strong> Paul Unschuld's <em>Medicine in China: A History of Ideas</em> (University of California Press, 2010) is the definitive scholarly history in English — rigorous, readable, and appropriately critical. For clinical vocabulary, Nigel Wiseman and Feng Ye's <em>A Practical Dictionary of Chinese Medicine</em> is the standard reference for translation of TCM terms.</p>
      <p><strong>On the evidence debate:</strong> The Cochrane Collaboration (cochrane.org) publishes systematic reviews of acupuncture, herbal medicine, and qigong research that represent the current state of the clinical evidence without advocacy in either direction.</p>
    </div>

  </main>

</div>
