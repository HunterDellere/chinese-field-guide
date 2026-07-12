# Voice & copy principles

角落書屋 is written as a curious scholar's notebook for adult readers. The voice should feel like a person who has lived with the material talking plainly to a friend who's interested but hasn't done the reading yet.

## Tone

- Confident and specific. Make assertions. Avoid hedging ("arguably", "perhaps", "in some sense").
- Concrete over abstract. Name the dynasty, the dish, the year, the source. A vague gesture is worse than a specific claim that might need correction.
- One observation per sentence when the observation is interesting. Long sentences are fine, but they should earn their length.
- Cultural complexity gets acknowledged, not flattened. Note disagreements between schools, regional variation, contested etymology. Don't paper over.

## Patterns to avoid

These are the tells of LLM-generic writing. Strip them when seen.

- **Em-dashes are banned in body prose. Zero, no exceptions.** They are the single clearest AI tell, and `build/validate-formatting.mjs` enforces a budget of 0 as an ERROR — any em-dash introduced in body prose blocks the build and the pre-push hook. The only `—` allowed is the gloss separator after a Chinese sentence (`中文句子。 — English translation`), which the validator excludes. Everywhere else, rewrite: comma, semicolon, colon, parenthetical, or a sentence split. If you are reaching for `—` to introduce a clarification, contrast, or aside, restructure the sentence instead.
- **"It's not X, it's Y" / "Not just X, but Y" parallelism.** This construction is overused by LLMs as a way to sound insightful. Replace with a direct claim: "Y" instead of "not X, but Y".
- **Throat-clearing openings.** Skip "It is worth noting that…", "One might argue…", "It is important to remember…". Just say the thing.
- **Tricolons of three short phrases.** "Quick, cheap, and reliable." "Birth, marriage, and death." Used sparingly these are fine. Used in every paragraph they read as filler.
- **"In the end" / "ultimately" / "at its core".** Almost always cuttable.
- **Trailing summary sentences.** A paragraph that ends with a sentence summarising what the paragraph just said.

## Patterns to keep

- Parenthetical pinyin and Chinese: 春节 (chūnjié) — useful and distinctive to this guide.
- Character etymology rooted in concrete imagery (oracle bone, seal script, radical decomposition).
- Brief stories from primary sources where they exist (Hánfēizǐ for 矛盾, Zhuangzi for 庄周, etc.).
- Explicit cross-reference to other guide entries by name when they're directly relevant.

## Lengths

- Hero `desc`: one sentence, under 25 words. Should make a curious reader want to click.
- `metaDesc`: one or two sentences, around 150–160 characters for SEO.
- Body paragraphs: 2–5 sentences typical. Longer if the argument needs it.
- Card definitions: 1–3 sentences. Examples carry the weight.

## Topic page failure modes

Topic pages fail differently from character pages. Character entries have clear etymology and compound structure to anchor them. Topic entries — religion, philosophy, history, daily life — can drift into survey-lecture register: facts arranged chronologically without an argument, every claim hedged, nothing at stake.

Specific patterns to kill in topic entries:

- **"Throughout history, X has been..."** — find the specific dynasty, text, or person.
- **"This tradition has had a profound influence on..."** — name the influence and show it. A concrete example beats any number of influence-sentences.
- **"Many scholars believe / debate / argue..."** — pick the most defensible reading and commit to it. If there's a genuine scholarly disagreement worth noting, name the sides and their reasoning, not the fact that disagreement exists.
- **Chronological survey as structure.** A history section isn't just dates and dynasties in order. Lead with the thing that makes the history interesting, then give the facts that explain it.
- **The closing "significance" paragraph.** Entries that end with a paragraph about why this topic matters haven't earned their landing. End on a concrete image, a quotation, a compound, or an observation — not a verdict.

## AI tells (humanizer ruleset, adapted)

Adapted from the humanizer skill (vendored verbatim at `templates/_drafting/humanizer-SKILL.md`, which itself distills Wikipedia's "Signs of AI writing"). The rules above stay in force; this section adds the patterns not already covered, adapted to house style. Each is marked **[machine]** (checked by `build/validate-formatting.mjs` as WARN-level findings on the admin dashboard) or **[judgment]** (caught only by a human or reviewing agent).

### Content tells

- **Significance inflation** [machine]: testament, tapestry, landscape (abstract), pivotal, crucial role, vital role, key moment, underscores, delve, showcase, boasts, vibrant, rich cultural heritage, profound, renowned, breathtaking, stunning, nestled, indelible mark, deeply rooted, setting the stage for, marking a shift, evolving landscape. Say what the thing is and did; drop the claim about what it represents.
- **Copula avoidance** [machine]: "serves as", "stands as", "functions as", "acts as a" where "is" works. Write "汉 is the source of the ethnonym", not "汉 serves as the source".
- **Vague attribution** [machine]: "experts say", "scholars believe", "many argue", "observers have noted", "it is believed". Already banned above for topic pages; now checked. Name the text, the person, or the survey, or commit to the claim yourself.
- **Superficial -ing tails** [judgment]: a present-participle phrase tacked onto a sentence to add fake depth ("…, reflecting the community's deep connection to the land"). Cut the tail or turn it into a claim with a subject.
- **False ranges** [machine]: "from X to Y" where X and Y aren't on a real scale ("from oracle bones to WeChat"). Fine when the range is literal (from 1368 to 1644); a tell when it's decorative.
- **Formulaic challenges/outlook sections** [judgment]: "Despite these challenges…", "Future outlook". Give the specific problem and the specific response instead.
- **Speculative gap-filling** [judgment]: inventing plausible filler where sources are silent ("likely", "it is believed that"). Say what isn't known or cut the sentence.

### Language tells

- **Signposting** [machine]: "it's worth noting", "it is important to note", "let's explore", "let's dive in", "here's what you need to know". Extends the throat-clearing rule above.
- **Persuasive authority tropes** [judgment]: "the real question is", "at its core" (already banned above), "the heart of the matter", "what really matters". The next sentence usually restates an ordinary point with ceremony.
- **Aphorism formulas** [judgment]: "X is the Y of Z", "the language of", "the currency of". Replace with the concrete claim it gestures at.
- **Elegant variation** [judgment]: cycling synonyms for the page subject (the character… the glyph… the sign… the form). Repeat the plain word.
- **Staccato drama** [judgment]: runs of clipped fragments for engineered punch. One short sentence lands; four in a row read as performance.
- **Excessive hedging** [judgment]: "could potentially possibly". Already covered by the tone rules; stack of two hedges = rewrite.
- **Filler phrases** [judgment]: "in order to" → "to", "due to the fact that" → "because", "has the ability to" → "can", "at this point in time" → "now".

### Chatbot artifacts

- **Chatbot closers and correspondence** [machine]: "I hope this helps", "let me know", "would you like", "in conclusion", "exciting times lie ahead", generic upbeat endings ("the future looks bright"). The closing-significance-paragraph rule above is the house version; these literal strings should never appear at all.
- **Knowledge-cutoff residue** [judgment]: "as of my last update", "based on available information", "specific details are limited".
- **Emojis in prose** [judgment]: none, anywhere in body prose.

### Openings

- **Slow openings** [machine]: hero descs and first scholar paragraphs must hit a concrete fact fast: a name, a date, a number, or a CN term. The validator flags any opening that runs more than ~3 sentences before the first concrete fact. This is the coffee test made mechanical: a person who knows the material leads with the interesting specific, not with atmosphere.

### Humanizer rules NOT adopted (house-style conflicts)

- **Boldface ban**: we deliberately bold CN terms and key vocabulary in prose. The tell to avoid is mechanical bold-header bullet lists ("**Performance:** …"), not bold itself.
- **Em/en-dash rule**: superseded by our stricter rule above (budget 0, gloss-separator exception).
- **Curly quotes**: typographic quotes are fine in a set scholarly page; not a tell here.
- **Title case in headings**: our section heads are bilingual (CN + pinyin) with the `·` separator; the English-heading title-case rule doesn't map.
- **Personality injection**: the humanizer's "add opinions, mess, first person" guidance is for personal essays. Our register is a scholar's notebook: confident, concrete, third person. De-AI by cutting tells and rambles, not by adding chattiness.

## When in doubt

Read the paragraph aloud. If it sounds like something a person who knows the material would actually say to you over coffee, keep it. If it sounds like a smooth stranger trying to sound knowledgeable, cut.
