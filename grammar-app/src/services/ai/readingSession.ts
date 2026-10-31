import { LevelType } from '../../types/japanese';
import {
  ActiveReading,
  ActiveReadings,
  ReadingHistoryEntry,
  ReadingPracticeData,
  ReadingProgress,
  StoryAnswers,
} from '../../types/ai';

/**
 * Pure state logic for Reading Practice.
 *
 * - A passage belongs to the level it was generated for. Each level keeps its
 *   own *current* passage; switching the header level shows that level's own
 *   passage (or nothing) and never relabels another level's.
 * - Answers belong to a *story* (its library entry id), not to a level, so
 *   reopening any story - in Studio or the quick reader - restores them.
 * - Which Reading view is open (Studio or Library) and the library level filter
 *   live in the URL, so the header level, the list and Back always agree.
 */

const LEVELS: readonly LevelType[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

function isLevel(value: unknown): value is LevelType {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

function isReading(value: unknown): value is ReadingPracticeData {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<ReadingPracticeData>;
  return typeof r.title === 'string' && typeof r.japaneseText === 'string' && Array.isArray(r.questions);
}

function sanitizeAnswers(value: unknown): StoryAnswers {
  if (!value || typeof value !== 'object') return {};
  const out: StoryAnswers = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const id = Number(k);
    if (Number.isFinite(id) && typeof v === 'number') out[id] = v;
  }
  return out;
}

/**
 * The story id of a passage stored without one (older builds): the library
 * entry with the same level and title, else one with the same title, else a
 * deterministic local id so its answers still have somewhere to live.
 */
export function resolveStoryId(level: LevelType, title: string, history: ReadingHistoryEntry[]): string {
  const sameLevel = history.find((h) => h.level === level && h.data?.title === title);
  const anyLevel = sameLevel ?? history.find((h) => h.data?.title === title);
  return anyLevel?.id ?? `local_${level}_${title}`;
}

/** Valid per-level slots of a stored map, as `[level, slot, rawSlot]`. */
function storedSlots(raw: unknown): Array<[LevelType, Partial<ActiveReading> & { data: ReadingPracticeData }, Record<string, unknown>]> {
  if (!raw || typeof raw !== 'object' || isReading(raw)) return [];
  const out: Array<[LevelType, Partial<ActiveReading> & { data: ReadingPracticeData }, Record<string, unknown>]> = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isLevel(key) || !value || typeof value !== 'object') continue;
    const slot = value as Partial<ActiveReading>;
    if (!isReading(slot.data)) continue;
    out.push([key, slot as Partial<ActiveReading> & { data: ReadingPracticeData }, value as Record<string, unknown>]);
  }
  return out;
}

function slotStoryId(level: LevelType, slot: Partial<ActiveReading> & { data: ReadingPracticeData }, history: ReadingHistoryEntry[]): string {
  return typeof slot.storyId === 'string' && slot.storyId
    ? slot.storyId
    : resolveStoryId(level, slot.data.title, history);
}

/**
 * Turns whatever is stored under the active-reading key into a per-level map.
 *
 * Two older shapes are upgraded: one bare passage with no level (attributed to
 * the level of the saved-library entry with the same title, or dropped when
 * none matches - its level is unknowable), and per-level slots without a
 * `storyId` (resolved via `resolveStoryId`).
 */
export function normalizeActiveReadings(raw: unknown, history: ReadingHistoryEntry[]): ActiveReadings {
  if (isReading(raw)) {
    const match = history.find((h) => h.data?.title === raw.title);
    if (!match) return {};
    return {
      [match.level]: { storyId: match.id, level: match.level, lesson: match.lesson, topic: match.topic, data: raw },
    };
  }

  const out: ActiveReadings = {};
  for (const [level, slot] of storedSlots(raw)) {
    out[level] = {
      storyId: slotStoryId(level, slot, history),
      level,
      lesson: typeof slot.lesson === 'number' ? slot.lesson : null,
      topic: typeof slot.topic === 'string' ? slot.topic : '',
      data: slot.data,
    };
  }
  return out;
}

/** Validates a stored progress map (story id -> answers), dropping junk and empty entries. */
export function normalizeProgress(raw: unknown): ReadingProgress {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ReadingProgress = {};
  for (const [id, answers] of Object.entries(raw as Record<string, unknown>)) {
    const clean = sanitizeAnswers(answers);
    if (id && Object.keys(clean).length > 0) out[id] = clean;
  }
  return out;
}

/**
 * Answers kept per level by older builds (`slot.answers` in the active-reading
 * map), moved onto that slot's story id. Answers already recorded for a story
 * in `progress` win over the legacy copy.
 */
export function migrateLegacyAnswers(
  rawActive: unknown,
  progress: ReadingProgress,
  history: ReadingHistoryEntry[]
): ReadingProgress {
  let out = progress;
  for (const [level, slot, rawSlot] of storedSlots(rawActive)) {
    const answers = sanitizeAnswers(rawSlot.answers);
    if (Object.keys(answers).length === 0) continue;
    const id = slotStoryId(level, slot, history);
    if (out[id]) continue;
    out = { ...out, [id]: answers };
  }
  return out;
}

/** Makes `reading` the current passage of its own level. Its answers (by story id) are untouched. */
export function withReading(readings: ActiveReadings, reading: ActiveReading): ActiveReadings {
  const { storyId, level, lesson, topic, data } = reading;
  return { ...readings, [level]: { storyId, level, lesson, topic, data } };
}

/** The current-passage slot for a saved-library entry. */
export function readingFromEntry(entry: ReadingHistoryEntry): ActiveReading {
  return { storyId: entry.id, level: entry.level, lesson: entry.lesson, topic: entry.topic, data: entry.data };
}

/**
 * Records the first answer to a question of a story. Answers are final, so a
 * repeat answer changes nothing and returns the same object.
 */
export function withStoryAnswer(
  progress: ReadingProgress,
  storyId: string,
  questionId: number,
  optionIndex: number
): ReadingProgress {
  const answers = progress[storyId] ?? {};
  if (answers[questionId] !== undefined) return progress;
  return { ...progress, [storyId]: { ...answers, [questionId]: optionIndex } };
}

/** "Start over": forgets a story's answers (and so its score). */
export function withoutStoryAnswers(progress: ReadingProgress, storyId: string): ReadingProgress {
  if (!(storyId in progress)) return progress;
  const next = { ...progress };
  delete next[storyId];
  return next;
}

/** Drops answers of stories that are neither in the library nor any level's current passage. */
export function pruneProgress(
  progress: ReadingProgress,
  history: ReadingHistoryEntry[],
  readings: ActiveReadings
): ReadingProgress {
  const keep = new Set<string>(history.map((h) => h.id));
  for (const slot of Object.values(readings)) if (slot) keep.add(slot.storyId);
  const ids = Object.keys(progress);
  if (ids.every((id) => keep.has(id))) return progress;
  return Object.fromEntries(ids.filter((id) => keep.has(id)).map((id) => [id, progress[id]]));
}

/** Answered / correct / total for a story's answers against its questions. */
export function scoreStory(data: ReadingPracticeData, answers: StoryAnswers): { answered: number; correct: number; total: number } {
  const questions = data.questions ?? [];
  return {
    answered: questions.filter((q) => answers[q.id] !== undefined).length,
    correct: questions.filter((q) => answers[q.id] === q.correctIndex).length,
    total: questions.length,
  };
}

// ---------------------------------------------------------------------------
// Opening a story & the Reading view in the URL
// ---------------------------------------------------------------------------

export type ReadingView = 'studio' | 'library';
export type LibraryFilter = 'ALL' | LevelType;

/** Path of a level's Reading Studio. */
export function readingPath(level: LevelType): string {
  return `/${level.toLowerCase()}/reading`;
}

/**
 * What opening a library story in Studio does: it becomes the current passage
 * of *its own* level, and when that is not the header level the app navigates
 * there (`path`), so the header and the passage always agree. `path` is null
 * when the story is already on the header level.
 *
 * The caller must apply `readings` and `path` in one update (one transition):
 * applying the passage first and the route later renders a frame where the old
 * level - and its passage - is shown under the new URL.
 */
export function planOpenStory(
  readings: ActiveReadings,
  entry: ReadingHistoryEntry,
  headerLevel: LevelType
): { readings: ActiveReadings; path: string | null } {
  const current = readings[entry.level];
  const next = current?.storyId === entry.id ? readings : withReading(readings, readingFromEntry(entry));
  return { readings: next, path: entry.level === headerLevel ? null : readingPath(entry.level) };
}

/** Label of the "open this story in Studio" action: says when it will switch level. */
export function openStoryLabel(entryLevel: LevelType, headerLevel: LevelType): string {
  return entryLevel === headerLevel ? 'Practice in Studio' : `Open in ${entryLevel} →`;
}

/**
 * Reads the Reading view from the URL query. The library filter defaults to
 * (and so follows) the header level; `filter` is only present when the user
 * picked something else, e.g. ALL.
 */
export function parseReadingView(search: string | URLSearchParams, headerLevel: LevelType): { view: ReadingView; filter: LibraryFilter } {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const view: ReadingView = params.get('view') === 'library' ? 'library' : 'studio';
  const rawFilter = params.get('filter')?.toUpperCase();
  const filter: LibraryFilter = rawFilter === 'ALL' || isLevel(rawFilter) ? rawFilter : headerLevel;
  return { view, filter: view === 'library' ? filter : headerLevel };
}

/** The URL query for a Reading view; '' for the Studio, the default. */
export function readingViewSearch(view: ReadingView, filter: LibraryFilter, headerLevel: LevelType): string {
  if (view !== 'library') return '';
  return filter === headerLevel ? '?view=library' : `?view=library&filter=${filter.toLowerCase()}`;
}

/** Saved-library entries matching a level filter and a free-text query. */
export function filterLibrary(
  history: ReadingHistoryEntry[],
  level: LibraryFilter,
  query: string
): ReadingHistoryEntry[] {
  const q = query.toLowerCase().trim();
  return history.filter((item) => {
    if (level !== 'ALL' && item.level !== level) return false;
    if (!q) return true;
    return (
      !!item.data?.title?.toLowerCase().includes(q) ||
      !!item.data?.titleEn?.toLowerCase().includes(q) ||
      !!item.topic?.toLowerCase().includes(q)
    );
  });
}
