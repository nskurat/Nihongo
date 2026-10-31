import { describe, expect, it } from 'vitest';
import { enTokens, foldPlural, phraseText, queryForms, queryTerms } from '../english';
import { englishRanges } from '../engine/SearchEngine';

describe('English tokens', () => {
  it('folds plurals on the index side only', () => {
    expect(foldPlural('cities')).toBe('city');
    expect(foldPlural('boxes')).toBe('box');
    expect(foldPlural('cats')).toBe('cat');
    expect(foldPlural('glass')).toBe('glass');
    expect(foldPlural('bus')).toBe('bus');
    expect(foldPlural('analysis')).toBe('analysis');
  });

  it('drops stopwords and possessive -s', () => {
    expect(enTokens("lose [one's way]")).toEqual(['lose', 'way']);
    expect(enTokens('to be lost, the cats')).toEqual(['lost', 'cat']);
    expect(enTokens(undefined)).toEqual([]);
  });

  it('expands query forms without touching even/event', () => {
    expect(queryForms('lost')).toContain('lose');
    expect(queryForms('went')).toContain('go');
    expect(queryForms('studied')).toContain('study');
    expect(queryForms('making')).toContain('make');
    expect(queryForms('running')).toContain('run');
    expect(queryForms('even')).toEqual(['even']);
    expect(queryForms('even')).not.toContain('event');
  });

  it('removes stopwords from queries and builds phrases', () => {
    expect(queryTerms('in addition')).toEqual(['addition']);
    expect(queryTerms('not only')).toEqual(['not', 'only']);
    expect(phraseText('Not only… but also')).toBe(' not only but also ');
  });

  it('finds whole-word ranges for highlights', () => {
    expect(englishRanges('lost child, getting lost', new Set(['lost']))).toEqual([[0, 4], [20, 24]]);
    expect(englishRanges('an event', new Set(['even']))).toEqual([]);
    expect(englishRanges('two cats', new Set(['cat']))).toEqual([[4, 8]]);
  });
});
