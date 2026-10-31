import { ALIAS_CATEGORIES, TAG_ALIASES, aliasKey } from '../aliases';
import { deinflect } from '../deinflect';
import { foldPlural, phraseText, queryForms, queryTerms, words } from '../english';
import { findKeyRanges, foldLong, hasKanji, isKana, isKanjiChar, key, norm } from '../normalize';
import { compareHits, groupOrderFor, levelIndex, TIER } from '../rank';
import { isLatin, romajiToKana } from '../romaji';
import { isShardFile, LEVELS, type ShardFile } from '../shard';
import type {
  CategoryChip,
  DocType,
  Level,
  MatchField,
  MatchKind,
  Script,
  SearchDocument,
  SearchHit,
  SearchOptions,
  SearchResponse,
} from '../types';
import { decodeShard, foldableReadings, toSearchDocument, type Doc } from './docs';

/** Posting kinds. A posting is `docIndex * KINDS + kind`. */
const K = { surface: 0, reading: 1, lemma: 2, alias: 3, hint: 4, structure: 5, compound: 6, stem: 7 } as const;
type Kind = (typeof K)[keyof typeof K];
const KINDS = 8;
const LOW_KINDS: ReadonlySet<number> = new Set([K.hint, K.structure, K.compound]);
const WORD_KINDS: ReadonlySet<number> = new Set([K.surface, K.reading, K.lemma, K.alias]);

const TYPES: DocType[] = ['grammar', 'vocab', 'kanji'];
const DEFAULT_LIMIT = 8;
const SINGLE_KANA_CAP = 40;
const ALL_KANJI = /^[一-鿿㐀-䶿々〆]+$/;
const KATAKANA_WORD = /^[ァ-ヺー・\s]+$/;

interface Cand {
  tier: number;
  sub: number;
  kind: MatchKind;
  field: MatchField;
  /** Key to highlight in the display string. */
  needle?: string;
  /** English query forms to highlight in the meaning. */
  enForms?: Set<string>;
  via?: string;
  deinflection?: SearchHit['deinflection'];
}

interface Scored {
  d: number;
  c: Cand;
}

export class ContentHashMismatchError extends Error {
  constructor(expected: string, got: string) {
    super(`search index shards from different builds (${expected} vs ${got})`);
    this.name = 'ContentHashMismatchError';
  }
}

function fieldOf(kind: Kind): MatchField {
  switch (kind) {
    case K.reading:
    case K.stem:
      return 'reading';
    case K.structure:
      return 'structure';
    case K.compound:
      return 'compound';
    default:
      return 'title';
  }
}

const emptyByType = <T>(make: () => T): Record<DocType, T> => ({ grammar: make(), vocab: make(), kanji: make() });
const emptyByLevel = (): Record<Level, number> => ({ N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 });

/**
 * The static matcher: hash maps + a sorted key array + tier ranking over the decoded
 * shards. Pure in-memory; the worker and `MemorySearchSource` both drive one of these.
 */
export class SearchEngine {
  private docs: Doc[] = [];
  private exact = new Map<string, number[]>();
  private folded = new Map<string, number[]>();
  private en = new Map<string, number[]>();
  private kanjiByChar = new Map<string, number>();
  private tagDocs = new Map<string, number[]>();
  private grammarKanaKeys = new Set<string>();
  private sortedKeys: string[] | null = null;
  private tagIds: string[] = [];
  private tagLabels: string[] = [];
  private loaded = new Set<string>();
  private contentHash: string | null = null;
  /** Shards the source expects; `status` is 'ready' once all are loaded. */
  expected: string[] | null = null;

  get loadedShards(): string[] {
    return [...this.loaded];
  }

  get isComplete(): boolean {
    return this.expected ? this.expected.every((s) => this.loaded.has(s)) : this.loaded.size > 0;
  }

  get size(): number {
    return this.docs.length;
  }

  addShard(shard: ShardFile): void {
    if (!isShardFile(shard)) throw new Error('not a search index shard (schema/version mismatch)');
    if (this.loaded.has(shard.shard)) return;
    if (this.contentHash !== null && this.contentHash !== shard.contentHash) {
      throw new ContentHashMismatchError(this.contentHash, shard.contentHash);
    }
    this.contentHash = shard.contentHash;
    if (shard.shard === 'grammar') {
      this.tagIds = shard.tags;
      this.tagLabels = shard.tagLabels;
    }
    for (const doc of decodeShard(shard)) this.index(doc);
    this.loaded.add(shard.shard);
    this.sortedKeys = null;
  }

  private post(map: Map<string, number[]>, k: string, value: number): void {
    if (!k) return;
    const list = map.get(k);
    if (list) {
      if (list[list.length - 1] !== value) list.push(value);
    } else map.set(k, [value]);
  }

  private index(doc: Doc): void {
    const d = this.docs.push(doc) - 1;
    const add = (keys: string[], kind: Kind) => {
      for (const k of keys) this.post(this.exact, k, d * KINDS + kind);
    };
    add(doc.surface, K.surface);
    add(doc.readings, K.reading);
    add(doc.stems, K.stem);
    add(doc.lemma, K.lemma);
    add(doc.alias, K.alias);
    add(doc.hint, K.hint);
    add(doc.structureKeys, K.structure);
    add(doc.compounds, K.compound);
    for (const r of foldableReadings(doc)) this.post(this.folded, foldLong(r), d);
    for (const t of doc.en) this.post(this.en, t, d * 2);
    for (const t of doc.summaryEn) this.post(this.en, t, d * 2 + 1);
    if (doc.type === 'kanji') this.kanjiByChar.set(doc.title, d);
    if (doc.type === 'grammar') {
      for (const t of doc.tags ?? []) this.post(this.tagDocs, t, d);
      for (const k of doc.surface) if (k.length >= 2 && isKana(k)) this.grammarKanaKeys.add(k);
    }
  }

  private keys(): string[] {
    if (!this.sortedKeys) this.sortedKeys = [...this.exact.keys()].sort();
    return this.sortedKeys;
  }

  /** Logical documents (for tests and a future DB loader). */
  documents(): SearchDocument[] {
    return this.docs.map(toSearchDocument);
  }

  // ------------------------------------------------------------------ categories

  private tagsFor(id: string, preferTag: boolean): string[] {
    const isTag = this.tagIds.includes(id);
    const cat = ALIAS_CATEGORIES.find((c) => c.id === id);
    if (preferTag && isTag) return [id];
    if (cat) return cat.tags;
    return isTag ? [id] : [];
  }

  private docsWithTags(tags: string[]): Set<number> {
    const out = new Set<number>();
    for (const t of tags) for (const d of this.tagDocs.get(t) ?? []) out.add(d);
    return out;
  }

  listCategories(): CategoryChip[] {
    return ALIAS_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      count: this.docsWithTags(c.tags).size,
      tagIds: [...c.tags],
    }));
  }

  /** Category chips whose alias, tag id or tag label equals the whole query. */
  matchCategories(query: string): CategoryChip[] {
    const q = aliasKey(query);
    if (!q) return [];
    const chips: CategoryChip[] = [];
    const seen = new Set<string>();
    const push = (id: string, label: string, tags: string[]) => {
      const sig = [...tags].sort().join(',');
      if (seen.has(sig)) return;
      seen.add(sig);
      chips.push({ id, label, count: this.docsWithTags(tags).size, tagIds: [...tags] });
    };
    for (const c of ALIAS_CATEGORIES) {
      if (c.aliases.some((a) => aliasKey(a) === q) || aliasKey(c.label) === q || aliasKey(c.id) === q) push(c.id, c.label, c.tags);
    }
    this.tagIds.forEach((id, i) => {
      const names = [id, this.tagLabels[i] ?? '', ...(TAG_ALIASES[id] ?? [])].map(aliasKey);
      if (names.includes(q) && this.tagDocs.has(id)) push(id, this.tagLabels[i] ?? id, [id]);
    });
    return chips;
  }

  // ------------------------------------------------------------------ tag listing

  listByTag(tag: string, opts: Partial<Omit<SearchOptions, 'tag'>> = {}): SearchHit[] {
    const tags = this.tagsFor(tag, true);
    const docs = [...this.docsWithTags(tags)]
      .filter((d) => !opts.levels?.length || opts.levels.includes(this.docs[d].level))
      .sort((a, b) => {
        const x = this.docs[a];
        const y = this.docs[b];
        return levelIndex(x.level) - levelIndex(y.level) || x.lesson - y.lesson || x.pos - y.pos;
      });
    return docs.map((d) => this.toHit(d, { tier: 0, sub: 0, kind: 'tag', field: 'tag' }, false));
  }

  // ------------------------------------------------------------------ search

  search(query: string, opts: SearchOptions): SearchResponse {
    const n = norm(query);
    const q = key(query);
    const latin = isLatin(n);
    const best = new Map<number, Cand>();
    const consider = (d: number, c: Cand) => {
      const prev = best.get(d);
      if (!prev || c.tier < prev.tier || (c.tier === prev.tier && c.sub < prev.sub)) best.set(d, c);
    };

    let script: Script = latin ? 'english' : ALL_KANJI.test(q) ? 'kanji' : isKana(q) ? 'kana' : 'mixed';
    let queryAs: string | undefined;
    let exactOnly = false;
    let romajiExact = false;

    if (q) {
      if (latin) {
        const kana = romajiToKana(n);
        if (kana && isKana(kana)) {
          const before = best.size;
          exactOnly = this.matchJapanese(kana, consider);
          const romajiHits = [...best.values()];
          if (best.size > before) {
            queryAs = kana;
            romajiExact = romajiHits.some((c) => c.tier <= TIER.deinflected);
          }
        }
        const enCount = this.matchEnglish(n, consider);
        if (queryAs && (romajiExact || enCount === 0)) script = 'romaji';
        if (enCount > 0) exactOnly = false;
      } else {
        exactOnly = this.matchJapanese(q, consider);
      }
    }

    const tagFilter = opts.tag ? this.tagsFor(opts.tag, true) : opts.category ? this.tagsFor(opts.category, false) : null;
    // A function filter with no query lists that function's grammar (`?tag=comparison`).
    if (!q && tagFilter) {
      for (const d of this.docsWithTags(tagFilter)) consider(d, { tier: 0, sub: 0, kind: 'tag', field: 'tag' });
    }

    const scored: Scored[] = [...best.entries()].map(([d, c]) => ({ d, c }));
    const singleKanji = q.length === 1 && isKanjiChar(q);
    return this.respond(query, opts, scored, {
      script,
      queryAs,
      exactOnly,
      tagFilter,
      categories: latin ? this.matchCategories(n) : [],
      groupOrder: groupOrderFor(script, { singleKanji, romajiExact }),
      queryHasKanji: hasKanji(q),
      tagListing: !q && !!tagFilter,
    });
  }

  /** Japanese (or romaji-as-kana) matching. Returns true when the single-kana guard applied. */
  private matchJapanese(k: string, consider: (d: number, c: Cand) => void): boolean {
    const oneKana = k.length === 1 && isKana(k);

    for (const p of this.exact.get(k) ?? []) {
      const d = Math.floor(p / KINDS);
      const kind = (p % KINDS) as Kind;
      if (oneKana && kind !== K.surface && kind !== K.reading) continue;
      const doc = this.docs[d];
      if (kind === K.lemma) consider(d, { tier: TIER.lemma, sub: 0, kind: 'lemma', field: 'title', via: doc.lemma[0] });
      else if (kind === K.alias) consider(d, { tier: TIER.lemma, sub: 0, kind: 'lemma', field: 'title', needle: k, via: k });
      else if (kind === K.compound) consider(d, { tier: TIER.hint, sub: 0, kind: 'compound', field: 'compound', via: k });
      else if (kind === K.hint) consider(d, { tier: TIER.hint, sub: 0, kind: 'compound', field: 'title', needle: k, via: k });
      else if (kind === K.structure) consider(d, { tier: TIER.hint, sub: 0, kind: 'exact', field: 'structure', needle: k });
      else consider(d, { tier: TIER.exact, sub: kind === K.stem ? 1 : 0, kind: 'exact', field: fieldOf(kind), needle: k });
    }
    if (oneKana) return true;

    // Deinflection: keep only lemmas that are vocab words in the index.
    if (isKana(k.slice(-1))) {
      for (const c of deinflect(k)) {
        const last = c.lemma.slice(-1);
        for (const p of this.exact.get(c.lemma) ?? []) {
          const d = Math.floor(p / KINDS);
          const kind = p % KINDS;
          const doc = this.docs[d];
          if (doc.type !== 'vocab' || !WORD_KINDS.has(kind)) continue;
          // A verb/adjective lemma must end like the word's own spelling (rejects 蛙 for かえる).
          if (last && ![...doc.surface, ...doc.lemma, ...doc.alias].some((s) => s.endsWith(last))) continue;
          // Katakana words are loanwords and nouns, not inflecting verbs (カエル for かえって).
          if (KATAKANA_WORD.test(doc.title)) continue;
          consider(d, {
            tier: TIER.deinflected,
            sub: c.steps.length,
            kind: 'deinflected',
            field: kind === K.reading ? 'reading' : 'title',
            needle: c.lemma,
            via: c.lemma,
            deinflection: { input: k, lemma: c.lemma, steps: c.steps.map((s) => ({ en: s.en, ja: s.ja })) },
          });
        }
      }
    }

    const keys = this.keys();
    // Prefix: binary search, then walk.
    let lo = 0;
    let hi = keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid] < k) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < keys.length && keys[i].startsWith(k); i++) {
      if (keys[i] === k) continue;
      this.considerPostings(keys[i], 'prefix', k, consider);
    }
    // Contains: ≥ 2 chars, or a single kanji (a full query).
    // A single kanji ranks words that start with it and words that contain it together
    // (分 → 分かる, 自分, 十分, 半分 by level), since its position says little.
    const singleKanji = k.length === 1 && isKanjiChar(k);
    if (k.length >= 2 || singleKanji) {
      for (const other of keys) {
        if (other.length > k.length && !other.startsWith(k) && other.includes(k)) {
          this.considerPostings(other, singleKanji ? 'prefix' : 'contains', k, consider);
        }
      }
    }
    // Long-vowel-folded reading.
    if (isKana(k) && k.length >= 2) {
      for (const d of this.folded.get(foldLong(k)) ?? []) {
        consider(d, { tier: TIER.folded, sub: 0, kind: 'folded', field: 'reading', via: this.docs[d].readings[0] });
      }
    }
    // Kanji in a word-shaped query.
    if (k.length > 1 && hasKanji(k)) {
      for (const ch of k) {
        const d = this.kanjiByChar.get(ch);
        if (d !== undefined) consider(d, { tier: TIER.contains, sub: 1, kind: 'kanjiFromWord', field: 'title', needle: ch, via: k });
      }
    }
    // Grammar pattern inside the query (読まずに → 〜ずに).
    if (k.length >= 3) {
      for (const gk of this.grammarKanaKeys) {
        if (gk.length >= k.length || !k.includes(gk)) continue;
        for (const p of this.exact.get(gk) ?? []) {
          const d = Math.floor(p / KINDS);
          if (p % KINDS !== K.surface || this.docs[d].type !== 'grammar') continue;
          consider(d, { tier: TIER.hint, sub: 1, kind: 'contains', field: 'title', needle: gk, via: gk });
        }
      }
    }
    return false;
  }

  private considerPostings(k: string, how: 'prefix' | 'contains', needle: string, consider: (d: number, c: Cand) => void): void {
    for (const p of this.exact.get(k) ?? []) {
      const d = Math.floor(p / KINDS);
      const kind = (p % KINDS) as Kind;
      const low = LOW_KINDS.has(kind);
      const tier = low ? TIER.hint : how === 'prefix' ? TIER.prefix : TIER.contains;
      const kindOut: MatchKind = kind === K.compound || kind === K.hint ? 'compound' : how;
      consider(d, { tier, sub: 0, kind: kindOut, field: fieldOf(kind), needle, via: low ? k : undefined });
    }
  }

  /** English whole-word matching. Returns the number of docs hit. */
  private matchEnglish(n: string, consider: (d: number, c: Cand) => void): number {
    const terms = queryTerms(n);
    if (!terms.length) return 0;
    const forms = terms.map((t) => new Set(queryForms(t)));
    let acc: Map<number, boolean> | null = null; // doc → matched only through the summary
    for (const set of forms) {
      const hit = new Map<number, boolean>();
      for (const f of set) {
        for (const p of this.en.get(f) ?? []) {
          const d = p >> 1;
          const summary = (p & 1) === 1;
          hit.set(d, (hit.get(d) ?? true) && summary);
        }
      }
      if (acc === null) acc = hit;
      else {
        const next = new Map<number, boolean>();
        for (const [d, s] of acc) {
          const h = hit.get(d);
          if (h !== undefined) next.set(d, s || h);
        }
        acc = next;
      }
      if (!acc.size) return 0;
    }
    const phrase = terms.length > 1 ? phraseText(words(n).join(' ')) : '';
    const enForms = new Set(forms.flatMap((s) => [...s]));
    for (const [d, summaryOnly] of acc ?? []) {
      const doc = this.docs[d];
      const isPhrase = phrase !== '' && doc.phrase.includes(phrase);
      // Inside the tier, glosses that are mostly the query word come first (失う "lose"
      // before 負けず嫌い "hating to lose"); a multi-word phrase beats a scattered AND.
      const density = doc.en.length ? Math.min(1, terms.length / doc.en.length) : 0;
      consider(d, {
        tier: summaryOnly ? TIER.summary : TIER.english,
        sub: (isPhrase || terms.length === 1 ? 0 : 1) + (1 - density),
        kind: 'english',
        field: 'meaning',
        enForms: summaryOnly ? undefined : enForms,
        via: summaryOnly ? 'summary' : undefined,
      });
    }
    return acc?.size ?? 0;
  }

  // ------------------------------------------------------------------ response

  private respond(
    query: string,
    opts: SearchOptions,
    scored: Scored[],
    meta: {
      script: Script;
      queryAs?: string;
      exactOnly: boolean;
      tagFilter: string[] | null;
      categories: CategoryChip[];
      groupOrder: DocType[];
      queryHasKanji: boolean;
      tagListing: boolean;
    }
  ): SearchResponse {
    const tagSet = meta.tagFilter ? this.docsWithTags(meta.tagFilter) : null;
    const typeFilter = new Set<DocType>(meta.tagFilter ? ['grammar'] : opts.types?.length ? opts.types : TYPES);
    if (meta.tagFilter && opts.types?.length && !opts.types.includes('grammar')) typeFilter.clear();
    const levelFilter = opts.levels?.length ? new Set(opts.levels) : null;

    const passes = (s: Scored, ignore: 'type' | 'level' | null): boolean => {
      const doc = this.docs[s.d];
      if (ignore !== 'type' && !typeFilter.has(doc.type)) return false;
      if (ignore !== 'level' && levelFilter && !levelFilter.has(doc.level)) return false;
      if (tagSet && !tagSet.has(s.d)) return false;
      return true;
    };
    const ident = (s: Scored) => this.docs[s.d].dupKey ?? this.docs[s.d].uid;
    const count = (list: Scored[]) => new Set(list.map(ident)).size;

    const filtered = scored.filter((s) => passes(s, null));
    const cmp = compareHits(opts.rankLevel);
    const rank = (a: Scored, b: Scored) => {
      const x = this.docs[a.d];
      const y = this.docs[b.d];
      if (meta.tagListing) return levelIndex(x.level) - levelIndex(y.level) || x.lesson - y.lesson || x.pos - y.pos;
      return cmp({ ...a.c, level: x.level, lesson: x.lesson, pos: x.pos }, { ...b.c, level: y.level, lesson: y.lesson, pos: y.pos });
    };

    const groups = emptyByType<SearchHit[]>(() => []);
    const totals = emptyByType(() => 0);
    let remaining = meta.exactOnly ? SINGLE_KANA_CAP : Infinity;
    const limit = opts.limitPerType ?? DEFAULT_LIMIT;
    for (const type of meta.groupOrder) {
      const list = filtered.filter((s) => this.docs[s.d].type === type).sort(rank);
      const collapsed: { s: Scored; also: Scored[] }[] = [];
      const byKey = new Map<string, { s: Scored; also: Scored[] }>();
      for (const s of list) {
        const dk = this.docs[s.d].dupKey;
        const prev = dk ? byKey.get(dk) : undefined;
        if (prev) prev.also.push(s);
        else {
          const entry = { s, also: [] };
          collapsed.push(entry);
          if (dk) byKey.set(dk, entry);
        }
      }
      const capped = collapsed.slice(0, Math.max(0, remaining));
      remaining -= capped.length;
      totals[type] = capped.length;
      groups[type] = capped.slice(0, limit).map(({ s, also }) => {
        const hit = this.toHit(s.d, s.c, true);
        if (also.length) {
          hit.alsoAt = also
            .map((a) => this.docs[a.d])
            .sort((x, y) => levelIndex(x.level) - levelIndex(y.level) || x.lesson - y.lesson)
            .map((x) => ({ uid: x.uid, level: x.level, lesson: x.lesson }));
        }
        return hit;
      });
    }

    const facetType = emptyByType(() => 0);
    for (const type of TYPES) facetType[type] = count(scored.filter((s) => this.docs[s.d].type === type && passes(s, 'type')));
    const facetLevel = emptyByLevel();
    for (const level of LEVELS) facetLevel[level] = count(scored.filter((s) => this.docs[s.d].level === level && passes(s, 'level')));
    const otherLevels = levelFilter ? scored.filter((s) => !levelFilter.has(this.docs[s.d].level) && passes(s, 'level')) : [];

    const kanjiOnly =
      scored.length > 0 &&
      scored.every((s) => this.docs[s.d].type === 'kanji' && (s.c.kind === 'kanjiFromWord' || s.c.kind === 'compound'));

    const response: SearchResponse = {
      query,
      script: meta.script,
      exactOnly: meta.exactOnly,
      wordMatch: !(meta.queryHasKanji && kanjiOnly),
      queryHasKanji: meta.queryHasKanji,
      groupOrder: meta.groupOrder,
      groups,
      totals,
      facetCounts: { type: facetType, level: facetLevel },
      categories: meta.categories,
      hiddenByFilters: count(scored) - count(filtered),
      otherLevelsCount: count(otherLevels),
      status: this.isComplete ? 'ready' : 'partial',
    };
    if (meta.queryAs) response.queryAs = meta.queryAs;
    return response;
  }

  private toHit(d: number, c: Cand, withHighlights: boolean): SearchHit {
    const doc = this.docs[d];
    const hit: SearchHit = {
      uid: doc.uid,
      type: doc.type,
      level: doc.level,
      lesson: doc.lesson,
      title: doc.title,
      meaning: doc.meaning,
      matchKind: c.kind,
      matchField: c.field,
      tier: c.tier,
    };
    if (doc.reading !== undefined) hit.reading = doc.reading;
    if (doc.onyomi) hit.onyomi = doc.onyomi;
    if (doc.kunyomi) hit.kunyomi = doc.kunyomi;
    if (doc.structure) hit.structure = doc.structure;
    if (doc.tags) hit.tags = doc.tags;
    if (c.via && c.via !== doc.title) hit.via = c.via;
    if (c.deinflection) hit.deinflection = c.deinflection;
    if (withHighlights) {
      const highlights = this.highlights(doc, c);
      if (highlights.length) hit.highlights = highlights;
    }
    return hit;
  }

  private highlights(doc: Doc, c: Cand): NonNullable<SearchHit['highlights']> {
    if (c.enForms) {
      const ranges = englishRanges(doc.meaning, c.enForms);
      return ranges.length ? [{ field: 'meaning', ranges }] : [];
    }
    if (!c.needle || c.kind === 'folded') return [];
    const fields: [MatchField, string | undefined][] =
      c.field === 'structure'
        ? [['structure', doc.structure]]
        : c.field === 'reading'
          ? [['reading', doc.reading], ['title', doc.title]]
          : [['title', doc.title], ['reading', doc.reading]];
    for (const [field, text] of fields) {
      if (!text) continue;
      const ranges = findKeyRanges(text, c.needle, 1);
      if (ranges.length) return [{ field, ranges }];
    }
    return [];
  }
}

/** Ranges of whole words in `text` whose plural-folded form is in `forms`. */
export function englishRanges(text: string, forms: Set<string>): [number, number][] {
  const out: [number, number][] = [];
  const re = /[A-Za-z0-9']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const w = m[0].toLowerCase().replace(/^'+|'+$/g, '').replace(/'s$/, '');
    if (w && forms.has(foldPlural(w))) out.push([m.index, m.index + m[0].length]);
  }
  return out;
}
