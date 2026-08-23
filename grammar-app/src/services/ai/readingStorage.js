/**
 * Reading Storage Adapter Architecture
 *
 * Provides an asynchronous Storage Adapter interface allowing seamless swapping
 * between LocalStorage, Firebase Firestore, Supabase, or REST backends.
 */

export const ACTIVE_STORAGE_KEY = 'nihongo_reading_active';
export const HISTORY_STORAGE_KEY = 'nihongo_reading_history';

/**
 * Base Abstract Adapter (Contract Interface)
 */
export class BaseReadingStorageAdapter {
  async getActiveReading() {
    throw new Error('getActiveReading() not implemented');
  }

  async setActiveReading(reading) {
    throw new Error('setActiveReading() not implemented');
  }

  async getHistory() {
    throw new Error('getHistory() not implemented');
  }

  async saveToHistory({ reading, level, lesson, topic, maxItems }) {
    throw new Error('saveToHistory() not implemented');
  }

  async deleteFromHistory(id) {
    throw new Error('deleteFromHistory() not implemented');
  }

  async clearHistory() {
    throw new Error('clearHistory() not implemented');
  }
}

/**
 * LocalStorage Implementation of the Reading Storage Adapter
 */
export class LocalStorageReadingAdapter extends BaseReadingStorageAdapter {
  constructor(storage = typeof window !== 'undefined' ? window.localStorage : null) {
    super();
    this.storage = storage;
    this.memoryStore = new Map(); // Fallback when localStorage is unavailable
  }

  _getItem(key) {
    if (this.storage) {
      return this.storage.getItem(key);
    }
    return this.memoryStore.get(key) || null;
  }

  _setItem(key, value) {
    if (this.storage) {
      this.storage.setItem(key, value);
    } else {
      this.memoryStore.set(key, value);
    }
  }

  _removeItem(key) {
    if (this.storage) {
      this.storage.removeItem(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  async getActiveReading() {
    try {
      const raw = this._getItem(ACTIVE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('LocalStorageAdapter: failed to get active reading', e);
      return null;
    }
  }

  async setActiveReading(reading) {
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

  async getHistory() {
    try {
      const raw = this._getItem(HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('LocalStorageAdapter: failed to get history', e);
      return [];
    }
  }

  async saveToHistory({ reading, level = 'N4', lesson = null, topic = '', maxItems = 30 }) {
    if (!reading || !reading.title) return await this.getHistory();

    try {
      const current = await this.getHistory();
      const entry = {
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

  async deleteFromHistory(id) {
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

  async clearHistory() {
    try {
      this._removeItem(HISTORY_STORAGE_KEY);
      return [];
    } catch (e) {
      console.error('LocalStorageAdapter: failed to clear history', e);
      return [];
    }
  }
}

/**
 * Example Firebase / Cloud DB Adapter Blueprint
 * (Ready to be populated when Firebase Firestore is connected)
 *
 * ```javascript
 * import { doc, getDoc, setDoc, collection, getDocs, ... } from 'firebase/firestore';
 *
 * export class FirebaseReadingAdapter extends BaseReadingStorageAdapter {
 *   constructor(db, userId) {
 *     super();
 *     this.db = db;
 *     this.userId = userId;
 *   }
 *   async getActiveReading() { ... }
 *   async setActiveReading(reading) { ... }
 *   async getHistory() { ... }
 *   async saveToHistory(...) { ... }
 * }
 * ```
 */

// Singleton Storage Facade
let currentAdapter = new LocalStorageReadingAdapter();

/**
 * Get active storage adapter instance.
 */
export function getReadingStorageAdapter() {
  return currentAdapter;
}

/**
 * Swap storage adapter (e.g. to a FirebaseReadingAdapter or custom cloud backend).
 */
export function setReadingStorageAdapter(adapter) {
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
  setActiveReading: (reading) => currentAdapter.setActiveReading(reading),
  getHistory: () => currentAdapter.getHistory(),
  saveToHistory: (params) => currentAdapter.saveToHistory(params),
  deleteFromHistory: (id) => currentAdapter.deleteFromHistory(id),
  clearHistory: () => currentAdapter.clearHistory(),
};
