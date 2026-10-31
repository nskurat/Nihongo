/**
 * Deinflection rule table (docs/search/04-data.md §3.3, teacher §2). Data, not code.
 *
 * Yomichan-style type chaining: a rule applies to the raw query, or to a candidate whose
 * type (the previous rule's `out`) is in the rule's `in`. A rule with an empty `in` only
 * applies to the raw query (terminal forms such as polite or volitional).
 */

/**
 * v1 ichidan, v5 godan, vk 来る, vs する, adj-i い-adjective, noun (also な-adjectives),
 * te a te-form, aux a te-form left by stripping an auxiliary (its て形 step is not shown),
 * plain any dictionary form (after なら).
 */
export type WordType = 'v1' | 'v5' | 'vk' | 'vs' | 'adj-i' | 'te' | 'aux' | 'noun' | 'plain';

export interface Label {
  en: string;
  ja: string;
}

export interface DeinflectRule {
  from: string;
  to: string;
  label: Label;
  in: WordType[];
  out: WordType;
}

export const L = {
  polite: { en: 'polite', ja: '丁寧' },
  politePast: { en: 'polite past', ja: '丁寧・過去' },
  politeNeg: { en: 'polite negative', ja: '丁寧・否定' },
  politePastNeg: { en: 'polite past negative', ja: '丁寧・過去否定' },
  politeVol: { en: "polite volitional (let's)", ja: '丁寧・意向' },
  negative: { en: 'negative', ja: '否定' },
  past: { en: 'past', ja: '過去' },
  te: { en: 'te-form', ja: 'て形' },
  tai: { en: 'want to (たい)', ja: '希望' },
  potential: { en: 'potential', ja: '可能' },
  passive: { en: 'passive', ja: '受身' },
  potPass: { en: 'potential/passive', ja: '可能・受身' },
  causative: { en: 'causative', ja: '使役' },
  causPass: { en: 'causative-passive', ja: '使役受身' },
  volitional: { en: 'volitional', ja: '意向形' },
  ba: { en: 'conditional (ば)', ja: '仮定形（ば）' },
  tara: { en: 'conditional (たら)', ja: '条件（たら）' },
  imperative: { en: 'imperative', ja: '命令形' },
  zu: { en: 'without (ず/ずに)', ja: '否定（ず）' },
  sou: { en: 'looks like (そう)', ja: '様態' },
  sugiru: { en: 'too much (すぎる)', ja: '過度' },
  nagara: { en: 'while (ながら)', ja: '同時' },
  sa: { en: 'noun (さ)', ja: '名詞化' },
  teiru: { en: 'ongoing/state (ている)', ja: '進行・状態' },
  tearu: { en: 'resultative (てある)', ja: '結果の状態' },
  teshimau: { en: 'completion (てしまう)', ja: '完了' },
  suru: { en: 'する-verb', ja: 'する動詞' },
  raNuki: { en: 'potential (colloquial ら抜き)', ja: '可能（ら抜き）' },
  copula: { en: 'copula (です/だ)', ja: '断定' },
  copulaPast: { en: 'copula, past', ja: '断定・過去' },
  copulaNeg: { en: 'copula, negative', ja: '断定・否定' },
  chau: { en: 'completion, colloquial (ちゃう)', ja: '完了（ちゃう）' },
  teoku: { en: 'preparation (ておく)', ja: '準備（ておく）' },
  adverb: { en: 'adverbial (く)', ja: '連用形' },
  naru: { en: 'become (くなる)', ja: '変化' },
  nara: { en: 'if (なら)', ja: '仮定（なら）' },
  kudasai: { en: 'request (てください)', ja: '依頼' },
} satisfies Record<string, Label>;

const rules: DeinflectRule[] = [];
const r = (from: string, to: string, label: Label, inT: WordType[], out: WordType) =>
  rules.push({ from, to, label, in: inT, out });

/** Godan rows: [u, i, a, e, o] endings. */
const GODAN: [string, string, string, string, string][] = [
  ['う', 'い', 'わ', 'え', 'お'],
  ['く', 'き', 'か', 'け', 'こ'],
  ['ぐ', 'ぎ', 'が', 'げ', 'ご'],
  ['す', 'し', 'さ', 'せ', 'そ'],
  ['つ', 'ち', 'た', 'て', 'と'],
  ['ぬ', 'に', 'な', 'ね', 'の'],
  ['ぶ', 'び', 'ば', 'べ', 'ぼ'],
  ['む', 'み', 'ま', 'め', 'も'],
  ['る', 'り', 'ら', 'れ', 'ろ'],
];

// ---- polite (terminal; ます-forms chain into causative/passive/potential via v1)
const POLITE: [string, Label][] = [
  ['ます', L.polite], ['ました', L.politePast], ['ません', L.politeNeg],
  ['ませんでした', L.politePastNeg], ['ましょう', L.politeVol],
];
for (const [suffix, label] of POLITE) {
  r(suffix, 'る', label, [], 'v1');
  for (const [u, i] of GODAN) r(i + suffix, u, label, [], 'v5');
  r(`し${suffix}`, 'する', label, [], 'vs');
  r(`き${suffix}`, 'くる', label, [], 'vk');
  r(`来${suffix}`, '来る', label, [], 'vk');
}
// Polite irregulars: いらっしゃいます, おっしゃいます, くださいます, なさいます.
for (const stem of ['いらっしゃ', 'おっしゃ', 'くださ', 'なさ', 'ござ']) {
  for (const [suffix, label] of POLITE) r(`${stem}い${suffix}`, `${stem}る`, label, [], 'v5');
}

// ---- negative ない (an い-adjective form, so past/te/ba chain into it)
r('ない', 'る', L.negative, ['adj-i'], 'v1');
for (const [u, , a] of GODAN) r(`${a}ない`, u, L.negative, ['adj-i'], 'v5');
r('しない', 'する', L.negative, ['adj-i'], 'vs');
r('こない', 'くる', L.negative, ['adj-i'], 'vk');
r('来ない', '来る', L.negative, ['adj-i'], 'vk');

// ---- past / te / たら
const TA_GODAN: [string, string[]][] = [
  ['っ', ['う', 'つ', 'る']], ['ん', ['む', 'ぶ', 'ぬ']], ['い', ['く']], ['い*', ['ぐ']], ['し', ['す']],
];
const PAST_FORMS: [string, string, Label, WordType[]][] = [
  ['た', 'だ', L.past, []],
  ['て', 'で', L.te, ['te', 'aux']],
  ['たら', 'だら', L.tara, []],
];
for (const [plain, voiced, label, inT] of PAST_FORMS) {
  r(plain, 'る', label, inT, 'v1');
  for (const [stem, us] of TA_GODAN) {
    for (const u of us) {
      if (stem === 'ん') r(`ん${voiced}`, u, label, inT, 'v5');
      else if (stem === 'い*') r(`い${voiced}`, u, label, inT, 'v5');
      else r(stem + plain, u, label, inT, 'v5');
    }
  }
  r(`し${plain}`, 'する', label, inT, 'vs');
  r(`き${plain}`, 'くる', label, inT, 'vk');
  r(`来${plain}`, '来る', label, inT, 'vk');
  // 行く is the one godan く verb with a っ-form.
  r(`行っ${plain}`, '行く', label, inT, 'v5');
  r(`いっ${plain}`, 'いく', label, inT, 'v5');
}

// ---- te-form auxiliaries (strip; the te-form is deinflected next without its own step)
r('ている', 'て', L.teiru, ['v1'], 'aux');
r('でいる', 'で', L.teiru, ['v1'], 'aux');
r('てる', 'て', L.teiru, ['v1'], 'aux');
r('でる', 'で', L.teiru, ['v1'], 'aux');
r('てある', 'て', L.tearu, ['v5'], 'aux');
r('てしまう', 'て', L.teshimau, ['v5'], 'aux');
r('でしまう', 'で', L.teshimau, ['v5'], 'aux');
r('ちゃう', 'て', L.chau, ['v5'], 'aux');
r('じゃう', 'で', L.chau, ['v5'], 'aux');
r('ておく', 'て', L.teoku, ['v5'], 'aux');
r('でおく', 'で', L.teoku, ['v5'], 'aux');
r('とく', 'て', L.teoku, ['v5'], 'aux');
r('どく', 'で', L.teoku, ['v5'], 'aux');
r('てください', 'て', L.kudasai, [], 'aux');
r('でください', 'で', L.kudasai, [], 'aux');

// ---- たい (an い-adjective form)
r('たい', 'る', L.tai, ['adj-i'], 'v1');
for (const [u, i] of GODAN) r(`${i}たい`, u, L.tai, ['adj-i'], 'v5');
r('したい', 'する', L.tai, ['adj-i'], 'vs');
r('きたい', 'くる', L.tai, ['adj-i'], 'vk');

// ---- potential / passive / causative / causative-passive (all ichidan-shaped: chain on v1)
r('られる', 'る', L.potPass, ['v1'], 'v1');
r('れる', 'る', L.raNuki, ['v1'], 'v1');
r('させる', 'る', L.causative, ['v1'], 'v1');
r('させられる', 'る', L.causPass, ['v1'], 'v1');
for (const [u, , a, e] of GODAN) {
  r(`${e}る`, u, L.potential, ['v1'], 'v5');
  r(`${a}れる`, u, L.passive, ['v1'], 'v5');
  r(`${a}せる`, u, L.causative, ['v1'], 'v5');
  r(`${a}せられる`, u, L.causPass, ['v1'], 'v5');
  if (u !== 'す') r(`${a}される`, u, L.causPass, ['v1'], 'v5');
}
r('できる', 'する', L.potential, ['v1'], 'vs');
r('される', 'する', L.passive, ['v1'], 'vs');
r('させる', 'する', L.causative, ['v1'], 'vs');
r('させられる', 'する', L.causPass, ['v1'], 'vs');
r('こられる', 'くる', L.potPass, ['v1'], 'vk');
r('来られる', '来る', L.potPass, ['v1'], 'vk');
r('こさせる', 'くる', L.causative, ['v1'], 'vk');
r('来させる', '来る', L.causative, ['v1'], 'vk');
r('こさせられる', 'くる', L.causPass, ['v1'], 'vk');

// ---- volitional (terminal)
r('よう', 'る', L.volitional, [], 'v1');
for (const [u, , , , o] of GODAN) r(`${o}う`, u, L.volitional, [], 'v5');
r('しよう', 'する', L.volitional, [], 'vs');
r('こよう', 'くる', L.volitional, [], 'vk');
r('来よう', '来る', L.volitional, [], 'vk');

// ---- conditional ば (terminal)
r('れば', 'る', L.ba, [], 'v1');
for (const [u, , , e] of GODAN) r(`${e}ば`, u, L.ba, [], 'v5');
r('すれば', 'する', L.ba, [], 'vs');
r('くれば', 'くる', L.ba, [], 'vk');
r('来れば', '来る', L.ba, [], 'vk');

// ---- imperative (terminal)
r('ろ', 'る', L.imperative, [], 'v1');
for (const [u, , , e] of GODAN) r(e, u, L.imperative, [], 'v5');
r('しろ', 'する', L.imperative, [], 'vs');
r('せよ', 'する', L.imperative, [], 'vs');
r('こい', 'くる', L.imperative, [], 'vk');
r('来い', '来る', L.imperative, [], 'vk');

// ---- ず / ずに (terminal)
for (const suffix of ['ず', 'ずに']) {
  r(suffix, 'る', L.zu, [], 'v1');
  for (const [u, , a] of GODAN) r(a + suffix, u, L.zu, [], 'v5');
  r(`せ${suffix}`, 'する', L.zu, [], 'vs');
  r(`こ${suffix}`, 'くる', L.zu, [], 'vk');
}

// ---- stem + そう / すぎる / ながら
r('そう', 'る', L.sou, [], 'v1');
r('すぎる', 'る', L.sugiru, ['v1'], 'v1');
r('ながら', 'る', L.nagara, [], 'v1');
for (const [u, i] of GODAN) {
  r(`${i}そう`, u, L.sou, [], 'v5');
  r(`${i}すぎる`, u, L.sugiru, ['v1'], 'v5');
  r(`${i}ながら`, u, L.nagara, [], 'v5');
}

// ---- い-adjectives
r('かった', 'い', L.past, [], 'adj-i');
r('くない', 'い', L.negative, ['adj-i'], 'adj-i');
r('くて', 'い', L.te, ['te', 'aux'], 'adj-i');
r('ければ', 'い', L.ba, [], 'adj-i');
r('かったら', 'い', L.tara, [], 'adj-i');
r('さ', 'い', L.sa, [], 'adj-i');
r('そう', 'い', L.sou, [], 'adj-i');
r('すぎる', 'い', L.sugiru, ['v1'], 'adj-i');
// いい inflects on よい.
r('よかった', 'いい', L.past, [], 'adj-i');
r('よくない', 'いい', L.negative, ['adj-i'], 'adj-i');
r('よくて', 'いい', L.te, ['te', 'aux'], 'adj-i');
r('よければ', 'いい', L.ba, [], 'adj-i');

// ---- adverbial く and くなる
r('く', 'い', L.adverb, [], 'adj-i');
r('くなる', 'い', L.naru, ['v5'], 'adj-i');

// ---- copula after nouns / な-adjectives (静かだった → 静か), です after い-adjectives
const COPULA: [string, Label][] = [
  ['です', L.copula], ['だ', L.copula], ['でした', L.copulaPast], ['だった', L.copulaPast],
  ['じゃない', L.copulaNeg], ['ではない', L.copulaNeg], ['じゃなかった', L.copulaNeg],
  ['じゃありません', L.copulaNeg], ['ではありません', L.copulaNeg], ['でしょう', L.copula],
];
for (const [from, label] of COPULA) r(from, '', label, [], 'noun');
r('いです', 'い', L.copula, [], 'adj-i');
r('かったです', 'い', L.past, [], 'adj-i');
r('くないです', 'い', L.negative, [], 'adj-i');

// ---- なら after any dictionary form (食べるなら)
r('なら', '', L.nara, [], 'plain');

// ---- する-verb → its noun (勉強する → 勉強); the engine only keeps all-kanji/katakana stems
r('する', '', L.suru, ['vs'], 'noun');

export const DEINFLECT_RULES: readonly DeinflectRule[] = rules;

/** Whole-word irregulars that no suffix rule can express. */
export const IRREGULAR_WORDS: Record<string, { lemma: string; label: Label }[]> = {
  ない: [{ lemma: 'ある', label: L.negative }],
  なかった: [{ lemma: 'ある', label: { en: 'negative past', ja: '否定・過去' } }],
};
