import { BaseSearchSource } from '../../../services/search/SearchSource';
import type {
  CategoryChip,
  DocType,
  Level,
  MatchField,
  MatchKind,
  Script,
  SearchHit,
  SearchOptions,
  SearchResponse,
} from '../../../services/search/types';
import { FIXTURE_ITEMS, type FixtureItem } from './fixtureItems';

/**
 * Deterministic stand-in for the real engine, over a small set of real rows. Used by
 * tests and, lazily, by local dev when no source was registered with setSearchSource().
 * It is deliberately naive (substring + whole-word English, a few hand deinflections);
 * the real matcher lives in services/search/ and is owned by the data layer.
 */

const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const TYPES: DocType[] = ['grammar', 'vocab', 'kanji'];

const CATEGORIES: { id: string; label: string; tagIds: string[]; aliases: string[] }[] = [
  { id: 'comparison', label: 'Comparison', tagIds: ['comparison'], aliases: ['comparison', 'compare', 'than', 'rather'] },
  { id: 'cause-reason', label: 'Cause / reason', tagIds: ['cause-reason'], aliases: ['because', 'reason', 'so'] },
  {
    id: 'concession-contrast',
    label: 'Concession / Contrast',
    tagIds: ['concession-contrast'],
    aliases: ['although', 'even though', 'contrast', 'but', 'so'],
  },
  { id: 'degree-extent', label: 'Degree / Extent', tagIds: ['degree-extent'], aliases: ['degree', 'extent'] },
  { id: 'emphasis', label: 'Emphasis / Limitation', tagIds: ['emphasis-limitation', 'emphasis-assertion'], aliases: ['only', 'emphasis'] },
];

/** Hand deinflections for the fixture (the real deinflector is data-driven). */
const DEINFLECT: Record<string, { lemma: string; steps: { en: string; ja: string }[] }> = {
  わかります: { lemma: '分かる', steps: [{ en: 'polite', ja: '丁寧' }] },
  待たされた: { lemma: '待つ', steps: [{ en: 'causative-passive', ja: '使役受身' }, { en: 'past', ja: '過去' }] },
  たべました: { lemma: '食べる', steps: [{ en: 'polite', ja: '丁寧' }, { en: 'past', ja: '過去' }] },
};
const ROMAJI: Record<string, string> = { taberu: 'たべる', kyoushitsu: 'きょうしつ', matsu: 'まつ', mei: 'めい', wakaru: 'わかる' };

function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
const norm = (s: string) => kataToHira(s.normalize('NFKC').toLowerCase()).replace(/[〜~～]/g, '');

function detectScript(q: string): Script {
  if (/^[a-z' -]+$/i.test(q)) return ROMAJI[q.toLowerCase()] ? 'romaji' : 'english';
  if (/^[぀-ヿ〜~～ー]+$/.test(q)) return 'kana';
  if (/^[一-鿿]+$/.test(q)) return 'kanji';
  return 'mixed';
}

/** Index of `needle` in `hay` with identical length mapping (norm keeps length for kana). */
function findRange(display: string, needle: string): [number, number] | null {
  if (!needle) return null;
  const hay = kataToHira(display.toLowerCase());
  const i = hay.indexOf(needle);
  return i >= 0 ? [i, i + needle.length] : null;
}

function wholeWord(meaning: string, word: string): [number, number] | null {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const m = re.exec(meaning);
  return m ? [m.index, m.index + m[0].length] : null;
}

function toHit(item: FixtureItem, kind: MatchKind, field: MatchField, tier: number, range: [number, number] | null): SearchHit {
  return {
    ...item,
    matchKind: kind,
    matchField: field,
    tier,
    highlights: range ? [{ field, ranges: [range] }] : undefined,
  };
}

function match(item: FixtureItem, q: string, kana: string, script: Script): SearchHit | null {
  const nq = norm(kana);
  const title = norm(item.title);
  if (script !== 'english') {
    if (title === nq || (item.reading && norm(item.reading) === nq)) {
      return toHit(item, 'exact', title === nq ? 'title' : 'reading', 0, findRange(item.title, nq) ?? null);
    }
    const de = DEINFLECT[kana];
    if (de && item.type !== 'grammar' && item.title === de.lemma) {
      return { ...toHit(item, 'deinflected', 'title', 2, null), deinflection: { input: kana, ...de } };
    }
    if (nq.length >= 2 || script === 'kanji') {
      if (title.includes(nq)) return toHit(item, title.startsWith(nq) ? 'prefix' : 'contains', 'title', 3, findRange(item.title, nq));
      if (item.reading && norm(item.reading).includes(nq)) return toHit(item, 'prefix', 'reading', 4, findRange(item.reading, nq));
      const readings = [...(item.onyomi ?? []), ...(item.kunyomi ?? [])].map((r) => norm(r).replace(/[.・-]/g, ''));
      if (readings.some((r) => r === nq || r.startsWith(nq))) return toHit(item, 'exact', 'reading', 1, null);
      if (item.structure && norm(item.structure).includes(nq)) return toHit(item, 'contains', 'structure', 5, findRange(item.structure, nq));
      if (script === 'kanji' && item.type === 'kanji' && nq.includes(item.title) && nq.length > 1) {
        return { ...toHit(item, 'kanjiFromWord', 'title', 7, null), via: q };
      }
    }
    return null;
  }
  const r = wholeWord(item.meaning, q);
  return r ? toHit(item, 'english', 'meaning', 6, r) : null;
}

function groupOrderFor(script: Script, q: string): DocType[] {
  if (script === 'kanji' && [...q].length === 1) return ['kanji', 'vocab', 'grammar'];
  if (script === 'english') return ['vocab', 'grammar', 'kanji'];
  if (script === 'kana' || /^[〜~～]/.test(q)) return ['grammar', 'vocab', 'kanji'];
  return ['vocab', 'grammar', 'kanji'];
}

function rankCmp(rank: Level) {
  const order = (l: Level) => (l === rank ? 0 : LEVELS.indexOf(l) < LEVELS.indexOf(rank) ? 1 : 2);
  return (a: SearchHit, b: SearchHit) =>
    a.tier - b.tier || order(a.level) - order(b.level) || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.lesson - b.lesson;
}

function categoryTags(id: string | undefined): string[] | null {
  if (!id) return null;
  return CATEGORIES.find((c) => c.id === id)?.tagIds ?? [id];
}

function chip(c: (typeof CATEGORIES)[number]): CategoryChip {
  const count = FIXTURE_ITEMS.filter((i) => i.type === 'grammar' && (i.tags ?? []).some((t) => c.tagIds.includes(t))).length;
  return { id: c.id, label: c.label, count, tagIds: c.tagIds };
}

export interface FixtureOptions {
  /** Simulated latency in ms (0 in tests). */
  delayMs?: number;
  failWarmup?: boolean;
}

export class FixtureSearchSource extends BaseSearchSource {
  constructor(private readonly options: FixtureOptions = {}) {
    super();
  }

  private wait(): Promise<void> {
    const ms = this.options.delayMs ?? 0;
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
  }

  async warmup(): Promise<void> {
    await this.wait();
    if (this.options.failWarmup) throw new Error('fixture: warmup failed');
  }

  async listCategories(): Promise<CategoryChip[]> {
    await this.wait();
    return CATEGORIES.map(chip);
  }

  async listByTag(tag: string, opts?: Omit<SearchOptions, 'tag'>): Promise<SearchHit[]> {
    await this.wait();
    const tags = categoryTags(tag) ?? [];
    return FIXTURE_ITEMS.filter(
      (i) =>
        i.type === 'grammar' &&
        (i.tags ?? []).some((t) => tags.includes(t)) &&
        (!opts?.levels?.length || opts.levels.includes(i.level))
    )
      .map((i) => toHit(i, 'tag', 'tag', 0, null))
      .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.lesson - b.lesson);
  }

  async search(query: string, opts: SearchOptions): Promise<SearchResponse> {
    await this.wait();
    const q = query.trim();
    const script = detectScript(q);
    const kana = script === 'romaji' ? ROMAJI[q.toLowerCase()] : q;
    const exactOnly = script === 'kana' && [...norm(q)].length === 1;
    const fnTags = opts.tag ? [opts.tag] : categoryTags(opts.category);

    const all = FIXTURE_ITEMS.map((i) => match(i, q, kana, script))
      .filter((h): h is SearchHit => !!h)
      .filter((h) => !exactOnly || h.matchKind === 'exact')
      .filter((h) => !fnTags || (h.type === 'grammar' && (h.tags ?? []).some((t) => fnTags.includes(t))));

    const byLevel = (h: SearchHit) => !opts.levels?.length || opts.levels.includes(h.level);
    const byType = (h: SearchHit) => !opts.types?.length || opts.types.includes(h.type);
    const filtered = all.filter((h) => byLevel(h) && byType(h)).sort(rankCmp(opts.rankLevel));

    const limit = opts.limitPerType ?? 8;
    const groups = Object.fromEntries(TYPES.map((t) => [t, filtered.filter((h) => h.type === t).slice(0, limit)])) as Record<
      DocType,
      SearchHit[]
    >;
    const totals = Object.fromEntries(TYPES.map((t) => [t, filtered.filter((h) => h.type === t).length])) as Record<DocType, number>;
    const facetType = Object.fromEntries(TYPES.map((t) => [t, all.filter((h) => byLevel(h) && h.type === t).length])) as Record<
      DocType,
      number
    >;
    const facetLevel = Object.fromEntries(LEVELS.map((l) => [l, all.filter((h) => byType(h) && h.level === l).length])) as Record<
      Level,
      number
    >;
    const lq = q.toLowerCase();
    const categories = script === 'english' ? CATEGORIES.filter((c) => c.aliases.includes(lq)).map(chip) : [];
    const queryHasKanji = /[一-鿿]/.test(q);
    const wordMatch = filtered.some((h) => h.matchKind !== 'kanjiFromWord');
    const otherLevelsCount = opts.levels?.length ? all.filter((h) => byType(h) && !byLevel(h)).length : 0;

    return {
      query: query,
      queryAs: script === 'romaji' ? kana : undefined,
      script,
      exactOnly,
      wordMatch,
      queryHasKanji,
      groupOrder: groupOrderFor(script, q),
      groups,
      totals,
      facetCounts: { type: facetType, level: facetLevel },
      categories,
      hiddenByFilters: all.length - filtered.length,
      otherLevelsCount,
      status: 'ready',
    };
  }
}

export const fixtureSearchSource = new FixtureSearchSource({ delayMs: 120 });
