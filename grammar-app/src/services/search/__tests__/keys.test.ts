import { describe, expect, it } from 'vitest';
import { grammarKeys } from '../keys/grammarKeys';
import { kanjiReadingKeys } from '../keys/kanjiReadingKeys';
import { isMasuExpression, masuToDict, posGroup } from '../keys/masuToDict';
import { honorificAlias, vocabVariants } from '../keys/vocabVariants';

describe('vocabVariants (teacher §3 table)', () => {
  it('collocation hints', () => {
    expect(vocabVariants('迷う [道に〜]')).toMatchObject({ variants: ['迷う'], hints: ['道に'] });
    expect(vocabVariants('かける [迷惑を〜]')).toMatchObject({ variants: ['かける'], hints: ['迷惑を'] });
    expect(vocabVariants('[〜を]ください')).toMatchObject({ variants: ['ください'], hints: ['を'] });
  });

  it('optional text, both with and without', () => {
    expect(vocabVariants('[お]花見').variants).toEqual(['花見', 'お花見']);
    expect(vocabVariants('きれい[な]').variants).toEqual(['きれい', 'きれいな']);
    expect(vocabVariants('[どうも]ありがとう[ございます]').variants).toEqual(
      expect.arrayContaining(['ありがとう', 'どうもありがとう', 'ありがとうございます', 'どうもありがとうございます'])
    );
  });

  it('slash pairs split into parts', () => {
    const v = vocabVariants('近い／遠い');
    expect(v.parts.map((p) => p.variants)).toEqual([['近い'], ['遠い']]);
    expect(vocabVariants('よっぽど/よほど').variants).toEqual(['よっぽど', 'よほど']);
  });

  it('reading glosses dropped, affixes flagged, katakana folded', () => {
    expect(vocabVariants('本社（ほんしゃ）／支店').variants).toEqual(['本社', '支店']);
    expect(vocabVariants('〜中').parts[0]).toEqual({ variants: ['中'], affix: true });
    expect(vocabVariants('タクシー').variants).toEqual(['たくしー']);
  });

  it('お/ご alias only before a kanji', () => {
    expect(honorificAlias('お酒')).toBe('酒');
    expect(honorificAlias('ご飯')).toBe('飯');
    expect(honorificAlias('おいしい')).toBeNull();
  });
});

describe('grammarKeys', () => {
  it('strips placeholders and keeps Japanese runs', () => {
    expect(grammarKeys('Vて-form + いただけませんか')).toEqual(['ていただけませんか', 'て', 'いただけませんか']);
    expect(grammarKeys('Aは Bです')).toEqual(['はです', 'は', 'です']);
    expect(grammarKeys('N(time)に V')).toEqual(['に']);
  });

  it('expands optional parentheses and alternatives', () => {
    expect(grammarKeys('〜つつ（も）')).toEqual(['つつ', 'つつも']);
    expect(grammarKeys('〜にしろ／〜にせよ')).toEqual(['にしろ', 'にせよ']);
    expect(grammarKeys('〜（よ）うが')).toEqual(['うが', 'ようが']);
  });

  it('drops Latin parentheses, reading glosses and anything after →', () => {
    expect(grammarKeys('N(place)で V')).toEqual(['で']);
    expect(grammarKeys('上（じょう）')).toEqual(['上']);
    expect(grammarKeys('い-adj（〜い→さ）')).toEqual(['い']);
    expect(grammarKeys(undefined)).toEqual([]);
  });
});

describe('kanjiReadingKeys (three separator styles)', () => {
  it('full reading and stem', () => {
    expect(kanjiReadingKeys('まよ・う')).toEqual({ full: 'まよう', stem: 'まよ' });
    expect(kanjiReadingKeys('たか.い')).toEqual({ full: 'たかい', stem: 'たか' });
    expect(kanjiReadingKeys('な.き-')).toEqual({ full: 'なき', stem: 'な' });
    expect(kanjiReadingKeys('-さん')).toEqual({ full: 'さん' });
    expect(kanjiReadingKeys('メイ')).toEqual({ full: 'めい' });
    expect(kanjiReadingKeys('')).toBeNull();
  });
});

describe('masuToDict (§2.3 rule table)', () => {
  const corpus = new Set(['書く', '借りる', '着る', '帰る', '起きる']);
  const lemma = (w: string, r: string, pos?: string) => masuToDict(w, r, pos, corpus);

  it('te-iru, kuru, suru', () => {
    expect(lemma('住んでいます', 'すんでいます')).toMatchObject({ lemma: '住んでいる', rule: 'te-iru' });
    expect(lemma('来ます', 'きます', 'Verb (Group III)')).toMatchObject({ lemma: '来る', lemmaReading: 'くる', rule: 'kuru' });
    expect(lemma('きます', 'きます', 'Verb (Group III)')).toMatchObject({ lemma: 'くる', rule: 'kuru' });
    expect(lemma('勉強します', 'べんきょうします', 'Verb (Group III)')).toMatchObject({ lemma: '勉強する', rule: 'suru' });
    expect(lemma('勉強します', 'べんきょうします', 'verb')).toMatchObject({ lemma: '勉強する', rule: 'suru' });
  });

  it('pos groups', () => {
    expect(lemma('起きます', 'おきます', 'Verb (Group II)')).toMatchObject({ lemma: '起きる', rule: 'ichidan(pos)' });
    expect(lemma('働きます', 'はたらきます', 'Verb (Group I)')).toMatchObject({ lemma: '働く', lemmaReading: 'はたらく', rule: 'godan(pos)' });
    expect(posGroup('Verb (Group I) (phrase)')).toBe(1);
    expect(posGroup('verb')).toBe(0);
  });

  it('e-row and kanji stems are ichidan', () => {
    expect(lemma('寝ます', 'ねます')).toMatchObject({ lemma: '寝る' });
    expect(lemma('見ます', 'みます')).toMatchObject({ lemma: '見る', rule: 'ichidan(kanji-stem)' });
    expect(lemma('食べます', 'たべます')).toMatchObject({ lemma: '食べる', rule: 'ichidan(e-row)' });
  });

  it('corpus check, exceptions, godan default', () => {
    expect(lemma('借ります', 'かります')).toMatchObject({ lemma: '借りる', rule: 'ichidan(corpus)' });
    expect(lemma('書きます', 'かきます')).toMatchObject({ lemma: '書く', rule: 'godan(corpus)' });
    expect(lemma('浴びます', 'あびます')).toMatchObject({ lemma: '浴びる', rule: 'ichidan(exception)' });
    expect(lemma('歌います', 'うたいます')).toMatchObject({ lemma: '歌う', rule: 'godan(default)' });
  });

  it('set phrases get no lemma', () => {
    expect(isMasuExpression('おめでとうございます', undefined)).toBe(true);
    expect(isMasuExpression('いってきます', 'Expression')).toBe(true);
    expect(masuToDict('食べる', 'たべる', undefined, corpus)).toBeNull();
  });
});
