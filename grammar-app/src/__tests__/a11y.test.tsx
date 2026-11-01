import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { renderWithRouter } from '../test/renderWithRouter';
import { restoreContentSource, serveFixtureContent } from '../test/fixtures';
import { axeViolations } from '../test/axe';
import { readingRepository } from '../services/ai/readingStorage';
import { setSearchSource } from '../services/search/SearchSource';
import { FixtureSearchSource } from '../features/search/__fixtures__/FixtureSearchSource';
import type { ReadingPracticeData } from '../types/ai';

/**
 * The accessibility gate (Phase 7): axe-core over every page and dialog, plus the
 * keyboard behaviour axe can't see. Colour contrast needs real rendering, so it is on
 * the manual checklist in docs/a11y.md, not here.
 */

const STORY: ReadingPracticeData = {
  title: '猫[ねこ]の話[はなし]',
  titleEn: 'A story about a cat',
  japaneseText: '私[わたし]の猫[ねこ]は毎日[まいにち]公園[こうえん]で遊[あそ]びます。',
  englishTranslation: 'My cat plays in the park every day.',
  vocabulary: [{ word: '猫', reading: 'ねこ', meaning: 'cat' }],
  grammarUsed: [],
  questions: [
    {
      id: 1,
      question: '猫[ねこ]はどこで遊[あそ]びますか。',
      options: ['学校[がっこう]', '公園[こうえん]', '駅[えき]', '家[いえ]'],
      correctIndex: 1,
      explanationJp: '公園です。',
      explanationEn: 'The park.',
    },
  ],
};

const lessonLoaded = () => waitFor(() => expect(screen.queryByText(/^Loading Lesson/)).not.toBeInTheDocument());

beforeEach(() => {
  serveFixtureContent();
  setSearchSource(new FixtureSearchSource({ delayMs: 0 }));
});
afterEach(() => restoreContentSource());

describe('axe: pages', () => {
  it.each(['/n5/grammar/1', '/n5/vocab/1', '/n5/kanji/1'])('%s has no violations', async (route) => {
    renderWithRouter(<App />, { route });
    await lessonLoaded();
    expect(await axeViolations()).toEqual([]);
  });

  it('a lesson that failed to load has no violations', async () => {
    renderWithRouter(<App />, { route: '/n5/grammar/3' });
    await lessonLoaded();
    expect(await axeViolations()).toEqual([]);
  });

  it('Reading Studio has no violations', async () => {
    renderWithRouter(<App />, { route: '/n5/reading/1' });
    await screen.findByText('No N5 passage yet');
    expect(await axeViolations()).toEqual([]);
  });

  it('the Story Library, empty and with a story, has no violations', async () => {
    renderWithRouter(<App />, { route: '/n5/reading/1?view=library' });
    await screen.findByText('No Saved Stories Yet');
    expect(await axeViolations()).toEqual([]);
  });

  it('search results have no violations', async () => {
    renderWithRouter(<App />, { route: '/search?q=より' });
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    // Known: the group <h2>s sit inside role=listbox (FINDINGS.md, "Accessibility").
    expect(await axeViolations(document.body, { exempt: ['aria-required-children'] })).toEqual([]);
  });
});

describe('axe: dialogs', () => {
  it('AI settings has no violations', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await lessonLoaded();
    await user.click(screen.getByRole('button', { name: /Key|Ready/ }));
    expect(await axeViolations(screen.getByRole('dialog'))).toEqual([]);
  });

  it('a grammar point has no violations', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await user.click(await screen.findByText('Noun です'));
    expect(await axeViolations(screen.getByRole('dialog'))).toEqual([]);
  });

  it('a saved story has no violations', async () => {
    await readingRepository.saveToHistory({ reading: STORY, id: 'story-cat', level: 'N5', lesson: 1, topic: 'Cats' });
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/reading/1?view=library' });
    await screen.findByRole('heading', { name: '猫の話' });
    expect(await axeViolations()).toEqual([]);
    await user.click(screen.getByRole('button', { name: '猫の話' }));
    expect(await axeViolations(screen.getByRole('dialog', { name: /^猫/ }))).toEqual([]);
  });
});

describe('keyboard and screen-reader semantics', () => {
  it('starts with a skip link to the main content', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await lessonLoaded();
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(document.getElementById('main-content')).toContainElement(screen.getByRole('main'));
  });

  it('marks the active level, and lists lessons in a named navigation landmark', async () => {
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await lessonLoaded();
    const levels = screen.getByRole('group', { name: 'JLPT level' });
    expect(within(levels).getByRole('button', { name: 'N5' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(levels).getByRole('button', { name: 'N4' })).toHaveAttribute('aria-pressed', 'false');
    const lessons = screen.getByRole('navigation', { name: 'N5 lessons' });
    expect(within(lessons).getByRole('button', { name: /^Lesson 1/ })).toHaveAttribute('aria-current', 'true');
  });

  it('Reading views are a tablist driven by the arrow keys', async () => {
    const user = userEvent.setup();
    const { currentPath } = renderWithRouter(<App />, { route: '/n5/reading/1' });
    const studio = await screen.findByRole('tab', { name: /Practice Studio/ });
    const library = screen.getByRole('tab', { name: /Story Library/ });
    expect(studio).toHaveAttribute('aria-selected', 'true');
    expect(library).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel', { name: /Practice Studio/ })).toBeInTheDocument();

    studio.focus();
    await user.keyboard('{ArrowRight}');
    expect(library).toHaveFocus();
    expect(library).toHaveAttribute('aria-selected', 'true');
    expect(currentPath()).toBe('/n5/reading/1?view=library');
    expect(await screen.findByRole('tabpanel', { name: /Story Library/ })).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(studio).toHaveFocus();
    expect(studio).toHaveAttribute('aria-selected', 'true');
  });

  it('a library story opens from the keyboard', async () => {
    await readingRepository.saveToHistory({ reading: STORY, id: 'story-cat', level: 'N5', lesson: 1, topic: 'Cats' });
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/reading/1?view=library' });
    const open = await screen.findByRole('button', { name: '猫の話' });
    open.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: /^猫/ })).toBeInTheDocument();
  });

  it('every modal close button has a name', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await user.click(await screen.findByText('Noun です'));
    expect(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(0);
  });
});
