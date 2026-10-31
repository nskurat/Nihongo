import { kataToHira } from '../normalize';
import { masuToDict } from './masuToDict';

/**
 * Search keys of a grammar title or structure (docs/search/04-data.md §2.5).
 * Placeholders (V, N, A, B, S1, -form, (place)) are Latin, so extracting Japanese runs
 * drops them: `Vて-form + いただけませんか` → ていただけませんか, て, いただけませんか.
 */

const LATIN_PAREN = /[（(][^）)]*[A-Za-z][^）)]*[）)]/g;
const READING_PAREN = /([一-鿿々])[（(]([ぁ-ゖ]+)[）)]/g;
const OPTIONAL = /[（(]([^）)]*)[）)]/;
/** A parenthetical that shows a derivation (`（〜い→さ）`) is a note, not optional text. */
const ARROW_PAREN = /[（(][^）)]*→[^）)]*[）)]/g;
const JP_RUN = /[ぁ-ゖー一-鿿々〆]+/g;

function expandOptional(s: string): string[] {
  let forms = [s];
  for (let guard = 0; guard < 4 && forms.some((f) => OPTIONAL.test(f)); guard++) {
    forms = forms.flatMap((f) => {
      const m = OPTIONAL.exec(f);
      if (!m) return [f];
      const before = f.slice(0, m.index);
      const after = f.slice(m.index + m[0].length);
      return [before + after, before + m[1] + after];
    });
  }
  return forms;
}

export function grammarKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  const keys: string[] = [];
  const add = (k: string) => {
    if (k && !keys.includes(k)) keys.push(k);
  };
  const s = kataToHira(raw.normalize('NFKC'))
    .replace(READING_PAREN, '$1')
    .replace(LATIN_PAREN, '')
    .replace(ARROW_PAREN, '');
  for (const alt of s.split(/[／/・]/)) {
    for (const form of expandOptional(alt)) {
      const runs = form.replace(/→.*$/, '').match(JP_RUN) ?? [];
      add(runs.join(''));
      // Runs of 2+ chars are keys; so is a lone kana run, which is a particle or form
      // marker (`N(time)に V` → に, `Vて-form` → て) that single-kana queries look for.
      for (const run of runs) if (run.length >= 2 || (runs.length > 1 && /^[ぁ-ゖ]$/.test(run))) add(run);
    }
  }
  // Titles stored in ます/です form also answer plain-form queries (てしまう, はずだ).
  for (const k of [...keys]) for (const p of plainForms(k)) add(p);
  return keys;
}

const NO_CORPUS: ReadonlySet<string> = new Set();

/** Plain-form variants of a polite key: しまいます → しまう, はずです → はずだ, はず. */
export function plainForms(k: string): string[] {
  const out: string[] = [];
  const masu = k.endsWith('ました') ? `${k.slice(0, -3)}ます` : k;
  if (masu.endsWith('します')) out.push(`${masu.slice(0, -3)}する`);
  else if (masu.endsWith('ます') && masu.length > 2) {
    const m = masuToDict(masu, masu, undefined, NO_CORPUS);
    if (m) out.push(m.lemma);
  }
  for (const [polite, plain] of [['です', 'だ'], ['でした', 'だった'], ['でしょう', 'だろう']]) {
    if (k.endsWith(polite) && k.length > polite.length) {
      const base = k.slice(0, -polite.length);
      out.push(base + plain);
      if (base.length >= 2) out.push(base);
    }
  }
  return out;
}

/**
 * Keys that may match INSIDE a longer query (読まずに → 〜ずに): whole kana runs of 2+
 * characters from the title (not the kana tail of a kanji word, 帰ります → ります), never
 * a bare inflection morpheme (ます, ない, です…) and never a key joined across
 * placeholders (`S1か、S2か` → かか). A title made only of kana runs joined by 〜
 * (〜ば〜ほど) yields an ordered sequence key `ば〜ほど`: all its runs must appear in order.
 */
const MORPHEMES = new Set(['ます', 'ません', 'ました', 'ない', 'なかった', 'です', 'でした', 'だった', 'たい', 'ている', 'てい']);
export function grammarPatternKeys(title: string): string[] {
  const s = kataToHira(title.normalize('NFKC'))
    .replace(/[~～]/g, '〜')
    .replace(READING_PAREN, '$1')
    .replace(LATIN_PAREN, '')
    .replace(ARROW_PAREN, '');
  const out: string[] = [];
  const add = (k: string) => {
    if (!out.includes(k)) out.push(k);
  };
  for (const alt of s.split(/[／/・]/)) {
    for (const form of expandOptional(alt)) {
      const trimmed = form.trim().replace(/^〜/, '');
      if (/^[ぁ-ゖー]+(〜[ぁ-ゖー]+)+$/.test(trimmed)) add(trimmed);
      for (const run of form.match(JP_RUN) ?? []) {
        if (/^[ぁ-ゖー]{2,}$/.test(run) && !MORPHEMES.has(run)) add(run);
      }
    }
  }
  return out;
}

/** Whether a pattern key occurs in the query (sequence keys: every run, in order). */
export function patternInQuery(pattern: string, query: string): boolean {
  // A 2-kana key is only trusted at the end of the query (読まずに → ずに), not in the
  // middle of another word (わけにはいかない ⊅ かな).
  if (!pattern.includes('〜')) return pattern.length < query.length && (pattern.length > 2 ? query.includes(pattern) : query.endsWith(pattern));
  let at = 0;
  for (const run of pattern.split('〜')) {
    const i = query.indexOf(run, at);
    if (i < 0) return false;
    at = i + run.length;
  }
  return true;
}
