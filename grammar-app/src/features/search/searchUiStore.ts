import { create } from 'zustand';

/**
 * Combobox state shared by the header input (owns the keyboard) and the results page
 * (owns the rows). Not persisted: it only lives while the app is open.
 */
export type NavItem =
  | { id: string; kind: 'link'; to: string; state?: unknown }
  | { id: string; kind: 'action'; run: () => void };

interface SearchUiState {
  items: NavItem[];
  activeId: string | null;
  /** Bumps on each arrow-key move (the page scrolls the active row into view only then). */
  moveSeq: number;
  /** Bumps when the result set identity changes (new query/filters). */
  listKey: string;
  /** Row opened last; re-selected when Back returns to the results. */
  lastOpenedId: string | null;
  /** Router path of the results page last shown (for the lesson's "Back to results" label). */
  resultsPath: string;
  setResultsPath: (path: string) => void;
  setItems: (items: NavItem[], listKey: string) => void;
  move: (delta: 1 | -1) => void;
  setActive: (id: string | null) => void;
  markOpened: (id: string) => void;
}

export const useSearchUiStore = create<SearchUiState>()((set, get) => ({
  items: [],
  activeId: null,
  moveSeq: 0,
  listKey: '',
  lastOpenedId: null,
  resultsPath: '',
  setResultsPath: (resultsPath) => set({ resultsPath }),
  setItems: (items, listKey) => {
    const { activeId, lastOpenedId, listKey: prevKey } = get();
    const has = (id: string | null) => !!id && items.some((i) => i.id === id);
    let next: string | null;
    if (has(lastOpenedId)) next = lastOpenedId;
    else if (listKey === prevKey && has(activeId)) next = activeId;
    else next = items[0]?.id ?? null;
    set({ items, listKey, activeId: next, lastOpenedId: has(lastOpenedId) ? null : lastOpenedId });
  },
  move: (delta) => {
    const { items, activeId } = get();
    if (!items.length) return;
    const i = items.findIndex((it) => it.id === activeId);
    const next = i < 0 ? (delta > 0 ? 0 : items.length - 1) : (i + delta + items.length) % items.length;
    set({ activeId: items[next].id, moveSeq: get().moveSeq + 1 });
  },
  setActive: (id) => set({ activeId: id }),
  markOpened: (id) => set({ lastOpenedId: id, activeId: id }),
}));

/**
 * Navigation bookkeeping outside React (read and written only in event handlers): true from
 * the push that enters /search until /search has rendered, so a burst of keystrokes in
 * between replaces that entry instead of pushing several (BUG-07).
 */
export const searchNav = { entering: false };

/** History state set on links opened from the results page (a constant, so rows can memoise). */
export interface FromSearchState {
  fromSearch?: true;
}

export const FROM_SEARCH: FromSearchState = { fromSearch: true };
