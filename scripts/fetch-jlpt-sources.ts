import { readFileSync, writeFileSync } from 'node:fs';
import { tidyGloss } from './lib/jlptContent';

/**
 * Downloads the public JLPT reference lists and trims them into the two vendored files
 * the content scripts read, so those scripts never need the network:
 *
 *   scripts/sources/jlpt-kanji.json   every N5–N1 kanji: level, strokes, radical, readings, meanings
 *   scripts/sources/jlpt-vocab.json   every N5–N1 word: level, JMdict id, kanji form, kana, meaning
 *
 *   npx tsx scripts/fetch-jlpt-sources.ts
 *
 * Sources (all openly licensed; attribution in scripts/sources/README.md):
 *  - JLPT levels: Jonathan Waller's tanos.co.uk lists (CC BY), the de-facto reference
 *    jisho.org also uses. Kanji levels via davidluzgouveia/kanji-data (`jlpt_new`),
 *    vocab via stephenmk/yomitan-jlpt-vocab (Waller's lists re-keyed to JMdict ids,
 *    with rare spellings replaced by their common form).
 *  - Kanji strokes / radical / readings / meanings: KANJIDIC + KRADFILE via
 *    mifunetoshiro/kanjium (CC BY-SA 4.0).
 *  - Vocab glosses: JMdict-derived meanings from jamsinclair/open-anki-jlpt-decks where the
 *    word matches, otherwise Waller's own definition.
 *  - Radical names: Unicode Kangxi radical names (scripts/sources/kangxi-radicals.json).
 */

const RAW = 'https://raw.githubusercontent.com';
const URLS = {
  kanjiData: `${RAW}/davidluzgouveia/kanji-data/master/kanji.json`,
  kanjium: `${RAW}/mifunetoshiro/kanjium/master/data/source_files/kanjidict.txt`,
  waller: (lv: string) => `${RAW}/stephenmk/yomitan-jlpt-vocab/main/original_data/${lv}.csv`,
  anki: (lv: string) => `${RAW}/jamsinclair/open-anki-jlpt-decks/main/src/${lv}.csv`,
};
const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'] as const;
type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

async function get(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

/** Minimal RFC-4180 CSV parser (quoted fields, embedded commas, doubled quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}

const hiraToKata = (s: string) =>
  s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

interface KanjiDataEntry {
  strokes: number;
  freq: number | null;
  jlpt_new: number | null;
  meanings: string[];
  readings_on: string[];
  readings_kun: string[];
}

// Classical radicals our Kangxi name table lists under a variant form.
const RADICAL_ALIASES: Record<string, string> = { 彑: '彐' };

async function buildKanji(): Promise<void> {
  const kanjiData: Record<string, KanjiDataEntry> = JSON.parse(await get(URLS.kanjiData));
  const radicalNames: Record<string, string> = JSON.parse(
    readFileSync('scripts/sources/kangxi-radicals.json', 'utf-8')
  );
  // kanjium kanjidict.txt columns: 0 kanji, 1 classical radical, 2 radical variant, ...,
  // 6 on, 7 kun, 11 strokes, 16 meanings (';'-separated)
  const kanjium = new Map<string, string[]>();
  for (const line of (await get(URLS.kanjium)).split('\n')) {
    const cols = line.split('\t');
    if (cols.length > 16) kanjium.set(cols[0], cols);
  }

  const out: Record<string, unknown> = {};
  for (const [kanji, entry] of Object.entries(kanjiData)) {
    if (!entry.jlpt_new) continue;
    const k = kanjium.get(kanji);
    const radical = k?.[1] || (radicalNames[kanji] ? kanji : '');
    const shown = k?.[2] || radical;
    const radicalName = radicalNames[radical] ?? radicalNames[RADICAL_ALIASES[radical]] ?? '?';
    const meanings = k?.[16] ? k[16].split(';') : entry.meanings.map((m) => m.toLowerCase());
    out[kanji] = {
      level: `N${entry.jlpt_new}` as Level,
      strokes: entry.strokes,
      freq: entry.freq,
      radical: radical ? `${shown} (${radicalName})` : '',
      onyomi: entry.readings_on.map(hiraToKata),
      kunyomi: entry.readings_kun.map((r) => r.replace('.', '・')),
      meanings: meanings.filter((m) => !/^\((kokuji|extended shinjitai|ghost character)\)$/.test(m)),
    };
  }
  writeFileSync('scripts/sources/jlpt-kanji.json', `${JSON.stringify(out, null, 0).replace(/},"/g, '},\n"')}\n`);
  console.log(`jlpt-kanji.json: ${Object.keys(out).length} kanji`);
}

// Waller's list (and the Anki deck) have no usable gloss for these rows — an empty
// cell or the spreadsheet error "#NAME?". Short glosses from their JMdict entries.
const GLOSS_FIXES: Record<number, string> = {
  2069620: 'yes, I see (polite reply); huh? (surprise)', // はあ
  2022640: "one's turn; watch, guard", // 番
  2088750: 'see you later, take care (to someone leaving)', // いってらっしゃい
  1032880: 'overcoat', // オーバーコート
  2167510: "I'm sorry to hear that", // おきのどくに
  2847540: 'take care, all the best', // 元気でね
  1609730: 'to hold in one\'s mouth', // 咥える
  1006460: 'to slip out of place; to deviate, to be off', // ずれる
  1632290: 'gently sloping; smooth, fluent', // なだらか
  2197150: 'x-mark, cross (marking a wrong answer)', // ｘ
  1194480: 'counter for months', // ヶ月
  1294940: 'counter for years of age', // 歳
  1356740: 'counter for tatami mats', // 畳
};
GLOSS_FIXES[1583250] = 'no; well, um (softer いいえ)'; // いえ: Waller's cell reads "TODO same as いいえ?"

// The JMdict-derived deck copied a homograph's gloss onto these readings (後 うしろ as
// "afterwards", 上 かみ as "first volume"). Short glosses from each reading's own entry.
const GLOSS_OVERRIDES: Record<number, string> = {
  1269410: 'back, behind, rear', // 後 うしろ
  1352150: 'upper part, top; upper reaches (of a river); the authorities', // 上 かみ
  2080200: 'lower (in rank or quality), inferior; second volume', // 下 げ
  2080210: 'lower part, bottom; lower reaches (of a river)', // 下 しも
  1620400: 'medium, average; during, in the middle of', // 中 ちゅう
};

// Waller writes these usually-kana words (JMdict "uk") or old 御- forms with rare kanji
// spellings; learners meet them as shown here. Key: Waller's kanji|kana, value: the
// headword to use ('' = write in kana). The original spelling is kept as `listKanji`.
export const PREFERRED_SPELLING: Record<string, string> = {
  '丁度|ちょうど': '', '何時|いつ': '', '此処|ここ': '', '此方|こっち': '', '此の|この': '', '其処|そこ': '',
  '其の|その': '', '為る|する': '', '為る|なる': '', '如何|どう': '', '然し|しかし': '',
  '遣る|やる': '', '有る|ある': '', '在る|ある': '', '先ず|まず': '', '呉れる|くれる': '',
  '積もり|つもり': '', '筈|はず': '', '程|ほど': '', '為|ため': '', '或|ある': '',
  '或る|ある': '', '或いは|あるいは': '', '何時か|いつか': '', '何時も|いつも': '',
  '何時でも|いつでも': '', '何時までも|いつまでも': '', '何時の間にか|いつのまにか': 'いつの間にか',
  'お目出度う|おめでとう': '', '位|くらい': '', '様|よう': '', '御|お': '', '御|ご': '',
  '有難い|ありがたい': '', '有難う|ありがとう': '', '又は|または': '', '間も無く|まもなく': '間もなく',
  '御飯|ごはん': 'ご飯', '朝御飯|あさごはん': '朝ご飯', '昼御飯|ひるごはん': '昼ご飯',
  '晩御飯|ばんごはん': '晩ご飯', '御主人|ごしゅじん': 'ご主人', '御辞儀|おじぎ': 'お辞儀',
  '御馳走|ごちそう': 'ご馳走', '御無沙汰|ごぶさた': 'ご無沙汰', '御免|ごめん': '', '御覧|ごらん': 'ご覧',
  '御免ください|ごめんください': '', '御免なさい|ごめんなさい': '', '御覧なさい|ごらんなさい': 'ご覧なさい',
  '御手洗い|おてあらい': 'お手洗い', '御負け|おまけ': '', '嗚呼|ああ': '', '彼方|あちら': '',
  '彼処|あそこ': '', '彼の|あの': '', '彼方此方|あちこち': '', '彼方此方|あちらこちら': '', '彼此|あれこれ': '',
  '何れ|いずれ': '', '何れ|どれ': '', '何方|どちら': '', '何方|どなた': '', '何処|どこ': '', '何処か|どこか': '',
  '此れ|これ': '', '此れ等|これら': '', '其れ|それ': '', '其方|そちら': '', '其処で|そこで': '', '其処ら|そこら': '',
  '其の儘|そのまま': '', '為来り|しきたり': '', '迚も|とても': '', '一寸|ちょっと': '', '屹度|きっと': '',
  '流石|さすが': '', '大凡|おおよそ': '', '矢っ張り|やっぱり': '', '態と|わざと': '', '其れ故|それゆえ': '',
  '若しかして|もしかして': '', '若しくは|もしくは': '', '為さる|なさる': '', '何れ何れ|どれどれ': '',
  '依って|よって': '', '然も|さも': '', '然うして|そうして': '', '成る丈|なるたけ': '', '如何に|いかに': '',
  '然して|そして': '', '然しながら|しかしながら': '', '於いて|おいて': '', '戴きます|いただきます': '',
  '兎角|とかく': '', '仕舞|しまい': '', '仰っしゃる|おっしゃる': '', 'ご座います|ございます': '',
  '余っ程|よっぽど': '', '丸で|まるで': '', '愛でたい|めでたい': '', 'お出でになる|おいでになる': '',
  '苛める|いじめる': '', '填まる|はまる': '', 'お蔭|おかげ': '', '又|また': '', '上手い|うまい': '',
  '不図|ふと': '', '中々|なかなか': '',
};

const usable = (m: string | undefined): string | undefined =>
  m && m.trim() && m.trim() !== '#NAME?' && !/^TODO\b/.test(m.trim()) ? m : undefined;

async function buildVocab(): Promise<void> {
  const out: { level: Level; jmdictSeq: number; kanji: string; kana: string; meaning: string; listKanji?: string }[] = [];
  for (const lv of LEVELS) {
    const level = lv.toUpperCase() as Level;
    const anki = new Map<string, string>();
    for (const r of parseCsv(await get(URLS.anki(lv)))) {
      anki.set(`${r.expression}|${r.reading}`, r.meaning);
      if (!anki.has(`*|${r.reading}`)) anki.set(`*|${r.reading}`, r.meaning);
    }
    for (const r of parseCsv(await get(URLS.waller(lv)))) {
      const word = r.kanji || r.kana;
      const meaning =
        GLOSS_OVERRIDES[Number(r.jmdict_seq)] ??
        usable(anki.get(`${word}|${r.kana}`)) ??
        (r.kanji ? undefined : usable(anki.get(`${r.kana}|${r.kana}`))) ??
        usable(r.waller_definition) ??
        GLOSS_FIXES[Number(r.jmdict_seq)] ??
        '';
      const respelled = PREFERRED_SPELLING[`${r.kanji}|${r.kana}`];
      if (respelled !== undefined) seenSpellings.add(`${r.kanji}|${r.kana}`);
      out.push({
        level, jmdictSeq: Number(r.jmdict_seq), kanji: respelled ?? r.kanji, kana: r.kana, meaning: tidyGloss(meaning),
        ...(respelled !== undefined ? { listKanji: r.kanji } : {}),
      });
    }
  }
  // A spelling variant without a gloss (清む beside 澄む, 棄てる beside 捨てる) is
  // already covered by its glossed sibling, so it is dropped rather than shipped blank.
  const glossed = new Set(out.filter((o) => o.meaning).map((o) => o.jmdictSeq));
  const missing = out.filter((o) => !o.meaning && !glossed.has(o.jmdictSeq));
  if (missing.length) throw new Error(`no gloss for: ${missing.map((o) => o.kanji || o.kana).join(' ')}`);
  out.splice(0, out.length, ...out.filter((o) => o.meaning));
  writeFileSync('scripts/sources/jlpt-vocab.json', `[\n${out.map((o) => JSON.stringify(o)).join(',\n')}\n]\n`);
  console.log(`jlpt-vocab.json: ${out.length} words`);
}

const unused = () => Object.keys(PREFERRED_SPELLING).filter((key) => !seenSpellings.has(key));
const seenSpellings = new Set<string>();
await buildKanji();
await buildVocab();
if (unused().length) throw new Error(`PREFERRED_SPELLING keys not in the lists: ${unused().join(' ')}`);
