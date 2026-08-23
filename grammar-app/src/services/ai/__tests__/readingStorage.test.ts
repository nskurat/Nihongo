import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocalStorageReadingAdapter,
  BaseReadingStorageAdapter,
  readingRepository,
  setReadingStorageAdapter,
  ACTIVE_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
} from '../readingStorage';
import { ReadingPracticeData, ReadingHistoryEntry, SaveHistoryParams } from '../../../types/ai';

// Mock in-memory storage simulating window.localStorage
class MockStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const mockReadingData: ReadingPracticeData = {
  title: 'テストの物語',
  titleEn: 'Test Story',
  japaneseText: 'これはテストの文章です。',
  englishTranslation: 'This is a test passage.',
  questions: [
    {
      id: 1,
      question: 'テストですか。',
      options: ['はい', 'いいえ'],
      correctIndex: 0,
      explanationJp: 'テストです。',
      explanationEn: 'It is a test.',
    },
  ],
};

describe('Reading Storage Adapter Architecture', () => {
  let mockStorage: MockStorage;
  let adapter: LocalStorageReadingAdapter;

  beforeEach(() => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageReadingAdapter(mockStorage);
    setReadingStorageAdapter(adapter);
  });

  describe('LocalStorageReadingAdapter Contract', () => {
    it('should save and retrieve active reading session', async () => {
      await readingRepository.setActiveReading(mockReadingData);
      const active = await readingRepository.getActiveReading();
      expect(active).toEqual(mockReadingData);
      expect(mockStorage.getItem(ACTIVE_STORAGE_KEY)).toContain('テストの物語');
    });

    it('should clear active reading session when passing null', async () => {
      await readingRepository.setActiveReading(mockReadingData);
      await readingRepository.setActiveReading(null);
      const active = await readingRepository.getActiveReading();
      expect(active).toBeNull();
      expect(mockStorage.getItem(ACTIVE_STORAGE_KEY)).toBeNull();
    });

    it('should handle corrupted JSON gracefully without throwing', async () => {
      mockStorage.setItem(ACTIVE_STORAGE_KEY, 'INVALID_JSON{[[:');
      const active = await readingRepository.getActiveReading();
      expect(active).toBeNull();
    });

    it('should archive reading stories to history library', async () => {
      const history = await readingRepository.saveToHistory({
        reading: mockReadingData,
        level: 'N4',
        lesson: 26,
        topic: 'Test Topic',
      });

      expect(history).toHaveLength(1);
      expect(history[0].data.title).toBe('テストの物語');
      expect(history[0].level).toBe('N4');
      expect(history[0].lesson).toBe(26);
    });

    it('should deduplicate and move re-saved reading stories to top of history', async () => {
      await readingRepository.saveToHistory({ reading: mockReadingData, level: 'N4' });
      await readingRepository.saveToHistory({
        reading: { ...mockReadingData, title: '第二の物語' },
        level: 'N3',
      });

      // Re-save first story
      const updated = await readingRepository.saveToHistory({ reading: mockReadingData, level: 'N4' });
      expect(updated).toHaveLength(2);
      expect(updated[0].data.title).toBe('テストの物語');
      expect(updated[1].data.title).toBe('第二の物語');
    });

    it('should cap history items to maxItems limit', async () => {
      for (let i = 1; i <= 5; i++) {
        await readingRepository.saveToHistory({
          reading: { ...mockReadingData, title: `Story ${i}` },
          maxItems: 3,
        });
      }

      const history = await readingRepository.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].data.title).toBe('Story 5');
      expect(history[1].data.title).toBe('Story 4');
      expect(history[2].data.title).toBe('Story 3');
    });

    it('should delete individual history item by ID', async () => {
      const history = await readingRepository.saveToHistory({ reading: mockReadingData });
      const itemId = history[0].id;

      const afterDelete = await readingRepository.deleteFromHistory(itemId);
      expect(afterDelete).toHaveLength(0);
    });

    it('should clear all history stories', async () => {
      await readingRepository.saveToHistory({ reading: mockReadingData });
      const cleared = await readingRepository.clearHistory();
      expect(cleared).toEqual([]);
      expect(mockStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
    });
  });

  describe('Storage Adapter Swapping / Extensibility (Future Cloud DB)', () => {
    it('should allow switching to a custom cloud database adapter seamlessly', async () => {
      // Mock cloud DB adapter
      class MockFirebaseAdapter extends BaseReadingStorageAdapter {
        private cloudDb: ReadingHistoryEntry[] = [];

        async getActiveReading(): Promise<ReadingPracticeData | null> {
          return mockReadingData;
        }
        async setActiveReading(): Promise<void> {}
        async getHistory(): Promise<ReadingHistoryEntry[]> {
          return this.cloudDb;
        }
        async saveToHistory({ reading }: SaveHistoryParams): Promise<ReadingHistoryEntry[]> {
          this.cloudDb.push({
            id: 'cloud_1',
            timestamp: new Date().toISOString(),
            level: 'N3',
            lesson: null,
            topic: 'Cloud',
            data: reading,
          });
          return this.cloudDb;
        }
        async deleteFromHistory(): Promise<ReadingHistoryEntry[]> {
          return [];
        }
        async clearHistory(): Promise<ReadingHistoryEntry[]> {
          return [];
        }
      }

      // Swap adapter
      setReadingStorageAdapter(new MockFirebaseAdapter());

      const active = await readingRepository.getActiveReading();
      expect(active?.title).toBe('テストの物語');

      const cloudHistory = await readingRepository.saveToHistory({ reading: mockReadingData });
      expect(cloudHistory).toHaveLength(1);
      expect(cloudHistory[0].id).toBe('cloud_1');
    });
  });
});
