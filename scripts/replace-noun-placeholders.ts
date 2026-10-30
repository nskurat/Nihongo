import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * One-time migration: renames the noun slots in grammar patterns from N1/N2/N3
 * (the textbook convention, e.g. "N1は N2です") to A/B/C. In an app whose levels
 * are named N5-N1 the old labels read as JLPT levels.
 *
 * N1 and N2 never name a level in grammar text, so every occurrence is a slot.
 * N3 is mostly a real level reference ("(N3)", "the N3 point"), so only the slot
 * uses are rewritten: N3 directly followed by a particle (N3を, N3も) or by
 * "(the object)" / "the topic". Any N1/N2 left afterwards fails the run.
 *
 * uid, level and section are never touched. Safe to re-run (a second run finds
 * nothing to replace). Pass --dry-run to print counts without writing.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const FILES = ['n5', 'n4', 'n3', 'n2'].map((level) => resolve(`grammar-app/src/data/${level}/grammar.json`));
const SKIP_KEYS = new Set(['uid', 'level', 'section']);
const dryRun = process.argv.includes('--dry-run');

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/N1(?!\d)/g, 'A'],
  [/N2(?!\d)/g, 'B'],
  [/N3(?=[をもはが]|\s\(the object\)|\sthe topic)/g, 'C'],
];

let changed = 0;

function rewrite(value: Json): Json {
  if (typeof value === 'string') {
    let next = value;
    for (const [pattern, to] of REPLACEMENTS) next = next.replace(pattern, to);
    if (next !== value) changed++;
    return next;
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, SKIP_KEYS.has(key) ? entry : rewrite(entry)])
    );
  }
  return value;
}

for (const file of FILES) {
  changed = 0;
  const output = rewrite(JSON.parse(readFileSync(file, 'utf8')) as Json);
  const text = `${JSON.stringify(output, null, 2)}\n`;
  const leftover = text.replace(/"level": "N\d"/g, '').match(/.{0,20}N[12](?!\d).{0,20}/g);
  if (leftover) throw new Error(`${file}: N1/N2 left after rewrite:\n${leftover.join('\n')}`);
  console.log(`${file}: ${changed} strings rewritten`);
  if (!dryRun) writeFileSync(file, text);
}
