/**
 * Function-category alias layer (docs/search/02-requirements.md §3 Should #10,
 * docs/search/04-data.md §6, teacher §4). Reference data over the EXISTING tags only —
 * no re-tagging. Addition, Approximation and Range wait for the v2 re-tag; Concession and
 * Contrast share one chip because the data has one tag for both.
 *
 * Every tag also matches its own id and taxonomy label automatically (`degree/extent`).
 * Tests check that every tag id here exists in tag-taxonomy.json.
 */

export interface AliasCategory {
  id: string;
  label: string;
  tags: string[];
  aliases: string[];
}

export const ALIAS_CATEGORIES: readonly AliasCategory[] = [
  { id: 'cause-reason', label: 'Cause / reason', tags: ['cause-reason'],
    aliases: ['because', 'since', 'due to', 'thanks to', 'reason', 'why', 'so', 'cause'] },
  { id: 'result-consequence', label: 'Result / consequence', tags: ['result-consequence', 'decision-outcome'],
    aliases: ['so', 'therefore', 'as a result', 'ended up', 'result', 'consequence'] },
  { id: 'purpose', label: 'Purpose', tags: ['purpose'],
    aliases: ['in order to', 'so that', 'for', 'purpose'] },
  { id: 'condition', label: 'Condition', tags: ['conditional'],
    aliases: ['if', 'when', 'provided', 'unless', 'in case', 'condition', 'conditional'] },
  { id: 'concession-contrast', label: 'Concession / Contrast', tags: ['concession-contrast'],
    aliases: ['although', 'even though', 'despite', 'even if', 'but', 'whereas', 'while', 'on the other hand',
      'unlike', 'contrast', 'concession', 'though'] },
  { id: 'limitation', label: 'Limitation', tags: ['emphasis-limitation'],
    aliases: ['only', 'just', 'nothing but', 'no more than', 'limitation'] },
  { id: 'emphasis', label: 'Emphasis', tags: ['emphasis-limitation', 'emphasis-assertion'],
    aliases: ['even', 'especially', 'precisely', 'indeed', 'emphasis'] },
  { id: 'degree', label: 'Degree / intensity', tags: ['degree-extent', 'excessive-degree'],
    aliases: ['very', 'so much', 'too', 'extent', 'how much', 'degree', 'intensity'] },
  { id: 'comparison', label: 'Comparison', tags: ['comparison'],
    aliases: ['than', 'compared to', 'rather', 'more', 'the most', 'comparison', 'compare'] },
  { id: 'similarity', label: 'Similarity / appearance', tags: ['similarity-appearance'],
    aliases: ['like', 'as if', 'seems', 'looks', 'similarity', 'appearance'] },
  { id: 'hearsay', label: 'Hearsay', tags: ['hearsay'],
    aliases: ['i heard', 'apparently', 'they say', 'hearsay'] },
  { id: 'inference', label: 'Inference / certainty', tags: ['conjecture-inference', 'certainty-expectation', 'possibility'],
    aliases: ['probably', 'must be', 'maybe', 'might', 'surely', 'inference', 'certainty'] },
  { id: 'obligation', label: 'Obligation', tags: ['obligation-necessity'],
    aliases: ['must', 'have to', 'no choice', "can't help", 'obligation', 'necessity'] },
  { id: 'permission-prohibition', label: 'Permission / prohibition', tags: ['permission', 'prohibition'],
    aliases: ['may', 'allowed', 'must not', "don't", 'permission', 'prohibition'] },
  { id: 'advice-request', label: 'Advice / request / command', tags: ['advice-suggestion', 'request', 'command'],
    aliases: ['should', 'please', 'had better', "let's", 'advice', 'request', 'command'] },
  { id: 'intention', label: 'Intention / volition', tags: ['volitional-intention', 'attempt'],
    aliases: ['intend', 'plan', 'try to', 'going to', 'will', 'intention', 'volition'] },
  { id: 'time-sequence', label: 'Time / sequence', tags: ['time-relative', 'simultaneous-action', 'completion'],
    aliases: ['when', 'before', 'after', 'while', 'as soon as', 'until', 'time', 'sequence'] },
  { id: 'topic', label: 'Topic / regarding', tags: ['viewpoint-standpoint'],
    aliases: ['about', 'regarding', 'concerning', 'as for', 'topic'] },
  { id: 'standpoint', label: 'Standpoint / basis', tags: ['viewpoint-standpoint', 'manner-accordance'],
    aliases: ['for', 'as', 'according to', 'based on', 'standpoint', 'basis'] },
  { id: 'change-state', label: 'Change / state', tags: ['change-of-state', 'state-continuation', 'habit-effort'],
    aliases: ['become', 'keep', 'still', 'used to', 'change', 'state'] },
  { id: 'feelings', label: 'Feelings / attitude', tags: ['emotion-expression', 'spontaneous-perception'],
    aliases: ['regret', "can't help feeling", 'surprise', 'feeling', 'feelings', 'emotion'] },
  { id: 'voice', label: 'Voice & conjugation', tags: ['passive', 'causative', 'causative-passive', 'potential', 'giving-receiving'],
    aliases: ['passive', 'causative', 'can', 'give', 'receive', 'voice', 'conjugation'] },
];

/** Extra spellings for individual tags, beyond their id and taxonomy label. */
export const TAG_ALIASES: Readonly<Record<string, string[]>> = {
  'degree-extent': ['degree/extent'],
  'concession-contrast': ['concession/contrast'],
  'cause-reason': ['cause/reason'],
};

/** Okurigana spelling pairs: each spelling is indexed as an alias of the other. */
export const OKURIGANA_PAIRS: readonly [string, string][] = [
  ['分る', '分かる'],
  ['終る', '終わる'],
  ['行なう', '行う'],
  ['変る', '変わる'],
  ['代る', '代わる'],
  ['当る', '当たる'],
  ['受付', '受け付け'],
  ['申込む', '申し込む'],
  ['取消す', '取り消す'],
  ['落着く', '落ち着く'],
];

/** Lower-case words joined by one space: `Degree / Extent` → `degree extent`. */
export function aliasKey(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
}
