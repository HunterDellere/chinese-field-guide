"""
fill_manual.py — Fill remaining [gloss needed] entries by manual lookup table.
These are multi-word phrases, morphemes, and idioms not in CEDICT as standalone entries.

Usage: uv run fill_manual.py
"""

import re
from pathlib import Path

HSK_DIR = Path(__file__).parent.parent

# Manual glosses keyed by the simplified form as it appears in the line.
# Key = simplified text (before the first " — "), value = replacement gloss string.
MANUAL: dict[str, str] = {
    # HSK 2
    "为什么 / 為什麼": "why, for what reason",
    # HSK 3
    "初（初一）": "prefix: ordinal/initial (e.g. 初一 first day of the month)",
    "电子邮件 / 電子郵件": "email, electronic mail",
    "放到": "to put into, to place at",
    "分组 / 分組": "to divide into groups",
    "高速公路": "expressway, highway",
    "化（现代化） / 化（現代化）": "suffix: -ize, -ification (e.g. 现代化 modernization)",
    "…极了 / …極了": "extremely …, to the extreme degree",
    "看起来 / 看起來": "it looks like, it seems",
    "看上去": "it looks like, it appears",
    "另一方面": "on the other hand",
    "能不能": "can or cannot, is it possible to",
    "性（积极性） / 性（積極性）": "suffix: -ness, -ity (e.g. 积极性 enthusiasm)",
    "员（服务员） / 員（服務員）": "suffix: -er, person in a role (e.g. 服务员 waiter)",
    "者（志愿者） / 者（志願者）": "suffix: -er, person who does (e.g. 志愿者 volunteer)",
    # HSK 4
    "中华民族 / 中華民族": "the Chinese nation, the Chinese people (as a whole)",
    "大规模 / 大規模": "large-scale, on a large scale",
    "大楼 / 大樓": "large building, tower block",
    "多次": "multiple times, on many occasions",
    "多年": "many years, for years",
    "多种 / 多種": "various kinds, multiple types",
    "而是": "but rather, instead",
    "…分之…": "fraction: … out of … (e.g. 三分之一 one-third)",
    "感兴趣 / 感興趣": "to be interested in, to take an interest",
    "离不开 / 離不開": "cannot do without, inseparable from",
    "没错 / 沒錯": "that's right, correct, no mistake",
    "没想到 / 沒想到": "unexpectedly, I didn't expect that",
    "上个月 / 上個月": "last month",
    "上楼 / 上樓": "to go upstairs",
    "手里 / 手裡": "in one's hand, in hand",
    "刷牙": "to brush one's teeth",
    "下个月 / 下個月": "next month",
    "下楼 / 下樓": "to go downstairs",
    "眼里 / 眼裡": "in one's eyes, in the eyes of",
    "有劲儿 / 有勁兒": "energetic, vigorous; interesting, fun",
    # HSK 5
    "岸上": "on the shore, on the bank",
    "不耐烦 / 不耐煩": "impatient, annoyed",
    "不能不": "cannot but, have no choice but to",
    "不停": "nonstop, unceasingly",
    "差（一）点儿 / 差（一）點兒": "almost, nearly (but not quite)",
    "称2 / 稱2": "to call, to be called (second reading of 称)",
    "城里 / 城裡": "in the city, inside the city",
    "乘车 / 乘車": "to ride a vehicle, to take a bus/train",
    "递给 / 遞給": "to hand to, to pass to",
    "尽可能 / 盡可能": "as much as possible",
    "决不 / 決不": "absolutely not, by no means",
    "品（工艺品） / 品（工藝品）": "suffix: article, product (e.g. 工艺品 handicraft)",
    "敲门 / 敲門": "to knock on the door",
    "全世界": "the whole world, worldwide",
    "忍不住": "cannot help but, unable to hold back",
    "双手 / 雙手": "both hands",
    "向前": "forward, ahead",
    "一句话 / 一句話": "in a word, in one sentence",
    "由此": "from this, therefore, hence",
    "有毒": "poisonous, toxic",
    "有害": "harmful, hazardous",
    "再也": "no longer (in negative), ever again",
    "只见 / 只見": "only to see, one sees only",
    "中秋节 / 中秋節": "Mid-Autumn Festival (15th day of 8th lunar month)",
    # HSK 6
    "本期": "this issue, current period",
    "便是": "is exactly, is precisely",
    "表面上": "on the surface, superficially",
    "不仅仅 / 不僅僅": "not only, not merely",
    "城乡 / 城鄉": "urban and rural, city and countryside",
    "此处 / 此處": "here, at this place",
    "此次": "this time, this occasion",
    "从不 / 從不": "never (habitual), at no time",
    "从没 / 從沒": "have never, not once",
    "打官司": "to go to court, to file a lawsuit",
    "端午节 / 端午節": "Dragon Boat Festival (5th day of 5th lunar month)",
    "更是": "even more so, all the more",
    "好（不）容易": "with great difficulty, not easily at all",
    "很难说 / 很難說": "hard to say, difficult to determine",
    "界（文艺界） / 界（文藝界）": "suffix: world, circles (e.g. 文艺界 arts world)",
    "绝大多数 / 絕大多數": "the vast majority, the overwhelming majority",
    "开夜车 / 開夜車": "to burn the midnight oil, to work late into the night",
    "蓝天 / 藍天": "blue sky",
    "力（影响力） / 力（影響力）": "suffix: power, force (e.g. 影响力 influence)",
    "清明节 / 清明節": "Qingming Festival, Tomb-Sweeping Day",
    "却是 / 卻是": "but it is, yet it is (concessive)",
    "圣诞节 / 聖誕節": "Christmas",
    "说实话 / 說實話": "to tell the truth, honestly speaking",
    "修车 / 修車": "to repair a vehicle, to fix a car",
    "一路上": "along the way, all the way",
    "一番": "a bout of, a round of (effort or action)",
    "意想不到": "unexpected, beyond imagination",
    "有没有 / 有沒有": "do you have, is there or isn't there",
    "长（秘书长） / 長（秘書長）": "suffix: chief, head (e.g. 秘书长 secretary-general)",
    "这就是说 / 這就是說": "that is to say, in other words",
    "指着 / 指著": "pointing at, indicating",
    "治病": "to treat a disease, to cure an illness",
    "族（上班族）": "suffix: group, tribe (e.g. 上班族 office workers)",
    # HSK 7-9 (selected high-frequency remaining)
    "爱面子 / 愛面子": "to care about face/reputation, to be sensitive to social standing",
    "按理说 / 按理說": "logically speaking, in principle",
    "百科全书 / 百科全書": "encyclopedia",
    "办不到 / 辦不到": "cannot be done, impossible to accomplish",
    "爆冷门 / 爆冷門": "to produce a dark-horse result, to spring a surprise",
    "比不上": "cannot compare with, inferior to",
    "别提了 / 別提了": "don't even mention it, it's too embarrassing to bring up",
    "滨海 / 濱海": "coastal, seaside",
    "不利于 / 不利於": "unfavorable to, detrimental to",
    "不算": "doesn't count, not considered",
    "不服气 / 不服氣": "unconvinced, refusing to accept defeat",
    "不肯": "unwilling to, refuse to",
    "不理": "to ignore, to pay no attention to",
    "不难 / 不難": "not difficult, easy enough",
    "不如说 / 不如說": "it would be more accurate to say, or rather",
    "不予": "not to grant, to refuse (formal)",
    "不准": "not allowed, forbidden",
    "长达 / 長達": "as long as, lasting as much as",
    "长期以来 / 長期以來": "for a long time, over a long period",
    "趁着 / 趁著": "taking advantage of, while the opportunity exists",
    "吃不上": "unable to get food, cannot afford to eat",
    "出风头 / 出風頭": "to show off, to seek the limelight",
    "出毛病": "to develop a problem, to go wrong",
    "出难题 / 出難題": "to pose a difficult problem, to make things hard",
    "出洋相": "to make a fool of oneself, to embarrass oneself",
    "出主意": "to offer a suggestion, to come up with an idea",
    "穿小鞋": "to make things difficult for someone (lit. to make wear tight shoes)",
    "吹了": "it's off, it fell through, (plans) collapsed",
    "从今以后 / 從今以後": "from now on, henceforth",
    "从来不 / 從來不": "never, at no time ever",
    "打交道": "to deal with, to have contact with",
    "打招呼": "to greet, to say hello; to give a heads-up",
    "大幅度": "by a large margin, substantially",
    "大面积 / 大面積": "large area, on a large scale",
    "大体上 / 大體上": "generally speaking, on the whole",
    "得益于 / 得益於": "to benefit from, thanks to",
    "帝国主义 / 帝國主義": "imperialism",
    "定为 / 定為": "to designate as, to set as",
    "度（知名度）": "suffix: degree, extent (e.g. 知名度 level of fame)",
    "多年来 / 多年來": "over the years, for many years",
    "发脾气 / 發脾氣": "to lose one's temper, to get angry",
    "反过来 / 反過來": "conversely, the other way around",
    "飞往 / 飛往": "to fly to, to fly toward",
    "非（非金属） / 非（非金屬）": "prefix: non-, not (e.g. 非金属 non-metal)",
    "改革开放 / 改革開放": "reform and opening-up (PRC policy since 1978)",
    "感（责任感） / 感（責任感）": "suffix: sense of, feeling of (e.g. 责任感 sense of responsibility)",
    "跟不上": "cannot keep up with, fall behind",
    "公共场所 / 公共場所": "public place, public venue",
    "公益性": "public-welfare nature, public-interest character",
    "顾不得 / 顧不得": "to have no time to attend to, cannot be bothered with",
    "刮风 / 颳風": "to be windy, wind is blowing",
    "官僚主义 / 官僚主義": "bureaucratism, red-tape mentality",
    "过日子 / 過日子": "to get through one's days, to live one's life",
    "过早 / 過早": "too early, prematurely",
    "海内外 / 海內外": "at home and abroad, domestic and overseas",
    "毫不": "not at all, in no way",
    "毫不犹豫 / 毫不猶豫": "without the slightest hesitation",
    "毫无 / 毫無": "completely without, absolutely no",
    "何处 / 何處": "where, what place (literary)",
    "何时 / 何時": "when, at what time (literary)",
    "和平共处 / 和平共處": "peaceful coexistence",
    "怀里 / 懷裡": "in one's arms, in one's embrace",
    "怀着 / 懷著": "harboring, with (a feeling or intention)",
    "还款 / 還款": "to repay a loan, loan repayment",
    "及其": "and its, together with (formal connective)",
    "极少数 / 極少數": "a tiny minority, very few",
    "驾车 / 駕車": "to drive a vehicle",
    "戒烟 / 戒煙": "to quit smoking",
    "仅次于 / 僅次於": "second only to, ranked just below",
    "紧接着 / 緊接著": "immediately after, right on the heels of",
    "近年来 / 近年來": "in recent years",
    "开枪 / 開槍": "to fire a gun, to shoot",
    "侃大山": "to chat idly, to shoot the breeze",
    "看热闹 / 看熱鬧": "to watch the excitement, to be a bystander",
    "看样子 / 看樣子": "it looks like, by the looks of things",
    "苦练 / 苦練": "to practice hard, to train strenuously",
    "来源于 / 來源於": "to originate from, to derive from",
    "老远 / 老遠": "from far away, a long way off",
    "率（成功率）": "suffix: rate, ratio (e.g. 成功率 success rate)",
    "买不起 / 買不起": "cannot afford to buy",
    "慢慢来 / 慢慢來": "take it easy, no rush",
    "茅台（酒） / 茅臺（酒）": "Moutai (premium Chinese baijiu liquor)",
    "没意思 / 沒意思": "boring, meaningless, no fun",
    "哪知道": "who would have thought, who knew",
    "难得一见 / 難得一見": "rarely seen, hard to come by",
    "难以想象 / 難以想象": "hard to imagine, unimaginable",
    "跑龙套 / 跑龍套": "to play a bit part, to do minor supporting work",
    "碰钉子 / 碰釘子": "to hit a snag, to meet a rebuff",
    "譬如说 / 譬如說": "for example, for instance",
    "骗人 / 騙人": "to deceive people, deceptive",
    "贫富 / 貧富": "rich and poor, wealth disparity",
    "泼冷水 / 潑冷水": "to pour cold water on, to dampen enthusiasm",
    "普通人": "ordinary person, average person",
    "恰恰相反": "exactly the opposite, just the reverse",
    "敲边鼓 / 敲邊鼓": "to play a supporting role, to back someone up on the side",
    "取决于 / 取決於": "to depend on, to be determined by",
    "如果说 / 如果說": "if we say, assuming that",
    "晒太阳 / 曬太陽": "to sunbathe, to bask in the sun",
    "伤脑筋 / 傷腦筋": "to rack one's brains, to be a headache",
    "上期": "last issue, previous period",
    "少林寺": "Shaolin Monastery (famous Buddhist temple)",
    "社会主义 / 社會主義": "socialism",
    "谁知道 / 誰知道": "who would have known, nobody knew",
    "十字路口": "crossroads, intersection",
    "时隔 / 時隔": "after an interval of, separated by (time)",
    "世界级 / 世界級": "world-class, international level",
    "市场经济 / 市場經濟": "market economy",
    "说干就干 / 說幹就幹": "to act as soon as one says (decisive action)",
    "说老实话 / 說老實話": "to be honest, to tell it straight",
    "说起来 / 說起來": "speaking of which, come to think of it",
    "说闲话 / 說閒話": "to gossip, to talk behind one's back",
    "说真的 / 說真的": "to be honest, seriously speaking",
    "俗话说 / 俗話說": "as the saying goes, the proverb says",
    "随处可见 / 隨處可見": "visible everywhere, can be seen anywhere",
    "随大溜 / 隨大溜": "to follow the crowd, to go with the flow",
    "谈不上 / 談不上": "cannot be called, does not qualify as",
    "掏钱 / 掏錢": "to pull out money, to pay",
    "讨人喜欢 / 討人喜歡": "likeable, pleasing to people",
    "忘不了": "cannot forget, unforgettable",
    "下功夫": "to put in effort, to work hard on",
    "下决心 / 下決心": "to make up one's mind, to resolve to",
    "下期": "next issue, next period",
    "下一代": "the next generation",
    "相比之下": "by comparison, in comparison",
    "业（服务业） / 業（服務業）": "suffix: industry, sector (e.g. 服务业 service industry)",
    "一不小心": "if one is not careful, inadvertently",
    "一长一短 / 一長一短": "one long one short; pros and cons",
    "意料之外": "beyond expectation, unexpected",
    "饮水 / 飲水": "drinking water; to drink water",
    "永不": "never, never ever",
    "有两下子 / 有兩下子": "to have some real ability, to have a few tricks up one's sleeve",
    "有所不同": "to differ in some respects, not entirely the same",
    "与否 / 與否": "whether or not",
    "愈来愈 / 愈來愈": "more and more, increasingly",
    "元宵节 / 元宵節": "Lantern Festival (15th day of 1st lunar month)",
    "知识分子 / 知識分子": "intellectual, educated person",
    "止咳": "to relieve a cough, anti-cough",
    "致力于 / 致力於": "to devote oneself to, to be committed to",
    "着眼于 / 著眼於": "to focus on, to have one's sights set on",
    "资本主义 / 資本主義": "capitalism",
    "总的来说 / 總的來說": "generally speaking, all in all",
    "走过场 / 走過場": "to go through the motions",
    "走后门 / 走後門": "to use the back door, to pull strings",
    "走弯路 / 走彎路": "to take the long way around, to make unnecessary detours",
    "钻空子 / 鑽空子": "to exploit a loophole, to find a gap to sneak through",
    "做生意": "to do business, to run a business",
    # Additional HSK 7-9 entries (from the full list above)
    "阿拉伯语 / 阿拉伯語": "Arabic language",
    "哎": "hey, ah (interjection of surprise or attention)",
    "哎呀": "oh my, goodness (interjection of surprise or dismay)",
    "哀求": "to beg, to implore",
    "挨家挨户 / 挨家挨戶": "door to door, house by house",
    "癌": "cancer (disease)",
    "癌症": "cancer, malignant tumor",
    "艾滋病": "AIDS",
    "唉": "alas, sigh (interjection of regret or resignation)",
    "爱不释手 / 愛不釋手": "to be so fond of something that one can't put it down",
    "爱理不理 / 愛理不理": "indifferent, taking no notice, cool attitude",
    "碍事 / 礙事": "to be in the way, to cause inconvenience",
    "安定": "stable, settled; to stabilize",
}


def apply_manual(path: Path, manual: dict[str, str]) -> tuple[int, int]:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    filled = 0
    missing = 0
    out = []
    for line in lines:
        stripped = line.rstrip("\n")
        if "— [gloss needed]" not in stripped:
            out.append(line if line.endswith("\n") else line + "\n")
            continue
        # Extract the key: everything from first non-"- " char to the first " — "
        m = re.match(r"^- (.+?) — ", stripped)
        if m:
            key = m.group(1)
            gloss = manual.get(key)
            if gloss:
                new_line = re.sub(r"\[gloss needed\]", gloss, stripped) + "\n"
                out.append(new_line)
                filled += 1
                continue
        out.append(line if line.endswith("\n") else line + "\n")
        missing += 1
    if filled:
        path.write_text("".join(out), encoding="utf-8")
    return filled, missing


def main() -> None:
    hsk_files = sorted(HSK_DIR.glob("hsk-*.md"))
    total_filled = total_missing = 0
    for path in hsk_files:
        filled, missing = apply_manual(path, MANUAL)
        total_filled += filled
        total_missing += missing
        print(f"  {path.name}: filled {filled:>4}, still missing {missing:>4}")
    print(f"\nTotal: {total_filled} filled, {total_missing} still missing.")


if __name__ == "__main__":
    main()
