import { ReactElement } from 'react';
import { render, RenderResult } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

/** Renders the current router location so tests can assert on navigation. */
function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location" hidden>
      {location.pathname + location.search}
    </output>
  );
}

/**
 * Renders `ui` inside a MemoryRouter at `route`. Every section reads its level,
 * section and lesson from the URL, so they need a router to render at all.
 * `currentPath()` reads where the app has navigated to since.
 */
export function renderWithRouter(
  ui: ReactElement,
  { route = '/' }: { route?: string } = {}
): RenderResult & { currentPath: () => string } {
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>
  );
  return {
    ...result,
    currentPath: () => result.getByTestId('location').textContent ?? '',
  };
}
