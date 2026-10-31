import { ALIAS_CATEGORIES, TAG_ALIASES, aliasKey, type AliasCategory } from '../aliases';
import { deinflect } from '../deinflect';
import { foldPlural, phraseText, queryForms, queryTerms, STOPWORDS, words } from '../english';
import { patternInQuery } from '../keys/grammarKeys';
import { classForType } from '../keys/wordClass';
import { findKeyRanges, foldLong, hasKanji, isKana, isKanjiChar, key, norm } from '../normalize';
import { compareHits, groupOrderFor, levelIndex, orderGroups, TIER, type GroupBest } from '../rank';
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
/** Grammar rows matched only because their key sits inside the query (読まずに → 〜ずに). */
const PATTERN_CAP = 2;
const ALL_KANJI = /^[一-鿿㐀-䶿々〆]+$/;
const KATAKANA_WORD = /^[ァ-ヺー・\s]+$/;
const LOWER_LEVELS: ReadonlySet<Level> = new Set(['N5', 'N4']);

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

type Consider = (d: number, c: Cand) => void;

interface CategoryMatch {
  chips: CategoryChip[];
  /** Grammar docs in any matched chip. */
  members: Set<number>;
  /** Grammar docs a teacher expects first for the typed alias (because → から, ので). */
  core: Set<number>;
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

const better = (a: Cand, b: Cand | undefined) => !b || a.tier < b.tier || (a.tier === b.tier && a.sub < b.sub);
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
  private patternKeys = new Map<string, number[]>();
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
      for (const k of doc.patternKeys) this.post(this.patternKeys, k, d);
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

  private rankOf(d: number, c: Cand) {
    const doc = this.docs[d];
    return { ...c, level: doc.level, lesson: doc.lesson, pos: doc.pos, len: doc.type === 'vocab' ? (doc.surface[0] ?? doc.title).length : 0 };
  }

  // ------------------------------------------------------------------ categories

  private categoryMembers(c: AliasCategory): Set<number> {
    const out = new Set<number>();
    for (const t of c.tags) {
      for (const d of this.tagDocs.get(t) ?? []) {
        if (!c.titleKeys || this.docs[d].surface.some((k) => c.titleKeys?.includes(k))) out.add(d);
      }
    }
    return out;
  }

  private docsWithTags(tags: string[]): Set<number> {
    const out = new Set<number>();
    for (const t of tags) for (const d of this.tagDocs.get(t) ?? []) out.add(d);
    return out;
  }

  /** Grammar docs of a tag id or alias-category id (`preferTag`: a tag id wins when both exist). */
  private membersFor(id: string, preferTag: boolean): Set<number> {
    const isTag = this.tagIds.includes(id);
    const cat = ALIAS_CATEGORIES.find((c) => c.id === id);
    if (preferTag && isTag) return this.docsWithTags([id]);
    if (cat) return this.categoryMembers(cat);
    return isTag ? this.docsWithTags([id]) : new Set();
  }

  /** Display label of a tag id or alias category id (the `via` of tag hits). */
  private labelFor(id: string, preferTag: boolean): string | undefined {
    const i = this.tagIds.indexOf(id);
    const cat = ALIAS_CATEGORIES.find((c) => c.id === id);
    if (preferTag && i >= 0) return this.tagLabels[i];
    return cat?.label ?? (i >= 0 ? this.tagLabels[i] : undefined);
  }

  listCategories(): CategoryChip[] {
    return ALIAS_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      count: this.categoryMembers(c).size,
      tagIds: [...c.tags],
    }));
  }

  /** Category chips whose alias, tag id or tag label equals the whole query. */
  matchCategories(query: string): CategoryChip[] {
    return this.categoryMatch(query).chips;
  }

  private categoryMatch(query: string): CategoryMatch {
    const q = aliasKey(query);
    const result: CategoryMatch = { chips: [], members: new Set(), core: new Set() };
    if (!q) return result;
    const seen = new Set<string>();
    const push = (id: string, label: string, tags: string[], members: Set<number>) => {
      const sig = [...members].sort((a, b) => a - b).join(',');
      for (const d of members) result.members.add(d);
      if (seen.has(sig)) return;
      seen.add(sig);
      result.chips.push({ id, label, count: members.size, tagIds: [...tags] });
    };
    for (const c of ALIAS_CATEGORIES) {
      const alias = c.aliases.find((a) => aliasKey(a) === q);
      if (!alias && aliasKey(c.label) !== q && aliasKey(c.id) !== q) continue;
      const members = this.categoryMembers(c);
      push(c.id, c.label, c.tags, members);
      const coreKeys = alias ? c.core?.[alias] : undefined;
      if (coreKeys) {
        for (const k of coreKeys) {
          for (const p of this.exact.get(k) ?? []) {
            const d = Math.floor(p / KINDS);
            if (p % KINDS === K.surface && this.docs[d].type === 'grammar') result.core.add(d);
          }
        }
      }
    }
    this.tagIds.forEach((id, i) => {
      const names = [id, this.tagLabels[i] ?? '', ...(TAG_ALIASES[id] ?? [])].map(aliasKey);
      if (names.includes(q) && this.tagDocs.has(id)) push(id, this.tagLabels[i] ?? id, [id], this.docsWithTags([id]));
    });
    return result;
  }

  // ------------------------------------------------------------------ tag listing

  listByTag(tag: string, opts: Partial<Omit<SearchOptions, 'tag'>> = {}): SearchHit[] {
    const docs = [...this.membersFor(tag, true)]
      .filter((d) => !opts.levels?.length || opts.levels.includes(this.docs[d].level))
      .sort((a, b) => {
        const x = this.docs[a];
        const y = this.docs[b];
        return levelIndex(x.level) - levelIndex(y.level) || x.lesson - y.lesson || x.pos - y.pos;
      });
    const via = this.labelFor(tag, true);
    return docs.map((d) => this.toHit(d, { tier: 0, sub: 0, kind: 'tag', field: 'tag', via }, false));
  }

  // ------------------------------------------------------------------ search

  search(query: string, opts: SearchOptions): SearchResponse {
    const n = norm(query);
    const q = key(query);
    const latin = isLatin(n);
    const best = new Map<number, Cand>();
    const consider: Consider = (d, c) => {
      if (better(c, best.get(d))) best.set(d, c);
    };

    let script: Script = latin ? 'english' : ALL_KANJI.test(q) ? 'kanji' : isKana(q) ? 'kana' : 'mixed';
    let queryAs: string | undefined;
    let exactOnly = false;
    let romajiExact = false;
    let categories: CategoryChip[] = [];

    if (q && latin) {
      // English first, then romaji read as kana; romaji fragments never outrank meanings.
      const cats = this.categoryMatch(n);
      categories = cats.chips;
      const enCount = this.matchEnglish(n, consider, cats);
      const kana = romajiToKana(n);
      if (kana && isKana(kana) && !/\s/.test(n.trim())) {
        const romaji = new Map<number, Cand>();
        const res = this.matchKana(kana, (d, c) => {
          if (better(c, romaji.get(d))) romaji.set(d, c);
        });
        const len = [...kana].length;
        for (const [d, c] of romaji) {
          const doc = this.docs[d];
          // A 1–2 kana reading of an English word (so → そ, ate → あて) keeps only particle
          // grammar; a 2-kana reading also keeps exact kanji readings (pun → 分 プン).
          if (enCount > 0 && len <= 2) {
            const keep = c.tier === TIER.exact && (doc.type === 'grammar' || (len === 2 && doc.type === 'kanji'));
            if (!keep) continue;
          }
          // With English hits, romaji readings rank after the meanings (rain → 雨 before オンライン);
          // a kept 2-kana kanji reading goes just after them (ate → 食べる first, then 当).
          const demoted =
            enCount > 0 && (c.tier >= TIER.prefix || len <= 2) ? { ...c, tier: TIER.english + 0.8 + c.tier / 100 } : c;
          consider(d, demoted);
          if (c.tier <= TIER.deinflected && doc.type !== 'grammar' && [...kana].length >= 3) romajiExact = true;
          if (c.kind === 'folded' && doc.type === 'vocab') romajiExact = true;
        }
        if (romaji.size) {
          queryAs = res.as ?? kana;
          exactOnly = res.exactOnly && enCount === 0;
          if (romajiExact || enCount === 0) script = 'romaji';
        }
      }
    } else if (q) {
      const res = this.matchKana(q, consider);
      exactOnly = res.exactOnly;
      if (res.as) queryAs = res.as;
    }

    const tagMembers = opts.tag ? this.membersFor(opts.tag, true) : opts.category ? this.membersFor(opts.category, false) : null;
    const tagListing = !q && !!tagMembers;
    // A function filter with no query lists that function's grammar (`?tag=comparison`).
    if (tagListing && tagMembers) {
      const via = opts.tag ? this.labelFor(opts.tag, true) : this.labelFor(opts.category ?? '', false);
      for (const d of tagMembers) consider(d, { tier: 0, sub: 0, kind: 'tag', field: 'tag', via });
    }

    const scored: Scored[] = [...best.entries()].map(([d, c]) => ({ d, c }));
    return this.respond(query, opts, scored, {
      script,
      queryAs,
      exactOnly,
      tagMembers,
      categories,
      defaults: groupOrderFor(script, { singleKanji: q.length === 1 && isKanjiChar(q), romajiExact }),
      singleKanji: q.length === 1 && isKanjiChar(q),
      katakana: KATAKANA_WORD.test(n) && !latin,
      queryHasKanji: hasKanji(q),
      tagListing,
    });
  }

  /**
   * Kana/kanji matching with the は/わ retry (こんにちわ → こんにちは): when nothing matches
   * exactly, a final わ/え is read as the particle は/へ once.
   */
  private matchKana(k: string, consider: Consider): { exactOnly: boolean; as?: string } {
    const local = new Map<number, Cand>();
    const collect: Consider = (d, c) => {
      if (better(c, local.get(d))) local.set(d, c);
    };
    const exactOnly = this.matchJapanese(k, collect);
    let as: string | undefined;
    const hasExact = [...local.values()].some((c) => c.tier <= TIER.lemma && c.kind !== 'kanjiFromWord');
    if (!hasExact && k.length >= 3 && /[わえ]$/.test(k)) {
      const alt = k.slice(0, -1) + (k.endsWith('わ') ? 'は' : 'へ');
      const retry = new Map<number, Cand>();
      this.matchJapanese(alt, (d, c) => {
        if (better(c, retry.get(d))) retry.set(d, c);
      });
      if ([...retry.values()].some((c) => c.tier <= TIER.lemma)) {
        for (const [d, c] of retry) collect(d, c);
        as = alt;
      }
    }
    for (const [d, c] of local) consider(d, c);
    return { exactOnly, as };
  }

  /** Japanese (or romaji-as-kana) matching. Returns true when the single-kana guard applied. */
  private matchJapanese(k: string, consider: Consider): boolean {
    const oneKana = k.length === 1 && isKana(k);
    const singleKanji = k.length === 1 && isKanjiChar(k);

    for (const p of this.exact.get(k) ?? []) {
      const d = Math.floor(p / KINDS);
      const kind = (p % KINDS) as Kind;
      if (oneKana && kind !== K.surface && kind !== K.reading) continue;
      const doc = this.docs[d];
      if (kind === K.lemma) consider(d, { tier: TIER.lemma, sub: 0, kind: 'lemma', field: 'title', via: doc.lemma[0] });
      else if (kind === K.alias) consider(d, { tier: TIER.lemma, sub: 0, kind: 'lemma', field: 'title', needle: k, via: k });
      else if (kind === K.compound) {
        if (!singleKanji) consider(d, { tier: TIER.hint, sub: 0, kind: 'compound', field: 'compound', via: k });
      } else if (kind === K.hint) consider(d, { tier: TIER.hint, sub: 0, kind: 'compound', field: 'title', needle: k, via: k });
      else if (kind === K.structure) consider(d, { tier: TIER.hint, sub: 0, kind: 'exact', field: 'structure', needle: k });
      else consider(d, { tier: TIER.exact, sub: kind === K.stem ? 1 : 0, kind: 'exact', field: fieldOf(kind), needle: k });
    }
    if (oneKana) return true;

    if (isKana(k.slice(-1))) this.matchDeinflected(k, consider);

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
      this.considerPostings(keys[i], 'prefix', k, consider, singleKanji);
    }
    // Contains: ≥ 2 chars, or a single kanji (a full query). A single kanji ranks words
    // that start with it and words that contain it together (分 → 自分, 十分, 分かる).
    if (k.length >= 2 || singleKanji) {
      const shortKana = k.length <= 2 && isKana(k);
      for (const other of keys) {
        if (other.length > k.length && !other.startsWith(k) && other.includes(k)) {
          this.considerPostings(other, singleKanji ? 'prefix' : 'contains', k, consider, singleKanji, shortKana);
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
    // Grammar pattern inside the query (読まずに → 〜ずに): at most PATTERN_CAP rows,
    // longest (most specific) keys first, never bare morphemes.
    if (k.length >= 3) {
      const found: { d: number; gk: string }[] = [];
      for (const [gk, docs] of this.patternKeys) {
        if (!patternInQuery(gk, k)) continue;
        for (const d of docs) found.push({ d, gk });
      }
      found.sort((a, b) => b.gk.length - a.gk.length || levelIndex(this.docs[a.d].level) - levelIndex(this.docs[b.d].level) || a.d - b.d);
      const used = new Set<number>();
      for (const { d, gk } of found) {
        if (used.size >= PATTERN_CAP) break;
        if (used.has(d)) continue;
        used.add(d);
        const needle = gk.split('〜').sort((a, b) => b.length - a.length)[0];
        consider(d, { tier: TIER.hint, sub: 1 - gk.length / 100, kind: 'contains', field: 'title', needle, via: gk });
      }
    }
    return false;
  }

  /**
   * Deinflection, keeping only lemmas that are vocab words of a compatible class
   * (teacher review F1). Returns true when at least one word was reached.
   */
  private matchDeinflected(k: string, consider: Consider): boolean {
    let reached = false;
    const short = [...k].length <= 2;
    for (const c of deinflect(k)) {
      // A 2-kana imperative is almost always a different word (さけ is 酒, not 咲け).
      if (short && !c.irregular && c.steps.some((s) => s.en === 'imperative')) continue;
      const need = classForType(c.type);
      // Kana 来る forms need an empty stem or a te-form before them (連れてきた, not おきて → おくる).
      if (c.type === 'vk' && c.lemma.endsWith('くる')) {
        const stem = c.lemma.slice(0, -2);
        if (stem && !/[てで]$/.test(stem)) continue;
      }
      for (const p of this.exact.get(c.lemma) ?? []) {
        const d = Math.floor(p / KINDS);
        const kind = p % KINDS;
        const doc = this.docs[d];
        if (doc.type !== 'vocab' || !WORD_KINDS.has(kind)) continue;
        if (need && !doc.cls.includes(need)) continue;
        if (c.type === 'vs' && ![...doc.surface, ...doc.lemma].some((s) => s.endsWith('する'))) continue;
        // Katakana words are loanwords and nouns, not inflecting verbs.
        if (need !== 'n' && KATAKANA_WORD.test(doc.title)) continue;
        reached = true;
        consider(d, {
          tier: TIER.deinflected,
          sub: c.steps.length - (c.irregular ? 0.5 : 0),
          kind: 'deinflected',
          field: kind === K.reading ? 'reading' : 'title',
          needle: c.lemma,
          via: c.lemma,
          deinflection: { input: k, lemma: c.lemma, steps: c.steps.map((s) => ({ en: s.en, ja: s.ja })) },
        });
      }
    }
    return reached;
  }

  private considerPostings(k: string, how: 'prefix' | 'contains', needle: string, consider: Consider, singleKanji = false, shortKana = false): void {
    for (const p of this.exact.get(k) ?? []) {
      const d = Math.floor(p / KINDS);
      const kind = (p % KINDS) as Kind;
      // A single kanji's own row is the answer; other kanji via compounds are noise (日 → 語).
      if (singleKanji && kind === K.compound) continue;
      // 2-kana queries do not match inside katakana loanwords (ぷん → オープン).
      if (shortKana && how === 'contains' && KATAKANA_WORD.test(this.docs[d].title)) continue;
      const low = LOW_KINDS.has(kind);
      const tier = low ? TIER.hint : how === 'prefix' ? TIER.prefix : TIER.contains;
      const kindOut: MatchKind = kind === K.compound || kind === K.hint ? 'compound' : how;
      consider(d, { tier, sub: 0, kind: kindOut, field: fieldOf(kind), needle, via: low ? k : undefined });
    }
  }

  /**
   * English whole-word matching, with category boosts (teacher review F3): grammar in a
   * matched chip ranks first, its core points (because → から, ので) at the very top, and
   * N5/N4 chip members are listed even when their descriptive meaning lacks the word.
   * Returns the number of docs hit by the words themselves.
   */
  private matchEnglish(n: string, consider: Consider, cats: CategoryMatch): number {
    const terms = queryTerms(n);
    let acc: Map<number, boolean> | null = null; // doc → matched only through the summary
    const forms = terms.map((t) => new Set(queryForms(t)));
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
      if (!acc.size) break;
    }
    const hits = acc ?? new Map<number, boolean>();
    const phrase = terms.length > 1 ? phraseText(words(n).join(' ')) : '';
    const enForms = new Set(forms.flatMap((s) => [...s]));
    for (const [d, summaryOnly] of hits) {
      const doc = this.docs[d];
      const isPhrase = phrase !== '' && doc.phrase.includes(phrase);
      // Two density buckets only, so the level tie-break decides inside a bucket.
      const content = doc.phrase.split(' ').filter((w) => w && !STOPWORDS.has(w));
      const matched = content.filter((w) => enForms.has(foldPlural(w))).length;
      const dense = content.length > 0 && matched / content.length >= 0.5;
      let sub = (isPhrase || terms.length === 1 ? 0 : 1) + (dense ? 0 : 0.5);
      let tier: number = summaryOnly ? TIER.summary : TIER.english;
      if (cats.members.has(d)) {
        tier = TIER.english;
        sub = cats.core.has(d) ? -2 : -1;
      }
      consider(d, {
        tier,
        sub,
        kind: 'english',
        field: 'meaning',
        enForms: summaryOnly ? undefined : enForms,
        via: summaryOnly ? 'summary' : undefined,
      });
    }
    // Chip members the words themselves missed: core points and N5/N4 first, the rest last.
    const via = cats.chips.map((c) => c.label).join(' · ') || undefined;
    for (const d of cats.members) {
      if (hits.has(d)) continue;
      const core = cats.core.has(d);
      const basic = LOWER_LEVELS.has(this.docs[d].level);
      consider(d, { tier: TIER.english, sub: core ? -2 : basic ? -1 : 0.75, kind: 'tag', field: 'tag', via });
    }
    return hits.size;
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
      tagMembers: Set<number> | null;
      categories: CategoryChip[];
      defaults: DocType[];
      singleKanji: boolean;
      katakana: boolean;
      queryHasKanji: boolean;
      tagListing: boolean;
    }
  ): SearchResponse {
    const tagSet = meta.tagMembers;
    const typeFilter = new Set<DocType>(tagSet ? ['grammar'] : opts.types?.length ? opts.types : TYPES);
    if (tagSet && opts.types?.length && !opts.types.includes('grammar')) typeFilter.clear();
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
      return cmp(this.rankOf(a.d, a.c), this.rankOf(b.d, b.c));
    };

    // Group order: by each group's best real match (tier < 7), script default on ties.
    const bestByType: Partial<Record<DocType, GroupBest>> = {};
    let vocabVerbExact = false;
    for (const s of filtered) {
      if (s.c.tier >= TIER.hint) continue;
      const t = this.docs[s.d].type;
      const b = bestByType[t];
      if (!b || s.c.tier < b.tier || (s.c.tier === b.tier && s.c.sub < b.sub)) bestByType[t] = { tier: s.c.tier, sub: s.c.sub };
      if (t === 'vocab' && s.c.tier <= TIER.lemma && (this.docs[s.d].lemma.length > 0 || /[15ksi]/.test(this.docs[s.d].cls))) vocabVerbExact = true;
    }
    let groupOrder: DocType[];
    if (meta.tagListing) groupOrder = ['grammar', 'vocab', 'kanji'];
    else if (meta.singleKanji) groupOrder = meta.defaults;
    else if (meta.katakana) groupOrder = ['vocab', 'grammar', 'kanji'];
    else groupOrder = orderGroups(meta.defaults, bestByType, vocabVerbExact);

    const groups = emptyByType<SearchHit[]>(() => []);
    const totals = emptyByType(() => 0);
    let remaining = meta.exactOnly ? SINGLE_KANA_CAP : Infinity;
    const limit = opts.limitPerType ?? DEFAULT_LIMIT;
    for (const type of groupOrder) {
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
      groupOrder,
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
