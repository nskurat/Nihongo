/**
 * Display labels for the closed vocab part-of-speech set (scripts/lib/vocabPos.ts). Verbs
 * name both the textbook group and the dictionary term learners meet elsewhere.
 */
const LABELS: Record<string, string> = {
  noun: 'Noun',
  pronoun: 'Pronoun',
  interrogative: 'Question word',
  'verb-godan': 'Verb (Group I, godan)',
  'verb-ichidan': 'Verb (Group II, ichidan)',
  'verb-irregular': 'Verb (Group III, irregular)',
  'i-adjective': 'い-adjective',
  'na-adjective': 'な-adjective',
  adverb: 'Adverb',
  determiner: 'Determiner',
  particle: 'Particle',
  conjunction: 'Conjunction',
  interjection: 'Interjection',
  suffix: 'Suffix',
  expression: 'Expression',
  pattern: 'Grammar pattern',
};

/** `verb-godan / verb-ichidan` → `Verb (Group I, godan) / Verb (Group II, ichidan)`; unknown values pass through. */
export function posLabel(pos: string): string {
  return pos
    .split(' / ')
    .map((p) => LABELS[p] ?? p)
    .join(' / ');
}
