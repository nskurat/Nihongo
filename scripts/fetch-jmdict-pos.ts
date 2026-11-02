import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { lookupForm, posCode, type JmdictEntry } from './lib/jmdictPos';
import type { SourceWord } from './lib/jlptContent';

/**
 * Downloads JMdict (as the jamdict-data SQLite build on PyPI) and trims it into the one
 * vendored file scripts/fill-vocab-pos.ts reads, so that script runs offline:
 *
 *   scripts/sources/jmdict-pos.json   JMdict entries our vocab can match: seq, spellings,
 *                                     readings, per-sense part-of-speech codes and glosses
 *
 *   npx tsx scripts/fetch-jmdict-pos.ts [--db path/to/jamdict.db]
 *
 * Needs the network (once; the archive is cached in the OS temp dir), `tar` and `xz`.
 * Kept entries: every JMdict id on the JLPT lists (scripts/sources/jlpt-vocab.json) plus
 * every entry with a spelling or reading equal to a vocab row's head word (N5–N1).
 *
 * Source: JMdict © EDRDG, CC BY-SA 4.0 (https://www.edrdg.org/edrdg/licence.html), via
 * jamdict-data 1.5 (neocl/jamdict, MIT; JMdict build of April 2021). Pinned by SHA-256 so a
 * refresh is deliberate. EDRDG's own server and the jmdict-simplified GitHub releases are a
 * newer alternative when reachable; the trimmed format is the same either way.
 */

const URL =
  'https://files.pythonhosted.org/packages/97/a5/075928aed2b3b70459fc1db396397dfa6714d266c143c51af9b648551a4e/jamdict_data-1.5.tar.gz';
const SHA256 = 'a4247dd9bb3148ab17c1b32fc56d7a7f1c35293b0d6ff2838c811f896d13f415';
const CACHE = join(tmpdir(), 'nihongo-jmdict');
const DATA = 'grammar-app/src/data';
const OUT = 'scripts/sources/jmdict-pos.json';

async function databasePath(): Promise<string> {
  const flag = process.argv.indexOf('--db');
  if (flag !== -1) return process.argv[flag + 1];
  const db = join(CACHE, 'jamdict.db');
  if (existsSync(db)) return db;
  mkdirSync(CACHE, { recursive: true });
  const archive = join(CACHE, 'jamdict_data-1.5.tar.gz');
  if (!existsSync(archive)) {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`${res.status} fetching ${URL}`);
    writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  }
  const sum = createHash('sha256').update(readFileSync(archive)).digest('hex');
  if (sum !== SHA256) throw new Error(`checksum mismatch for ${archive}: ${sum}`);
  execFileSync('tar', ['-xzf', archive, '-C', CACHE, 'jamdict_data-1.5/jamdict_data/jamdict.db.xz']);
  writeFileSync(db, execFileSync('xz', ['-dc', join(CACHE, 'jamdict_data-1.5/jamdict_data/jamdict.db.xz')], { maxBuffer: 1 << 30 }));
  return db;
}

/** Head words of every vocab row, N5–N1 (both parts of a ／ pair), and their する / な stems. */
function vocabForms(): Set<string> {
  const forms = new Set<string>();
  for (const level of readdirSync(DATA)) {
    const path = join(DATA, level, 'vocab.json');
    if (!existsSync(path)) continue;
    const file = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, { word: string }[]>;
    for (const row of Object.values(file).flat())
      for (const part of row.word.split('／')) {
        const form = lookupForm(part);
        forms.add(form);
        // 帰国する / 温暖な: the noun or na-adjective is the JMdict headword.
        const stem = form.replace(/(する|な)$/, '');
        if (stem !== form && stem) forms.add(stem);
      }
  }
  return forms;
}

const db = new DatabaseSync(await databasePath(), { readOnly: true });
const listSeqs = new Set((JSON.parse(readFileSync('scripts/sources/jlpt-vocab.json', 'utf-8')) as SourceWord[]).map((w) => w.jmdictSeq));
const forms = vocabForms();

const group = <T extends { idseq?: number; sid?: number }>(rows: T[], key: 'idseq' | 'sid') => {
  const map = new Map<number, T[]>();
  for (const r of rows) {
    const id = r[key] as number;
    map.set(id, [...(map.get(id) ?? []), r]);
  }
  return map;
};
type Text = { idseq?: number; sid?: number; text: string };
const kanji = group(db.prepare('SELECT idseq, text FROM Kanji ORDER BY ID').all() as Text[], 'idseq');
const kana = group(db.prepare('SELECT idseq, text FROM Kana ORDER BY ID').all() as Text[], 'idseq');
const senses = group(db.prepare('SELECT ID AS sid, idseq FROM Sense ORDER BY ID').all() as { sid: number; idseq: number }[], 'idseq');
const pos = group(db.prepare('SELECT sid, text FROM pos ORDER BY rowid').all() as Text[], 'sid');
const gloss = group(db.prepare("SELECT sid, text FROM SenseGloss WHERE lang = 'eng' ORDER BY rowid").all() as Text[], 'sid');

const out: JmdictEntry[] = [];
for (const { idseq } of db.prepare('SELECT idseq FROM Entry ORDER BY idseq').all() as { idseq: number }[]) {
  const k = (kanji.get(idseq) ?? []).map((x) => x.text);
  const r = (kana.get(idseq) ?? []).map((x) => x.text);
  if (!listSeqs.has(idseq) && ![...k, ...r].some((f) => forms.has(f))) continue;
  let previous: string[] = [];
  const s = (senses.get(idseq) ?? []).map(({ sid }) => {
    // JMdict states a sense's pos only when it changes; later senses inherit it.
    const own = (pos.get(sid) ?? []).map((p) => posCode(p.text));
    const p = own.length ? own : previous;
    previous = p;
    return { p, g: (gloss.get(sid) ?? []).map((x) => x.text).join('; ') };
  });
  out.push({ seq: idseq, k, r, s });
}
writeFileSync(OUT, `[\n${out.map((e) => JSON.stringify(e)).join(',\n')}\n]\n`);
console.log(`${OUT}: ${out.length} entries (${listSeqs.size} JLPT-list ids)`);
