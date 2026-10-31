import { ICHIDAN_I_EXCEPTIONS } from './lemmaExceptions';

/**
 * ます-form → dictionary form for N5/N4 rows (docs/search/04-data.md §2.3). Inferred at
 * build time; `pos` is used when it names a group, else e-row/corpus/exception rules.
 * Every derived lemma is written to the build report for teacher review.
 */

export type MasuRule =
  | 'te-iru'
  | 'kuru'
  | 'suru'
  | 'ichidan(pos)'
  | 'godan(pos)'
  | 'ichidan(e-row)'
  | 'ichidan(kanji-stem)'
  | 'ichidan(corpus)'
  | 'godan(corpus)'
  | 'ichidan(exception)'
  | 'godan(default)'
  | 'godan(honorific)';

export interface MasuLemma {
  lemma: string;
  lemmaReading: string;
  rule: MasuRule;
}

const I_TO_U: Record<string, string> = {
  い: 'う', き: 'く', ぎ: 'ぐ', し: 'す', ち: 'つ', に: 'ぬ', び: 'ぶ', み: 'む', り: 'る',
};
const E_ROW = new Set('えけげせぜてでねへべぺめれ');

function godan(stem: string): string | null {
  const u = I_TO_U[stem.slice(-1)];
  return u ? stem.slice(0, -1) + u : null;
}

export type PosGroup = 0 | 1 | 2 | 3;

/** `Verb (Group II)` → 2. Bare `verb`, missing or non-verb pos → 0. */
export function posGroup(pos: string | undefined): PosGroup {
  if (!pos) return 0;
  if (/Group III/.test(pos)) return 3;
  if (/Group II/.test(pos)) return 2;
  if (/Group I/.test(pos)) return 1;
  return 0;
}

/** True when a ます row should get no lemma (set phrases such as おめでとうございます). */
export function isMasuExpression(word: string, pos: string | undefined): boolean {
  return /^expression/i.test(pos ?? '') || /(ござい|御座い|ご座い)ます$/.test(word);
}

/**
 * @param word one cleaned surface key ending in ます
 * @param reading its paired reading key
 * @param corpus cleaned dictionary-form surfaces (vocab + kanji compounds) for the corpus check
 */
export function masuToDict(word: string, reading: string, pos: string | undefined, corpus: ReadonlySet<string>): MasuLemma | null {
  if (!word.endsWith('ます')) return null;
  const w = word.slice(0, -2);
  const r = reading.endsWith('ます') ? reading.slice(0, -2) : reading;
  if (!w) return null;
  const grp = posGroup(pos);

  // ラ行特殊 honorifics: the ます-stem ends in い, not り (いらっしゃいます → いらっしゃる).
  if (/(くださ|いらっしゃ|おっしゃ|なさ|ござ)い$/.test(w)) {
    return { lemma: `${w.slice(0, -1)}る`, lemmaReading: `${r.slice(0, -1)}る`, rule: 'godan(honorific)' };
  }
  if (/[てで]い$/.test(w)) {
    return { lemma: `${w}る`, lemmaReading: `${r}る`, rule: 'te-iru' };
  }
  if ((w.endsWith('来') || (w.endsWith('き') && grp === 3)) && r.endsWith('き')) {
    return { lemma: `${w.slice(0, -1)}${w.endsWith('来') ? '来る' : 'くる'}`, lemmaReading: `${r.slice(0, -1)}くる`, rule: 'kuru' };
  }
  const go = godan(w);
  if (w.endsWith('し') && (grp === 3 || (grp === 0 && w.length > 1 && !(go && corpus.has(go))))) {
    return { lemma: `${w.slice(0, -1)}する`, lemmaReading: `${r.slice(0, -1)}する`, rule: 'suru' };
  }
  const ichi: MasuLemma = { lemma: `${w}る`, lemmaReading: `${r}る`, rule: 'ichidan(pos)' };
  const goRead = godan(r);
  const five: MasuLemma | null = go && goRead ? { lemma: go, lemmaReading: goRead, rule: 'godan(pos)' } : null;
  if (grp === 2) return ichi;
  if (grp === 1) return five;
  if (E_ROW.has(w.slice(-1)) || E_ROW.has(r.slice(-1))) return { ...ichi, rule: 'ichidan(e-row)' };
  if (!five) return { ...ichi, rule: 'ichidan(kanji-stem)' };
  const hasIchi = corpus.has(ichi.lemma);
  const hasGo = corpus.has(five.lemma);
  if (hasIchi && !hasGo) return { ...ichi, rule: 'ichidan(corpus)' };
  if (hasGo && !hasIchi) return { ...five, rule: 'godan(corpus)' };
  if (ICHIDAN_I_EXCEPTIONS.has(w)) return { ...ichi, rule: 'ichidan(exception)' };
  return { ...five, rule: 'godan(default)' };
}
