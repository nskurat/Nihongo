import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * One-time migration (stage 4 of the level audit, see docs/grammar-level-audit.md):
 * moves points whose level is contested up one level, drops one duplicate, and parks
 * one N2 point. Where jlptsensei and Bunpro agree on a harder level the point moves;
 * where they disagree the point also moves (uncertain -> higher level).
 *
 * Moved points are appended to the end of their target lesson, so existing numbers in
 * the target do not shift; only lessons that lost points renumber. Every uid is then
 * recomputed positionally. Lesson cross-references in text are name-based, so only the
 * handful listed in TEXT_FIXES needed rewording.
 *
 * Not idempotent: each planned uid must still carry the expected title.
 * Pass --dry-run to print the plan without writing.
 */

type Level = 'N5' | 'N4' | 'N3' | 'N2';
type Item = Record<string, unknown> & { uid: string; level: Level; lesson: number; title: string };
type Chunk = Record<string, Item[]>;

const DATA_DIR = 'grammar-app/src/data';
const dryRun = process.argv.includes('--dry-run');
const path = (level: Level): string => `${DATA_DIR}/${level.toLowerCase()}/grammar.json`;

interface Move {
  to: Level;
  lesson: number;
  title: string; // substring the current title must contain
}

const MOVES: Record<string, Move> = {
  // N5 -> N4
  'n5-grammar-17-3': { to: 'N4', lesson: 20, title: 'なければ' }, // なければなりません (next to 〜が必要)
  'n5-grammar-21-7': { to: 'N4', lesson: 20, title: 'ないと' },
  'n5-grammar-17-6': { to: 'N4', lesson: 9, title: 'までに' },
  'n5-grammar-18-5': { to: 'N4', lesson: 7, title: 'なかなか' }, // next to きっと／たぶん／そんなに
  'n5-grammar-18-6': { to: 'N4', lesson: 7, title: 'ぜひ' },
  'n5-grammar-21-1': { to: 'N4', lesson: 8, title: '思います' }, // next to という／と言っていました
  'n5-grammar-21-2': { to: 'N4', lesson: 8, title: '言います' },
  'n5-grammar-23-3': { to: 'N4', lesson: 10, title: 'dictionary form と' }, // conditionals
  'n5-grammar-24-2': { to: 'N4', lesson: 16, title: 'あげます' }, // Vて-form あげます／もらいます／くれます
  'n5-grammar-25-1': { to: 'N4', lesson: 10, title: 'ら' },
  'n5-grammar-25-2': { to: 'N4', lesson: 10, title: 'ら' },
  'n5-grammar-25-3': { to: 'N4', lesson: 10, title: 'Vて-form' }, // 〜ても
  'n5-grammar-25-4': { to: 'N4', lesson: 10, title: 'もし' },
  // N4 -> N3
  'n4-grammar-9-1': { to: 'N3', lesson: 17, title: 'とおり' }, // next to によると／ことから (basis)
  'n4-grammar-12-5': { to: 'N3', lesson: 8, title: 'によって' }, // next to 〜によって／による
  'n4-grammar-14-4': { to: 'N3', lesson: 12, title: 'とちゅうで' }, // next to うちに／最中に／たとたん
  'n4-grammar-17-3': { to: 'N3', lesson: 13, title: 'Quantifier' },
  // N3 -> N2 (parked, not shown in the UI)
  'n3-grammar-16-1': { to: 'N2', lesson: 16, title: 'ところだった' },
};

// Dropped item -> the item that already covers it.
const DROP: Record<string, { survivor: string; title: string }> = {
  'n4-grammar-10-6': { survivor: 'n3-grammar-9-1', title: 'ほど' }, // ば〜ほど, already an N3 point
};

// Text that cited a point by number; reworded by name so renumbering cannot strand it.
const TEXT_FIXES: Record<string, Array<[string, string, string]>> = {
  // [field, from, to]
  'n5-grammar-2-2': [['note', 'これ/それ/あれ (2-1) can never', 'これ/それ/あれ can never']],
  'n5-grammar-2-6': [['note', "(2-3's affirmative-check use)", '(its affirmative-check use)']],
  'n5-grammar-5-2': [['note', 'the "also" も from 1-4 —', 'the "also" も —']],
  'n5-grammar-5-5': [['note', 'Contrast with 4-4: numbered time words', 'Contrast with exact times: numbered time words']],
  'n5-grammar-17-4': [['summary', "counterpart to 17-3's なければなりません.", 'counterpart to なければなりません.']],
  'n5-grammar-21-7': [['note', 'なければなりません (17-3).', 'なければなりません.']],
  'n5-grammar-23-4': [['note', 'the natural-phenomenon が rule (14-8) to any', 'the natural-phenomenon が rule to any']],
  'n5-grammar-25-5': [
    ['note', 'across から(16-4)、とき(23-1)、たら/ても(25-1/3).', 'across から, とき and まえに clauses.'],
  ],
  'n2-grammar-14-1': [['details', "Compare with N4 Lesson 11-4's とか、とか,", 'Compare with the N4 とか、とか point,']],
  'n2-grammar-16-2': [['details', "See N4 Lesson 20-2's のに for", 'See the N4 のに point for']],
  'n2-grammar-18-1': [['details', 'のに (N4 Lesson 20-2) and にもかかわらず (Lesson 16-2)', 'のに (N4) and にもかかわらず']],
  'n2-grammar-19-1': [['details', 'について (N3 Lesson 9-3)', 'について (N3)']],
  'n2-grammar-20-1': [['details', 'にとって (N3 Lesson 6-2)', 'にとって (N3)']],
  'n2-grammar-21-2': [
    ['details', 'による／によって (N3 Lesson 8-1)', 'による／によって (N3)'],
    ['details', 'に関する／に関して (N3 Lesson 15-2)', 'に関する／に関して (N3)'],
  ],
};

const read = (level: Level): Chunk => JSON.parse(readFileSync(resolve(process.cwd(), path(level)), 'utf-8'));
const write = (level: Level, data: Chunk): void =>
  writeFileSync(resolve(process.cwd(), path(level)), `${JSON.stringify(data, null, 2)}\n`, 'utf-8');

const old: Record<Level, Chunk> = { N5: read('N5'), N4: read('N4'), N3: read('N3'), N2: read('N2') };
const byUid = new Map<string, Item>();
for (const level of ['N5', 'N4', 'N3', 'N2'] as const) {
  for (const items of Object.values(old[level])) for (const item of items) byUid.set(item.uid, item);
}

for (const [uid, move] of Object.entries(MOVES)) {
  const item = byUid.get(uid);
  if (!item) throw new Error(`plan references unknown item ${uid}`);
  if (!item.title.includes(move.title)) throw new Error(`${uid} title "${item.title}" does not contain "${move.title}"`);
}
for (const [uid, drop] of Object.entries(DROP)) {
  const item = byUid.get(uid);
  if (!item || !item.title.includes(drop.title)) throw new Error(`drop ${uid} does not match`);
  if (!byUid.has(drop.survivor) || drop.survivor in DROP) throw new Error(`bad survivor ${drop.survivor}`);
}
for (const uid of Object.keys(TEXT_FIXES)) if (!byUid.has(uid)) throw new Error(`text fix for unknown ${uid}`);

// ---- restructure ------------------------------------------------------

const next: Record<Level, Chunk> = { N5: {}, N4: {}, N3: {}, N2: {} };
const moving: Array<{ item: Item; move: Move }> = [];
for (const level of ['N5', 'N4', 'N3', 'N2'] as const) {
  for (const [key, items] of Object.entries(old[level])) {
    for (const item of items) {
      if (item.uid in DROP) continue;
      if (item.uid in MOVES) { moving.push({ item, move: MOVES[item.uid] }); continue; }
      (next[level][key] ||= []).push(item);
    }
  }
}
for (const { item, move } of moving) (next[move.to][String(move.lesson)] ||= []).push(item);

const applyFixes = (item: Item): Item => {
  const fixes = TEXT_FIXES[item.uid] ?? [];
  const copy = { ...item } as Record<string, unknown>;
  for (const [field, from, to] of fixes) {
    const value = copy[field];
    if (typeof value !== 'string' || !value.includes(from)) throw new Error(`${item.uid}.${field} missing "${from}"`);
    copy[field] = value.replace(from, to);
  }
  return copy as Item;
};

const output: Record<Level, Chunk> = { N5: {}, N4: {}, N3: {}, N2: {} };
for (const level of ['N5', 'N4', 'N3', 'N2'] as const) {
  for (const key of Object.keys(next[level]).map(Number).sort((a, b) => a - b)) {
    output[level][String(key)] = next[level][String(key)].map((item, index) => {
      const { uid: _uid, level: _level, section: _section, lesson: _lesson, ...rest } = applyFixes(item);
      return { uid: `${level.toLowerCase()}-grammar-${key}-${index + 1}`, level, section: 'grammar', lesson: key, ...rest } as Item;
    });
  }
}

// ---- report / write ----------------------------------------------------

const count = (c: Chunk): number => Object.values(c).reduce((n, v) => n + v.length, 0);
const newUidOf = new Map<string, string>();
for (const level of ['N5', 'N4', 'N3', 'N2'] as const) {
  for (const items of Object.values(output[level])) items.forEach((i) => newUidOf.set(i.title, i.uid));
}
console.log(`Moved ${moving.length}, dropped ${Object.keys(DROP).length}.`);
for (const { item, move } of moving) console.log(`  ${item.uid} ${item.title.slice(0, 30)} -> ${move.to} lesson ${move.lesson}`);
for (const [uid, drop] of Object.entries(DROP)) console.log(`  dropped ${uid} (covered by ${drop.survivor})`);
for (const level of ['N5', 'N4', 'N3', 'N2'] as const) {
  const sizes = Object.entries(output[level]).map(([k, v]) => `${k}:${v.length}`).join(' ');
  console.log(`${level}: ${count(output[level])} points | ${sizes}`);
}
for (const level of ['N5', 'N4', 'N3'] as const) {
  const empty = Object.keys(output[level]).length !== Object.keys(old[level]).length;
  if (empty) throw new Error(`${level} lost a lesson entirely`);
}

if (dryRun) console.log('\n(dry run - nothing written)');
else {
  for (const level of ['N5', 'N4', 'N3', 'N2'] as const) write(level, output[level]);
  console.log('\nWritten.');
}
