/**
 * Text normalisation shared by the index builder and the query planner
 * (docs/search/04-data.md §2.1). Pure, no dependencies.
 */

const KATAKANA = /[ァ-ヶ]/g;
const TILDES = /[~～〜]/g;

/** Katakana U+30A1–30F6 → hiragana. `ー` is kept. */
export function kataToHira(s: string): string {
  return s.replace(KATAKANA, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** NFKC, lower-case, katakana → hiragana, every tilde → `〜`, whitespace collapsed. */
export function norm(s: string): string {
  return kataToHira(s.normalize('NFKC').toLowerCase())
    .replace(TILDES, '〜')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `norm()` minus `〜`, whitespace and `・`. Every stored key and every query goes through this. */
export function key(s: string): string {
  return norm(s).replace(/[〜\s・]/g, '');
}

const KANA_ONLY = /^[ぁ-ゖー]+$/;
const CJK = /[一-鿿㐀-䶿々〆]/;
const CJK_CHAR = /^[一-鿿㐀-䶿々〆]$/;

/** Hiragana (and `ー`) only. Run on a key, so katakana is already folded. */
export function isKana(s: string): boolean {
  return KANA_ONLY.test(s);
}

export function hasKanji(s: string): boolean {
  return CJK.test(s);
}

export function isKanjiChar(ch: string): boolean {
  return CJK_CHAR.test(ch);
}

/** The kanji characters of a string, in order, deduplicated (`々` excluded). */
export function kanjiChars(s: string): string[] {
  const out: string[] = [];
  for (const ch of s) if (ch !== '々' && ch !== '〆' && isKanjiChar(ch) && !out.includes(ch)) out.push(ch);
  return out;
}

const VOWEL_OF: Record<string, 'a' | 'i' | 'u' | 'e' | 'o'> = {};
const ROWS: [string, 'a' | 'i' | 'u' | 'e' | 'o'][] = [
  ['あかさたなはまやらわがざだばぱぁゃゎ', 'a'],
  ['いきしちにひみりぎじぢびぴぃ', 'i'],
  ['うくすつぬふむゆるぐずづぶぷぅゅゔ', 'u'],
  ['えけせてねへめれげぜでべぺぇ', 'e'],
  ['おこそとのほもよろをごぞどぼぽぉょ', 'o'],
];
for (const [chars, v] of ROWS) for (const c of chars) VOWEL_OF[c] = v;

/**
 * Long-vowel fold on hiragana (§3.2): after an o-row kana drop う/お/ー, after e-row
 * い/え/ー, after u-row う/ー, after a-row あ/ー, after i-row い/ー. So `きょしつ`,
 * `きょうしつ` and `きょーしつ` all fold to `きょしつ`.
 */
export function foldLong(h: string): string {
  let out = '';
  let prevVowel: string | undefined;
  for (const ch of h) {
    const v = prevVowel;
    if (v) {
      if (ch === 'ー') continue;
      if (v === 'o' && (ch === 'う' || ch === 'お')) continue;
      if (v === 'e' && (ch === 'い' || ch === 'え')) continue;
      if (v === 'u' && ch === 'う') continue;
      if (v === 'a' && ch === 'あ') continue;
      if (v === 'i' && ch === 'い') continue;
    }
    out += ch;
    prevVowel = VOWEL_OF[ch];
  }
  return out;
}

/**
 * The display string mapped through `key()` one character at a time, with the UTF-16
 * offset of each key character back into the display string. Used for highlights:
 * a range found in `text` maps to `[starts[i], ends[j-1])` in the display string.
 */
export interface KeyMap {
  text: string;
  starts: number[];
  ends: number[];
}

export function keyMap(display: string): KeyMap {
  let text = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const ch of display) {
    const piece = key(ch);
    for (let i = 0; i < piece.length; i++) {
      starts.push(offset);
      ends.push(offset + ch.length);
    }
    text += piece;
    offset += ch.length;
  }
  return { text, starts, ends };
}

/** Ranges of `needle` (a key) inside `display`, as offsets into the display string. */
export function findKeyRanges(display: string, needle: string, max = 3): [number, number][] {
  if (!needle) return [];
  const m = keyMap(display);
  const out: [number, number][] = [];
  let from = 0;
  while (out.length < max) {
    const i = m.text.indexOf(needle, from);
    if (i < 0) break;
    out.push([m.starts[i], m.ends[i + needle.length - 1]]);
    from = i + needle.length;
  }
  return out;
}
