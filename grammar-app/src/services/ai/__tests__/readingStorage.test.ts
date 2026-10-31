import { describe, it, expect, beforeEach } from 'vitest';
import {
  LocalStorageReadingAdapter,
  BaseReadingStorageAdapter,
  readingRepository,
  setReadingStorageAdapter,
  ACTIVE_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
} from '../readingStorage';
import {
  ActiveReadings,
  ReadingPracticeData,
  ReadingHistoryEntry,
  ReadingProgress,
  SaveHistoryParams,
} from '../../../types/ai';

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
    it('should save and retrieve active readings per level', async () => {
      const readings = {
        N3: { storyId: 's1', level: 'N3' as const, lesson: 4, topic: 'T', data: mockReadingData },
      };
      await readingRepository.setActiveReadings(readings);
      expect(await readingRepository.getActiveReadings()).toEqual(readings);
      expect(mockStorage.getItem(ACTIVE_STORAGE_KEY)).toContain('テストの物語');
    });

    it('should save and retrieve answers per story, removing the key when empty', async () => {
      await readingRepository.setProgress({ s1: { 1: 0 }, s2: { 2: 1 } });
      expect(await readingRepository.getProgress()).toEqual({ s1: { 1: 0 }, s2: { 2: 1 } });
      await readingRepository.setProgress({});
      expect(mockStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
    });

    it('should migrate legacy per-level answers onto the current passage story id', async () => {
      const [saved] = await readingRepository.saveToHistory({ reading: mockReadingData, level: 'N3', id: 'story_n3' });
      expect(saved.id).toBe('story_n3');
      mockStorage.setItem(
        ACTIVE_STORAGE_KEY,
        JSON.stringify({ N3: { level: 'N3', lesson: null, topic: '', data: mockReadingData, answers: { 1: 0 } } })
      );

      expect(await readingRepository.getProgress()).toEqual({ story_n3: { 1: 0 } });
      const active = await readingRepository.getActiveReadings();
      expect(active.N3?.storyId).toBe('story_n3');

      // Once the new shape is written the legacy answers are gone, but progress keeps them.
      await readingRepository.setProgress(await readingRepository.getProgress());
      await readingRepository.setActiveReadings(active);
      expect(mockStorage.getItem(ACTIVE_STORAGE_KEY)).not.toContain('answers');
      expect(await readingRepository.getProgress()).toEqual({ story_n3: { 1: 0 } });
    });

    it('should remove the key when no level has an active reading', async () => {
      await readingRepository.setActiveReadings({
        N4: { storyId: 's1', level: 'N4', lesson: null, topic: '', data: mockReadingData },
      });
      await readingRepository.setActiveReadings({});
      expect(await readingRepository.getActiveReadings()).toEqual({});
      expect(mockStorage.getItem(ACTIVE_STORAGE_KEY)).toBeNull();
    });

    it('should attribute a legacy bare active passage to its saved-library level', async () => {
      mockStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(mockReadingData));
      await readingRepository.saveToHistory({ reading: mockReadingData, level: 'N5', lesson: 3, topic: 'Food' });

      const active = await readingRepository.getActiveReadings();

      expect(Object.keys(active)).toEqual(['N5']);
      expect(active.N5).toMatchObject({ level: 'N5', lesson: 3, topic: 'Food' });
      expect(active.N5?.data.title).toBe('テストの物語');
    });

    it('should handle corrupted JSON gracefully without throwing', async () => {
      mockStorage.setItem(ACTIVE_STORAGE_KEY, 'INVALID_JSON{[[:');
      expect(await readingRepository.getActiveReadings()).toEqual({});
    });

    it('should archive reading stories to history library', async () => {
      const history = await readingRepository.saveToHistory({
        reading: mockReadingData,
        level: 'N4',
        lesson: 5,
        topic: 'Test Topic',
      });

      expect(history).toHaveLength(1);
      expect(history[0].data.title).toBe('テストの物語');
      expect(history[0].level).toBe('N4');
      expect(history[0].lesson).toBe(5);
    });

    it('should map history saved under the old N4 numbering (26-50) onto 1-25', async () => {
      const legacy = [
        { id: 'a', timestamp: '2026-01-01T00:00:00Z', level: 'N4', lesson: 30, topic: '', data: mockReadingData },
        { id: 'b', timestamp: '2026-01-01T00:00:00Z', level: 'N5', lesson: 30, topic: '', data: mockReadingData },
        { id: 'c', timestamp: '2026-01-01T00:00:00Z', level: 'N4', lesson: null, topic: '', data: mockReadingData },
      ];
      mockStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(legacy));

      const history = await readingRepository.getHistory();

      expect(history.map((h) => h.lesson)).toEqual([5, 30, null]);
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

        async getActiveReadings(): Promise<ActiveReadings> {
          return { N3: { storyId: 'cloud_1', level: 'N3', lesson: null, topic: '', data: mockReadingData } };
        }
        async setActiveReadings(): Promise<void> {}
        async getProgress(): Promise<ReadingProgress> {
          return {};
        }
        async setProgress(): Promise<void> {}
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

      const active = await readingRepository.getActiveReadings();
      expect(active.N3?.data.title).toBe('テストの物語');

      const cloudHistory = await readingRepository.saveToHistory({ reading: mockReadingData });
      expect(cloudHistory).toHaveLength(1);
      expect(cloudHistory[0].id).toBe('cloud_1');
    });
  });
});
