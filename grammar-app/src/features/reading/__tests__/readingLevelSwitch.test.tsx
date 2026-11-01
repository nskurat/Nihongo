import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../App';
import { renderWithRouter } from '../../../test/renderWithRouter';
import { restoreContentSource, serveFixtureContent } from '../../../test/fixtures';
import { getRegisteredProviders, setStoredApiKey } from '../../../services/ai/registry';
import { aiErrorFromStatus } from '../../../services/ai/errors';

/**
 * docs/reading-library-nav-ux.md acceptance criteria that were only code-reviewed until
 * Phase 3's harness existed: a generation started on one level and finished after the
 * learner switched level lands on (and only on) the level it was made for.
 */

const PASSAGE = JSON.stringify({
  title: '猫[ねこ]の話[はなし]',
  japaneseText: '私[わたし]の猫[ねこ]は毎日[まいにち]公園[こうえん]で遊[あそ]びます。とても元気[げんき]です。',
  questions: [{ id: 1, question: '質問', options: ['A', 'B'], correctIndex: 0, explanationJp: '説明' }],
});

/** Every provider answers with one promise the test settles by hand. */
function holdProviderReply() {
  let resolve!: (text: string) => void;
  let reject!: (err: unknown) => void;
  const reply = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  setStoredApiKey('gemini', 'test-key-not-real');
  getRegisteredProviders().forEach((p) => vi.spyOn(p, 'executePrompt').mockReturnValue(reply));
  return { resolve, reject };
}

beforeEach(() => serveFixtureContent());
afterEach(() => restoreContentSource());

describe('Reading generation across a level switch', () => {
  it('a passage finishing after N5 → N4 lands on N5, not on the N4 page', async () => {
    const user = userEvent.setup();
    const reply = holdProviderReply();
    const { currentPath } = renderWithRouter(<App />, { route: '/n5/reading/1' });

    await user.click(await screen.findByRole('button', { name: /Generate N5 Reading Material/ }));
    await user.click(screen.getByRole('button', { name: 'N4' }));
    expect(currentPath()).toBe('/n4/reading/1');
    // N4 shows the other level's generation is busy, not a passage
    expect(await screen.findByRole('button', { name: /Generating N5 passage/ })).toBeDisabled();

    await act(async () => reply.resolve(PASSAGE));
    expect(await screen.findByText('No N4 passage yet')).toBeInTheDocument();
    expect(screen.queryByText('N4 Passage')).not.toBeInTheDocument();
    expect(screen.queryByText('N5 Passage')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'N5' }));
    expect(await screen.findByText('N5 Passage')).toBeInTheDocument();
  });

  it('an error from the N5 generation stays on N5', async () => {
    const user = userEvent.setup();
    const reply = holdProviderReply();
    renderWithRouter(<App />, { route: '/n5/reading/1' });

    await user.click(await screen.findByRole('button', { name: /Generate N5 Reading Material/ }));
    await user.click(screen.getByRole('button', { name: 'N4' }));
    await screen.findByRole('button', { name: /Generating N5 passage/ });

    await act(async () => reply.reject(aiErrorFromStatus('Gemini', 400, 'Model overloaded')));
    expect(await screen.findByRole('button', { name: /Generate N4 Reading Material/ })).toBeEnabled();
    expect(screen.queryByText('Generation Error')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'N5' }));
    expect(await screen.findByText('Generation Error')).toBeInTheDocument();
    expect(screen.getByText(/Model overloaded/)).toBeInTheDocument();
  });
});
