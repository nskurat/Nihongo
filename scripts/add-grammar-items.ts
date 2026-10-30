import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Appends newly authored grammar points to their level's grammar.json.
 *
 *   npx tsx scripts/add-grammar-items.ts batch.json [more.json ...] [--dry-run]
 *
 * A batch is an array of { level, lesson, title, meaning, structure, explanation,
 * examples, summary, details, tags }. Points are appended to the end of their lesson, so
 * existing positional uids (and the "Lesson 3-2" style references to them) never shift;
 * uid/level/section/lesson are stamped here. Tags must exist in tag-taxonomy.json and a
 * title may not repeat at any level. Nothing is written if any point is rejected.
 *
 * Instead of `details`, a point may give `bold` (the pattern's surface forms) and `note`
 * (the nuance paragraph): details are then built as the examples with the pattern bolded,
 * followed by the note, and every example must contain one of the `bold` forms - so an
 * example that doesn't actually use the pattern is rejected.
 */

type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
interface NewItem {
  level: Level;
  lesson: number;
  title: string;
  meaning: string;
  structure: string;
  explanation: string;
  examples: Array<{ jp: string; en: string }>;
  summary: string;
  details?: string;
  bold?: string[];
  note?: string;
  tags: string[];
}
type Stored = Record<string, unknown> & { title: string };
type Chunk = Record<string, Stored[]>;

const DATA_DIR = 'grammar-app/src/data';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const batchFiles = args.filter((a) => !a.startsWith('--'));
if (batchFiles.length === 0) throw new Error('usage: add-grammar-items.ts batch.json [...] [--dry-run]');

const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf-8'));

const taxonomy = readJson<{ facets: Record<string, { tags: Record<string, unknown> }> }>(
  `${DATA_DIR}/tag-taxonomy.json`
);
const knownTags = new Set(Object.values(taxonomy.facets).flatMap((facet) => Object.keys(facet.tags)));

const RANGES: Record<Level, number> = { N5: 25, N4: 25, N3: 24, N2: 26, N1: 32 };
const REQUIRED = ['title', 'meaning', 'structure', 'explanation', 'summary'] as const;

const items = batchFiles.flatMap((file) => readJson<NewItem[]>(file));
const errors: string[] = [];
const chunks = {} as Record<Level, Chunk>;
const titles = {} as Record<Level, Set<string>>;
for (const level of LEVELS) {
  chunks[level] = readJson<Chunk>(`${DATA_DIR}/${level.toLowerCase()}/grammar.json`);
  titles[level] = new Set(Object.values(chunks[level]).flatMap((list) => list.map((item) => item.title)));
}

for (const item of items) {
  const where = `${item.level} "${item.title}"`;
  if (!(item.level in RANGES)) { errors.push(`${where}: unknown level`); continue; }
  if (!Number.isInteger(item.lesson) || item.lesson < 1 || item.lesson > RANGES[item.level]) {
    errors.push(`${where}: lesson ${item.lesson} outside 1-${RANGES[item.level]}`);
  }
  for (const field of REQUIRED) if (!String(item[field] ?? '').trim()) errors.push(`${where}: empty ${field}`);
  if (!item.examples?.length || item.examples.some((e) => !e.jp?.trim() || !e.en?.trim())) {
    errors.push(`${where}: needs examples with jp and en`);
  }
  if (!item.tags?.length) errors.push(`${where}: needs at least one tag`);
  for (const tag of item.tags ?? []) if (!knownTags.has(tag)) errors.push(`${where}: unknown tag "${tag}"`);
  const clash = LEVELS.find((level) => titles[level].has(item.title));
  if (clash) errors.push(`${where}: title already exists at ${clash}`);
  titles[item.level].add(item.title);
  if (!item.details) {
    if (!item.note?.trim() || !item.bold?.length) {
      errors.push(`${where}: needs details, or bold + note`);
    } else {
      const lines: string[] = [];
      for (const example of item.examples ?? []) {
        const form = [...item.bold].sort((a, b) => b.length - a.length).find((f) => example.jp.includes(f));
        if (!form) errors.push(`${where}: example "${example.jp}" contains none of ${item.bold.join(', ')}`);
        else lines.push(`${example.jp.replace(form, `**${form}**`)}\n*(${example.en})*`);
      }
      item.details = `${lines.join('\n')}\n\n${item.note.trim()}`;
    }
  }
}
if (errors.length) {
  errors.forEach((e) => console.error(`  - ${e}`));
  throw new Error(`${errors.length} problem(s); nothing written`);
}

const added: Record<string, number> = {};
for (const item of items) {
  const key = String(item.lesson);
  const lessonList = (chunks[item.level][key] ||= []);
  const { level, lesson, bold: _bold, note: _note, ...rest } = item;
  lessonList.push({
    uid: `${level.toLowerCase()}-grammar-${lesson}-${lessonList.length + 1}`,
    level,
    section: 'grammar',
    lesson,
    ...rest,
  });
  added[level] = (added[level] ?? 0) + 1;
}

for (const level of LEVELS) {
  const sorted: Chunk = {};
  for (const key of Object.keys(chunks[level]).map(Number).sort((a, b) => a - b)) {
    sorted[String(key)] = chunks[level][String(key)];
  }
  if (!dryRun && added[level]) {
    writeFileSync(
      resolve(process.cwd(), `${DATA_DIR}/${level.toLowerCase()}/grammar.json`),
      `${JSON.stringify(sorted, null, 2)}\n`,
      'utf-8'
    );
  }
}
console.log(`${dryRun ? 'Would add' : 'Added'} ${items.length} point(s): ${JSON.stringify(added)}`);
