import { describe, expect, it } from 'vitest';
import { deinflect, MAX_DEPTH } from '../deinflect';
import { DEINFLECT_RULES } from '../deinflectRules';

const lemmas = (w: string) => deinflect(w).map((d) => d.lemma);
const path = (w: string, lemma: string) => deinflect(w).find((d) => d.lemma === lemma)?.steps.map((s) => s.en);

describe('deinflect', () => {
  it('has a rule table in the teacher-scoped size', () => {
    expect(DEINFLECT_RULES.length).toBeGreaterThan(60);
    for (const r of DEINFLECT_RULES) expect(r.from.length).toBeGreaterThan(0);
  });

  const cases: [string, string, string[]][] = [
    ['わかります', 'わかる', ['polite']],
    ['食べません', '食べる', ['polite negative']],
    ['行きました', '行く', ['polite past']],
    ['食べませんでした', '食べる', ['polite past negative']],
    ['勉強します', '勉強する', ['polite']],
    ['来ます', '来る', ['polite']],
    ['いらっしゃいます', 'いらっしゃる', ['polite']],
    ['食べない', '食べる', ['negative']],
    ['書かない', '書く', ['negative']],
    ['こない', 'くる', ['negative']],
    ['食べなかった', '食べる', ['negative', 'past']],
    ['書いて', '書く', ['te-form']],
    ['泳いだ', '泳ぐ', ['past']],
    ['読んだ', '読む', ['past']],
    ['行って', '行く', ['te-form']],
    ['話した', '話す', ['past']],
    ['きた', 'くる', ['past']],
    ['食べたい', '食べる', ['want to (たい)']],
    ['飲みたくない', '飲む', ['want to (たい)', 'negative']],
    ['食べられない', '食べる', ['potential/passive', 'negative']],
    ['書ける', '書く', ['potential']],
    ['書かれる', '書く', ['passive']],
    ['書かせる', '書く', ['causative']],
    ['待たされた', '待つ', ['causative-passive', 'past']],
    ['食べさせられなかった', '食べる', ['causative-passive', 'negative', 'past']],
    ['行こう', '行く', ['volitional']],
    ['食べよう', '食べる', ['volitional']],
    ['書けば', '書く', ['conditional (ば)']],
    ['書いたら', '書く', ['conditional (たら)']],
    ['読まずに', '読む', ['without (ずに)']],
    ['食べている', '食べる', ['te-form', 'ongoing/state (ている)']],
    ['書いてある', '書く', ['te-form', 'resultative (てある)']],
    ['高かった', '高い', ['past']],
    ['寒くて', '寒い', ['te-form']],
    ['高くない', '高い', ['negative']],
    ['高ければ', '高い', ['conditional (ば)']],
    ['よかった', 'いい', ['past']],
    ['勉強する', '勉強', ['する-verb']],
    ['ない', 'ある', ['negative']],
  ];
  it.each(cases)('%s → %s', (word, lemma, steps) => {
    expect(lemmas(word)).toContain(lemma);
    expect(path(word, lemma)).toEqual(steps);
  });

  it('over-generates ambiguous forms (the caller filters by the index)', () => {
    expect(lemmas('かえって')).toEqual(expect.arrayContaining(['かえる', 'かえう', 'かえつ']));
    expect(lemmas('きた')).toEqual(expect.arrayContaining(['きる', 'くる']));
  });

  it('never exceeds the depth limit and never returns the input', () => {
    for (const d of deinflect('食べさせられなかった')) expect(d.steps.length).toBeLessThanOrEqual(MAX_DEPTH);
    expect(lemmas('食べる')).not.toContain('食べる');
    expect(lemmas('ます')).not.toContain('る');
  });

  it('orders shorter paths first', () => {
    const depths = deinflect('食べられなかった').map((d) => d.steps.length);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
  });
});
