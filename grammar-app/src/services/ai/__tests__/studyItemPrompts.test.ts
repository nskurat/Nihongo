// Study-item AI prompts (grammar examples / nuance, vocab usage, kanji mnemonic) and
// their output cleanup. Prompts are built from real repo rows; nothing calls a provider
// (the registry test at the bottom stubs fetch).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  GRAMMAR_EXAMPLE_COUNT,
  STUDY_LEVEL_RULES,
  getGrammarExamplesPrompt,
  getKanjiMnemonicPrompt,
} from '../prompts';
import {
  UNREADABLE_RESPONSE,
  cleanMarkdownNote,
  formatKanjiReadings,
  grammarExamplesPromptFor,
  grammarNuancePromptFor,
  kanjiMnemonicPromptFor,
  parseGrammarExamples,
  relatedGrammarTitles,
  splitVocabHeadword,
  vocabHelpPromptFor,
} from '../studyItems';
import { GrammarItem, KanjiItem, LevelType, VocabItem } from '../../../types/japanese';
import n5Grammar from '../../../data/n5/grammar.json';
import n4Grammar from '../../../data/n4/grammar.json';
import n3Grammar from '../../../data/n3/grammar.json';
import n2Grammar from '../../../data/n2/grammar.json';
import n1Grammar from '../../../data/n1/grammar.json';
import n5Vocab from '../../../data/n5/vocab.json';
import n3Vocab from '../../../data/n3/vocab.json';
import n1Vocab from '../../../data/n1/vocab.json';
import n5Kanji from '../../../data/n5/kanji.json';
import n3Kanji from '../../../data/n3/kanji.json';
import n1Kanji from '../../../data/n1/kanji.json';

type Rows<T> = Record<string, T[]>;
const LEVELS: LevelType[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const GRAMMAR: Record<LevelType, Rows<GrammarItem>> = {
  N5: n5Grammar as unknown as Rows<GrammarItem>,
  N4: n4Grammar as unknown as Rows<GrammarItem>,
  N3: n3Grammar as unknown as Rows<GrammarItem>,
  N2: n2Grammar as unknown as Rows<GrammarItem>,
  N1: n1Grammar as unknown as Rows<GrammarItem>,
};

function row<T extends { uid: string }>(data: unknown, uid: string): T {
  const found = Object.values(data as Rows<T>).flat().find((r) => r.uid === uid);
  if (!found) throw new Error(`missing fixture row ${uid}`);
  return found;
}

const n5Vehicle = row<GrammarItem>(n5Grammar, 'n5-grammar-5-3'); // N(vehicle)で 行きます
const n1NaiMademo = row<GrammarItem>(n1Grammar, 'n1-grammar-3-2'); // 〜ないまでも

describe('grammar examples prompt', () => {
  it('N5 lesson 5: lesson ceiling, short sentences, plain Japanese, JSON object contract', () => {
    const { prompt, known } = grammarExamplesPromptFor(n5Vehicle, 'N5');
    expect(prompt).toContain('Pattern: N(vehicle)で 行きます／来ます／帰ります');
    expect(prompt).toContain('studied N5 Lessons 1–5 only');
    expect(prompt).toMatch(/never use them in Japanese sentences: .*て-form \(Lesson 14\).*dictionary form \(Lesson 18\)/);
    expect(prompt).toContain('at most 25 Japanese characters');
    expect(prompt).toContain('Polite です/ます style');
    expect(prompt).toContain('no furigana or readings in [] or （）');
    expect(prompt).toContain(`write ${GRAMMAR_EXAMPLE_COUNT} new example sentences`);
    // OpenAI JSON mode needs the word JSON and returns objects only.
    expect(prompt).toContain('one JSON object only');
    expect(prompt).toContain('{"examples":[{"jp":"…","en":"…"}');
    // The data's own examples are listed so they are not repeated.
    expect(known).toEqual(n5Vehicle.examples!.map((e) => e.jp));
    for (const jp of known) expect(prompt).toContain(`• ${jp}`);
  });

  it('N1: no Minna lesson scope, longer sentences, register follows the pattern', () => {
    const { prompt } = grammarExamplesPromptFor(n1NaiMademo, 'N1');
    expect(prompt).toContain('Structure: Verb (ない-form) + までも');
    expect(prompt).toContain('Function: Concession / Contrast; Degree / Extent');
    expect(prompt).not.toContain('Minna');
    expect(prompt).not.toContain('Not taught yet');
    expect(prompt).toContain('at most 65 Japanese characters');
    expect(prompt).toContain('register the pattern really lives in');
  });

  it('N4 lessons map onto Minna 26–50; N5 late lessons have nothing left to forbid', () => {
    const n4 = getGrammarExamplesPrompt({ title: '〜たら', meaning: 'if', structure: 'V-たら', level: 'N4', lesson: 10 });
    expect(n4).toContain('Minna no Nihongo Lessons 26–35');
    const n5late = getGrammarExamplesPrompt({ title: 'x', meaning: 'y', structure: 'x', level: 'N5', lesson: 25 });
    expect(n5late).toContain('Lessons 1–25');
    expect(n5late).not.toContain('Not taught yet');
  });

  it('passes earlier AI examples and caps the list, newest kept', () => {
    const previous = Array.from({ length: 12 }, (_, i) => ({ jp: `文${i}です。`, en: `s${i}` }));
    const { prompt, known } = grammarExamplesPromptFor(n1NaiMademo, 'N1', previous);
    expect(known).toHaveLength(14);
    expect(prompt).toContain('文11です。');
    expect(prompt).not.toContain('文3です。');
  });

  it('cuts a long multi-sentence meaning to its first sentence', () => {
    const p = getGrammarExamplesPrompt({
      title: '〜と',
      meaning: 'Expresses a general condition. Second sentence that should not appear.',
      structure: 'V-dict + と',
      level: 'N4',
    });
    expect(p).toContain('Meaning: Expresses a general condition.');
    expect(p).not.toContain('Second sentence');
  });

  it('example sentence length rises with the level', () => {
    const caps = LEVELS.map((l) => STUDY_LEVEL_RULES[l].maxSentenceChars);
    expect([...caps].sort((a, b) => a - b)).toEqual(caps);
  });
});

describe('grammar nuance prompt', () => {
  it('N5: offers same-lesson, same-function patterns and asks for contrast, minimal pairs and a mistake', () => {
    const prompt = grammarNuancePromptFor(n5Vehicle, 'N5', GRAMMAR.N5['5']);
    expect(prompt).toContain('similar function: N(place)へ 行きます／来ます／帰ります, N(person/animal)と V');
    expect(prompt).not.toContain('いつ,'); // different tags
    expect(prompt).toContain('**Nuance:**');
    expect(prompt).toContain('**Compared with:**');
    expect(prompt).toContain('taken from N5 or lower levels');
    expect(prompt).toContain('minimal pair');
    expect(prompt).toContain('**Common mistake:**');
    expect(prompt).toContain('Example from the lesson: 電車で行きます。');
    expect(prompt).toContain('studied N5 Lessons 1–5 only');
    expect(prompt).toContain('Never use square brackets');
    expect(prompt).toContain('every Japanese word or phrase with kanji');
  });

  it('N1: readings only beyond N3, no Minna scope', () => {
    const prompt = grammarNuancePromptFor(n1NaiMademo, 'N1', GRAMMAR.N1['3']);
    expect(prompt).toContain('similar function: 〜ならいざしらず');
    expect(prompt).toContain('words with kanji beyond N3 only');
    expect(prompt).not.toContain('Minna');
    expect(prompt).toContain('At most 160 words');
  });

  it('related patterns ignore other lessons/levels and untagged items', () => {
    const other = { ...GRAMMAR.N5['5'][0], uid: 'n5-grammar-6-9', lesson: 6 };
    expect(relatedGrammarTitles(n5Vehicle, [other])).toEqual([]);
    expect(relatedGrammarTitles({ ...n5Vehicle, tags: [] }, GRAMMAR.N5['5'])).toEqual([]);
    expect(relatedGrammarTitles(n5Vehicle)).toEqual([]);
  });
});

describe('vocab usage prompt', () => {
  it('N5 ます-form headword: lesson ceiling, card example not reused', () => {
    const v = row<VocabItem>(n5Vocab, 'n5-vocab-5-3'); // 帰ります
    const prompt = vocabHelpPromptFor(v, 'N5');
    expect(prompt).toContain('Word: 帰ります（かえります）');
    expect(prompt).toContain('listed in ます-form');
    expect(prompt).toContain('do not reuse it): うちへ帰ります。');
    expect(prompt).toContain('Part of speech: Verb (Group I)');
    expect(prompt).toContain('studied N5 Lessons 1–5 only');
    for (const label of ['**Usage:**', '**Collocations:**', '**Watch out:**', '**Example:**']) {
      expect(prompt).toContain(label);
    }
  });

  it('bracket notes leave the headword: collocation → hint, optional part → （）', () => {
    expect(splitVocabHeadword('取る [ノートを〜]')).toEqual({ word: '取る', usageHint: 'ノートを〜' });
    expect(splitVocabHeadword('[お]花見')).toEqual({ word: '（お）花見', usageHint: undefined });
    expect(splitVocabHeadword('平凡 [な]').word).toBe('平凡（な）');
    const prompt = vocabHelpPromptFor(row<VocabItem>(n3Vocab, 'n3-vocab-8-3'), 'N3');
    expect(prompt).toContain('Word: 取る（とる）');
    expect(prompt).toContain('Typical use: ノートを〜');
    expect(prompt).toContain('Meaning: take (notes)');
    expect(prompt).not.toMatch(/\[ノート|\[notes\]/);
  });

  it('N1: no ます note, no Minna scope, readings only beyond N3', () => {
    const prompt = vocabHelpPromptFor(row<VocabItem>(n1Vocab, 'n1-vocab-5-1'), 'N1');
    expect(prompt).toContain('Word: 獲物（えもの）');
    expect(prompt).not.toContain('ます-form');
    expect(prompt).not.toContain('Minna');
    expect(prompt).toContain('words with kanji beyond N3 only');
    expect(prompt).not.toContain('Example already on the card');
  });
});

describe('kanji mnemonic prompt', () => {
  it('N5 休: radical, readings and compounds from the data; memory aid, not etymology', () => {
    const prompt = kanjiMnemonicPromptFor(row<KanjiItem>(n5Kanji, 'n5-kanji-4-7'), 'N5');
    expect(prompt).toContain('KANJI (JLPT N5): 休');
    expect(prompt).toContain('Radical: 人 (person)');
    expect(prompt).toContain('Readings: On: キュウ | Kun: やす.む');
    expect(prompt).toContain('休み（やすみ）break, rest, day off');
    expect(prompt).toContain('memory aid, not history');
    expect(prompt).toContain('Use only the readings listed');
    expect(prompt).toContain("**Don't confuse:**");
    expect(prompt).toContain('Name only real components');
  });

  it('N3 kunyomi separators are unified and compound notes stripped', () => {
    const k = row<KanjiItem>(n3Kanji, 'n3-kanji-3-1'); // 悲, compound 悲観的 reading "ひかんてき [な]"
    expect(formatKanjiReadings(k)).toBe('On: ヒ | Kun: かな.しい');
    const prompt = kanjiMnemonicPromptFor(k, 'N3');
    expect(prompt).toContain('悲観的（ひかんてき）');
    expect(prompt).not.toContain('[な]');
  });

  it('N1 盤: on-reading only, at most 4 compounds, affix compounds dropped', () => {
    const prompt = kanjiMnemonicPromptFor(row<KanjiItem>(n1Kanji, 'n1-kanji-5-1'), 'N1');
    expect(prompt).toContain('Readings: On: バン (');
    expect(prompt).toContain('基盤（きばん）');
    expect(prompt).toContain('words with kanji beyond N3 only');
    const many = getKanjiMnemonicPrompt({
      kanji: '時',
      meaning: 'time',
      readings: 'On: ジ',
      level: 'N5',
      compounds: [
        { word: '〜時', reading: '〜じ', meaning: "o'clock" },
        ...['時間', '時計', '時々', '当時', '時代'].map((w) => ({ word: w, reading: 'x', meaning: 'm' })),
      ],
    });
    expect(many).not.toContain('〜時（');
    expect(many).toContain('当時');
    expect(many).not.toContain('時代');
    expect(many).not.toContain('starting with the radical');
  });
});

describe('every level builds clean prompts from real rows', () => {
  it.each(LEVELS)('%s', (level) => {
    const lessons = Object.values(GRAMMAR[level]);
    for (const g of [lessons[0][0], lessons[lessons.length - 1][0]]) {
      for (const p of [grammarExamplesPromptFor(g, level).prompt, grammarNuancePromptFor(g, level, lessons[0])]) {
        expect(p).not.toMatch(/undefined|null|\[object/);
        expect(p).toContain(`JLPT ${level}`);
        expect(p).toContain(`Level ceiling (JLPT ${level})`);
      }
    }
  });
});

describe('parseGrammarExamples', () => {
  const ok = { examples: [{ jp: 'バスで来ました。', en: 'I came by bus.' }] };

  it('accepts the object contract, a bare array, fences and surrounding prose', () => {
    expect(parseGrammarExamples(JSON.stringify(ok))).toEqual(ok.examples);
    expect(parseGrammarExamples(JSON.stringify(ok.examples))).toEqual(ok.examples);
    expect(parseGrammarExamples('```json\n' + JSON.stringify(ok) + '\n```')).toEqual(ok.examples);
    expect(parseGrammarExamples('Here you go:\n' + JSON.stringify(ok) + '\nEnjoy!')).toEqual(ok.examples);
  });

  it('drops malformed or non-Japanese rows, strips bracket furigana, caps the count', () => {
    const raw = JSON.stringify({
      examples: [
        { jp: '自転車[じてんしゃ]で行[い]きます。', en: 'I go by bike.' },
        { jp: '', en: 'empty' },
        { jp: 'jitensha de ikimasu', en: 'romaji' },
        { jp: 'タクシーで帰ります。' },
        'string row',
        { jp: '電車で来ます。', en: 'a' },
        { jp: 'バスで行きます。', en: 'b' },
        { jp: 'ふねで行きます。', en: 'c' },
      ],
    });
    const out = parseGrammarExamples(raw);
    expect(out).toHaveLength(GRAMMAR_EXAMPLE_COUNT);
    expect(out[0]).toEqual({ jp: '自転車で行きます。', en: 'I go by bike.' });
    expect(out.map((e) => e.jp)).not.toContain('ふねで行きます。');
  });

  it('removes sentences the learner has already seen (ignoring punctuation/space)', () => {
    const raw = JSON.stringify({
      examples: [
        { jp: '電車で行きます', en: 'dup of data' },
        { jp: 'バスで来ました。', en: 'new' },
        { jp: 'バスで 来ました！', en: 'dup within reply' },
      ],
    });
    expect(parseGrammarExamples(raw, ['電車で行きます。'])).toEqual([{ jp: 'バスで来ました。', en: 'new' }]);
  });

  it('returns [] for an unexpected shape and a friendly error for non-JSON', () => {
    expect(parseGrammarExamples('{"sentences": []}')).toEqual([]);
    expect(() => parseGrammarExamples('Sorry, I cannot help.')).toThrow(UNREADABLE_RESPONSE);
    expect(() => parseGrammarExamples('{"examples": [')).toThrow(UNREADABLE_RESPONSE);
  });
});

describe('cleanMarkdownNote', () => {
  it('unwraps a whole-reply code fence and turns bracket furigana into （reading）', () => {
    expect(cleanMarkdownNote('```markdown\n**Usage:** 道[みち]に迷[まよ]う\n```')).toBe('**Usage:** 道（みち）に迷（まよ）う');
  });

  it('leaves Markdown links and ordinary text alone', () => {
    const md = '**Parts:** 亻 + 木 — see [jisho](https://jisho.org)';
    expect(cleanMarkdownNote(md)).toBe(md);
  });
});

describe('registry wiring (fetch stubbed, no provider reached)', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub(reply: string) {
    const fetchMock = vi.fn(async (...args: [url: string, init: { body: string }]) => {
      void args;
      return {
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: reply }] } }] }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k === 'nihongo_ai_key_gemini' ? 'test-key' : null),
      setItem: () => {},
      removeItem: () => {},
    });
    return fetchMock;
  }

  function sentPrompt(fetchMock: ReturnType<typeof stub>): string {
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    return body.contents[0].parts[0].text;
  }

  it('generateGrammarExamples sends earlier examples and filters repeats from the reply', async () => {
    const { generateGrammarExamples } = await import('../registry');
    const fetchMock = stub(
      JSON.stringify({ examples: [{ jp: 'バスで来ました。', en: 'old' }, { jp: 'ふねで行きます。', en: 'new' }] })
    );
    const out = await generateGrammarExamples({
      grammar: n5Vehicle,
      level: 'N5',
      previous: [{ jp: 'バスで来ました。', en: 'old' }],
    });
    expect(out).toEqual([{ jp: 'ふねで行きます。', en: 'new' }]);
    const prompt = sentPrompt(fetchMock);
    expect(prompt).toContain('• バスで来ました。');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).generationConfig).toEqual({
      responseMimeType: 'application/json',
    });
  });

  it('generateKanjiMnemonic cleans the note it returns', async () => {
    const { generateKanjiMnemonic } = await import('../registry');
    const fetchMock = stub('**Reading hook:** 休[やす]み');
    const out = await generateKanjiMnemonic({ kanji: row<KanjiItem>(n5Kanji, 'n5-kanji-4-7'), level: 'N5' });
    expect(out).toBe('**Reading hook:** 休（やす）み');
    expect(sentPrompt(fetchMock)).toContain('KANJI (JLPT N5): 休');
  });
});
