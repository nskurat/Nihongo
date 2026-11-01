import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../App';
import { renderWithRouter } from '../../../test/renderWithRouter';
import { restoreContentSource, serveFixtureContent } from '../../../test/fixtures';
import { mockAi } from '../../../test/mockAi';
import { blockedFetch } from '../../../test/setup.node';
import { readingRepository } from '../../../services/ai/readingStorage';
import type { ReadingPracticeData } from '../../../types/ai';

/**
 * Characterization tests for Reading Studio and the Story Library - the file
 * Phase 4 cuts apart. They pin today's behaviour, quirks included.
 */

const story = (title: string, titleEn: string, text: string, questions = 2): ReadingPracticeData => ({
  title,
  titleEn,
  japaneseText: text,
  englishTranslation: 'An English translation of the passage.',
  vocabulary: [{ word: '猫', reading: 'ねこ', meaning: 'cat' }],
  grammarUsed: [],
  questions: Array.from({ length: questions }, (_, i) => ({
    id: i + 1,
    question: `質問[しつもん]${i + 1}`,
    options: ['学校[がっこう]', '公園[こうえん]', '駅[えき]', '家[いえ]'],
    correctIndex: 1,
    explanationJp: `答[こた]えは公園です (${i + 1})`,
    explanationEn: `The answer is the park (${i + 1}).`,
  })),
});

const CAT = story('猫[ねこ]の話[はなし]', 'A story about a cat', '私[わたし]の猫[ねこ]は毎日[まいにち]公園[こうえん]で遊[あそ]びます。とても元気[げんき]です。');
const TRAIN = story('電車[でんしゃ]の旅[たび]', 'A train trip', '週末[しゅうまつ]に電車[でんしゃ]で京都[きょうと]へ行[い]きました。楽[たの]しかったです。');

/** A Studio question card, found by its prompt (rendered with furigana: base + reading). */
const questionCard = (n: number) =>
  (screen.getAllByRole('heading', { level: 4 }).find((h) => h.textContent === `質問しつもん${n}`) as HTMLElement).closest(
    'div.p-5'
  ) as HTMLElement;

const option = (scope: HTMLElement, text: string) =>
  within(scope).getAllByRole('button').find((b) => b.textContent?.includes(text)) as HTMLElement;

beforeEach(() => serveFixtureContent());
afterEach(() => restoreContentSource());

describe('Reading Studio flow', () => {
  it('generates a passage with a mocked provider, then quizzes and archives it', async () => {
    const user = userEvent.setup();
    const ai = mockAi(JSON.stringify(CAT));
    const { container } = renderWithRouter(<App />, { route: '/n5/reading/1' });

    expect(await screen.findByText('No N5 passage yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Generate N5 Reading Material/ }));

    // Passage renders, with furigana as real <ruby>/<rt>
    expect(await screen.findByText('N5 Passage')).toBeInTheDocument();
    expect(screen.getByText('A story about a cat')).toBeInTheDocument();
    const rubies = [...container.querySelectorAll('ruby')].map((r) => r.textContent);
    expect(rubies).toEqual(expect.arrayContaining(['猫ねこ', '毎日まいにち', '公園こうえん']));
    expect(container.querySelector('ruby rt')?.textContent).toBe('ねこ');

    // One provider call, prompt built for N5, never the network
    expect(ai.respond).toHaveBeenCalledTimes(1);
    expect(ai.respond.mock.calls[0][0]).toContain('N5');
    expect(blockedFetch).not.toHaveBeenCalled();

    // Answering reveals the explanation and starts the score
    const q1 = questionCard(1);
    expect(within(q1).queryByText(/Explanation & Evidence/)).not.toBeInTheDocument();
    await user.click(option(q1, '公園'));
    expect(within(q1).getByText(/Explanation & Evidence/)).toBeInTheDocument();
    expect(screen.getByText('Score: 1 / 2 (50%)')).toBeInTheDocument();

    // The English explanation is behind a toggle
    expect(within(q1).queryByText('The answer is the park (1).')).not.toBeInTheDocument();
    await user.click(within(q1).getByRole('button', { name: /English Translation/ }));
    expect(within(q1).getByText('The answer is the park (1).')).toBeInTheDocument();

    // A wrong answer still counts as answered but not correct
    const q2 = questionCard(2);
    await user.click(option(q2, '駅'));
    expect(screen.getByText('Score: 1 / 2 (50%)')).toBeInTheDocument();
    // Answered options lock
    expect(option(q2, '学校')).toBeDisabled();

    // The passage landed in the library, with its progress
    await user.click(screen.getByRole('button', { name: /Story Library/ }));
    expect(await screen.findByRole('heading', { name: '猫の話' })).toBeInTheDocument();
    expect(screen.getByText('1 Stories Saved')).toBeInTheDocument();
    expect(screen.getByText('Current N5')).toBeInTheDocument();
    expect(screen.getByText(/Done 1\/2/)).toBeInTheDocument();
    expect((await readingRepository.getHistory()).map((h) => h.level)).toEqual(['N5']);
  });

  it('shows a Generation Error for an unusable response and keeps the empty state', async () => {
    const user = userEvent.setup();
    mockAi('{"japaneseText": "short"}');
    renderWithRouter(<App />, { route: '/n5/reading/1' });
    await user.click(await screen.findByRole('button', { name: /Generate N5 Reading Material/ }));
    expect(await screen.findByText('Generation Error')).toBeInTheDocument();
    expect(screen.getByText(/"japaneseText" is missing or too short/)).toBeInTheDocument();
    expect(screen.getByText('No N5 passage yet')).toBeInTheDocument();
  });

  it('opens the API key dialog instead of calling a provider when no key is stored', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/reading/1' });
    await user.click(await screen.findByRole('button', { name: /Generate N5 Reading Material/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Generation Error')).not.toBeInTheDocument();
    expect(blockedFetch).not.toHaveBeenCalled();
  });
});

describe('Story Library flow', () => {
  beforeEach(async () => {
    await readingRepository.saveToHistory({ reading: CAT, id: 'story-cat', level: 'N5', lesson: 1, topic: 'Cats' });
    await readingRepository.saveToHistory({ reading: TRAIN, id: 'story-train', level: 'N4', lesson: null, topic: 'Trains' });
  });

  it('filters by level (following the header level by default) and searches by title', async () => {
    const user = userEvent.setup();
    const { currentPath } = renderWithRouter(<App />, { route: '/n5/reading/1?view=library' });

    expect(await screen.findByRole('heading', { name: '猫の話' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '電車の旅' })).not.toBeInTheDocument();
    expect(screen.getByText('1 Stories Saved')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ALL', pressed: false }));
    expect(currentPath()).toBe('/n5/reading/1?view=library&filter=all');
    expect(screen.getByRole('heading', { name: '電車の旅' })).toBeInTheDocument();
    expect(screen.getByText('2 Stories Saved')).toBeInTheDocument();
    expect(screen.getByText(/Showing all levels while you are/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search saved stories...'), '電車');
    expect(screen.getByRole('heading', { name: '電車の旅' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '猫の話' })).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Search saved stories...'));
    await user.type(screen.getByPlaceholderText('Search saved stories...'), 'nothing-matches');
    expect(screen.getByText('No Saved Stories Yet')).toBeInTheDocument();
  });

  it('opens a story in the modal, answers inside it, and the score shows on its card', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/reading/1?view=library' });

    await user.click(await screen.findByRole('heading', { name: '猫の話' }));
    const modal = screen.getByText('N5 Reader').closest('div.relative') as HTMLElement;
    expect(within(modal).getByText('Comprehension Questions (2)')).toBeInTheDocument();
    expect(within(modal).getByText(/An English translation of the passage/)).toBeInTheDocument();

    // Explanations render through FuriganaText, so match on text content (base + reading)
    expect(modal).not.toHaveTextContent('答こたえは公園です (1)');
    await user.click(option(modal, '公園'));
    expect(modal).toHaveTextContent('答こたえは公園です (1)');
    expect(within(modal).getByRole('button', { name: /Start over/ })).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: 'Close Reader' }));
    expect(screen.queryByText('N5 Reader')).not.toBeInTheDocument();
    expect(screen.getByText('1/2 answered')).toBeInTheDocument();
  });

  it('deletes an entry', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/reading/1?view=library&filter=all' });
    await screen.findByRole('heading', { name: '電車の旅' });

    const trainCard = screen.getByRole('heading', { name: '電車の旅' }).closest('div.group') as HTMLElement;
    await user.click(within(trainCard).getByTitle('Delete Story'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: '電車の旅' })).not.toBeInTheDocument());
    expect(screen.getByText('1 Stories Saved')).toBeInTheDocument();
    expect((await readingRepository.getHistory()).map((h) => h.id)).toEqual(['story-cat']);
  });

  it('loads a story back into the studio, keeping its answers', async () => {
    const user = userEvent.setup();
    const { currentPath } = renderWithRouter(<App />, { route: '/n5/reading/1?view=library' });

    await user.click(await screen.findByRole('heading', { name: '猫の話' }));
    const modal = screen.getByText('N5 Reader').closest('div.relative') as HTMLElement;
    await user.click(option(modal, '駅'));
    await user.click(within(modal).getByRole('button', { name: /Open in Studio/ }));

    expect(currentPath()).toBe('/n5/reading/1');
    expect(await screen.findByText('N5 Passage')).toBeInTheDocument();
    expect(screen.getByText('Score: 0 / 2 (0%)')).toBeInTheDocument();
  });

  it('opening another level\'s story switches the header level', async () => {
    const user = userEvent.setup();
    const { currentPath } = renderWithRouter(<App />, { route: '/n5/reading/1?view=library&filter=all' });
    const trainCard = (await screen.findByRole('heading', { name: '電車の旅' })).closest('div.group') as HTMLElement;
    await user.click(within(trainCard).getByRole('button', { name: 'Open in N4 →' }));
    // Quirk: the cross-level path carries no lesson number
    await waitFor(() => expect(currentPath()).toBe('/n4/reading'));
    expect(await screen.findByText('N4 Passage')).toBeInTheDocument();
  });
});
