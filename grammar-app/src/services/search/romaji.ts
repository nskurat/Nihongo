/**
 * Romaji → hiragana for search queries (docs/search/04-data.md §3.2). Accepts Hepburn,
 * kunrei and IME spellings. Long vowels are not guessed: `kyoshitsu` stays きょしつ and
 * reaches 教室 through the long-vowel-folded tier. Pure.
 */

const TABLE: Record<string, string> = {};

const BASE =
  'a:あ i:い u:う e:え o:お ka:か ki:き ku:く ke:け ko:こ sa:さ shi:し si:し su:す se:せ so:そ ' +
  'ta:た chi:ち ti:ち tsu:つ tu:つ te:て to:と na:な ni:に nu:ぬ ne:ね no:の ha:は hi:ひ fu:ふ hu:ふ ' +
  'he:へ ho:ほ ma:ま mi:み mu:む me:め mo:も ya:や yu:ゆ yo:よ ra:ら ri:り ru:る re:れ ro:ろ ' +
  'wa:わ wi:うぃ we:うぇ wo:を ga:が gi:ぎ gu:ぐ ge:げ go:ご ' +
  'za:ざ ji:じ zi:じ zu:ず ze:ぜ zo:ぞ da:だ di:ぢ du:づ dzu:づ de:で do:ど ba:ば bi:び bu:ぶ ' +
  'be:べ bo:ぼ pa:ぱ pi:ぴ pu:ぷ pe:ぺ po:ぽ fa:ふぁ fi:ふぃ fe:ふぇ fo:ふぉ va:ゔぁ vi:ゔぃ ' +
  'vu:ゔ ve:ゔぇ vo:ゔぉ thi:てぃ dhi:でぃ xa:ぁ xi:ぃ xu:ぅ xe:ぇ xo:ぉ xtu:っ xtsu:っ ' +
  'ltu:っ ltsu:っ xya:ゃ xyu:ゅ xyo:ょ lya:ゃ lyu:ゅ lyo:ょ xwa:ゎ';
for (const pair of BASE.split(' ')) {
  const [k, v] = pair.split(':');
  TABLE[k] = v;
}
const Y_ROWS: [string, string][] = [
  ['k', 'き'], ['g', 'ぎ'], ['n', 'に'], ['h', 'ひ'], ['b', 'び'], ['p', 'ぴ'], ['m', 'み'], ['r', 'り'],
];
for (const [c, kana] of Y_ROWS) {
  TABLE[`${c}ya`] = `${kana}ゃ`;
  TABLE[`${c}yu`] = `${kana}ゅ`;
  TABLE[`${c}yo`] = `${kana}ょ`;
}
const PALATAL: [string, string][] = [
  ['sh', 'し'], ['sy', 'し'], ['ch', 'ち'], ['ty', 'ち'], ['cy', 'ち'], ['j', 'じ'], ['zy', 'じ'], ['jy', 'じ'], ['dy', 'ぢ'],
];
for (const [pre, kana] of PALATAL) {
  TABLE[`${pre}a`] = `${kana}ゃ`;
  TABLE[`${pre}u`] = `${kana}ゅ`;
  TABLE[`${pre}o`] = `${kana}ょ`;
  TABLE[`${pre}e`] = `${kana}ぇ`;
}

const MACRON: Record<string, string> = {
  ā: 'aa', ī: 'ii', ū: 'uu', ē: 'ee', ō: 'ou', â: 'aa', î: 'ii', û: 'uu', ê: 'ee', ô: 'ou',
};

const VOWEL_OR_Y = /[aiueoy]/;
const DOUBLING = /[bcdfghjkmpqrstvwxz]/;

/** Converts a romaji query to hiragana. Unconvertible characters are copied through. */
export function romajiToKana(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[āīūēōâîûêô]/g, (c) => MACRON[c])
    .replace(/[\s]/g, '')
    .replace(/-/g, 'ー');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const n = s[i + 1];
    if (c === "'") {
      i++;
      continue;
    }
    if (c === 'n') {
      if (n === "'" || n === 'n') {
        out += 'ん';
        i += 2;
        continue;
      }
      if (n === undefined || !VOWEL_OR_Y.test(n)) {
        out += 'ん';
        i++;
        continue;
      }
    }
    // Hepburn "shimbun", "ammari": m before b/p/m is ん.
    if (c === 'm' && n !== undefined && /[bpm]/.test(n)) {
      out += 'ん';
      i++;
      continue;
    }
    if (c === n && DOUBLING.test(c)) {
      out += 'っ';
      i++;
      continue;
    }
    if (c === 't' && n === 'c' && s[i + 2] === 'h') {
      out += 'っ';
      i++;
      continue;
    }
    if (c === 'o' && n === 'h' && !VOWEL_OR_Y.test(s[i + 2] ?? '')) {
      out += 'おう';
      i += 2;
      continue;
    }
    let matched = false;
    for (let len = 4; len >= 1; len--) {
      const chunk = s.slice(i, i + len);
      const kana = TABLE[chunk];
      if (kana) {
        out += kana;
        i += len;
        matched = true;
        // Hepburn "oh" for a long o (Tohkyoh): h after an o-row syllable, before a consonant or the end.
        if (chunk.endsWith('o') && s[i] === 'h' && !VOWEL_OR_Y.test(s[i + 1] ?? '')) {
          out += 'う';
          i++;
        }
        break;
      }
    }
    if (!matched) {
      out += c;
      i++;
    }
  }
  return out;
}

const LATIN = /^[a-z0-9'āīūēōâîûêô\s/-]+$/;

/** True for a query typed in Latin letters (romaji or English). Run on `norm()` output. */
export function isLatin(normalised: string): boolean {
  return LATIN.test(normalised) && /[a-zāīūēōâîûêô]/.test(normalised);
}
