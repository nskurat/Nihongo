/**
 * N5 lesson 26, "Core expressions" (owner decision D4, docs/search/07-regression.md R8):
 * everyday greetings and 日本語 that N5 learners use from day one but the textbook lessons
 * never list as vocab (some sit at N2/N3, where the list-derived pipeline placed them).
 * Teacher-authored; examples use only N5 vocabulary and kanji. Pure data plus an
 * idempotent `apply`, used by scripts/add-core-expressions.ts.
 */

type Json = Record<string, unknown>;
export type LessonFile = Record<string, Json[]>;

export const CORE_LESSON = 26;

export interface CoreExpression {
  word: string;
  reading: string;
  romaji: string;
  pos: string;
  meaning: string;
  exampleJp: string;
  exampleEn: string;
}

export const CORE_EXPRESSIONS: readonly CoreExpression[] = [
  { word: '日本語', reading: 'にほんご', romaji: 'nihongo', pos: 'noun', meaning: 'Japanese (language)',
    exampleJp: '毎日 日本語を 勉強して います。', exampleEn: 'I study Japanese every day.' },
  { word: 'おはようございます', reading: 'おはようございます', romaji: 'ohayou gozaimasu', pos: 'expression', meaning: 'Good morning',
    exampleJp: '先生、おはようございます。', exampleEn: 'Good morning, teacher.' },
  { word: 'こんにちは', reading: 'こんにちは', romaji: 'konnichiwa', pos: 'expression', meaning: 'Hello, good afternoon',
    exampleJp: 'こんにちは。いい 天気ですね。', exampleEn: "Hello. Nice weather, isn't it?" },
  { word: 'こんばんは', reading: 'こんばんは', romaji: 'konbanwa', pos: 'expression', meaning: 'Good evening',
    exampleJp: 'こんばんは。今日は 寒いですね。', exampleEn: "Good evening. It's cold today, isn't it?" },
  { word: 'おやすみなさい', reading: 'おやすみなさい', romaji: 'oyasuminasai', pos: 'expression', meaning: 'Good night',
    exampleJp: 'もう 寝ます。おやすみなさい。', exampleEn: "I'm going to bed now. Good night." },
  { word: 'さようなら', reading: 'さようなら', romaji: 'sayounara', pos: 'expression', meaning: 'Goodbye',
    exampleJp: 'さようなら。また 来週。', exampleEn: 'Goodbye. See you next week.' },
  { word: 'いただきます', reading: 'いただきます', romaji: 'itadakimasu', pos: 'expression',
    meaning: '(said before eating) Thank you for the food',
    exampleJp: 'みんなで「いただきます」と 言って、食べました。', exampleEn: "We all said 'itadakimasu' and ate." },
  { word: 'ごちそうさまでした', reading: 'ごちそうさまでした', romaji: 'gochisousama deshita', pos: 'expression',
    meaning: '(said after eating) Thank you for the meal',
    exampleJp: 'ごちそうさまでした。とても おいしかったです。', exampleEn: 'Thank you for the meal. It was delicious.' },
  { word: 'いってきます', reading: 'いってきます', romaji: 'ittekimasu', pos: 'expression',
    meaning: "(said when leaving home) I'm off, see you later",
    exampleJp: '「いってきます。」「いってらっしゃい。」', exampleEn: "\"I'm off.\" \"See you later.\"" },
  { word: 'いってらっしゃい', reading: 'いってらっしゃい', romaji: 'itterasshai', pos: 'expression',
    meaning: '(said to someone leaving home) See you later, take care',
    exampleJp: '母は 毎朝「いってらっしゃい」と 言います。', exampleEn: "My mother says 'itterasshai' every morning." },
  { word: 'ただいま', reading: 'ただいま', romaji: 'tadaima', pos: 'expression', meaning: "(said on coming home) I'm home",
    exampleJp: 'ただいま。おなかが すきました。', exampleEn: "I'm home. I'm hungry." },
  { word: 'おかえりなさい', reading: 'おかえりなさい', romaji: 'okaerinasai', pos: 'expression',
    meaning: '(said to someone coming home) Welcome home',
    exampleJp: 'おかえりなさい。ごはんが できて いますよ。', exampleEn: 'Welcome home. Dinner is ready.' },
  { word: 'ごめんなさい', reading: 'ごめんなさい', romaji: 'gomennasai', pos: 'expression', meaning: "I'm sorry",
    exampleJp: 'おそく なって、ごめんなさい。', exampleEn: "I'm sorry I'm late." },
  { word: '失礼します', reading: 'しつれいします', romaji: 'shitsurei shimasu', pos: 'expression',
    meaning: 'Excuse me (when entering or leaving a room)',
    exampleJp: '「失礼します。」と 言って、部屋に 入りました。', exampleEn: "I said 'excuse me' and went into the room." },
  { word: 'お願いします', reading: 'おねがいします', romaji: 'onegai shimasu', pos: 'expression', meaning: 'Please (when asking for something)',
    exampleJp: 'コーヒーを お願いします。', exampleEn: 'A coffee, please.' },
];

/**
 * Appends the expressions missing from N5 lesson 26 (matched by word), stamping uid,
 * level, section and lesson. Existing rows and uids are never touched; returns the words added.
 */
export function applyCoreExpressions(file: LessonFile): string[] {
  const key = String(CORE_LESSON);
  const lesson = (file[key] ??= []);
  const have = new Set(lesson.map((r) => r.word));
  const added: string[] = [];
  for (const e of CORE_EXPRESSIONS) {
    if (have.has(e.word)) continue;
    lesson.push({
      uid: `n5-vocab-${CORE_LESSON}-${lesson.length + 1}`,
      level: 'N5',
      section: 'vocab',
      lesson: CORE_LESSON,
      word: e.word,
      reading: e.reading,
      romaji: e.romaji,
      pos: e.pos,
      meaning: e.meaning,
      exampleJp: e.exampleJp,
      exampleEn: e.exampleEn,
    });
    added.push(e.word);
  }
  return added;
}
