import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../ErrorBoundary';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('boom');
  return <p>Recovered content</p>;
}

const quietConsole = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>Fine</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('Fine')).toBeInTheDocument();
  });

  it('replaces a crashed subtree with an alert offering recovery, and logs to the console only', () => {
    const consoleError = quietConsole();
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to start page' })).toHaveAttribute('href', import.meta.env.BASE_URL);
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it('"Try again" re-renders the children', async () => {
    quietConsole();
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>
    );
    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears itself when resetKey changes (navigating away)', () => {
    quietConsole();
    shouldThrow = true;
    const { rerender } = render(
      <ErrorBoundary resetKey="/n5/grammar/1">
        <Flaky />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    rerender(
      <ErrorBoundary resetKey="/n5/grammar/2">
        <Flaky />
      </ErrorBoundary>
    );
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });
});
