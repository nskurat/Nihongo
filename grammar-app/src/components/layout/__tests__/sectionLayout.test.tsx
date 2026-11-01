import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../App';
import { renderWithRouter } from '../../../test/renderWithRouter';
import { restoreContentSource } from '../../../test/fixtures';
import { BaseContentSource, ContentError } from '../../../services/content/ContentSource';
import { setContentSource } from '../../../services/content/StaticContentSource';
import { sectionTheme, sidebarHeading } from '../sectionTheme';

class FailingSource extends BaseContentSource {
  listLessons(): Promise<never> {
    return Promise.reject(new ContentError('load-failed', 'offline'));
  }
  getItems(): Promise<never> {
    return Promise.reject(new ContentError('load-failed', 'offline'));
  }
  getItem(): Promise<never> {
    return Promise.reject(new ContentError('load-failed', 'offline'));
  }
  search(): Promise<never> {
    return Promise.reject(new ContentError('load-failed', 'offline'));
  }
}

afterEach(() => restoreContentSource());

describe('sidebarHeading', () => {
  it('shows the lesson range once lessons are known', () => {
    expect(sidebarHeading(sectionTheme.grammar, 'N4', [1, 2, 25])).toBe('N4 Lessons (1–25)');
    expect(sidebarHeading(sectionTheme.kanji, 'N3', [3])).toBe('N3 Kanji (3–3)');
  });

  it('shows no range while the list is loading or failed (was a fake "(1–1)")', () => {
    expect(sidebarHeading(sectionTheme.vocab, 'N5', [])).toBe('N5 Vocab');
  });
});

describe('SectionLayout on a failed level', () => {
  it('shows the error panel with Retry and a heading without a range', async () => {
    setContentSource(new FailingSource());
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    expect(await screen.findByText("Couldn't load this lesson")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'N5 Lessons' })).toBeInTheDocument();
    expect(screen.queryByText(/\(1–1\)/)).not.toBeInTheDocument();
  });
});

describe('Retry after a failed chunk', () => {
  it('reloads the page, since the browser would not re-import a failed module', async () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });
    setContentSource(new FailingSource());
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
