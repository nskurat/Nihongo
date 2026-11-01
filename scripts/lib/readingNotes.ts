/**
 * Bracketed usage notes in vocab words (`迷う [道に〜]`, `〜げんか [夫婦〜]`). The reading
 * repeats each note in kana, so learners can read the note's kanji too (`まよう [みちに〜]`).
 * 206 rows had either no note in the reading or the note with its kanji left in; 63 already
 * mirrored it, and those readings seeded this table. The rest are teacher-authored.
 * Pure data plus `mirrorNotes`, used by scripts/normalise-vocab-readings.ts.
 */

/** Note (as written in the word, without brackets) → its reading. Notes in kana need no entry. */
export const NOTE_READINGS: Readonly<Record<string, string>> = {
  '1960年〜': '1960ねん〜',
  '〜一': '〜いち',
  '〜体験': '〜たいけん',
  '〜優秀賞': '〜ゆうしゅうしょう',
  '〜口': '〜ぐち',
  '〜口座': '〜こうざ',
  '〜多い': '〜おおい',
  '〜家族': '〜かぞく',
  '〜愉快': '〜ゆかい',
  '〜眠る': '〜ねむる',
  '〜誌': '〜し',
  '〜関係': '〜かんけい',
  'お言葉に〜': 'おことばに〜',
  'お金を〜': 'おかねを〜',
  'お願いします': 'おねがいします',
  '一人〜': 'ひとり〜',
  '世界中に〜': 'せかいじゅうに〜',
  '乗り物に〜': 'のりものに〜',
  '人と人との〜': 'ひととひととの〜',
  '人を〜': 'ひとを〜',
  '人間〜': 'にんげん〜',
  '仕事が〜': 'しごとが〜',
  '会員〜': 'かいいん〜',
  '伝言を〜': 'でんごんを〜',
  '体操する': 'たいそうする',
  '何日〜': 'なんにち〜',
  '例を〜': 'れいを〜',
  '例文が〜': 'れいぶんが〜',
  '保育〜': 'ほいく〜',
  '修理に〜': 'しゅうりに〜',
  '元気〜': 'げんき〜',
  '元気を〜': 'げんきを〜',
  '免許を〜': 'めんきょを〜',
  '利益を〜': 'りえきを〜',
  '力': 'りょく',
  '医学〜': 'いがく〜',
  '十両に〜': 'じゅうりょうに〜',
  '友人〜': 'ゆうじん〜',
  '口を〜': 'くちを〜',
  '台風〜': 'たいふう〜',
  '名前を〜': 'なまえを〜',
  '吹雪に〜': 'ふぶきに〜',
  '呼吸する': 'こきゅうする',
  '四季〜': 'しき〜',
  '国の〜': 'くにの〜',
  '地下水が〜': 'ちかすいが〜',
  '地球を〜': 'ちきゅうを〜',
  '型に〜': 'かたに〜',
  '型を〜': 'かたを〜',
  '場所を〜': 'ばしょを〜',
  '声を〜': 'こえを〜',
  '売上げが〜': 'うりあげが〜',
  '大通りに〜': 'おおどおりに〜',
  '太鼓〜': 'たいこ〜',
  '太鼓の〜': 'たいこの〜',
  '夫婦〜': 'ふうふ〜',
  '好き/嫌い': 'すき/きらい',
  '子どもを〜': 'こどもを〜',
  '学生〜': 'がくせい〜',
  '宗家の〜': 'そうけの〜',
  '宝くじが〜': 'たからくじが〜',
  '実を〜': 'みを〜',
  '尺八〜': 'しゃくはち〜',
  '川に〜': 'かわに〜',
  '市民の〜': 'しみんの〜',
  '弦を〜': 'げんを〜',
  '彼女を〜': 'かのじょを〜',
  '心の〜': 'こころの〜',
  '性格が〜': 'せいかくが〜',
  '意味を〜': 'いみを〜',
  '感': 'かん',
  '成果を〜': 'せいかを〜',
  '戦争を〜': 'せんそうを〜',
  '手に〜': 'てに〜',
  '手を〜': 'てを〜',
  '招待〜': 'しょうたい〜',
  '故郷を〜': 'こきょうを〜',
  '料理を〜': 'りょうりを〜',
  '日が〜': 'ひが〜',
  '時間が〜': 'じかんが〜',
  '時間を〜': 'じかんを〜',
  '本の〜': 'ほんの〜',
  '本屋に〜': 'ほんやに〜',
  '栓を〜': 'せんを〜',
  '水を〜': 'みずを〜',
  '汗を〜': 'あせを〜',
  '法則が〜': 'ほうそくが〜',
  '湿気を〜': 'しっけを〜',
  '物理の〜': 'ぶつりの〜',
  '現地に〜': 'げんちに〜',
  '理解が〜': 'りかいが〜',
  '生活が〜': 'せいかつが〜',
  '男〜': 'おとこ〜',
  '留守〜': 'るす〜',
  '疑問を〜': 'ぎもんを〜',
  '病院に車いすを〜': 'びょういんにくるまいすを〜',
  '相撲を〜': 'すもうを〜',
  '社会人〜': 'しゃかいじん〜',
  '空を〜': 'そらを〜',
  '管理体制が〜': 'かんりたいせいが〜',
  '米が〜': 'こめが〜',
  '約束を〜': 'やくそくを〜',
  '線を〜': 'せんを〜',
  '縁を〜': 'えんを〜',
  '能率が〜': 'のうりつが〜',
  '脈拍が〜': 'みゃくはくが〜',
  '腕に〜': 'うでに〜',
  '腕を〜': 'うでを〜',
  '興味を〜': 'きょうみを〜',
  '血が〜': 'ちが〜',
  '被害〜': 'ひがい〜',
  '製品が〜': 'せいひんが〜',
  '視線を〜': 'しせんを〜',
  '親切〜': 'しんせつ〜',
  '話を〜': 'はなしを〜',
  '誘いを〜': 'さそいを〜',
  '調理〜': 'ちょうり〜',
  '講演〜': 'こうえん〜',
  '豆を〜': 'まめを〜',
  '費用を〜': 'ひようを〜',
  '質を〜': 'しつを〜',
  '身に〜がない': 'みに〜がない',
  '身を〜': 'みを〜',
  '迷惑を〜': 'めいわくを〜',
  '道が〜': 'みちが〜',
  '道に〜': 'みちに〜',
  '選挙に〜': 'せんきょに〜',
  '野球〜': 'やきゅう〜',
  '金に〜': 'かねに〜',
  '関わりの〜': 'かかわりの〜',
  '雪が〜': 'ゆきが〜',
  '電源が〜': 'でんげんが〜',
  '電話が〜': 'でんわが〜',
  '電話に〜': 'でんわに〜',
  '電話を〜': 'でんわを〜',
  '音を〜': 'おとを〜',
  '音楽': 'おんがく',
  '音楽〜': 'おんがく〜',
  '食事を〜': 'しょくじを〜',
  '食卓を〜': 'しょくたくを〜',
};

const NOTE = /\s*[[［]([^\]］]*)[\]］]/g;
const HAS_KANJI = /[一-鿿々]/;

/** The note's reading: kana notes as they are, others from the table (null when it has none). */
export function noteReading(note: string): string | null {
  return HAS_KANJI.test(note) ? (NOTE_READINGS[note] ?? null) : note;
}

/**
 * The reading with every note of `word` mirrored in kana, in the word's own place and
 * spacing. Null when the word has no notes, a note has no known reading, or the reading's
 * own notes can't be lined up with the word's.
 */
export function mirrorNotes(word: string, reading: string): string | null {
  const notes = [...word.matchAll(NOTE)];
  if (!notes.length) return null;
  const head = reading.replace(NOTE, '').trim();
  const kana = notes.map((m) => noteReading(m[1]));
  if (kana.some((k) => k === null)) return null;
  // Rebuild from the word's layout: each note keeps its position (prefix or suffix) and the
  // whitespace before it; the text between notes is the head reading, which only occurs once.
  const parts = word.split(NOTE);
  // split() with one capture group interleaves text and notes: [text, note, text, note, text].
  const texts = parts.filter((_, i) => i % 2 === 0);
  if (texts.filter((t) => t.trim()).length !== 1) return null;
  let out = '';
  let n = 0;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const ws = /^\s*/.exec(notes[n][0])?.[0] ?? '';
      out += `${ws}[${kana[n]}]`;
      n++;
    } else if (parts[i].trim()) out += head;
  }
  return out;
}
