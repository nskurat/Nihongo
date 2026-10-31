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
  /** Bumps when the result set identity changes (new query/filters). */
  listKey: string;
  /** Row opened last; re-selected when Back returns to the results. */
  lastOpenedId: string | null;
  setItems: (items: NavItem[], listKey: string) => void;
  move: (delta: 1 | -1) => void;
  setActive: (id: string | null) => void;
  markOpened: (id: string) => void;
}

export const useSearchUiStore = create<SearchUiState>()((set, get) => ({
  items: [],
  activeId: null,
  listKey: '',
  lastOpenedId: null,
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
    set({ activeId: items[next].id });
  },
  setActive: (id) => set({ activeId: id }),
  markOpened: (id) => set({ lastOpenedId: id, activeId: id }),
}));
