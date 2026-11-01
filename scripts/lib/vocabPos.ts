/**
 * Closed part-of-speech set for vocab rows (backlog: "Vocab pos + lemma (v2 migration)").
 * N5/N4 rows carried 35 free-text spellings (`verb` ×81 with no group, `Noun`/`noun`,
 * `い-Adjective (phrase)` …); they map onto these values. A `／` pair (入ります／出ます)
 * stores one value per part, joined with ` / `. Pure; used by scripts/migrate-vocab-pos.ts
 * and the content validator.
 */

export const POS_VALUES = [
  'noun',
  'pronoun',
  'interrogative',
  'verb-godan',
  'verb-ichidan',
  'verb-irregular',
  'i-adjective',
  'na-adjective',
  'adverb',
  'determiner',
  'particle',
  'conjunction',
  'interjection',
  'suffix',
  'expression',
  'pattern',
] as const;

export type Pos = (typeof POS_VALUES)[number];

const SET: ReadonlySet<string> = new Set(POS_VALUES);

/** True for a valid stored value: one Pos, or several joined with ` / `. */
export function isPosValue(value: string): boolean {
  return value.split(' / ').every((p) => SET.has(p));
}

/** Group of a verb from the ます→dictionary rule that produced its lemma. */
export function verbPosForRule(rule: string): Pos {
  if (rule === 'suru' || rule === 'kuru') return 'verb-irregular';
  if (rule.startsWith('godan')) return 'verb-godan';
  // ichidan(*) and te-iru (知っています conjugates like いる).
  return 'verb-ichidan';
}

/** One legacy spelling (no ` / `) → its value; null when it is a verb without a group. */
export function mapPosPart(raw: string): Pos | null {
  const s = raw.replace(/\s*\(phrase\)\s*$/i, '').trim();
  if (/interrogative/i.test(s)) return 'interrogative';
  if (/Group III/.test(s)) return 'verb-irregular';
  if (/Group II/.test(s)) return 'verb-ichidan';
  if (/Group I/.test(s)) return 'verb-godan';
  if (/^verb$/i.test(s)) return null;
  if (/^い-?adj/i.test(s)) return 'i-adjective';
  if (/^な-?adj/i.test(s) || /^noun\/adjective$/i.test(s)) return 'na-adjective';
  if (/^grammar pattern$/i.test(s)) return 'pattern';
  const plain = s.toLowerCase();
  if (SET.has(plain)) return plain as Pos;
  return null;
}

/**
 * A row's stored pos: legacy parts mapped one by one; a verb without a group takes it from
 * the lemma rule of the same part (or the only rule). `parts` is the number of ／ parts.
 * Throws on a spelling it doesn't know, so the migration never guesses.
 */
export function normalisePos(raw: string, rules: readonly string[], parts: number): string {
  const legacy = raw.split(/\s+\/\s+/);
  const count = Math.max(parts, legacy.length);
  const out: Pos[] = [];
  for (let i = 0; i < count; i++) {
    const part = legacy.length === count ? legacy[i] : legacy[0];
    const mapped = mapPosPart(part);
    if (mapped) out.push(mapped);
    else if (/^verb$/i.test(part.trim())) {
      const rule = rules.length === count ? rules[i] : rules[0];
      if (!rule) throw new Error(`no lemma rule to group verb "${raw}" (part ${i + 1})`);
      out.push(verbPosForRule(rule));
    } else throw new Error(`unknown pos "${part}"`);
  }
  // A pair whose parts share one value is stored once (知ります／知っています → verb-godan / verb-ichidan stays).
  return out.every((p) => p === out[0]) ? out[0] : out.join(' / ');
}
