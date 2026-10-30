import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * One-time migration: prepares the parked N2 grammar points for display.
 *
 *  - Renumbers lessons to close the gaps left by their old N3 numbering
 *    (12, 14, 16 ... 24 -> 1-11), keeping their order and grouping, and recomputes
 *    every uid positionally. N2 was never shown in the UI, so no saved link,
 *    AI cache entry or reading-history uid points at the old numbers.
 *  - Applies the content review: wrong or misleading structures, English that
 *    doesn't match the Japanese, an example that used a different pattern, a missing
 *    core meaning (次第 'as soon as'), "N1/N2/N3" used as noun placeholders, typos,
 *    and points that had only one example.
 *
 * Keyed by the pre-migration uid; each entry asserts the expected title, so the
 * script refuses to run twice. Pass --dry-run to print the plan without writing.
 */

type Example = { jp: string; en: string };
type Item = Record<string, unknown> & {
  uid: string;
  lesson: number;
  title: string;
  examples?: Example[];
  details?: string;
};
type Chunk = Record<string, Item[]>;

interface Review {
  title: string; // substring the current title must contain
  set?: Partial<Pick<Item, 'title' | 'examples' | 'tags'>> & Record<string, unknown>;
  replace?: Array<[field: 'details' | 'summary' | 'explanation', from: string, to: string]>;
  appendDetails?: string;
}

const FILE = resolve('grammar-app/src/data/n2/grammar.json');
const dryRun = process.argv.includes('--dry-run');

const REVIEWS: Record<string, Review> = {
  'n2-grammar-12-1': {
    title: 'もんだから',
    set: {
      title: '〜ものだから／もんだから',
      structure: 'Verb/い-Adj (Plain) / な-Adj・Noun + な + ものだから／もんだから',
    },
    replace: [['details', 'equivalent of もの／ものだから.', 'equivalent of ものだから.']],
    appendDetails:
      'Because it presents a personal excuse, the second clause describes what happened — it is not used for requests, commands or invitations (✗ 時間がないものだから、急いでください).',
  },
  'n2-grammar-14-1': {
    title: 'といった',
    set: {
      structure: 'Noun A、Noun B ＋ といった ＋ Noun C',
      explanation:
        'Lists A, B, etc. as representative examples of the category C, implying there are others besides those mentioned.',
    },
    replace: [
      [
        'details',
        'Structurally: N1、N2 ＋ といった ＋ N3, where N1/N2 are specific examples and N3 is the category',
        'Structurally: A、B ＋ といった ＋ C, where A and B are specific examples and C is the category',
      ],
    ],
  },
  'n2-grammar-14-2': {
    title: 'わたって',
    set: {
      structure: 'Noun (period / distance / area) + に（も）わたって / にわたる + Noun',
      explanation:
        'Indicates that something covers the whole of a stated period, distance or area. Adding も (にもわたって) stresses that the span is long or wide. Before a noun it becomes にわたる.',
      examples: [
        { jp: '手術は3時間にわたって行われた。', en: 'The operation lasted for three hours.' },
        { jp: '砂漠は東西450キロにわたって広がっている。', en: 'The desert extends 450 km from east to west.' },
        {
          jp: '10年にわたる研究の結果が、ついに発表された。',
          en: 'The results of research spanning ten years were finally announced.',
        },
      ],
      summary:
        'に（も）わたって says something covers an entire period or area — often a notably long or wide one; にわたる modifies a following noun.',
      details:
        '手術は3時間**にわたって**行われた。 *(The operation lasted for three hours.)*\n砂漠は東西450キロ**にわたって**広がっている。 *(The desert extends 450 km from east to west.)*\n10年**にわたる**研究の結果が、ついに発表された。 *(The results of ten years of research were finally announced.)*\n\nにわたって takes a noun of time, distance or area (3時間, 450キロ, 全国, 長期) and says the action or state covers the whole of that span — typical of news and written reports. Adding も (に**も**わたって) stresses that the span is surprisingly long or wide: 会議は10時間にもわたった *(the meeting went on for a full ten hours)*. Before a noun, use にわたる (10年にわたる研究).',
    },
  },
  'n2-grammar-16-1': {
    title: '応じて',
    set: {
      meaning: 'In accordance with / Depending on',
      explanation:
        'Indicates that something changes or is adjusted to match X — an amount, a situation, a need or a request. Before a noun it becomes に応じた.',
      examples: [
        { jp: '収入に応じて、税金の額が変わる。', en: 'The amount of tax changes according to income.' },
        {
          jp: '時代の変化に応じて若者の文化や考え方も変わる。',
          en: "Young people's culture and ways of thinking also change in response to the changing times.",
        },
        {
          jp: 'このレストランでは、客の好みに応じた料理を出してくれる。',
          en: "This restaurant serves dishes suited to each customer's taste.",
        },
      ],
      summary:
        'に応じて means "in accordance with / depending on" — the result adjusts to match X (an amount, situation, need or request).',
      details:
        '収入**に応じて**、税金の額が変わる。 *(The amount of tax changes according to income.)*\n時代の変化**に応じて**若者の文化や考え方も変わる。 *(Young people\'s culture and ways of thinking change in response to the times.)*\nこのレストランでは、客の好み**に応じた**料理を出してくれる。 *(This restaurant serves dishes suited to each customer\'s taste.)*\n\nThe noun before に応じて is usually something that varies — 収入, 年齢, 能力, 季節, 状況, ニーズ — and the result scales or adjusts with it. Before a noun it becomes に応じた. The verb 応じる on its own means "to respond to / accept" (要求に応じる, "to accept a demand"; 質問に応じる, "to answer questions"), which is where the pattern\'s meaning comes from.',
      tags: ['manner-accordance'],
    },
  },
  'n2-grammar-16-2': {
    title: 'にもかかわらず',
    set: {
      structure: 'Verb/い-Adj (Plain) / な-Adj・Noun (である) + にもかかわらず',
      examples: [
        {
          jp: '雨が激しく降っているにもかかわらず、サッカーの試合は行われた。',
          en: 'Despite the heavy rain, the soccer match was held.',
        },
        { jp: '彼は熱があるにもかかわらず、仕事へ行きました。', en: 'In spite of having a fever, he went to work.' },
        { jp: '悪天候にもかかわらず、多くの人が集まった。', en: 'Despite the bad weather, many people gathered.' },
      ],
    },
    appendDetails:
      'With a noun it often attaches directly, with no である: 悪天候**にもかかわらず**、多くの人が集まった。 *(Despite the bad weather, many people gathered.)*',
  },
  'n2-grammar-16-3': {
    title: 'ところだった',
    set: {
      meaning: "Almost ~ / Nearly ~ (but didn't)",
      examples: [
        { jp: 'もう少しで電車に乗り遅れるところだった。', en: 'I almost missed the train.' },
        { jp: 'あやうく事故を起こすところだった。', en: 'I almost caused an accident.' },
      ],
    },
    replace: [
      ['details', '*(I was just about to miss the train — but I made it.)*', '*(I almost missed the train — but I made it.)*'],
    ],
  },
  'n2-grammar-17-1': {
    title: 'からには',
    set: {
      examples: [
        {
          jp: '大学院に入ったからには、どんなに大変でも学位を取って国へ帰りたい。',
          en: "Now that I've gotten into graduate school, I want to get my degree and go back home no matter how tough it is.",
        },
        { jp: 'やるからには勝たなければならないと思う。', en: "If I'm going to do it at all, I think I have to win." },
      ],
    },
    replace: [
      ['details', "*(As long as I'm doing it, I feel I have to win.)*", "*(If I'm going to do it at all, I think I have to win.)*"],
    ],
  },
  'n2-grammar-17-2': {
    title: 'ざるを得ない',
    set: {
      meaning: 'Have no choice but to / Cannot avoid ~ing',
      examples: [
        {
          jp: '熱が39度もあるので、今日の会議は休まざるを得ない。',
          en: "Since I have a fever of 39 degrees, I have no choice but to miss today's meeting.",
        },
        {
          jp: '電車が止まってしまったので、歩いて帰らざるを得ない。',
          en: 'Because the trains have stopped, I have no choice but to walk home.',
        },
      ],
    },
    replace: [
      ['summary', "— 'cannot help but...'", "— 'have no choice but to...'"],
      ['details', "*(Because the trains have stopped, I can't help but walk home.)*", '*(Because the trains have stopped, I have no choice but to walk home.)*'],
    ],
    appendDetails: 'Note the reading: 得ない is read **えない** here, not とくない.',
  },
  'n2-grammar-18-1': {
    title: 'ものの',
    set: { structure: 'Verb/い-Adj (Plain) / な-Adj + な・である / Noun + である + ものの' },
  },
  'n2-grammar-20-1': {
    title: 'からいうと',
    set: {
      explanation:
        'Used to make a judgment or evaluation from a particular standpoint, or on the basis of a particular piece of evidence.',
    },
  },
  'n2-grammar-21-1': {
    title: 'といえども',
    set: {
      meaning: 'Even though (it is) ~ / Even ~',
      examples: [
        {
          jp: 'どんな大金持ちといえども、お金で解決できない悩みがあるはずだ。',
          en: "However rich one might be, there are bound to be some problems that money can't solve.",
        },
        { jp: '名医といえども、すべての患者を救うことはできない。', en: 'Even a renowned doctor cannot save every patient.' },
      ],
    },
    replace: [
      ['details', '*(However skillful a doctor might be, she cannot save all her patients.)*', '*(Even a renowned doctor cannot save every patient.)*'],
      ['details', 'というても', 'といっても'],
    ],
  },
  'n2-grammar-21-2': {
    title: '基づいて',
    set: {
      examples: [
        { jp: 'この映画は、事実に基づいて作られている。', en: 'This film is based on actual events.' },
        {
          jp: 'デパートでは、調査結果に基づいた新しいサービスを導入した。',
          en: 'The department store introduced some new services based on the results of a survey.',
        },
      ],
      tags: ['manner-accordance', 'formal-written'],
    },
    replace: [['details', '*(This film is based on true facts.)*', '*(This film is based on actual events.)*']],
  },
  'n2-grammar-21-3': {
    title: '一方で',
    set: {
      title: '〜一方（で）',
      meaning: 'While ~ / On the other hand',
      structure: 'Plain form (な-Adj な／である, Noun である) + 一方（で） / 〜。一方（で）、〜',
      explanation:
        'Sets two contrasting facts or sides side by side, both of which are true — "while X, on the other hand Y". It can attach directly to a clause, follow が, or open a new sentence.',
      examples: [
        {
          jp: '日本は技術が進んだ国だが、一方で古い伝統文化も大切にしている。',
          en: 'Japan is a technologically advanced country, but at the same time it cherishes its traditional culture.',
        },
        {
          jp: 'この町では観光客が増える一方で、住民の数は減っている。',
          en: 'In this town, while the number of tourists is increasing, the number of residents is falling.',
        },
        { jp: 'インターネットは便利だ。一方で、危険な面もある。', en: 'The internet is convenient. On the other hand, it also has its dangers.' },
      ],
      summary: '一方（で） sets two contrasting facts side by side — "while X, on the other hand Y" — and both remain true.',
      details:
        '日本は技術が進んだ国だ**が、一方で**古い伝統文化も大切にしている。\n*(Japan is a technologically advanced country, but at the same time it cherishes its traditional culture.)*\nこの町では観光客が増える**一方で**、住民の数は減っている。\n*(In this town, while the number of tourists is increasing, the number of residents is falling.)*\nインターネットは便利だ。**一方で**、危険な面もある。\n*(The internet is convenient. On the other hand, it also has its dangers.)*\n\n一方で highlights that two contrasting facts are both true at the same time — useful in essays and balanced arguments where you acknowledge two sides without one cancelling the other. Don\'t confuse it with the N3 point 〜一方だ, where 一方 ends the sentence and means "keeps on ~ing / more and more" (物価は上がる一方だ, "prices just keep rising").',
    },
  },
  'n2-grammar-22-1': {
    title: '次第',
    set: {
      title: '〜次第（だ／で）',
      meaning: 'As soon as ~ / Depending on ~ / That is why ~',
      structure: 'V-ます stem + 次第 (as soon as) / Noun + 次第で・次第だ (depending on) / V-た・V-る + 次第です (that is why)',
      explanation:
        '次第 has three uses. After a ます-stem it means "as soon as", for what the speaker will do once something happens. After a noun, 次第で／次第だ means "depending on". After a plain verb, 次第です formally explains how or why something came about.',
      examples: [
        { jp: '詳しいことが分かり次第、ご連絡いたします。', en: 'I will contact you as soon as I know the details.' },
        { jp: '試合を行うかどうかは、天気次第だ。', en: 'Whether the match goes ahead depends on the weather.' },
        {
          jp: '関係者が情報を共有すべきだと考え、皆様にお知らせした次第です。',
          en: 'We believed everyone involved should share the information, which is why we have informed you all.',
        },
        {
          jp: '私どもだけではどうしようもなく、こうしてお願いに参った次第でございます。',
          en: "There's no way we can manage it by ourselves, which is why we have come to ask for your help like this.",
        },
      ],
      summary: '次第 means "as soon as" after a ます-stem, "depending on" after a noun, and "that is why" in formal 次第です explanations.',
      details:
        '### Three uses of 次第\n\n| Form | Meaning | Example |\n| :--- | :--- | :--- |\n| **V-ます stem ＋ 次第** | As soon as | 詳しいことが分かり**次第**、ご連絡いたします。 *(I\'ll contact you as soon as I know the details.)* |\n| **N ＋ 次第で／次第だ** | Depending on N | 試合を行うかどうかは、天気**次第だ**。 *(Whether the match goes ahead depends on the weather.)* |\n| **V-た／V-る ＋ 次第です** | That is why (formal) | 皆様にお知らせした**次第です**。 *(That is why we have informed everyone.)* |\n\nThe "as soon as" use describes what will be done once something happens, so the second clause is a future action or a request — never a past event (✗ 駅に着き次第、雨が降った). The 次第です use is very formal and often closes a business letter or formal explanation, summing up the reason for an action just described.',
      tags: ['time-relative', 'conditional', 'explanation', 'formal-written'],
    },
  },
  'n2-grammar-22-2': {
    title: 'をもって',
    appendDetails:
      'On its own, をもって also marks a point in time in formal announcements: 本日**をもって**閉店いたします *(we are closing as of today)*.',
  },
  'n2-grammar-22-3': {
    title: 'におきましては',
    set: {
      title: '〜においては／におきましては',
      meaning: 'In / As for (formal)',
      explanation:
        'A formal way of saying "〜では", marking the place, time or field a statement applies to. におきましては is its polite form, used in speeches and business writing.',
      examples: [
        {
          jp: '経済成長期の日本においては、収入が2〜3年で倍になることもあった。',
          en: "In Japan during its rapid economic growth period, some people's incomes doubled within two to three years.",
        },
        {
          jp: '当社におきましては、本年度より在宅勤務制度を導入いたしました。',
          en: 'At our company, we introduced a work-from-home system starting this fiscal year.',
        },
      ],
      summary:
        'においては is a formal way of saying では, marking the scope or context a statement applies to; におきましては is its polite form, used in speeches and business writing.',
      details:
        '経済成長期の日本**においては**、収入が2〜3年で倍になることもあった。\n*(In Japan during its rapid economic growth period, some people\'s incomes doubled within two to three years.)*\n当社**におきましては**、本年度より在宅勤務制度を導入いたしました。\n*(At our company, we introduced a work-from-home system starting this fiscal year.)*\n\nにおいては is a formal, written way of saying では, marking the place, time or field a statement applies to. におきましては is its polite (ます-style) version, heard in speeches and business correspondence. To refer respectfully to someone else, use におかれましては instead: 皆様におかれましては、ますますご健勝のこととお喜び申し上げます *(a set letter greeting wishing the readers continued good health)*.',
    },
  },
  'n2-grammar-23-1': {
    title: '及ぶ',
    set: {
      examples: [
        {
          jp: '害虫による松の被害は県内全域に及んでおり、回復には時間がかかるだろう。',
          en: 'Insect damage to pine trees extends to all parts of the prefecture, and it will take time to recover.',
        },
        {
          jp: '議論は国内問題にとどまらず国際問題にまで及び、実りのあるものとなった。',
          en: 'The discussion was not confined to domestic issues but broadened out to include international ones, making it fruitful.',
        },
        { jp: '話し合いは5時間に及んだ。', en: 'The discussion went on for as long as five hours.' },
      ],
    },
    appendDetails:
      'With a number, に及ぶ stresses how large it is: 話し合いは5時間**に及んだ**。 *(The discussion went on for as long as five hours.)*',
  },
  'n2-grammar-24-1': {
    title: 'ざる',
    set: {
      title: 'V-ない ＋ ざる ＋ N',
      meaning: 'Un~ / Not ~ (literary noun modifier)',
      structure: 'Verb (ない-form, drop ない) + ざる + Noun (※する → せざる)',
      explanation:
        'A classical negative form that modifies a noun the way 〜ない does today. It survives mainly in set expressions (知られざる, 招かれざる, 見えざる) and gives a literary tone.',
      examples: [
        { jp: '歴史にはまだ知られざる事実があるはずだ。', en: 'History must still hold facts that are not yet known.' },
        { jp: '彼はパーティーの招かれざる客だった。', en: 'He was an uninvited guest at the party.' },
      ],
      details:
        '歴史にはまだ**知られざる**事実があるはずだ。 *(History must still hold facts that are not yet known.)*\n彼はパーティーの**招かれざる**客だった。 *(He was an uninvited guest at the party.)*\n\nざる is the noun-modifying form of the classical negative ず, so 知られざる事実 is a literary way of saying 知られていない事実. In modern Japanese it survives mainly in set phrases — 知られざる, 招かれざる客, 見えざる手 ("the invisible hand") — and in titles and headlines, so it matters more to recognize than to produce. する becomes せざる (予期せざる, "unforeseen"). The famous 見ざる、聞かざる、言わざる ("see no evil, hear no evil, speak no evil") uses the same negative, punning on 猿 (さる, "monkey") — the three wise monkeys.',
    },
  },
};

const chunk = JSON.parse(readFileSync(FILE, 'utf8')) as Chunk;
const seen = new Set<string>();

for (const items of Object.values(chunk)) {
  for (const item of items) {
    const review = REVIEWS[item.uid];
    if (!review) continue;
    if (!item.title.includes(review.title)) {
      throw new Error(`${item.uid}: expected title containing "${review.title}", found "${item.title}" (already migrated?)`);
    }
    seen.add(item.uid);
    Object.assign(item, review.set);
    for (const [field, from, to] of review.replace ?? []) {
      const text = item[field];
      if (typeof text !== 'string' || !text.includes(from)) {
        throw new Error(`${item.uid}: ${field} does not contain "${from}"`);
      }
      item[field] = text.replace(from, to);
    }
    if (review.appendDetails) item.details = `${item.details}\n\n${review.appendDetails}`;
  }
}

const missing = Object.keys(REVIEWS).filter((uid) => !seen.has(uid));
if (missing.length) throw new Error(`Planned uids not found: ${missing.join(', ')}`);

const output: Chunk = {};
const lessons = Object.keys(chunk)
  .map(Number)
  .sort((a, b) => a - b);
lessons.forEach((oldLesson, index) => {
  const lesson = index + 1;
  output[lesson] = chunk[oldLesson].map((item, n) => {
    const uid = `n2-grammar-${lesson}-${n + 1}`;
    if (dryRun) console.log(`${item.uid} -> ${uid}  ${item.title}`);
    return { ...item, uid, lesson };
  });
});

if (dryRun) {
  console.log(`\n${seen.size} items reviewed, ${lessons.length} lessons (dry run, nothing written)`);
} else {
  writeFileSync(FILE, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${FILE}: ${seen.size} items reviewed, lessons renumbered 1-${lessons.length}`);
}
