import { readFileSync, writeFileSync } from 'node:fs';

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
    const meanings = k?.[16] ? k[16].split(';') : entry.meanings.map((m) => m.toLowerCase());
    out[kanji] = {
      level: `N${entry.jlpt_new}` as Level,
      strokes: entry.strokes,
      freq: entry.freq,
      radical: radical ? `${shown} (${radicalNames[radical] ?? '?'})` : '',
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
const usable = (m: string | undefined): string | undefined =>
  m && m.trim() && m.trim() !== '#NAME?' ? m : undefined;

async function buildVocab(): Promise<void> {
  const out: { level: Level; jmdictSeq: number; kanji: string; kana: string; meaning: string }[] = [];
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
        usable(anki.get(`${word}|${r.kana}`)) ??
        (r.kanji ? undefined : usable(anki.get(`${r.kana}|${r.kana}`))) ??
        usable(r.waller_definition.split(',').map((s) => s.trim()).join(', ')) ??
        GLOSS_FIXES[Number(r.jmdict_seq)] ??
        '';
      out.push({ level, jmdictSeq: Number(r.jmdict_seq), kanji: r.kanji, kana: r.kana, meaning });
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

await buildKanji();
await buildVocab();
