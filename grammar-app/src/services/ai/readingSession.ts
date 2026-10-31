import { LevelType } from '../../types/japanese';
import { ActiveReading, ActiveReadings, ReadingHistoryEntry, ReadingPracticeData } from '../../types/ai';

/**
 * Pure state logic for Reading Studio's "current passage per level".
 *
 * A passage belongs to the level it was generated for. Switching the header
 * level shows that level's own current passage (or nothing) — it never
 * relabels another level's passage — and each level keeps its own answers.
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

function sanitizeAnswers(value: unknown): Record<number, number> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const id = Number(k);
    if (Number.isFinite(id) && typeof v === 'number') out[id] = v;
  }
  return out;
}

/**
 * Turns whatever is stored under the active-reading key into a per-level map.
 *
 * Before this map existed the key held one bare passage with no level. That
 * legacy passage is attributed to the level of the saved-library entry with the
 * same title (every generated passage is also saved there); if none matches its
 * level is unknowable, so it is dropped rather than shown under a guessed level.
 */
export function normalizeActiveReadings(raw: unknown, history: ReadingHistoryEntry[]): ActiveReadings {
  if (isReading(raw)) {
    const match = history.find((h) => h.data?.title === raw.title);
    if (!match) return {};
    return {
      [match.level]: { level: match.level, lesson: match.lesson, topic: match.topic, data: raw, answers: {} },
    };
  }

  if (!raw || typeof raw !== 'object') return {};
  const out: ActiveReadings = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isLevel(key) || !value || typeof value !== 'object') continue;
    const slot = value as Partial<ActiveReading>;
    if (!isReading(slot.data)) continue;
    out[key] = {
      level: key,
      lesson: typeof slot.lesson === 'number' ? slot.lesson : null,
      topic: typeof slot.topic === 'string' ? slot.topic : '',
      data: slot.data,
      answers: sanitizeAnswers(slot.answers),
    };
  }
  return out;
}

/** Makes `reading` the current passage of its own level, with fresh answers. */
export function withReading(
  readings: ActiveReadings,
  reading: { level: LevelType; lesson: number | null; topic: string; data: ReadingPracticeData }
): ActiveReadings {
  return {
    ...readings,
    [reading.level]: {
      level: reading.level,
      lesson: reading.lesson,
      topic: reading.topic,
      data: reading.data,
      answers: {},
    },
  };
}

/**
 * Records the first answer to a question of `level`'s current passage. Answers
 * are final, so a repeat answer (or a level with no passage) changes nothing
 * and returns the same object.
 */
export function withAnswer(
  readings: ActiveReadings,
  level: LevelType,
  questionId: number,
  optionIndex: number
): ActiveReadings {
  const slot = readings[level];
  if (!slot || slot.answers[questionId] !== undefined) return readings;
  return { ...readings, [level]: { ...slot, answers: { ...slot.answers, [questionId]: optionIndex } } };
}

/** Saved-library entries matching a level filter and a free-text query. */
export function filterLibrary(
  history: ReadingHistoryEntry[],
  level: 'ALL' | LevelType,
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
