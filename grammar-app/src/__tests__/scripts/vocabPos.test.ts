import { describe, expect, it } from 'vitest';
import { isPosValue, mapPosPart, normalisePos, verbPosForRule } from '../../../../scripts/lib/vocabPos';

describe('vocab pos normalisation', () => {
  it('maps legacy spellings onto the closed set', () => {
    expect(mapPosPart('Noun')).toBe('noun');
    expect(mapPosPart('noun')).toBe('noun');
    expect(mapPosPart('Verb (Group I) (phrase)')).toBe('verb-godan');
    expect(mapPosPart('Verb (Group II)')).toBe('verb-ichidan');
    expect(mapPosPart('Verb (Group III)')).toBe('verb-irregular');
    expect(mapPosPart('い-Adjective (phrase)')).toBe('i-adjective');
    expect(mapPosPart('な-adjective')).toBe('na-adjective');
    expect(mapPosPart('Noun (interrogative)')).toBe('interrogative');
    expect(mapPosPart('Grammar Pattern')).toBe('pattern');
    expect(mapPosPart('Expression')).toBe('expression');
    expect(mapPosPart('verb')).toBeNull();
  });

  it('groups a bare verb from its lemma rule, part by part', () => {
    expect(normalisePos('verb', ['ichidan(e-row)'], 1)).toBe('verb-ichidan');
    expect(normalisePos('verb', ['godan(corpus)', 'ichidan(e-row)'], 2)).toBe('verb-godan / verb-ichidan');
    expect(normalisePos('verb', ['suru', 'suru'], 2)).toBe('verb-irregular');
    expect(normalisePos('Verb (Group II) / Verb (Group I)', [], 2)).toBe('verb-ichidan / verb-godan');
    expect(verbPosForRule('te-iru')).toBe('verb-ichidan');
  });

  it('refuses to guess', () => {
    expect(() => normalisePos('verb', [], 1)).toThrow();
    expect(() => normalisePos('Adjectival thing', [], 1)).toThrow();
  });

  it('validates stored values', () => {
    expect(isPosValue('verb-godan / verb-ichidan')).toBe(true);
    expect(isPosValue('Verb (Group I)')).toBe(false);
  });
});
