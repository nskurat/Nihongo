/**
 * Core expressions (docs/search/07-regression.md R8): everyday greetings and 日本語 that N5
 * learners use from day one but the textbook lessons never listed as vocab (some sat at
 * N2/N3, where the list-derived pipeline placed them). Each goes into the N5 lesson that
 * teaches it in the Minna no Nihongo sequence the N5 lessons follow: greetings with the
 * introductions (L1), 日本語 and ごめんなさい with countries and すみません (L3), home and
 * visiting expressions (L7). They first shipped as a separate lesson 26; `apply` moves
 * them out of it. Teacher-authored; examples use only N5 vocabulary and kanji.
 */

type Json = Record<string, unknown>;
export type LessonFile = Record<string, Json[]>;

/** Where the expressions first shipped; `apply` empties and removes it. */
export const FORMER_LESSON = 26;

export interface CoreExpression {
  /** N5 lesson the expression belongs to. */
  lesson: number;
  word: string;
  reading: string;
  romaji: string;
  pos: string;
  meaning: string;
  exampleJp: string;
  exampleEn: string;
}

export const CORE_EXPRESSIONS: readonly CoreExpression[] = [
  { lesson: 3, word: '日本語', reading: 'にほんご', romaji: 'nihongo', pos: 'noun', meaning: 'Japanese (language)',
    exampleJp: '毎日 日本語を 勉強して います。', exampleEn: 'I study Japanese every day.' },
  { lesson: 1, word: 'おはようございます', reading: 'おはようございます', romaji: 'ohayou gozaimasu', pos: 'expression', meaning: 'Good morning',
    exampleJp: '先生、おはようございます。', exampleEn: 'Good morning, teacher.' },
  { lesson: 1, word: 'こんにちは', reading: 'こんにちは', romaji: 'konnichiwa', pos: 'expression', meaning: 'Hello, good afternoon',
    exampleJp: 'こんにちは。いい 天気ですね。', exampleEn: "Hello. Nice weather, isn't it?" },
  { lesson: 1, word: 'こんばんは', reading: 'こんばんは', romaji: 'konbanwa', pos: 'expression', meaning: 'Good evening',
    exampleJp: 'こんばんは。今日は 寒いですね。', exampleEn: "Good evening. It's cold today, isn't it?" },
  { lesson: 1, word: 'おやすみなさい', reading: 'おやすみなさい', romaji: 'oyasuminasai', pos: 'expression', meaning: 'Good night',
    exampleJp: 'もう 寝ます。おやすみなさい。', exampleEn: "I'm going to bed now. Good night." },
  { lesson: 1, word: 'さようなら', reading: 'さようなら', romaji: 'sayounara', pos: 'expression', meaning: 'Goodbye',
    exampleJp: 'さようなら。また 来週。', exampleEn: 'Goodbye. See you next week.' },
  { lesson: 7, word: 'いただきます', reading: 'いただきます', romaji: 'itadakimasu', pos: 'expression',
    meaning: '(said before eating) Thank you for the food',
    exampleJp: 'みんなで「いただきます」と 言って、食べました。', exampleEn: "We all said 'itadakimasu' and ate." },
  { lesson: 7, word: 'ごちそうさまでした', reading: 'ごちそうさまでした', romaji: 'gochisousama deshita', pos: 'expression',
    meaning: '(said after eating) Thank you for the meal',
    exampleJp: 'ごちそうさまでした。とても おいしかったです。', exampleEn: 'Thank you for the meal. It was delicious.' },
  { lesson: 7, word: 'いってきます', reading: 'いってきます', romaji: 'ittekimasu', pos: 'expression',
    meaning: "(said when leaving home) I'm off, see you later",
    exampleJp: '「いってきます。」「いってらっしゃい。」', exampleEn: "\"I'm off.\" \"See you later.\"" },
  { lesson: 7, word: 'いってらっしゃい', reading: 'いってらっしゃい', romaji: 'itterasshai', pos: 'expression',
    meaning: '(said to someone leaving home) See you later, take care',
    exampleJp: '母は 毎朝「いってらっしゃい」と 言います。', exampleEn: "My mother says 'itterasshai' every morning." },
  { lesson: 7, word: 'ただいま', reading: 'ただいま', romaji: 'tadaima', pos: 'expression', meaning: "(said on coming home) I'm home",
    exampleJp: 'ただいま。おなかが すきました。', exampleEn: "I'm home. I'm hungry." },
  { lesson: 7, word: 'おかえりなさい', reading: 'おかえりなさい', romaji: 'okaerinasai', pos: 'expression',
    meaning: '(said to someone coming home) Welcome home',
    exampleJp: 'おかえりなさい。ごはんが できて いますよ。', exampleEn: 'Welcome home. Dinner is ready.' },
  { lesson: 3, word: 'ごめんなさい', reading: 'ごめんなさい', romaji: 'gomennasai', pos: 'expression', meaning: "I'm sorry",
    exampleJp: 'おそく なって、ごめんなさい。', exampleEn: "I'm sorry I'm late." },
  { lesson: 7, word: '失礼します', reading: 'しつれいします', romaji: 'shitsurei shimasu', pos: 'expression',
    meaning: 'Excuse me (when entering or leaving a room)',
    exampleJp: '「失礼します。」と 言って、部屋に 入りました。', exampleEn: "I said 'excuse me' and went into the room." },
  { lesson: 1, word: 'お願いします', reading: 'おねがいします', romaji: 'onegai shimasu', pos: 'expression', meaning: 'Please (when asking for something)',
    exampleJp: 'コーヒーを お願いします。', exampleEn: 'A coffee, please.' },
];

/**
 * Puts every expression into its lesson: rows already in the former lesson 26 are moved
 * (same fields, new uid), missing ones are added, and lesson 26 is removed. Rows are
 * appended to the end of their lesson, so no existing uid shifts. Idempotent: an
 * expression already in its lesson is left alone. Returns `old uid → new uid` for moved
 * rows (the AI-cache migration renames their entries) and the words newly added.
 */
export function applyCoreExpressions(file: LessonFile): { moved: Record<string, string>; added: string[] } {
  const former = file[String(FORMER_LESSON)] ?? [];
  const formerUid = new Map(former.map((r) => [r.word as string, r.uid as string]));
  const moved: Record<string, string> = {};
  const added: string[] = [];
  for (const e of CORE_EXPRESSIONS) {
    const lesson = (file[String(e.lesson)] ??= []);
    if (lesson.some((r) => r.word === e.word)) continue;
    const uid = `n5-vocab-${e.lesson}-${lesson.length + 1}`;
    lesson.push({
      uid,
      level: 'N5',
      section: 'vocab',
      lesson: e.lesson,
      word: e.word,
      reading: e.reading,
      romaji: e.romaji,
      pos: e.pos,
      meaning: e.meaning,
      exampleJp: e.exampleJp,
      exampleEn: e.exampleEn,
    });
    const old = formerUid.get(e.word);
    if (old) moved[old] = uid;
    else added.push(e.word);
  }
  delete file[String(FORMER_LESSON)];
  return { moved, added };
}
