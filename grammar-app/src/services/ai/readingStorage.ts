import {
  ActiveReadings,
  ReadingHistoryEntry,
  ReadingProgress,
  SaveHistoryParams,
} from '../../types/ai';
import { fromLegacyLesson } from '../../utils/levels';
import { migrateLegacyAnswers, normalizeActiveReadings, normalizeProgress } from './readingSession';

export const ACTIVE_STORAGE_KEY = 'nihongo_reading_active';
export const HISTORY_STORAGE_KEY = 'nihongo_reading_history';
export const PROGRESS_STORAGE_KEY = 'nihongo_reading_progress';

/** A new, unique story id (also used as the saved-library entry id). */
export function createStoryId(): string {
  return `reading_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Base Abstract Adapter (Contract Interface)
 */
export abstract class BaseReadingStorageAdapter {
  /** Each level's current Studio passage, keyed by level. */
  abstract getActiveReadings(): Promise<ActiveReadings>;
  abstract setActiveReadings(readings: ActiveReadings): Promise<void>;
  /** Quiz answers per story id. */
  abstract getProgress(): Promise<ReadingProgress>;
  abstract setProgress(progress: ReadingProgress): Promise<void>;
  abstract getHistory(): Promise<ReadingHistoryEntry[]>;
  abstract saveToHistory(params: SaveHistoryParams): Promise<ReadingHistoryEntry[]>;
  abstract deleteFromHistory(id: string): Promise<ReadingHistoryEntry[]>;
  abstract clearHistory(): Promise<ReadingHistoryEntry[]>;
}

/**
 * LocalStorage Implementation of the Reading Storage Adapter
 */
export class LocalStorageReadingAdapter extends BaseReadingStorageAdapter {
  private storage: StorageLike | null;
  private memoryStore: Map<string, string>;

  constructor(storage: StorageLike | null = typeof window !== 'undefined' ? window.localStorage : null) {
    super();
    this.storage = storage;
    this.memoryStore = new Map();
  }

  private _getItem(key: string): string | null {
    if (this.storage) {
      return this.storage.getItem(key);
    }
    return this.memoryStore.get(key) || null;
  }

  private _setItem(key: string, value: string): void {
    if (this.storage) {
      this.storage.setItem(key, value);
    } else {
      this.memoryStore.set(key, value);
    }
  }

  private _removeItem(key: string): void {
    if (this.storage) {
      this.storage.removeItem(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  async getActiveReadings(): Promise<ActiveReadings> {
    try {
      const raw = this._getItem(ACTIVE_STORAGE_KEY);
      if (!raw) return {};
      // Older builds stored one bare passage here; normalize maps it onto its level.
      return normalizeActiveReadings(JSON.parse(raw), await this.getHistory());
    } catch (e) {
      console.error('LocalStorageAdapter: failed to get active readings', e);
      return {};
    }
  }

  async setActiveReadings(readings: ActiveReadings): Promise<void> {
    try {
      if (Object.keys(readings).length > 0) {
        this._setItem(ACTIVE_STORAGE_KEY, JSON.stringify(readings));
      } else {
        this._removeItem(ACTIVE_STORAGE_KEY);
      }
    } catch (e) {
      console.error('LocalStorageAdapter: failed to set active readings', e);
    }
  }

  async getProgress(): Promise<ReadingProgress> {
    try {
      const raw = this._getItem(PROGRESS_STORAGE_KEY);
      const progress = raw ? normalizeProgress(JSON.parse(raw)) : {};
      // Older builds kept answers per level inside the active-reading map. Move them onto
      // that passage's story id; they drop out of that map on its next write.
      const rawActive = this._getItem(ACTIVE_STORAGE_KEY);
      if (!rawActive) return progress;
      return migrateLegacyAnswers(JSON.parse(rawActive), progress, await this.getHistory());
    } catch (e) {
      console.error('LocalStorageAdapter: failed to get progress', e);
      return {};
    }
  }

  async setProgress(progress: ReadingProgress): Promise<void> {
    try {
      if (Object.keys(progress).length > 0) {
        this._setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
      } else {
        this._removeItem(PROGRESS_STORAGE_KEY);
      }
    } catch (e) {
      console.error('LocalStorageAdapter: failed to set progress', e);
    }
  }

  async getHistory(): Promise<ReadingHistoryEntry[]> {
    try {
      const raw = this._getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      // Entries saved before N4 was renumbered 1-25 carry its old 26-50 lessons.
      return (JSON.parse(raw) as ReadingHistoryEntry[]).map((entry) =>
        entry.lesson === null ? entry : { ...entry, lesson: fromLegacyLesson(entry.level, entry.lesson) }
      );
    } catch (e) {
      console.error('LocalStorageAdapter: failed to get history', e);
      return [];
    }
  }

  async saveToHistory({
    reading,
    id = createStoryId(),
    level = 'N4',
    lesson = null,
    topic = '',
    maxItems = 30,
  }: SaveHistoryParams): Promise<ReadingHistoryEntry[]> {
    if (!reading || !reading.title) return await this.getHistory();

    try {
      const current = await this.getHistory();
      const entry: ReadingHistoryEntry = {
        id,
        timestamp: new Date().toISOString(),
        level,
        lesson,
        topic,
        data: reading,
      };

      // Move latest duplicate to top
      const filtered = current.filter((h) => h.data?.title !== reading.title);
      const updated = [entry, ...filtered].slice(0, maxItems);

      this._setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('LocalStorageAdapter: failed to save to history', e);
      return await this.getHistory();
    }
  }

  async deleteFromHistory(id: string): Promise<ReadingHistoryEntry[]> {
    try {
      const current = await this.getHistory();
      const updated = current.filter((item) => item.id !== id);
      this._setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('LocalStorageAdapter: failed to delete item', e);
      return await this.getHistory();
    }
  }

  async clearHistory(): Promise<ReadingHistoryEntry[]> {
    try {
      this._removeItem(HISTORY_STORAGE_KEY);
      return [];
    } catch (e) {
      console.error('LocalStorageAdapter: failed to clear history', e);
      return [];
    }
  }
}

// Singleton Storage Facade
let currentAdapter: BaseReadingStorageAdapter = new LocalStorageReadingAdapter();

/**
 * Get active storage adapter instance.
 */
export function getReadingStorageAdapter(): BaseReadingStorageAdapter {
  return currentAdapter;
}

/**
 * Swap storage adapter (e.g. to a FirebaseReadingAdapter or custom cloud backend).
 */
export function setReadingStorageAdapter(adapter: BaseReadingStorageAdapter): void {
  if (!(adapter instanceof BaseReadingStorageAdapter)) {
    throw new Error('Adapter must inherit from BaseReadingStorageAdapter');
  }
  currentAdapter = adapter;
}

/**
 * Facade Repository Methods used by React components
 */
export const readingRepository = {
  getActiveReadings: () => currentAdapter.getActiveReadings(),
  setActiveReadings: (readings: ActiveReadings) => currentAdapter.setActiveReadings(readings),
  getProgress: () => currentAdapter.getProgress(),
  setProgress: (progress: ReadingProgress) => currentAdapter.setProgress(progress),
  getHistory: () => currentAdapter.getHistory(),
  saveToHistory: (params: SaveHistoryParams) => currentAdapter.saveToHistory(params),
  deleteFromHistory: (id: string) => currentAdapter.deleteFromHistory(id),
  clearHistory: () => currentAdapter.clearHistory(),
};
