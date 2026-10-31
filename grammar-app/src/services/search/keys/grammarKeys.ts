import { kataToHira } from '../normalize';

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
  return keys;
}
