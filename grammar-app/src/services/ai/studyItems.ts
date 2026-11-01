import { posLabel } from '../../utils/pos';
import { GrammarItem, KanjiItem, LevelType, VocabItem } from '../../types/japanese';
import { getTagMeta } from '../../utils/tags';
import {
  GRAMMAR_EXAMPLE_COUNT,
  GrammarPromptItem,
  getGrammarExamplesPrompt,
  getGrammarNuancePrompt,
  getKanjiMnemonicPrompt,
  getVocabHelpPrompt,
} from './prompts';

/**
 * Pure helpers for the study-item AI buttons (grammar examples and nuance, vocab
 * usage, kanji mnemonic): the context taken from a data row, and the cleanup of
 * what the model sends back. No provider calls here.
 */

export interface GrammarExampleSentence {
  jp: string;
  en: string;
}

export const UNREADABLE_RESPONSE = 'The AI response could not be read. Please try again.';

const MAX_RELATED_PATTERNS = 4;

/**
 * Same-lesson grammar points that share a function tag with `item`. Lessons group
 * confusable patterns, so these are the first candidates for a nuance comparison.
 */
export function relatedGrammarTitles(item: GrammarItem, lessonItems: GrammarItem[] = []): string[] {
  const tags = new Set(item.tags ?? []);
  if (!tags.size) return [];
  return lessonItems
    .filter(
      (g) =>
        g.uid !== item.uid &&
        g.level === item.level &&
        g.lesson === item.lesson &&
        (g.tags ?? []).some((t) => tags.has(t))
    )
    .map((g) => g.title)
    .slice(0, MAX_RELATED_PATTERNS);
}

const BRACKET_NOTE = /\s*[[［]([^\]］]*)[\]］]\s*/g;

/**
 * Vocab headwords carry notes in square brackets (`迷う [道に〜]`, `[お]花見`,
 * `平凡 [な]`). Collocation notes (with 〜) become a usage hint; optional parts stay
 * on the word in full-width parentheses, since square brackets are not used in prompts.
 */
export function splitVocabHeadword(word: string): { word: string; usageHint?: string } {
  const hints: string[] = [];
  const clean = word
    .replace(BRACKET_NOTE, (_, note: string) => {
      if (/[〜～]/.test(note)) {
        hints.push(note);
        return '';
      }
      return `（${note}）`;
    })
    .trim();
  return { word: clean || word.trim(), usageHint: hints.length ? hints.join(', ') : undefined };
}

/** "On: ジ | Kun: とき" with one okurigana separator ('.') across levels. */
export function formatKanjiReadings(kanji: Pick<KanjiItem, 'onyomi' | 'kunyomi'>): string {
  return [
    kanji.onyomi?.length ? `On: ${kanji.onyomi.join(', ')}` : '',
    kanji.kunyomi?.length ? `Kun: ${kanji.kunyomi.map((k) => k.replace(/・/g, '.')).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

/** `漢字[かんじ]` → `漢字`. Grammar example cards render plain text. */
function stripBracketFurigana(text: string): string {
  return text.replace(/[[［][\p{Script=Hiragana}\p{Script=Katakana}ー]+[\]］]/gu, '');
}

function normalise(jp: string): string {
  return jp.replace(/[\s。．.！!？?、,]/g, '');
}

function extractJson(raw: string): unknown {
  const text = raw.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    // Fall back to the outermost object/array if the model wrapped it in prose.
    const start = text.search(/[[{]/);
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (start === -1 || end <= start) throw new Error(UNREADABLE_RESPONSE);
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new Error(UNREADABLE_RESPONSE);
    }
  }
}

/**
 * Parses the "AI: More Examples" response. Accepts the contract
 * `{"examples":[{jp,en}]}` and, for older/looser replies, a bare array. Drops
 * malformed rows, strips bracket furigana, removes sentences the learner has
 * already seen, and caps the count. Throws UNREADABLE_RESPONSE for non-JSON.
 */
export function parseGrammarExamples(raw: string, known: string[] = []): GrammarExampleSentence[] {
  const parsed = extractJson(raw);
  const list: unknown = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
    ? (parsed as { examples?: unknown }).examples
    : undefined;
  if (!Array.isArray(list)) return [];

  const seen = new Set(known.map(normalise));
  const out: GrammarExampleSentence[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const { jp, en } = row as Record<string, unknown>;
    if (typeof jp !== 'string' || typeof en !== 'string') continue;
    const cleanJp = stripBracketFurigana(jp).trim();
    const cleanEn = en.trim();
    if (!cleanJp || !cleanEn || !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(cleanJp)) continue;
    const key = normalise(cleanJp);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ jp: cleanJp, en: cleanEn });
    if (out.length === GRAMMAR_EXAMPLE_COUNT) break;
  }
  return out;
}

/**
 * Cleans a Markdown note (nuance, usage, mnemonic): unwraps a whole-reply code
 * fence and turns stray bracket furigana into the （reading） form MarkdownViewer
 * can show — `[...]` would otherwise be raw text or a broken link.
 */
export function cleanMarkdownNote(raw: string): string {
  let text = raw.trim();
  const fenced = text.match(/^```[a-z]*\n([\s\S]*?)\n?```$/i);
  if (fenced) text = fenced[1].trim();
  return text.replace(
    /([\p{Script=Han}々]+)[[［]([\p{Script=Hiragana}ー]+)[\]］]/gu,
    (_, base: string, reading: string) => `${base}（${reading}）`
  );
}

// -------------------------------------------------------------
// Data row -> prompt. registry.ts sends these; tests build them directly.
// -------------------------------------------------------------

function grammarPromptItem(grammar: GrammarItem, level: LevelType): GrammarPromptItem {
  return {
    title: grammar.title,
    meaning: grammar.meaning,
    structure: grammar.structure,
    level,
    lesson: grammar.lesson,
    tagLabels: (grammar.tags ?? [])
      .map((id) => getTagMeta(id)?.label)
      .filter((label): label is string => Boolean(label)),
  };
}

/** Prompt for "AI: More Examples", plus the sentences the parser must not repeat. */
export function grammarExamplesPromptFor(
  grammar: GrammarItem,
  level: LevelType,
  previous: GrammarExampleSentence[] = []
): { prompt: string; known: string[] } {
  const known = [...(grammar.examples ?? []), ...previous].map((e) => e.jp);
  return {
    prompt: getGrammarExamplesPrompt({ ...grammarPromptItem(grammar, level), knownExamples: known }),
    known,
  };
}

export function grammarNuancePromptFor(
  grammar: GrammarItem,
  level: LevelType,
  lessonItems: GrammarItem[] = []
): string {
  return getGrammarNuancePrompt({
    ...grammarPromptItem(grammar, level),
    relatedPatterns: relatedGrammarTitles(grammar, lessonItems),
    example: grammar.examples?.[0]?.jp,
  });
}

export function vocabHelpPromptFor(vocab: VocabItem, level: LevelType): string {
  const { word, usageHint } = splitVocabHeadword(vocab.word);
  return getVocabHelpPrompt({
    word,
    usageHint,
    reading: vocab.reading.replace(BRACKET_NOTE, '').trim(),
    meaning: vocab.meaning.replace(/\[/g, '(').replace(/\]/g, ')'),
    level,
    lesson: vocab.lesson,
    pos: vocab.pos ? posLabel(vocab.pos) : undefined,
    example: vocab.exampleJp,
  });
}

export function kanjiMnemonicPromptFor(kanji: KanjiItem, level: LevelType): string {
  return getKanjiMnemonicPrompt({
    kanji: kanji.kanji,
    meaning: kanji.meaning,
    radical: kanji.radical,
    readings: formatKanjiReadings(kanji),
    level,
    strokes: kanji.strokes,
    // Compounds with no reading/meaning in the data (150 N4 rows) can't be
    // shown to the model as word（reading）meaning, so they are left out.
    compounds: (kanji.compounds ?? []).flatMap((c) =>
      c.reading !== null && c.meaning !== null ? [{ word: c.word, reading: c.reading, meaning: c.meaning }] : []
    ),
  });
}
