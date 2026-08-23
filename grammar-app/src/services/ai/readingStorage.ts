import {
  ReadingPracticeData,
  ReadingHistoryEntry,
  SaveHistoryParams,
} from '../../types/ai';

export const ACTIVE_STORAGE_KEY = 'nihongo_reading_active';
export const HISTORY_STORAGE_KEY = 'nihongo_reading_history';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Base Abstract Adapter (Contract Interface)
 */
export abstract class BaseReadingStorageAdapter {
  abstract getActiveReading(): Promise<ReadingPracticeData | null>;
  abstract setActiveReading(reading: ReadingPracticeData | null): Promise<void>;
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

  async getActiveReading(): Promise<ReadingPracticeData | null> {
    try {
      const raw = this._getItem(ACTIVE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ReadingPracticeData) : null;
    } catch (e) {
      console.error('LocalStorageAdapter: failed to get active reading', e);
      return null;
    }
  }

  async setActiveReading(reading: ReadingPracticeData | null): Promise<void> {
    try {
      if (reading) {
        this._setItem(ACTIVE_STORAGE_KEY, JSON.stringify(reading));
      } else {
        this._removeItem(ACTIVE_STORAGE_KEY);
      }
    } catch (e) {
      console.error('LocalStorageAdapter: failed to set active reading', e);
    }
  }

  async getHistory(): Promise<ReadingHistoryEntry[]> {
    try {
      const raw = this._getItem(HISTORY_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ReadingHistoryEntry[]) : [];
    } catch (e) {
      console.error('LocalStorageAdapter: failed to get history', e);
      return [];
    }
  }

  async saveToHistory({
    reading,
    level = 'N4',
    lesson = null,
    topic = '',
    maxItems = 30,
  }: SaveHistoryParams): Promise<ReadingHistoryEntry[]> {
    if (!reading || !reading.title) return await this.getHistory();

    try {
      const current = await this.getHistory();
      const entry: ReadingHistoryEntry = {
        id: `reading_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
  getActiveReading: () => currentAdapter.getActiveReading(),
  setActiveReading: (reading: ReadingPracticeData | null) => currentAdapter.setActiveReading(reading),
  getHistory: () => currentAdapter.getHistory(),
  saveToHistory: (params: SaveHistoryParams) => currentAdapter.saveToHistory(params),
  deleteFromHistory: (id: string) => currentAdapter.deleteFromHistory(id),
  clearHistory: () => currentAdapter.clearHistory(),
};
