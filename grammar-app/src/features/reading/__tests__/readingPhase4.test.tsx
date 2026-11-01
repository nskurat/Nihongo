import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../App';
import { renderWithRouter } from '../../../test/renderWithRouter';
import { restoreContentSource, serveFixtureContent } from '../../../test/fixtures';
import { BaseContentSource, ContentError } from '../../../services/content/ContentSource';
import { setContentSource } from '../../../services/content/StaticContentSource';
import { readingRepository } from '../../../services/ai/readingStorage';

/** Behaviour Phase 4 changed on purpose (the Phase 3 characterization tests cover the rest). */

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

describe('Reading Studio after Phase 4', () => {
  it('says when the level lessons failed to load instead of silently offering none', async () => {
    setContentSource(new FailingSource());
    renderWithRouter(<App />, { route: '/n5/reading/1' });
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the N5 lessons");
    // General passages still work: the generator is there
    expect(screen.getByRole('button', { name: /Generate N5 Reading Material/ })).toBeEnabled();
  });

  it('closes the story reader on Escape', async () => {
    serveFixtureContent();
    await readingRepository.saveToHistory({
      reading: {
        title: '猫の話',
        japaneseText: '私の猫は毎日公園で遊びます。とても元気です。',
        questions: [{ id: 1, question: '質問', options: ['A', 'B'], correctIndex: 0, explanationJp: '説明' }],
      },
      id: 'story-1',
      level: 'N5',
      lesson: 1,
      topic: 'Cats',
    });
    renderWithRouter(<App />, { route: '/n5/reading/1?view=library' });
    await userEvent.click(await screen.findByRole('heading', { name: '猫の話' }));
    const dialog = screen.getByRole('dialog', { name: '猫の話' });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
