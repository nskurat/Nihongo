import { describe, it, expect } from 'vitest';
import {
  parseFuriganaTokens,
  stripFurigana,
  cleanJsonString,
  parseReadingResponse,
} from '../readingParser';

describe('Reading Parser & Furigana Tokenizer', () => {
  describe('parseFuriganaTokens', () => {
    it('should return plain text tokens when no furigana is present', () => {
      const text = 'わたしはがくせいです。';
      const tokens = parseFuriganaTokens(text);
      expect(tokens).toEqual([{ type: 'text', content: 'わたしはがくせいです。' }]);
    });

    it('should correctly parse standard bracketed furigana 漢字[かんじ]', () => {
      const text = '昨日[きのう]、東京[とうきょう]へ行[い]きました。';
      const tokens = parseFuriganaTokens(text);
      expect(tokens).toEqual([
        { type: 'ruby', base: '昨日', ruby: 'きのう' },
        { type: 'text', content: '、' },
        { type: 'ruby', base: '東京', ruby: 'とうきょう' },
        { type: 'text', content: 'へ' },
        { type: 'ruby', base: '行', ruby: 'い' },
        { type: 'text', content: 'きました。' },
      ]);
    });

    it('should support alternative markdown furigana notation [漢字](かんじ)', () => {
      const text = '[京都](きょうと)の[紅葉](こうよう)';
      const tokens = parseFuriganaTokens(text);
      expect(tokens).toEqual([
        { type: 'ruby', base: '京都', ruby: 'きょうと' },
        { type: 'text', content: 'の' },
        { type: 'ruby', base: '紅葉', ruby: 'こうよう' },
      ]);
    });
  });

  describe('stripFurigana', () => {
    it('should strip ruby brackets leaving plain Japanese text', () => {
      const text = '朝[あさ]の習慣[しゅうかん]と趣味[しゅみ]の時間[じかん]';
      expect(stripFurigana(text)).toBe('朝の習慣と趣味の時間');
    });

    it('should strip markdown notation [漢字](かんじ)', () => {
      const text = '[京都](きょうと)の[紅葉](こうよう)';
      expect(stripFurigana(text)).toBe('京都の紅葉');
    });

    it('should handle plain text without changes', () => {
      const text = 'こんにちは世界';
      expect(stripFurigana(text)).toBe('こんにちは世界');
    });
  });

  describe('cleanJsonString', () => {
    it('should strip markdown ```json code fences', () => {
      const raw = '```json\n{"title": "Test"}\n```';
      expect(cleanJsonString(raw)).toBe('{"title": "Test"}');
    });

    it('should extract outermost JSON object when surrounded by LLM preamble', () => {
      const raw = 'Here is your requested reading passage:\n\n{"title": "Valid", "japaneseText": "Test"}\n\nHope this helps!';
      expect(cleanJsonString(raw)).toBe('{"title": "Valid", "japaneseText": "Test"}');
    });

    it('should clean trailing commas before closing braces', () => {
      const raw = '{"items": ["a", "b",], "score": 100,}';
      expect(cleanJsonString(raw)).toBe('{"items": ["a", "b"], "score": 100}');
    });
  });

  describe('parseReadingResponse', () => {
    it('should parse and normalize a valid LLM response string with questions', () => {
      const mockLlmOutput = JSON.stringify({
        title: '新幹線[しんかんせん]の旅[たび]',
        titleEn: 'Trip on the Bullet Train',
        japaneseText: '先週[せんしゅう]、わたしは新幹線[しんかんせん]で京都[きょうと]へ行[い]きました。とても速[はや]かったです。',
        englishTranslation: 'Last week, I went to Kyoto by bullet train. It was very fast.',
        vocabulary: [{ word: '速い', reading: 'はやい', meaning: 'fast' }],
        grammarUsed: [{ pattern: '〜で行く', note: 'Means of transportation' }],
        questions: [
          {
            id: 1,
            question: 'わたしは先週どこへ行きましたか。',
            options: ['東京', '京都', '大阪', '北海道'],
            correctIndex: 1,
            explanationJp: '文章[ぶんしょう]に「京都[きょうと]へ行[い]きました」と書[か]いてあります。',
            explanationEn: 'The passage explicitly states that I went to Kyoto.',
          },
        ],
      });

      const parsed = parseReadingResponse(mockLlmOutput);
      expect(parsed.title).toBe('新幹線[しんかんせん]の旅[たび]');
      expect(parsed.titleEn).toBe('Trip on the Bullet Train');
      expect(parsed.japaneseText).toContain('京都[きょうと]');
      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].correctIndex).toBe(1);
      expect(parsed.questions[0].explanationJp).toContain('文章[ぶんしょう]');
      expect(parsed.questions[0].explanationEn).toBe('The passage explicitly states that I went to Kyoto.');
    });

    it('should throw error when japaneseText is missing or too short', () => {
      const invalid = JSON.stringify({ title: 'Short', japaneseText: 'Short' });
      expect(() => parseReadingResponse(invalid)).toThrowError(/Invalid reading material/);
    });

    it('should throw error when questions array is missing', () => {
      const invalid = JSON.stringify({
        title: 'No questions',
        japaneseText: 'これは長くて十分な長さがあるテスト用の日本語の文章です。しっかりとチェックします。',
      });
      expect(() => parseReadingResponse(invalid)).toThrowError(/questions/);
    });
  });
});
