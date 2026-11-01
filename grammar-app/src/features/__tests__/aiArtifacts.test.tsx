import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { renderWithRouter } from '../../test/renderWithRouter';
import { restoreContentSource, serveFixtureContent } from '../../test/fixtures';
import { mockAi } from '../../test/mockAi';
import { blockedFetch } from '../../test/setup.node';
import { getRegisteredProviders, retryPolicy, setStoredApiKey } from '../../services/ai/registry';
import { aiErrorFromStatus } from '../../services/ai/errors';
import { useAiArtifactStore, useAiUiStore } from '../../store/useAiStore';
import { useAiArtifacts } from '../useAiArtifacts';

const EXAMPLES = (jp: string) => JSON.stringify({ examples: [{ jp, en: 'An example.' }] });
const card = (title: string) => screen.getByText(title).closest('[data-uid]') as HTMLElement;

beforeEach(() => {
  serveFixtureContent();
  retryPolicy.delayMs = 0;
  useAiArtifactStore.setState({ artifacts: {} });
  useAiUiStore.setState({ pending: {}, errors: {}, showKeyModal: false, apiError: '' });
});
afterEach(() => restoreContentSource());

describe('AI artifacts on study cards', () => {
  it('two rapid clicks send one request; the result is cached and shown', async () => {
    const user = userEvent.setup();
    const ai = mockAi('Use です politely.');
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await screen.findByText('Noun です');
    const button = within(card('Noun です')).getByRole('button', { name: /Explain Nuances/ });
    await Promise.all([user.click(button), user.click(button)]);
    expect(await within(card('Noun です')).findByText('Use です politely.')).toBeInTheDocument();
    expect(ai.respond).toHaveBeenCalledTimes(1);
    expect(useAiArtifactStore.getState().artifacts['grammar-nuance:n5-grammar-1-1'].data).toBe('Use です politely.');
  });

  it('grammar examples accumulate across presses', async () => {
    const user = userEvent.setup();
    mockAi(EXAMPLES('学生です。'), EXAMPLES('先生です。'));
    renderWithRouter(<App />, { route: '/n5/grammar/1' });
    await screen.findByText('Noun です');
    const more = () => within(card('Noun です')).getByRole('button', { name: /More Examples/ });
    await user.click(more());
    await within(card('Noun です')).findByText('学生です。');
    await user.click(more());
    await within(card('Noun です')).findByText('先生です。');
    expect(within(card('Noun です')).getByText('学生です。')).toBeInTheDocument();
  });

  it('a 500 then a 200 shows the result after one retry', async () => {
    const user = userEvent.setup();
    setStoredApiKey('gemini', 'test-key-not-real');
    const spies = getRegisteredProviders().map((p) =>
      vi
        .spyOn(p, 'executePrompt')
        .mockRejectedValueOnce(aiErrorFromStatus(p.name, 500))
        .mockResolvedValueOnce('Mnemonic: the sun rises.')
    );
    renderWithRouter(<App />, { route: '/n5/kanji/1' });
    await screen.findByText('day, sun');
    await user.click(within(card('day, sun')).getByRole('button', { name: /Create Mnemonic Story/ }));
    expect(await screen.findByText('Mnemonic: the sun rises.')).toBeInTheDocument();
    expect(spies.reduce((n, s) => n + s.mock.calls.length, 0)).toBe(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a rejected key shows an inline error on that card, and the button can try again', async () => {
    const user = userEvent.setup();
    setStoredApiKey('gemini', 'test-key-not-real');
    getRegisteredProviders().forEach((p) =>
      vi.spyOn(p, 'executePrompt').mockRejectedValue(aiErrorFromStatus(p.name, 401, 'API key not valid'))
    );
    renderWithRouter(<App />, { route: '/n5/vocab/1' });
    await screen.findByText('学生');
    const studentCard = () => screen.getByText('学生').closest('[data-uid]') as HTMLElement;
    const button = within(studentCard()).getByRole('button', { name: /Explain Usage/ });
    await user.click(button);
    expect(await within(studentCard()).findByRole('alert')).toHaveTextContent('The API key was rejected');
    expect(button).toBeEnabled();
    expect(blockedFetch).not.toHaveBeenCalled();
  });

  it('no key opens AI settings instead of an inline error', async () => {
    const user = userEvent.setup();
    renderWithRouter(<App />, { route: '/n5/vocab/1' });
    await screen.findByText('学生');
    await user.click(within(card('学生')).getByRole('button', { name: /Explain Usage/ }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'AI Provider Settings' })).toBeInTheDocument());
    expect(screen.queryByText(/key was rejected/)).not.toBeInTheDocument();
  });
});

describe('useAiArtifacts', () => {
  it('a second generate while one is in flight joins it instead of calling again', async () => {
    const { result } = renderHook(() => useAiArtifacts('vocab-help'));
    let release: (v: string) => void = () => {};
    const producer = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = result.current.generate('n5-vocab-1-1', producer);
      second = result.current.generate('n5-vocab-1-1', producer);
    });
    expect(second).toBe(first);
    expect(producer).toHaveBeenCalledTimes(1);
    await act(async () => {
      release('a note');
      await first;
    });
    expect(result.current.get('n5-vocab-1-1')).toBe('a note');
    expect(result.current.isLoading('n5-vocab-1-1')).toBe(false);
  });
});

describe('persisted cache', () => {
  it('a v7 cache in localStorage rehydrates with every entry intact', async () => {
    localStorage.setItem(
      'ai-generation-cache',
      JSON.stringify({
        version: 7,
        state: {
          generatedExamples: { 'n5-grammar-1-1': [{ jp: '学生です。', en: 'I am a student.' }] },
          aiExplanations: { 'n5-grammar-1-1': 'nuance' },
          aiVocabNotes: { 'n5-vocab-1-1': 'usage' },
          aiKanjiMnemonics: { 'n5-kanji-1-1': 'sun story' },
        },
      })
    );
    await useAiArtifactStore.persist.rehydrate();
    const { artifacts } = useAiArtifactStore.getState();
    expect(Object.keys(artifacts).sort()).toEqual([
      'grammar-examples:n5-grammar-1-1',
      'grammar-nuance:n5-grammar-1-1',
      'kanji-mnemonic:n5-kanji-1-1',
      'vocab-help:n5-vocab-1-1',
    ]);
    // Written back in the new shape
    expect(JSON.parse(localStorage.getItem('ai-generation-cache')!).version).toBe(8);
  });
});
