import { BaseContentSource, ContentError, LessonSummary } from './ContentSource';
import { Level, ContentSection, StudyItem, Uid } from '../../types/content';

type ChunkData = Record<number, StudyItem[]>;
type ChunkImporter = () => Promise<{ default: ChunkData }>;

const UID_RE = /^(n5|n4|n3)-(grammar|vocab|kanji)-(\d+)-\d+$/;

function chunkKey(level: Level, section: ContentSection): string {
  return `${level}:${section}`;
}

function chunkPath(level: Level, section: ContentSection): string {
  return `../../data/${level.toLowerCase()}/${section}.json`;
}

function matchesQuery(item: StudyItem, query: string): boolean {
  return Object.values(item).some((value) => {
    if (typeof value === 'string') return value.toLowerCase().includes(query);
    if (Array.isArray(value)) {
      return value.some((entry) => typeof entry === 'string' && entry.toLowerCase().includes(query));
    }
    return false;
  });
}

/**
 * Content backend for the static, build-time JSON files. Each level+section
 * pair is its own lazily-imported chunk (`import.meta.glob`), so switching
 * level or section fetches exactly one new file and switching back fetches
 * none - the in-flight promise itself is the cache entry, so concurrent
 * callers for the same chunk share one request.
 */
export class StaticContentSource extends BaseContentSource {
  private modules: Record<string, ChunkImporter>;
  private cache = new Map<string, Promise<ChunkData>>();

  constructor(
    modules: Record<string, ChunkImporter> = import.meta.glob('../../data/*/*.json') as Record<
      string,
      ChunkImporter
    >
  ) {
    super();
    this.modules = modules;
  }

  private loadChunk(level: Level, section: ContentSection): Promise<ChunkData> {
    const key = chunkKey(level, section);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const importer = this.modules[chunkPath(level, section)];
    const pending: Promise<ChunkData> = importer
      ? importer()
          .then((mod) => mod.default)
          .catch((err) => {
            this.cache.delete(key);
            throw new ContentError('load-failed', err);
          })
      : Promise.reject(new ContentError('not-found', chunkPath(level, section)));

    this.cache.set(key, pending);
    return pending;
  }

  async listLessons(level: Level, section: ContentSection): Promise<LessonSummary[]> {
    const chunk = await this.loadChunk(level, section);
    return Object.keys(chunk)
      .map(Number)
      .sort((a, b) => a - b)
      .map((lesson) => ({ lesson, count: chunk[lesson].length }));
  }

  async getItems<T extends StudyItem>(level: Level, section: ContentSection, lesson: number): Promise<T[]> {
    const chunk = await this.loadChunk(level, section);
    return (chunk[lesson] as T[] | undefined) || [];
  }

  async getItem<T extends StudyItem>(uid: Uid): Promise<T | null> {
    const match = UID_RE.exec(uid);
    if (!match) return null;
    const [, levelKey, sectionKey] = match;
    const level = levelKey.toUpperCase() as Level;
    const section = sectionKey as ContentSection;

    const chunk = await this.loadChunk(level, section);
    for (const items of Object.values(chunk)) {
      const found = items.find((item) => item.uid === uid);
      if (found) return found as T;
    }
    return null;
  }

  async search<T extends StudyItem>(
    query: string,
    scope: { level: Level; section: ContentSection }
  ): Promise<T[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const chunk = await this.loadChunk(scope.level, scope.section);
    const results: T[] = [];
    for (const items of Object.values(chunk)) {
      for (const item of items) {
        if (matchesQuery(item, q)) results.push(item as T);
      }
    }
    return results;
  }
}

let currentSource: BaseContentSource = new StaticContentSource();

export function getContentSource(): BaseContentSource {
  return currentSource;
}

/**
 * Swap the content backend (e.g. to a future FirebaseContentSource). See
 * services/ai/readingStorage.ts for the pattern this copies.
 */
export function setContentSource(source: BaseContentSource): void {
  if (!(source instanceof BaseContentSource)) {
    throw new Error('Source must inherit from BaseContentSource');
  }
  currentSource = source;
}

export const contentRepository = {
  listLessons: (level: Level, section: ContentSection) => currentSource.listLessons(level, section),
  getItems: <T extends StudyItem>(level: Level, section: ContentSection, lesson: number) =>
    currentSource.getItems<T>(level, section, lesson),
  getItem: <T extends StudyItem>(uid: Uid) => currentSource.getItem<T>(uid),
  search: <T extends StudyItem>(query: string, scope: { level: Level; section: ContentSection }) =>
    currentSource.search<T>(query, scope),
};
