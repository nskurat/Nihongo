/**
 * English meaning search (docs/search/04-data.md §2.6). The index folds plurals only;
 * the query side expands -ing/-ed and a small irregular table. Doing it this way round
 * keeps `even` away from `evening`/`event` while `lost` still reaches `lose`. Pure.
 */

export const STOPWORDS = new Set(
  (
    'a an the of to in on at for by with and or is are be as it its one s sb sth someone something etc eg e g ie i ' +
    "one's oneself"
  ).split(' ')
);

const IRREGULAR: Record<string, string> = {
  lost: 'lose', went: 'go', gone: 'go', ate: 'eat', eaten: 'eat', saw: 'see', seen: 'see', taught: 'teach',
  bought: 'buy', thought: 'think', children: 'child', men: 'man', women: 'woman', better: 'good', best: 'good',
  ran: 'run', came: 'come', gave: 'give', given: 'give', took: 'take', taken: 'take', made: 'make', said: 'say',
  told: 'tell', felt: 'feel', left: 'leave', met: 'meet', wrote: 'write', written: 'write', spoke: 'speak',
  spoken: 'speak', knew: 'know', known: 'know', got: 'get', gotten: 'get', began: 'begin', begun: 'begin',
  became: 'become', brought: 'bring', caught: 'catch', fell: 'fall', fallen: 'fall', found: 'find', held: 'hold',
  kept: 'keep', paid: 'pay', sold: 'sell', sent: 'send', slept: 'sleep', stood: 'stand', understood: 'understand',
  won: 'win', wore: 'wear', worn: 'wear', mice: 'mouse', feet: 'foot', teeth: 'tooth', people: 'person',
  did: 'do', done: 'do', was: 'be', were: 'be', had: 'have', has: 'have', drank: 'drink', drunk: 'drink',
  swam: 'swim', sang: 'sing', sung: 'sing', drove: 'drive', driven: 'drive', rode: 'ride', flew: 'fly',
  flown: 'fly', forgot: 'forget', forgotten: 'forget', broke: 'break', broken: 'break', chose: 'choose',
  chosen: 'choose', woke: 'wake', hid: 'hide', hidden: 'hide', lent: 'lend', built: 'build', meant: 'mean',
  heard: 'hear', sat: 'sit', spent: 'spend', threw: 'throw', thrown: 'throw', grew: 'grow', grown: 'grow',
};

/** Index-side plural folding: -ies→y, -(s|x|z|ch|sh)es→, -s (not -ss/-us/-is). */
export function foldPlural(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 3 && /(s|x|z|ch|sh)es$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}

/** Raw lower-case words of a string, `'s` and edge quotes stripped. Stopwords kept. */
export function words(s: string): string[] {
  const out: string[] = [];
  for (const raw of s.normalize('NFKC').toLowerCase().split(/[^a-z0-9']+/)) {
    const w = raw.replace(/^'+|'+$/g, '').replace(/'s$/, '');
    if (w) out.push(w);
  }
  return out;
}

/** Index tokens: words minus stopwords, plural-folded, deduplicated. */
export function enTokens(s: string | undefined): string[] {
  if (!s) return [];
  const out = new Set<string>();
  for (const w of words(s)) if (!STOPWORDS.has(w)) out.add(foldPlural(w));
  return [...out];
}

/** Query-side candidate base forms of one word (all plural-folded, as the index is). */
export function queryForms(t: string): string[] {
  const f = new Set<string>([t, foldPlural(t)]);
  const irregular = IRREGULAR[t];
  if (irregular) f.add(irregular);
  for (const suffix of ['ing', 'ed']) {
    if (t.length > suffix.length + 2 && t.endsWith(suffix)) {
      const b = t.slice(0, -suffix.length);
      f.add(b);
      f.add(`${b}e`);
      f.add(b.replace(/(.)\1$/, '$1'));
      if (suffix === 'ed' && b.endsWith('i')) f.add(`${b.slice(0, -1)}y`);
    }
  }
  return [...f].map(foldPlural);
}

/** Query words with stopwords removed (`in addition` → `addition`). */
export function queryTerms(s: string): string[] {
  return words(s).filter((w) => !STOPWORDS.has(w));
}

/** Lower-case words joined by single spaces, for phrase matching. */
export function phraseText(s: string): string {
  return ` ${words(s).join(' ')} `;
}
