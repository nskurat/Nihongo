import { describe, expect, it } from 'vitest';
import { grammarKeys, grammarPatternKeys, patternInQuery, plainForms } from '../keys/grammarKeys';
import { classForType, defaultClassOf, dictClass, masuRuleClass, posClass } from '../keys/wordClass';
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
    expect(grammarKeys('Aは Bです')).toEqual(['はです', 'は', 'です', 'はだ']);
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

describe('plain-form grammar keys (teacher F6)', () => {
  it('adds plain variants of polite titles', () => {
    expect(grammarKeys('Vて-form + しまいました／しまいます')).toEqual(expect.arrayContaining(['てしまう', 'しまう']));
    expect(grammarKeys('…はずです')).toEqual(expect.arrayContaining(['はずだ', 'はず']));
    expect(grammarKeys('Vようにします')).toEqual(expect.arrayContaining(['ようにする']));
    expect(plainForms('なります')).toEqual(['なる']);
    expect(plainForms('でしょう')).toEqual([]);
    expect(plainForms('だろうでしょう')).toEqual(['だろうだろう', 'だろう']);
  });
});

describe('grammar pattern keys', () => {
  it('whole kana runs, no morphemes, no joins across placeholders', () => {
    expect(grammarPatternKeys('〜ずに')).toEqual(['ずに']);
    expect(grammarPatternKeys('N(place)へ 行きます／来ます／帰ります')).toEqual([]);
    expect(grammarPatternKeys('S1か、S2か')).toEqual([]);
    expect(grammarPatternKeys('Verb ない-form')).toEqual([]);
    expect(grammarPatternKeys('〜ば〜ほど')).toEqual(['ば〜ほど', 'ほど']);
  });

  it('matches inside the query (2-kana keys only at the end, sequences in order)', () => {
    expect(patternInQuery('ずに', '読まずに')).toBe(true);
    expect(patternInQuery('かな', 'わけにはいかない')).toBe(false);
    expect(patternInQuery('ば〜ほど', '食べれば食べるほど')).toBe(true);
    expect(patternInQuery('ほど〜ない', '食べれば食べるほど')).toBe(false);
    expect(patternInQuery('ずに', 'ずに')).toBe(false);
  });
});

describe('word class (teacher F1)', () => {
  it('derives class from dictionary forms', () => {
    expect(dictClass('食べる', 'たべる')).toBe('1');
    expect(dictClass('帰る', 'かえる')).toBe('5');
    expect(dictClass('変える', 'かえる')).toBe('1');
    expect(dictClass('知る', 'しる')).toBe('5');
    expect(dictClass('分かる', 'わかる')).toBe('5');
    expect(dictClass('勉強する', 'べんきょうする')).toBe('s');
    expect(dictClass('来る', 'くる')).toBe('k');
    expect(dictClass('書く', 'かく')).toBe('5');
    expect(dictClass('高い', 'たかい')).toBe('in');
    expect(dictClass('いつ', 'いつ')).toBe('5');
    expect(dictClass('本', 'ほん')).toBe('n');
  });

  it('uses pos and ます rules, and maps deinflection types', () => {
    expect(posClass('Verb (Group II)', '起きます')).toBe('1');
    expect(posClass('Verb (Group III)', '来ます')).toBe('k');
    expect(posClass('Interrogative', 'いつ')).toBe('n');
    expect(posClass('verb', '行く')).toBeNull();
    expect(masuRuleClass('godan(corpus)')).toBe('5');
    expect(masuRuleClass('suru')).toBe('s');
    expect(classForType('v1')).toBe('1');
    expect(classForType('plain')).toBeNull();
    expect(defaultClassOf(['勝つ', '負ける'], ['かつ', 'まける'])).toBe('15');
  });

  it('fixes the honorific ます lemmas (teacher F9)', () => {
    const none = new Set<string>();
    for (const [w, lemma] of [['いらっしゃいます', 'いらっしゃる'], ['くださいます', 'くださる'], ['おっしゃいます', 'おっしゃる'], ['なさいます', 'なさる']]) {
      expect(masuToDict(w, w, 'verb', none)?.lemma).toBe(lemma);
    }
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
    expect(lemma('コピーします', 'コピーします', 'verb')).toMatchObject({ lemma: 'コピーする', rule: 'suru' });
  });

  it('one kanji + します is godan す even when the す-form is not in the corpus', () => {
    // Regression: after scripts/dedupe-vocab.ts removed 話す/貸す/返す/回す, the corpus check no
    // longer rescued them and they were read as 話する etc.
    expect(lemma('話します', 'はなします', 'verb')).toMatchObject({ lemma: '話す', lemmaReading: 'はなす' });
    expect(lemma('貸します', 'かします', 'verb')).toMatchObject({ lemma: '貸す' });
    expect(lemma('起こします', 'おこします', 'verb')).toMatchObject({ lemma: '起こす' });
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
