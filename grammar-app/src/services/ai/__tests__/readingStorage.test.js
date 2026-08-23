import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACTIVE_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  BaseReadingStorageAdapter,
  LocalStorageReadingAdapter,
  setReadingStorageAdapter,
  readingRepository,
} from '../readingStorage';

// Mock browser storage for unit testing
function createMockStorage(initial = {}) {
  let store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    getStore: () => store,
  };
}

describe('Reading Storage Adapter Architecture', () => {
  let mockStorage;
  let adapter;

  const sampleReading1 = {
    title: '新幹線[しんかんせん]の旅[たび]',
    titleEn: 'Trip on the Shinkansen',
    japaneseText: '東京から京都まで新幹線で行きました。',
    questions: [{ id: 1, question: 'テスト', options: ['A', 'B'], correctIndex: 0 }],
  };

  const sampleReading2 = {
    title: '京都[きょうと]の寺[てら]',
    titleEn: 'Temples in Kyoto',
    japaneseText: '金閣寺はとても綺麗でした。',
    questions: [{ id: 1, question: 'テスト2', options: ['A', 'B'], correctIndex: 1 }],
  };

  beforeEach(() => {
    mockStorage = createMockStorage();
    adapter = new LocalStorageReadingAdapter(mockStorage);
    setReadingStorageAdapter(adapter);
  });

  describe('LocalStorageReadingAdapter Contract', () => {
    it('should return null when active reading is empty', async () => {
      const active = await readingRepository.getActiveReading();
      expect(active).toBeNull();
    });

    it('should save and retrieve active reading asynchronously', async () => {
      await readingRepository.setActiveReading(sampleReading1);
      const retrieved = await readingRepository.getActiveReading();
      expect(retrieved).toEqual(sampleReading1);
    });

    it('should clear active reading when null is passed', async () => {
      await readingRepository.setActiveReading(sampleReading1);
      expect(await readingRepository.getActiveReading()).toEqual(sampleReading1);

      await readingRepository.setActiveReading(null);
      expect(await readingRepository.getActiveReading()).toBeNull();
    });

    it('should handle corrupted JSON gracefully without throwing', async () => {
      mockStorage.setItem(ACTIVE_STORAGE_KEY, 'INVALID_JSON{[[');
      expect(await readingRepository.getActiveReading()).toBeNull();
    });

    it('should save to history with full metadata and timestamps', async () => {
      const history = await readingRepository.saveToHistory({
        reading: sampleReading1,
        level: 'N4',
        lesson: 27,
        topic: 'Travel',
      });

      expect(history).toHaveLength(1);
      expect(history[0].level).toBe('N4');
      expect(history[0].lesson).toBe(27);
      expect(history[0].topic).toBe('Travel');
      expect(history[0].data).toEqual(sampleReading1);
      expect(history[0].timestamp).toBeDefined();
    });

    it('should deduplicate passages by title and keep latest on top', async () => {
      await readingRepository.saveToHistory({ reading: sampleReading1, level: 'N4' });
      await readingRepository.saveToHistory({ reading: sampleReading2, level: 'N3' });

      const updated = await readingRepository.saveToHistory({
        reading: sampleReading1,
        level: 'N4',
        topic: 'Re-visited',
      });

      expect(updated).toHaveLength(2);
      expect(updated[0].data.title).toBe(sampleReading1.title);
      expect(updated[0].topic).toBe('Re-visited');
    });

    it('should respect maxItems limit', async () => {
      for (let i = 1; i <= 6; i++) {
        await readingRepository.saveToHistory({
          reading: { ...sampleReading1, title: `Passage ${i}` },
          maxItems: 3,
        });
      }

      const history = await readingRepository.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].data.title).toBe('Passage 6');
      expect(history[2].data.title).toBe('Passage 4');
    });

    it('should delete items by ID and clear history', async () => {
      const history = await readingRepository.saveToHistory({ reading: sampleReading1 });
      await readingRepository.saveToHistory({ reading: sampleReading2 });

      const afterDelete = await readingRepository.deleteFromHistory(history[0].id);
      expect(afterDelete).toHaveLength(1);

      const cleared = await readingRepository.clearHistory();
      expect(cleared).toEqual([]);
    });
  });

  describe('Cloud DB Adapter Swapping (Polymorphism)', () => {
    it('should allow seamlessly swapping to a custom Cloud / Firebase adapter without breaking repository consumers', async () => {
      // Mock cloud in-memory store simulating a remote Firestore collection
      class MockCloudReadingAdapter extends BaseReadingStorageAdapter {
        constructor() {
          super();
          this.remoteActive = null;
          this.remoteHistory = [];
        }
        async getActiveReading() {
          return this.remoteActive;
        }
        async setActiveReading(reading) {
          this.remoteActive = reading;
        }
        async getHistory() {
          return this.remoteHistory;
        }
        async saveToHistory({ reading, level, lesson, topic }) {
          const entry = { id: 'cloud_1', timestamp: new Date().toISOString(), level, lesson, topic, data: reading };
          this.remoteHistory = [entry, ...this.remoteHistory];
          return this.remoteHistory;
        }
        async deleteFromHistory(id) {
          this.remoteHistory = this.remoteHistory.filter((i) => i.id !== id);
          return this.remoteHistory;
        }
        async clearHistory() {
          this.remoteHistory = [];
          return [];
        }
      }

      const cloudAdapter = new MockCloudReadingAdapter();
      setReadingStorageAdapter(cloudAdapter);

      // Verify repository seamlessly delegates to cloudAdapter
      await readingRepository.setActiveReading(sampleReading2);
      expect(await readingRepository.getActiveReading()).toEqual(sampleReading2);

      const cloudHistory = await readingRepository.saveToHistory({
        reading: sampleReading2,
        level: 'N3',
        topic: 'Cloud Sync',
      });
      expect(cloudHistory).toHaveLength(1);
      expect(cloudHistory[0].id).toBe('cloud_1');
    });
  });
});
