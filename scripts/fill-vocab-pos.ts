import { readFileSync, writeFileSync } from 'node:fs';
import { indexEntries, matchRow, type JmdictEntry, type PosMatch } from './lib/jmdictPos';
import type { SourceWord } from './lib/jlptContent';

/**
 * Fills `pos` on vocab rows that have none, from JMdict part-of-speech tags
 * (scripts/sources/jmdict-pos.json, mapping in scripts/lib/jmdictPos.ts). Rows JMdict
 * can't settle — no entry, a tag the closed set has no value for, or homographs that
 * disagree — are left without `pos` and listed. Never overwrites an existing `pos`, never
 * adds or moves rows, so uids are untouched. Deterministic and idempotent.
 *
 *   npx tsx scripts/fill-vocab-pos.ts [--level N3 --level N2 …] [--dry-run] [--quiet]
 *   npx tsx scripts/fill-vocab-pos.ts --compare    # mapping vs the hand-labelled N5/N4 rows, writes nothing
 *
 * Default levels: N3, N2, N1 (N5/N4 rows with `pos` were labelled by hand; their list-derived
 * rows are a separate decision, see docs/backlog.md §4).
 */

const DATA = 'grammar-app/src/data';
const DRY = process.argv.includes('--dry-run');
const QUIET = process.argv.includes('--quiet');
const levelArgs = process.argv.flatMap((a, i, all) => (a === '--level' ? [all[i + 1].toUpperCase()] : []));
const LEVELS = levelArgs.length ? levelArgs : ['N3', 'N2', 'N1'];

type Row = Record<string, unknown> & { uid: string; word: string; reading: string; meaning: string; pos?: string };
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf-8')) as T;

const index = indexEntries(readJson<JmdictEntry[]>('scripts/sources/jmdict-pos.json'));
const listSeqs = new Map<string, number[]>();
for (const w of readJson<SourceWord[]>('scripts/sources/jlpt-vocab.json')) {
  for (const form of new Set([w.kanji || w.kana, w.listKanji ?? ''])) {
    if (!form) continue;
    const key = `${form}|${w.kana}`;
    listSeqs.set(key, [...(listSeqs.get(key) ?? []), w.jmdictSeq]);
  }
}
const seqsFor = (word: string, reading: string) => listSeqs.get(`${word}|${reading}`) ?? [];

type Labelled = Row & { lemma?: string; lemmaReading?: string };

/** How often the mapping agrees with the hand-labelled N5/N4 rows (ます rows looked up by their lemma). */
function compare(): void {
  let total = 0;
  let agree = 0;
  const diffs = new Map<string, string[]>();
  for (const level of ['n5', 'n4']) {
    for (const row of Object.values(readJson<Record<string, Labelled[]>>(`${DATA}/${level}/vocab.json`)).flat()) {
      if (!row.pos) continue;
      total++;
      const m = matchRow({ word: row.lemma ?? row.word, reading: row.lemmaReading ?? row.reading, meaning: row.meaning }, index, seqsFor);
      const got = m.status === 'matched' ? m.pos : m.status;
      if (got === row.pos) agree++;
      else diffs.set(`${row.pos} → ${got}`, [...(diffs.get(`${row.pos} → ${got}`) ?? []), row.word]);
    }
  }
  console.log(`${agree} of ${total} hand-labelled N5/N4 rows agree`);
  for (const [k, words] of [...diffs].sort((a, b) => b[1].length - a[1].length))
    console.log(`  ${words.length}  ${k}: ${words.slice(0, 8).join(' ')}`);
}

if (process.argv.includes('--compare')) {
  compare();
  process.exit(0);
}

const describe = (row: Row, m: PosMatch) =>
  `  ${row.uid}  ${row.word} 【${row.reading}】 "${row.meaning}"` +
  (m.status === 'ambiguous' ? `  → ${m.options.join(' | ')}` : m.status === 'unmatched' ? `  (${m.reason})` : '');

const totals = { matched: 0, ambiguous: 0, unmatched: 0 };
const leftovers: string[] = [];
for (const level of LEVELS) {
  const path = `${DATA}/${level.toLowerCase()}/vocab.json`;
  const file = readJson<Record<string, Row[]>>(path);
  const counts = { matched: 0, ambiguous: 0, unmatched: 0, alreadySet: 0 };
  const byPos = new Map<string, number>();
  for (const row of Object.values(file).flat()) {
    if (row.pos) {
      counts.alreadySet++;
      continue;
    }
    const m = matchRow(row, index, seqsFor);
    counts[m.status]++;
    if (m.status === 'matched') {
      row.pos = m.pos;
      byPos.set(m.pos, (byPos.get(m.pos) ?? 0) + 1);
    } else leftovers.push(`${level} ${m.status}${describe(row, m)}`);
  }
  for (const k of ['matched', 'ambiguous', 'unmatched'] as const) totals[k] += counts[k];
  console.log(
    `${level}: ${counts.matched} matched, ${counts.ambiguous} ambiguous, ${counts.unmatched} unmatched` +
      (counts.alreadySet ? ` (${counts.alreadySet} already had pos)` : ''),
  );
  if (!QUIET) console.log(`  ${[...byPos].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(', ')}`);
  if (!DRY && counts.matched) writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
}
console.log(`Total: ${totals.matched} matched, ${totals.ambiguous} ambiguous, ${totals.unmatched} unmatched${DRY ? ' (dry run)' : ''}`);
if (leftovers.length && !QUIET) {
  console.log('\nLeft without pos:');
  for (const line of leftovers.sort()) console.log(line);
}
