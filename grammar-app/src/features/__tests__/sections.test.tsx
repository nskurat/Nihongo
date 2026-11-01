import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { renderWithRouter } from '../../test/renderWithRouter';
import { restoreContentSource, serveFixtureContent } from '../../test/fixtures';

/**
 * Characterization tests: what the section pages do today, quirks included.
 * They are Phase 4's safety net - if one fails after a refactor, behaviour
 * changed. Update them only for a change that is meant to be visible.
 */

const sidebar = () => screen.getByRole('heading', { level: 2, name: /Lessons \(/ }).closest('div.bg-white') as HTMLElement;

beforeEach(() => serveFixtureContent());
afterEach(() => restoreContentSource());

describe('Grammar section shell', () => {
  it('shows a loading skeleton before the lesson data arrives', async () => {
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    expect(screen.getByText('Loading Lesson 1…')).toBeInTheDocument();
    expect(await screen.findByText('Noun です')).toBeInTheDocument();
    expect(screen.queryByText('Loading Lesson 1…')).not.toBeInTheDocument();
  });

  it('renders the lesson list from listLessons, with per-lesson counts', async () => {
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    expect(await screen.findByRole('heading', { name: 'N5 Lessons (1–2)' })).toBeInTheDocument();
    const lessons = within(sidebar()).getAllByRole('button', { name: /^Lesson \d+/ });
    expect(lessons.map((b) => b.textContent)).toEqual(['Lesson 12', 'Lesson 21']);
    expect(lessons[0]).toHaveAttribute('aria-current', 'true');
    expect(lessons[1]).not.toHaveAttribute('aria-current');
  });

  it('navigates when a lesson is clicked', async () => {
    const user = userEvent.setup();
    const { currentPath } = renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await user.click(await screen.findByRole('button', { name: /^Lesson 2/ }));
    expect(currentPath()).toBe('/n5/grammar/2');
    expect(await screen.findByText('Question か')).toBeInTheDocument();
    expect(screen.queryByText('Noun です')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Lesson 2' })).toBeInTheDocument();
  });

  it('filters the lesson by the search box and shows "x of y"', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await screen.findByText('Noun です');
    expect(screen.getByText('2 Patterns')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /filter this lesson/i }), 'not');
    expect(screen.getByText('Noun じゃありません')).toBeInTheDocument();
    expect(screen.queryByText('Noun です')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 2 Patterns')).toBeInTheDocument();
  });

  it('shows the empty state when the search matches nothing', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await screen.findByText('Noun です');
    await user.type(screen.getByRole('textbox', { name: /filter this lesson/i }), 'zzz');
    expect(screen.getByText('No grammar patterns found')).toBeInTheDocument();
    expect(screen.getByText('No results match your search "zzz" in Lesson 1.')).toBeInTheDocument();
  });

  it('shows the "being prepared" empty state for a lesson with no items', async () => {
    // Lesson 3 is in N5's range (1–25) but the fixture has no rows for it.
    renderWithRouter(<App />, { route: '/n5/grammar/3' });
    expect(await screen.findByText('Grammar patterns for Lesson 3 are currently being prepared.')).toBeInTheDocument();
  });
});

describe('Vocab and Kanji sections (smoke)', () => {
  it('vocab renders its lesson rows', async () => {
    renderWithRouter(<App />, { route: '/n5/vocab/1' });
    expect(await screen.findByText('学生')).toBeInTheDocument();
    expect(screen.getByText('先生')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'N5 Vocab (1–1)' })).toBeInTheDocument();
  });

  it('kanji renders its cards, with — for a compound whose meaning is missing', async () => {
    renderWithRouter(<App />, { route: '/n5/kanji/1' });
    expect(await screen.findByText('日')).toBeInTheDocument();
    expect(screen.getByText('日本')).toBeInTheDocument();
    expect(screen.getByText('Japan')).toBeInTheDocument();
    const missing = screen.getByText('本気').closest('li') as HTMLElement;
    expect(within(missing).getByText('—')).toBeInTheDocument();
  });
});

describe('Header level switch', () => {
  it('keeps the section and an in-range lesson (N3 lesson 24 → N4 lesson 24)', async () => {
    const user = userEvent.setup();
    const { currentPath } = renderWithRouter(<App />, { route: '/n3/grammar/24' });
    await screen.findByText('ものの');
    await user.click(screen.getByRole('button', { name: 'N4' }));
    expect(currentPath()).toBe('/n4/grammar/24');
    expect(await screen.findByText('Verb ば')).toBeInTheDocument();
  });

  it("resets an out-of-range lesson to the new level's default, not its maximum (N1 30 → N4 1)", async () => {
    const user = userEvent.setup();
    const { currentPath } = renderWithRouter(<App />, { route: '/n1/grammar/30' });
    await screen.findByText('をもって');
    await user.click(screen.getByRole('button', { name: 'N4' }));
    expect(currentPath()).toBe('/n4/grammar/1');
    expect(await screen.findByText('Verb たことがある')).toBeInTheDocument();
  });

  it('keeps a section the new level has (vocab stays vocab)', async () => {
    const user = userEvent.setup();
    const { currentPath } = renderWithRouter(<App />, { route: '/n5/vocab/1' });
    await screen.findByText('学生');
    await user.click(screen.getByRole('button', { name: 'N4' }));
    expect(currentPath()).toBe('/n4/vocab/1');
  });
});
