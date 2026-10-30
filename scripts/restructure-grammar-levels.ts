import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * One-time migration (stage 1 of the level audit, see docs/grammar-level-audit.md):
 *  - moves N3 grammar points that are really N4 into the matching N4 lesson,
 *  - drops N3 duplicates (within N3, or of an N4/N5 point we already teach),
 *  - parks N3 points that are really N2/N1 in data/n2/grammar.json (not shown in the UI),
 * then recomputes positional uids and rewrites every lesson cross-reference so
 * nothing dangles. Moved items are appended to the end of their target lesson, so
 * existing N4 numbers do not shift; only N3 lessons that lost items renumber.
 *
 * Not idempotent; refuses to run if the N2 file already exists.
 * Pass --dry-run to print the plan and every rewritten reference without writing.
 */

type Level = 'N5' | 'N4' | 'N3' | 'N2';
type Item = Record<string, unknown> & { uid: string; level: Level; lesson: number };
type Chunk = Record<string, Item[]>;

const DATA_DIR = 'grammar-app/src/data';
const dryRun = process.argv.includes('--dry-run');
const path = (level: Level): string => `${DATA_DIR}/${level.toLowerCase()}/grammar.json`;

const MOVE_TO_N4: Record<string, number> = {
  'n3-grammar-1-1': 18, // てくる／ていく  (next to n4 Vて-form 来ます)
  'n3-grammar-1-3': 8, // という N        (next to XはYという意味です)
  'n3-grammar-15-1': 8, // という (hearsay)
  'n3-grammar-1-4': 22, // みたいだ        (next to ようです)
  'n3-grammar-4-1': 22, // らしい
  'n3-grammar-2-1': 16, // てほしい        (giving/receiving)
  'n3-grammar-2-2': 11, // ことにする
  'n3-grammar-2-3': 11, // ことになる
  'n3-grammar-3-3': 3, // 始める／続ける／終わる
  'n3-grammar-8-1': 3, // ことがある      (next to customary action)
  'n3-grammar-4-2': 19, // がる
  'n3-grammar-4-3': 23, // させられる      (causative)
  'n3-grammar-10-1': 9, // まま
  'n3-grammar-11-2': 10, // たら［どう］    (conditionals)
};

// Dropped item -> the item that already covers it (refs to it are redirected there).
const DROP: Record<string, string> = {
  'n3-grammar-11-1': 'n3-grammar-1-1', // てくる／ていく, shorter copy
  'n3-grammar-11-4': 'n3-grammar-4-1', // らしい
  'n3-grammar-7-2': 'n3-grammar-19-1', // として
  'n3-grammar-11-5': 'n3-grammar-19-1',
  'n3-grammar-16-2': 'n3-grammar-8-2', // によって／による
  'n3-grammar-12-5': 'n3-grammar-5-2', // おかげで／せいで
  'n3-grammar-12-6': 'n3-grammar-5-2',
  'n3-grammar-11-6': 'n3-grammar-10-2', // ずに
  'n3-grammar-3-1': 'n4-grammar-11-3', // ようにする
  'n3-grammar-3-2': 'n4-grammar-11-2', // ようになる
  'n3-grammar-7-3': 'n4-grammar-10-4', // (の)なら
  'n3-grammar-10-3': 'n4-grammar-21-3', // はずだ
  'n3-grammar-5-3': 'n5-grammar-24-2', // てもらう／てくれる
  'n3-grammar-11-3': 'n5-grammar-12-3', // より…ほうが
  'n3-grammar-11-7': 'n5-grammar-14-5', // ている
  'n3-grammar-12-3': 'n5-grammar-19-3', // たり〜たり
  'n3-grammar-23-3': 'n5-grammar-2-2', // この＋N
};

// N2/N1-level points. The first group is confirmed against jlptsensei's N2 list; the
// second is N2/N1 by general knowledge and could not be confirmed there.
const PARK_AS_N2: string[] = [
  'n3-grammar-16-1', 'n3-grammar-16-3', 'n3-grammar-17-2', 'n3-grammar-18-3', 'n3-grammar-19-3',
  'n3-grammar-20-2', 'n3-grammar-21-3', 'n3-grammar-21-4', 'n3-grammar-22-1', 'n3-grammar-14-3',
  'n3-grammar-12-1',
  'n3-grammar-17-3', 'n3-grammar-17-4', 'n3-grammar-14-2', 'n3-grammar-24-2', 'n3-grammar-23-1',
  'n3-grammar-21-2', 'n3-grammar-22-2', 'n3-grammar-22-3', 'n3-grammar-24-1',
];

// Hand edits applied to an item's text before references are rewritten: the dropped
// duplicates leave self-references behind, and a couple of phrases would parse with
// the wrong level. Where a dropped duplicate held content the survivor lacked, it is
// folded in here.
const TEXT_FIXES: Record<string, Array<[string, string]>> = {
  'n3-grammar-5-2': [
    [
      'See Lesson 12-5/12-6 for these same two patterns covered again with more formal example sentences and the related 〜おかげだ／〜せいだ sentence-final versions. Because',
      'The sentence-final versions work the same way: 先生のおかげだ ("it\'s thanks to my teacher") and バスのせいだ ("it\'s the bus\'s fault") — せいだ is a more pointed way of assigning blame than せいで mid-sentence. Because',
    ],
  ],
  'n3-grammar-10-2': [
    [
      'See Lesson 11-6 for this same pattern covered again, in its variant ず［に］ shape (with or without the trailing に) — both mean exactly the same thing, and either is acceptable in writing.',
      'The trailing に is optional (ず［に］) — both shapes mean exactly the same thing, and either is acceptable in writing.',
    ],
  ],
  'n3-grammar-21-1': [["Lesson 10-2/11-6's ずに", "Lesson 10-2's ずに"]],
  'n3-grammar-8-2': [
    [
      'See Lesson 16-2 for this same expression revisited with a narrower focus specifically on the causal sense ("as a result of"), and N4 Lesson 12-5\'s によって marking the "creator" specifically in passive sentences about invention/creation/discovery — 8-2 is really the umbrella pattern that the other two lessons each zoom in on one sense of.',
      'See N4 Lesson 12-5\'s によって marking the "creator" specifically in passive sentences about invention/creation/discovery — this is the umbrella pattern, and that point zooms in on one sense of it.',
    ],
  ],
  'n3-grammar-4-1': [
    [
      'See Lesson 11-4 for the second (typical-of) meaning covered again on its own, and Lesson 18/22 in the N4 grammar set for how this compares',
      'See N4 Lessons 18 and 22 for how this compares',
    ],
  ],
  'n3-grammar-19-1': [['covered in Lesson 7-2 (role/capacity)', '(role/capacity)']],
  'n3-grammar-2-1': [['Lesson 1 in N4', 'N4 Lesson 1']],
};

const read = (level: Level): Chunk => JSON.parse(readFileSync(resolve(process.cwd(), path(level)), 'utf-8'));
const write = (level: Level, data: Chunk): void => {
  const file = resolve(process.cwd(), path(level));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
};

const UID_RE = /^(n[2-5])-grammar-(\d+)-(\d+)$/;
const parseUid = (uid: string): { level: Level; lesson: number; point: number } => {
  const m = UID_RE.exec(uid);
  if (!m) throw new Error(`bad uid ${uid}`);
  return { level: m[1].toUpperCase() as Level, lesson: Number(m[2]), point: Number(m[3]) };
};

// ---- load -------------------------------------------------------------

const old: Record<'N5' | 'N4' | 'N3', Chunk> = { N5: read('N5'), N4: read('N4'), N3: read('N3') };
const oldItems = new Map<string, Item>();
for (const level of ['N5', 'N4', 'N3'] as const) {
  for (const items of Object.values(old[level])) for (const item of items) oldItems.set(item.uid, item);
}

for (const uid of [...Object.keys(MOVE_TO_N4), ...Object.keys(DROP), ...PARK_AS_N2]) {
  if (!uid.startsWith('n3-') || !oldItems.has(uid)) throw new Error(`plan references unknown N3 item ${uid}`);
}
const planned = [...Object.keys(MOVE_TO_N4), ...Object.keys(DROP), ...PARK_AS_N2];
if (new Set(planned).size !== planned.length) throw new Error('an item appears in the plan twice');
for (const target of Object.values(DROP)) {
  if (!oldItems.has(target) || (target in DROP)) throw new Error(`bad redirect target ${target}`);
}

// ---- restructure ------------------------------------------------------

const next: Record<Level, Chunk> = { N5: {}, N4: {}, N3: {}, N2: {} };
const moved: Item[] = [];
const parked: Item[] = [];

for (const level of ['N5', 'N4', 'N3'] as const) {
  for (const key of Object.keys(old[level])) {
    for (const item of old[level][key]) {
      if (item.uid in DROP) continue;
      if (item.uid in MOVE_TO_N4) { moved.push(item); continue; }
      if (PARK_AS_N2.includes(item.uid)) { parked.push(item); continue; }
      (next[level][key] ||= []).push(item);
    }
  }
}
for (const item of moved) (next.N4[String(MOVE_TO_N4[item.uid])] ||= []).push(item);
for (const item of parked) (next.N2[String(item.lesson)] ||= []).push(item);

const newUidOf = new Map<string, string>();
const finalLevelOf = new Map<Item, Level>();
for (const level of ['N5', 'N4', 'N3', 'N2'] as const) {
  const sorted: Chunk = {};
  for (const key of Object.keys(next[level]).map(Number).sort((a, b) => a - b)) {
    sorted[String(key)] = next[level][String(key)];
  }
  next[level] = sorted;
  for (const [key, items] of Object.entries(sorted)) {
    items.forEach((item, index) => {
      newUidOf.set(item.uid, `${level.toLowerCase()}-grammar-${key}-${index + 1}`);
      finalLevelOf.set(item, level);
    });
  }
}
for (const [dropped, survivor] of Object.entries(DROP)) newUidOf.set(dropped, newUidOf.get(survivor)!);

// ---- cross-reference rewrite -------------------------------------------

// "Lesson 35-4", "N4 Lessons 43 and 47-1", "L31-2" (a number list after Lesson/L)...
const NUM = String.raw`\d+(?:-\d+)?`;
const SPAN = String.raw`(?:(N[2-5]) )?(?<![\w])(Lessons?|L)(\s?)(${NUM}(?:\s?(?:/|&|and|,)\s?${NUM})*)(?![\d])`;
// ...or a bare "37-2" point reference.
const BARE = String.raw`(?<![\w\-./])(\d{1,2}-\d{1,2})(?![\d\w-])`;
const REF = new RegExp(`${SPAN}|${BARE}`, 'g');

const rewrites: string[] = [];
const problems: string[] = [];
const unresolved = new Set<string>();

function mapToken(token: string, level: Level, itemUid: string): { level: Level; text: string } {
  const [lessonStr, pointStr] = token.split('-');
  if (pointStr === undefined) return { level, text: lessonStr }; // lesson-only: lesson numbers are stable
  const oldUid = `${level.toLowerCase()}-grammar-${lessonStr}-${pointStr}`;
  const mapped = newUidOf.get(oldUid);
  if (!mapped) {
    // Not an item: a lesson range such as "Lessons 24-25" or "L14-15". Leave it alone.
    unresolved.add(`${itemUid}: "${token}" (${level})`);
    return { level, text: token };
  }
  const target = parseUid(mapped);
  return { level: target.level, text: `${target.lesson}-${target.point}` };
}

function rewriteText(text: string, itemUid: string, oldLevel: Level, newLevel: Level): string {
  return text.replace(REF, (match, prefix: string | undefined, word: string | undefined, space: string, list: string | undefined, bare: string | undefined) => {
    let out: string;
    if (bare !== undefined) {
      const { level, text: mapped } = mapToken(bare, oldLevel, itemUid);
      out = level === newLevel ? mapped : `${level} Lesson ${mapped}`;
    } else {
      const specLevel = (prefix as Level | undefined) ?? oldLevel;
      const levels = new Set<Level>();
      const rewritten = list!.replace(new RegExp(NUM, 'g'), (token) => {
        const mapped = mapToken(token, specLevel, itemUid);
        levels.add(mapped.level);
        return mapped.text;
      });
      if (levels.size !== 1) {
        problems.push(`${itemUid}: reference list "${match}" maps to several levels`);
        return match;
      }
      const [level] = [...levels];
      out = `${level === newLevel ? '' : `${level} `}${word}${space}${rewritten}`;
    }
    if (out !== match) rewrites.push(`${itemUid}: "${match}" -> "${out}"`);
    return out;
  });
}

function rewriteItem(item: Item, oldLevel: Level): Item {
  const newUid = newUidOf.get(item.uid)!;
  const { level: newLevel, lesson } = parseUid(newUid);
  const fixes = TEXT_FIXES[item.uid] ?? [];
  const rewritten = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const fixed = fixes.reduce((text, [from, to]) => text.split(from).join(to), value);
      return rewriteText(fixed, item.uid, oldLevel, newLevel);
    }
    if (Array.isArray(value)) return value.map(rewritten);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewritten(v)]));
    }
    return value;
  };
  const rest = Object.fromEntries(
    Object.entries(item)
      .filter(([k]) => !['uid', 'level', 'section', 'lesson'].includes(k))
      .map(([k, v]) => [k, rewritten(v)])
  );
  return { uid: newUid, level: newLevel, section: 'grammar', lesson, ...rest } as Item;
}

const output: Record<Level, Chunk> = { N5: {}, N4: {}, N3: {}, N2: {} };
const oldLevelOf = (item: Item): Level => parseUid(item.uid).level;
for (const level of ['N5', 'N4', 'N3', 'N2'] as const) {
  for (const [key, items] of Object.entries(next[level])) {
    output[level][key] = items.map((item) => rewriteItem(item, oldLevelOf(item)));
  }
}

// ---- report / write ----------------------------------------------------

const count = (c: Chunk): number => Object.values(c).reduce((n, v) => n + v.length, 0);
console.log(
  `Moved ${moved.length} to N4, dropped ${Object.keys(DROP).length}, parked ${parked.length} as N2.`
);
for (const level of ['N5', 'N4', 'N3', 'N2'] as const) {
  console.log(`${level}: ${count(output[level])} grammar points in ${Object.keys(output[level]).length} lessons`);
}
console.log(`\n${rewrites.length} reference(s) rewritten:`);
rewrites.forEach((r) => console.log(`  ${r}`));
console.log(`\n${unresolved.size} token(s) left as-is (lesson ranges):`);
unresolved.forEach((u) => console.log(`  ${u}`));
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.log(`  ${p}`));
}

if (dryRun) {
  console.log('\n(dry run - nothing written)');
} else {
  if (problems.length) throw new Error('refusing to write with unresolved references');
  if (existsSync(resolve(process.cwd(), path('N2')))) throw new Error('N2 file already exists; already migrated?');
  for (const level of ['N5', 'N4', 'N3', 'N2'] as const) write(level, output[level]);
  console.log('\nWritten.');
}
