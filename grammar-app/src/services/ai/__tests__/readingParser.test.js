import { describe, it, expect } from 'vitest';
import {
  parseFuriganaTokens,
  cleanJsonString,
  parseReadingResponse,
} from '../readingParser';

describe('readingParser', () => {
  describe('parseFuriganaTokens', () => {
    it('should parse standard Kanji[furigana] syntax correctly', () => {
      const input = 'わたしは京都[きょうと]へ行[い]きました。';
      const tokens = parseFuriganaTokens(input);

      expect(tokens).toEqual([
        { type: 'text', content: 'わたしは' },
        { type: 'ruby', base: '京都', ruby: 'きょうと' },
        { type: 'text', content: 'へ' },
        { type: 'ruby', base: '行', ruby: 'い' },
        { type: 'text', content: 'きました。' },
      ]);
    });

    it('should handle pure text with no furigana', () => {
      const input = 'こんにちは、げんきですか。';
      const tokens = parseFuriganaTokens(input);

      expect(tokens).toEqual([
        { type: 'text', content: 'こんにちは、げんきですか。' },
      ]);
    });

    it('should handle alternative markdown [base](ruby) and {base|ruby} syntax', () => {
      const input = '[富士山](ふじさん)と{桜|さくら}';
      const tokens = parseFuriganaTokens(input);

      expect(tokens).toEqual([
        { type: 'ruby', base: '富士山', ruby: 'ふじさん' },
        { type: 'text', content: 'と' },
        { type: 'ruby', base: '桜', ruby: 'さくら' },
      ]);
    });
  });

  describe('cleanJsonString', () => {
    it('should extract JSON from markdown code fences', () => {
      const raw = '```json\n{"japaneseText": "テスト", "questions": []}\n```';
      const cleaned = cleanJsonString(raw);
      expect(JSON.parse(cleaned)).toEqual({
        japaneseText: 'テスト',
        questions: [],
      });
    });

    it('should strip conversational preambles and postscripts', () => {
      const raw = 'Sure! Here is the reading practice:\n{"japaneseText": "こんにちは", "questions": []}\nHope you enjoy studying!';
      const cleaned = cleanJsonString(raw);
      expect(JSON.parse(cleaned)).toEqual({
        japaneseText: 'こんにちは',
        questions: [],
      });
    });

    it('should fix trailing commas in objects and arrays', () => {
      const raw = '{"japaneseText": "本文", "questions": ["A", "B", ], }';
      const cleaned = cleanJsonString(raw);
      expect(JSON.parse(cleaned)).toEqual({
        japaneseText: '本文',
        questions: ['A', 'B'],
      });
    });
  });

  describe('parseReadingResponse', () => {
    it('should validate and parse complete reading responses with 5 questions', () => {
      const mockRaw = {
        title: '新幹線で旅行',
        titleEn: 'Trip on Shinkansen',
        japaneseText: '先週、京都へ新幹線で行きました。窓側の席に座ったので、富士山がよく見えました。とても綺麗でした。',
        englishTranslation: 'Last week I went to Kyoto by Shinkansen. Because I sat in a window seat, I could see Mt. Fuji clearly. It was very pretty.',
        vocabulary: [{ word: '新幹線', reading: 'しんかんせん', meaning: 'bullet train' }],
        grammarUsed: [{ pattern: '〜ので', note: 'cause/reason' }],
        questions: [
          {
            id: 1,
            question: 'どこへ行きましたか。',
            questionEn: 'Where did they go?',
            options: ['東京', '京都', '大阪', '北海道'],
            correctIndex: 1,
            explanation: '京都へ行きました。',
          },
          {
            id: 2,
            question: '何に乗りましたか。',
            questionEn: 'What did they ride?',
            options: ['バス', '飛行機', '新幹線', 'タクシー'],
            correctIndex: 2,
            explanation: '新幹線に乗りました。',
          },
        ],
      };

      const result = parseReadingResponse(mockRaw);
      expect(result.japaneseText).toBe(mockRaw.japaneseText);
      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].correctIndex).toBe(1);
    });

    it('should throw an error when japaneseText is too short or missing', () => {
      const invalid = {
        japaneseText: '短い',
        questions: [],
      };
      expect(() => parseReadingResponse(invalid)).toThrow(
        /Invalid reading material/
      );
    });

    it('should sanitize out-of-bounds correctIndex to 0', () => {
      const mock = {
        japaneseText: 'これは十分な長さを持つ日本語のテスト読解文章です。練習しましょう。',
        questions: [
          {
            id: 1,
            question: '質問ですか？',
            options: ['A', 'B', 'C', 'D'],
            correctIndex: 99, // Out of bounds
          },
        ],
      };

      const result = parseReadingResponse(mock);
      expect(result.questions[0].correctIndex).toBe(0);
    });
  });
});
