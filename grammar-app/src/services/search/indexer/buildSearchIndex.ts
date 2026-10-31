import type { GrammarItem, KanjiItem, TagTaxonomy, VocabItem } from '../../../types/japanese';
import type { Level } from '../types';
import { OKURIGANA_PAIRS } from '../aliases';
import { enTokens } from '../english';
import { grammarKeys } from '../keys/grammarKeys';
import { isMasuExpression, masuToDict, type MasuRule } from '../keys/masuToDict';
import { honorificAlias, vocabVariants } from '../keys/vocabVariants';
import { defaultClassOf, dictClass, masuRuleClass, mergeClasses, posClass } from '../keys/wordClass';
import { key } from '../normalize';
import {
  LEVELS,
  SHARD_SCHEMA,
  SHARD_VERSION,
  type GrammarRow,
  type GrammarShard,
  type KanjiRow,
  type KanjiShard,
  type ShardFile,
  type VocabExtra,
  type VocabRow,
  type VocabShard,
} from '../shard';

/** Bump when the builder's output changes for the same content. Part of `contentHash`. */
export const BUILDER_VERSION = 1;

type LessonFile<T> = Record<string, T[]>;

export interface SearchContent {
  taxonomy: TagTaxonomy;
  grammar: Partial<Record<Level, LessonFile<GrammarItem>>>;
  vocab: Partial<Record<Level, LessonFile<VocabItem>>>;
  kanji: Partial<Record<Level, LessonFile<KanjiItem>>>;
}

export interface MasuReportRow {
  uid: string;
  word: string;
  pos: string;
  lemma: string;
  lemmaReading: string;
  rule: MasuRule;
}

export interface SearchIndexBuild {
  shards: ShardFile[];
  report: { masu: MasuReportRow[]; warnings: string[] };
}

/** Rows of a lesson file in lesson order, then position. */
function rowsOf<T>(file: LessonFile<T> | undefined): T[] {
  if (!file) return [];
  return Object.keys(file)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((l) => file[l]);
}

/** Tag ids in taxonomy order (a tag listed in two facets appears once), with labels. */
export function taxonomyTags(taxonomy: TagTaxonomy): { ids: string[]; labels: string[] } {
  const ids: string[] = [];
  const labels: string[] = [];
  for (const facet of Object.values(taxonomy.facets)) {
    for (const [id, def] of Object.entries(facet.tags)) {
      if (ids.includes(id)) continue;
      ids.push(id);
      labels.push(def.label);
    }
  }
  return { ids, labels };
}

/**
 * Turns the content files into index shards. Pure: the build script and the tests both
 * call this; only the script writes files.
 */
export function buildSearchIndex(content: SearchContent, contentHash = 'dev'): SearchIndexBuild {
  const warnings: string[] = [];
  const masuReport: MasuReportRow[] = [];
  const base = { schema: SHARD_SCHEMA, v: SHARD_VERSION, contentHash } as const;

  // ---- grammar
  const { ids: tagIds, labels: tagLabels } = taxonomyTags(content.taxonomy);
  const tagIndex = new Map(tagIds.map((t, i) => [t, i]));
  const grammarDocs: GrammarRow[] = [];
  for (const level of LEVELS) {
    for (const g of rowsOf(content.grammar[level])) {
      const tags: number[] = [];
      for (const t of g.tags ?? []) {
        const i = tagIndex.get(t);
        if (i === undefined) warnings.push(`${g.uid}: unknown tag ${t}`);
        else tags.push(i);
      }
      const titleKeys = grammarKeys(g.title);
      const structureKeys = grammarKeys(g.structure).filter((k) => !titleKeys.includes(k));
      const meaningTokens = new Set(enTokens(g.meaning));
      const summaryTokens = enTokens(g.summary).filter((t) => !meaningTokens.has(t));
      grammarDocs.push([g.uid, g.title, g.meaning, tags, g.structure ?? '', titleKeys, structureKeys, summaryTokens.join(' ')]);
    }
  }
  const shards: ShardFile[] = [];
  const grammarShard: GrammarShard = { ...base, shard: 'grammar', tags: tagIds, tagLabels, docs: grammarDocs };
  shards.push(grammarShard);

  // ---- corpus for the ます corpus check: dictionary-looking vocab surfaces + compound words
  const corpus = new Set<string>();
  const vocabSurfaces = new Set<string>();
  for (const level of LEVELS) {
    for (const v of rowsOf(content.vocab[level])) {
      for (const k of vocabVariants(v.word).variants) {
        corpus.add(k);
        vocabSurfaces.add(k);
      }
    }
    for (const k of rowsOf(content.kanji[level])) for (const c of k.compounds ?? []) corpus.add(key(c.word));
  }
  const okurigana = new Map<string, string[]>();
  for (const [a, b] of OKURIGANA_PAIRS) {
    okurigana.set(a, [...(okurigana.get(a) ?? []), b]);
    okurigana.set(b, [...(okurigana.get(b) ?? []), a]);
  }

  // ---- vocab
  for (const level of LEVELS) {
    const rows = rowsOf(content.vocab[level]);
    if (!rows.length) continue;
    const docs: VocabRow[] = [];
    for (const v of rows) {
      const wv = vocabVariants(v.word);
      const rv = vocabVariants(v.reading);
      const extra: VocabExtra = {};
      const plainW = key(v.word);
      const plainR = key(v.reading);
      if (wv.variants.length && (wv.variants.length !== 1 || wv.variants[0] !== plainW)) extra.s = wv.variants;
      if (rv.variants.length && (rv.variants.length !== 1 || rv.variants[0] !== plainR)) extra.r = rv.variants;
      const hints = [...wv.hints];
      for (const h of rv.hints) if (!hints.includes(h)) hints.push(h);
      if (hints.length) extra.h = hints;

      // ます → dictionary form, part by part (入ります／出ます pair with their readings).
      // Only N5/N4 store ます-forms; N3–N1 rows are dictionary forms (覚ます, クリスマス).
      const lemmas: string[] = [];
      const classes: string[] = [];
      const masuLevel = level === 'N5' || level === 'N4';
      const posParts = (v.pos ?? '').split(/\s+\/\s+/);
      wv.parts.forEach((part, i) => {
        const readingPart = rv.parts.length === wv.parts.length ? rv.parts[i] : rv.parts[0];
        const pos = posParts.length === wv.parts.length ? posParts[i] : v.pos;
        part.variants.forEach((w, j) => {
          const r = readingPart?.variants[j] ?? readingPart?.variants[0] ?? '';
          const masuRow = masuLevel && w.endsWith('ます');
          const m = masuRow && !isMasuExpression(w, v.pos) ? masuToDict(w, r, pos, corpus) : null;
          if (!m) {
            classes.push(masuRow ? 'n' : (posClass(pos, w) ?? dictClass(w, r)));
            return;
          }
          // 知ります／知っています: the te-iru part is ichidan-shaped but says nothing about 知る.
          if (m.rule !== 'te-iru' || wv.parts.length === 1) classes.push(masuRuleClass(m.rule));
          for (const k of [m.lemma, m.lemmaReading]) if (k && !lemmas.includes(k)) lemmas.push(k);
          masuReport.push({ uid: v.uid, word: v.word, pos: v.pos ?? '', lemma: m.lemma, lemmaReading: m.lemmaReading, rule: m.rule });
        });
      });
      if (lemmas.length) extra.l = lemmas;
      const cls = mergeClasses(classes.length ? classes : ['n']);
      if (cls !== defaultClassOf(extra.s ?? [plainW], extra.r ?? [plainR])) extra.c = cls;

      const aliases: string[] = [];
      const addAlias = (k: string) => {
        if (k && !aliases.includes(k) && !wv.variants.includes(k)) aliases.push(k);
      };
      const first = wv.variants[0] ?? plainW;
      const stripped = honorificAlias(first);
      if (stripped) {
        addAlias(stripped);
        const r0 = rv.variants[0] ?? plainR;
        if (/^[おご]/.test(r0)) addAlias(r0.slice(1));
      }
      for (const w of [...wv.variants, ...lemmas]) for (const other of okurigana.get(w) ?? []) addAlias(other);
      if (aliases.length) extra.a = aliases;

      docs.push(Object.keys(extra).length ? [v.uid, v.word, v.reading, v.meaning, extra] : [v.uid, v.word, v.reading, v.meaning]);
    }
    const shard: VocabShard = { ...base, shard: `vocab-${level}`, docs };
    shards.push(shard);
  }

  // ---- kanji: compounds already reachable as vocab surfaces are dropped (§2.7)
  const kanjiDocs: KanjiRow[] = [];
  for (const level of LEVELS) {
    for (const k of rowsOf(content.kanji[level])) {
      const extraCompounds: string[] = [];
      for (const c of k.compounds ?? []) {
        const ck = key(c.word);
        if (ck && ck !== k.kanji && !vocabSurfaces.has(ck) && !extraCompounds.includes(ck)) extraCompounds.push(ck);
      }
      const row: KanjiRow = extraCompounds.length
        ? [k.uid, k.kanji, k.meaning, k.onyomi ?? [], k.kunyomi ?? [], extraCompounds]
        : [k.uid, k.kanji, k.meaning, k.onyomi ?? [], k.kunyomi ?? []];
      kanjiDocs.push(row);
    }
  }
  if (kanjiDocs.length) {
    const shard: KanjiShard = { ...base, shard: 'kanji', docs: kanjiDocs };
    shards.push(shard);
  }

  return { shards, report: { masu: masuReport, warnings } };
}

/** Lemma report as TSV (uid, word, pos, lemma, lemma reading, rule) for teacher review. */
export function masuReportTsv(rows: MasuReportRow[]): string {
  const lines = ['uid\tword\tpos\tlemma\tlemma_reading\trule'];
  for (const r of rows) lines.push([r.uid, r.word, r.pos || '-', r.lemma, r.lemmaReading, r.rule].join('\t'));
  return `${lines.join('\n')}\n`;
}
