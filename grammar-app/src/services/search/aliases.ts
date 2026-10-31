/**
 * Function-category alias layer (docs/search/02-requirements.md §3 Should #10,
 * docs/search/04-data.md §6, teacher §4, teacher review F11). Reference data over the
 * EXISTING tags only — no re-tagging.
 *
 * - `tags`: a grammar point belongs to the category when it carries one of these tags…
 * - `titleKeys` (optional): …and, when given, also has one of these title keys. This
 *   narrows a mixed tag honestly (Limitation is the だけ/しか part of
 *   `emphasis-limitation`; Addition is the ばかりか/上に/に加えて part of four tags).
 * - `core` (optional): per alias, the title keys a teacher expects first for that word
 *   (`because` → から, ので). Those points rank at the top of the grammar group.
 *
 * Every tag also matches its own id and taxonomy label automatically (`degree/extent`).
 * Tests check that every tag id exists in tag-taxonomy.json.
 */

export interface AliasCategory {
  id: string;
  label: string;
  tags: string[];
  aliases: string[];
  titleKeys?: string[];
  core?: Record<string, string[]>;
}

export const ALIAS_CATEGORIES: readonly AliasCategory[] = [
  { id: 'cause-reason', label: 'Cause / reason', tags: ['cause-reason'],
    aliases: ['because', 'since', 'due to', 'thanks to', 'reason', 'why', 'so', 'cause'],
    core: { because: ['から', 'ので'], since: ['から', 'ので'], reason: ['から', 'ので'], so: ['から', 'ので', 'それで'],
      'due to': ['ため', 'せいで', 'おかげで'], 'thanks to': ['おかげで'], why: ['どうして'] } },
  { id: 'result-consequence', label: 'Result / consequence', tags: ['result-consequence', 'decision-outcome'],
    aliases: ['so', 'therefore', 'as a result', 'ended up', 'result', 'consequence'],
    core: { so: ['それで'], therefore: ['それで', 'したがって'] } },
  { id: 'purpose', label: 'Purpose', tags: ['purpose'],
    aliases: ['in order to', 'so that', 'for', 'purpose'],
    core: { 'in order to': ['ために', 'ように'], 'so that': ['ように'] } },
  { id: 'condition', label: 'Condition', tags: ['conditional'],
    aliases: ['if', 'when', 'provided', 'unless', 'in case', 'condition', 'conditional'],
    core: { if: ['たら', 'ば', 'なら', 'と'], unless: ['ないかぎり'], 'in case': ['ばあいは', '場合は'] } },
  { id: 'concession-contrast', label: 'Concession / Contrast', tags: ['concession-contrast'],
    aliases: ['although', 'even though', 'despite', 'even if', 'but', 'whereas', 'while', 'on the other hand',
      'unlike', 'contrast', 'concession', 'though', 'however'],
    core: { although: ['けど', 'けれども', 'のに'], though: ['けど', 'けれども', 'のに'], but: ['が', 'けど', 'しかし'],
      however: ['しかし'], 'even if': ['ても'], 'even though': ['のに', 'ても'] } },
  { id: 'addition', label: 'Addition', tags: ['listing-examples', 'emphasis-limitation', 'degree-extent', 'emphasis-assertion'],
    titleKeys: ['ばかりか', 'ばかりでなく', 'だけでなく', 'のみならず', 'に限らず', '上に', 'に加えて', 'さらに', 'それに', 'はもちろん', 'はもとより'],
    aliases: ['not only', 'besides', 'moreover', 'in addition', 'addition', 'furthermore', 'as well as'],
    core: { 'not only': ['ばかりでなく', 'だけでなく'], moreover: ['それに', 'さらに'], 'in addition': ['それに', 'に加えて'],
      besides: ['上に', 'それに'] } },
  { id: 'limitation', label: 'Limitation', tags: ['emphasis-limitation'],
    titleKeys: ['だけ', 'しか', 'しかない', 'ばかり', 'だけで', 'に限り', 'かぎり', 'のみ'],
    aliases: ['only', 'just', 'nothing but', 'no more than', 'limitation'],
    core: { only: ['だけ', 'しか'], just: ['だけ'], 'nothing but': ['ばかり'] } },
  { id: 'emphasis', label: 'Emphasis', tags: ['emphasis-limitation', 'emphasis-assertion'],
    aliases: ['even', 'especially', 'precisely', 'indeed', 'emphasis'] },
  { id: 'degree', label: 'Degree / intensity', tags: ['degree-extent', 'excessive-degree'],
    aliases: ['very', 'so much', 'too', 'extent', 'how much', 'degree', 'intensity'],
    core: { too: ['すぎる'] } },
  { id: 'approximation', label: 'Approximation', tags: ['degree-extent', 'time-relative'],
    titleKeys: ['くらい', 'ぐらい', 'ごろ', '頃', 'ほど'],
    aliases: ['about', 'around', 'roughly', 'approximately', 'approximation'],
    core: { about: ['くらい', 'ぐらい', 'ごろ'], around: ['ごろ', 'くらい'] } },
  { id: 'comparison', label: 'Comparison', tags: ['comparison'],
    aliases: ['than', 'compared to', 'rather', 'more', 'the most', 'comparison', 'compare'],
    core: { than: ['より'], 'the most': ['いちばん'] } },
  { id: 'similarity', label: 'Similarity / appearance', tags: ['similarity-appearance'],
    aliases: ['like', 'as if', 'seems', 'looks', 'similarity', 'appearance'],
    core: { like: ['ようだ', 'みたい'], 'as if': ['まるで'] } },
  { id: 'hearsay', label: 'Hearsay', tags: ['hearsay'],
    aliases: ['i heard', 'apparently', 'they say', 'hearsay'],
    core: { 'i heard': ['そうです'], apparently: ['らしい'] } },
  { id: 'inference', label: 'Inference / certainty', tags: ['conjecture-inference', 'certainty-expectation', 'possibility'],
    aliases: ['probably', 'must be', 'maybe', 'might', 'may', 'surely', 'inference', 'certainty'],
    core: { probably: ['でしょう', 'だろう'], maybe: ['かもしれません'], might: ['かもしれません'], may: ['かもしれません'] } },
  { id: 'obligation', label: 'Obligation', tags: ['obligation-necessity'],
    aliases: ['must', 'have to', 'no choice', 'obligation', 'necessity'] },
  { id: 'permission-prohibition', label: 'Permission / prohibition', tags: ['permission', 'prohibition'],
    aliases: ['may', 'allowed', 'must not', "don't", 'permission', 'prohibition'] },
  { id: 'advice-request', label: 'Advice / request / command', tags: ['advice-suggestion', 'request', 'command'],
    aliases: ['should', 'please', 'had better', "let's", 'advice', 'request', 'command'],
    core: { should: ['ほうがいい'], please: ['ください'] } },
  { id: 'intention', label: 'Intention / volition', tags: ['volitional-intention', 'attempt'],
    aliases: ['intend', 'plan', 'try to', 'going to', 'will', "let's", 'intention', 'volition'],
    core: { intend: ['つもり'], 'going to': ['つもり'], "let's": ['ましょう'] } },
  { id: 'experience', label: 'Experience', tags: ['experience'],
    aliases: ['have ever', 'ever', 'have done', 'experience'],
    core: { 'have ever': ['たことがあります'], ever: ['たことがあります'] } },
  { id: 'time-sequence', label: 'Time / sequence', tags: ['time-relative', 'simultaneous-action', 'completion'],
    aliases: ['when', 'before', 'after', 'while', 'as soon as', 'until', 'time', 'sequence'],
    core: { before: ['まえに'], after: ['あとで', 'てから'], when: ['とき'], while: ['ながら', '間に'], until: ['まで', 'までに'] } },
  { id: 'frequency', label: 'Frequency', tags: ['frequency'],
    aliases: ['every time', 'often', 'frequency', 'how often'] },
  { id: 'topic', label: 'Topic / regarding', tags: ['viewpoint-standpoint'],
    titleKeys: ['について', 'に関する', '関して', 'に関して', 'をめぐって', 'をめぐる', 'に対して', 'にとって', 'として'],
    aliases: ['about', 'regarding', 'concerning', 'as for', 'topic'],
    core: { about: ['について'], regarding: ['に関して', '関して', 'について'], concerning: ['に関して', '関して'] } },
  { id: 'standpoint', label: 'Standpoint / basis', tags: ['viewpoint-standpoint', 'manner-accordance'],
    aliases: ['for', 'as', 'according to', 'based on', 'standpoint', 'basis'] },
  { id: 'change-state', label: 'Change / state', tags: ['change-of-state', 'state-continuation', 'habit-effort'],
    aliases: ['become', 'keep', 'still', 'used to', 'change', 'state'],
    core: { become: ['ようになる', 'なる'] } },
  { id: 'feelings', label: 'Feelings / attitude', tags: ['emotion-expression', 'spontaneous-perception'],
    aliases: ['regret', "can't help", "can't help feeling", 'surprise', 'feeling', 'feelings', 'emotion'] },
  { id: 'ease-difficulty', label: 'Ease / difficulty', tags: ['ease-difficulty'],
    aliases: ['easy to', 'hard to', 'difficult to', 'ease', 'difficulty'] },
  { id: 'partial-negation', label: 'Partial negation', tags: ['partial-negation'],
    aliases: ['not necessarily', 'not always', 'partial negation'] },
  { id: 'listing', label: 'Listing / examples', tags: ['listing-examples'],
    aliases: ['such as', 'for example', 'and', 'listing', 'examples'] },
  { id: 'keigo', label: 'Keigo (honorific / humble)', tags: ['keigo-respectful', 'keigo-humble', 'keigo-polite'],
    aliases: ['honorific', 'humble', 'respectful', 'keigo', 'polite'] },
  { id: 'voice', label: 'Voice & conjugation', tags: ['passive', 'causative', 'causative-passive', 'potential', 'giving-receiving'],
    aliases: ['passive', 'causative', 'can', 'give', 'receive', 'voice', 'conjugation'] },
];

/** Extra spellings for individual tags, beyond their id and taxonomy label. */
export const TAG_ALIASES: Readonly<Record<string, string[]>> = {
  'degree-extent': ['degree/extent'],
  'concession-contrast': ['concession/contrast'],
  'cause-reason': ['cause/reason'],
};

/** Okurigana / spelling pairs: each spelling is indexed as an alias of the other. */
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
  ['落す', '落とす'],
  ['引越し', '引っ越し'],
  ['引越す', '引っ越す'],
  ['起る', '起こる'],
  ['売場', '売り場'],
  ['手続', '手続き'],
  ['ご飯', 'ごはん'],
];

/** Lower-case words joined by one space: `Degree / Extent` → `degree extent`. */
export function aliasKey(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
}
