import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import App from '../../../App';
import { renderWithRouter } from '../../../test/renderWithRouter';
import { restoreContentSource, serveFixtureContent } from '../../../test/fixtures';
import { SECTIONS } from '../../../utils/sections';
import { isSectionAvailable } from '../../../utils/levels';

beforeEach(() => serveFixtureContent());
afterEach(() => restoreContentSource());

describe('Header section tabs', () => {
  it('renders one tab per registry entry the level has, marking the current one', async () => {
    renderWithRouter(<App />, { route: '/n5/vocab/1' });
    await screen.findByText('学生');
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const tabs = within(nav).getAllByRole('button');
    expect(tabs.map((t) => t.textContent)).toEqual(
      SECTIONS.filter((s) => isSectionAvailable('N5', s.id)).map((s) => s.label)
    );
    expect(within(nav).getByRole('button', { name: 'Vocabulary' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: 'Grammar' })).not.toHaveAttribute('aria-current');
  });
});
