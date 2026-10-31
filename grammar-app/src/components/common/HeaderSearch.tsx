import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { prefetchSearchIndex } from '../../features/search/searchClient';
import { searchNav, useSearchUiStore } from '../../features/search/searchUiStore';
import { isComposingKey, isSearchShortcut, isTypingTarget } from '../../features/search/keyboard';
import {
  EMPTY_SEARCH_STATE,
  parseSearchParams,
  SEARCH_PATH,
  serializeSearchState,
  toAbsoluteHref,
  withQuery,
} from '../../features/search/searchUrl';
import { S } from '../../features/search/strings';

interface HeaderSearchProps {
  /** True on /search. */
  onSearch: boolean;
  /** ≥ md viewport. */
  isDesktop: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

/** History state marking a /search entry pushed from inside the app (so Esc/← can go Back). */
export interface SearchEntryState {
  searchEntry?: boolean;
}

function hasModalOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"], [role="dialog"], [role="alertdialog"]');
}

/**
 * The single global search field (03-ux §1). It lives in the header, outside <Routes>, so
 * it keeps focus and caret while the route changes beneath it. The URL is the source of
 * truth for `q`; the input mirrors it except while the user is composing with an IME.
 */
export default function HeaderSearch({ onSearch, isDesktop, inputRef }: HeaderSearchProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const lastLesson = useAppStore((s) => s.lastLesson);
  const rankLevel = lastLesson.level;
  const prefetch = () => prefetchSearchIndex(rankLevel);
  const items = useSearchUiStore((s) => s.items);
  const activeId = useSearchUiStore((s) => s.activeId);
  const move = useSearchUiStore((s) => s.move);
  const markOpened = useSearchUiStore((s) => s.markOpened);

  const urlQ = onSearch ? (new URLSearchParams(location.search).get('q') ?? '') : '';
  const [value, setValue] = useState(urlQ);
  const [syncedQ, setSyncedQ] = useState(urlQ);
  // Values this input wrote to the URL that the router hasn't reflected back yet.
  const [pending, setPending] = useState<string[]>([]);
  const composing = useRef(false);
  // Set by the push that enters /search; until the router has rendered /search, further
  // keystrokes replace that entry instead of pushing more (BUG-07: fast typing / paste).
  useEffect(() => {
    searchNav.entering = false;
  }, [onSearch]);

  // Mirror URL → input only when q changes from outside (Back, hint chips, leaving search).
  // Our own writes arrive asynchronously and may lag fast typing, so they are ignored.
  if (urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    const i = pending.indexOf(urlQ);
    if (i >= 0) setPending(pending.slice(i + 1));
    else {
      setPending([]);
      if (urlQ !== value) setValue(urlQ);
    }
  }

  const commit = (q: string) => {
    const nextUrlQ = onSearch || q.trim() ? q : urlQ;
    if (nextUrlQ !== urlQ) setPending((p) => [...p, nextUrlQ]);
    const entry: SearchEntryState = { searchEntry: true };
    if (onSearch || searchNav.entering) {
      // On /search (or already on the way there): replace, keeping filters for a refined query.
      const base = onSearch ? parseSearchParams(new URLSearchParams(location.search)).state : EMPTY_SEARCH_STATE;
      const qs = serializeSearchState(withQuery(base, q)).toString();
      navigate(qs ? `${SEARCH_PATH}?${qs}` : SEARCH_PATH, { replace: true, state: onSearch ? location.state : entry });
    } else if (q.trim()) {
      searchNav.entering = true;
      navigate(`${SEARCH_PATH}?${serializeSearchState({ ...EMPTY_SEARCH_STATE, q })}`, { state: entry });
    }
  };

  const leaveSearch = () => {
    inputRef.current?.blur();
    if ((location.state as SearchEntryState | null)?.searchEntry) navigate(-1);
    else navigate(`/${lastLesson.level.toLowerCase()}/${lastLesson.section}/${lastLesson.lesson}`);
  };

  // The field was focused while visually hidden (mobile, before search mode rendered).
  // Chromium can leave the caret stuck at 0 after the resize; put it back at the end.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!onSearch || !input || document.activeElement !== input) return;
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [onSearch, inputRef]);

  // Global `/` and Ctrl/Cmd+K.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!isSearchShortcut(e)) return;
      if (isTypingTarget(document.activeElement) || hasModalOpen()) return;
      e.preventDefault();
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
      prefetchSearchIndex(rankLevel);
      if (!isDesktop && !onSearch && !searchNav.entering) {
        searchNav.entering = true;
        const entry: SearchEntryState = { searchEntry: true };
        navigate(SEARCH_PATH, { state: entry });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [inputRef, isDesktop, onSearch, navigate, rankLevel]);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    if (composing.current || (e.nativeEvent as InputEvent).isComposing) return;
    commit(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (composing.current || isComposingKey(e.nativeEvent)) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (!onSearch || !items.length) return;
        e.preventDefault();
        move(e.key === 'ArrowDown' ? 1 : -1);
        return;
      case 'Enter': {
        e.preventDefault();
        if (!onSearch) {
          commit(value);
          return;
        }
        if (!isDesktop) {
          // The phone keyboard's Search key reveals the results; it does not open row 1.
          inputRef.current?.blur();
          return;
        }
        const item = items.find((i) => i.id === activeId);
        if (!item) return;
        if (item.kind === 'action') {
          item.run();
          return;
        }
        if (e.ctrlKey || e.metaKey) {
          window.open(toAbsoluteHref(item.to), '_blank', 'noopener');
          return;
        }
        markOpened(item.id);
        navigate(item.to, { state: item.state });
        return;
      }
      case 'Escape':
        e.preventDefault();
        if (value) {
          setValue('');
          commit('');
        } else if (onSearch) {
          leaveSearch();
        } else {
          inputRef.current?.blur();
        }
        return;
    }
  };

  const clear = () => {
    setValue('');
    commit('');
    inputRef.current?.focus();
  };

  // Mobile lesson page: the field stays mounted (so a tap can focus it synchronously) but
  // is visually hidden and out of the tab order; the title-row icon opens it.
  const hiddenOnMobile = !isDesktop && !onSearch;
  const expanded = onSearch && items.length > 0;

  return (
    <div
      className={
        hiddenOnMobile
          ? 'absolute left-4 right-4 top-0 opacity-0 pointer-events-none -z-10'
          : 'flex items-center gap-1 w-full md:w-72 lg:w-80 md:ml-auto max-md:py-2 shrink-0'
      }
    >
      {onSearch && !isDesktop && (
        <button
          type="button"
          onClick={leaveSearch}
          aria-label={S.back}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <div className="relative flex-1 group">
        <Search
          size={16}
          aria-hidden="true"
          className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
            onSearch && !isDesktop ? 'text-slate-400' : 'text-indigo-200 group-focus-within:text-slate-400'
          }`}
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={S.fieldLabel}
          aria-expanded={expanded}
          aria-controls="search-results"
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeId ? activeId : undefined}
          tabIndex={hiddenOnMobile ? -1 : undefined}
          placeholder={S.fieldPlaceholder}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={prefetch}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(e) => {
            composing.current = false;
            commit(e.currentTarget.value);
          }}
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className={`w-full rounded-lg pl-9 pr-10 py-1.5 max-md:py-2 text-sm max-md:text-[16px] border transition-colors focus:outline-none [&::-webkit-search-cancel-button]:hidden ${
            onSearch && !isDesktop
              ? 'bg-white text-slate-800 placeholder:text-slate-500 border-white focus:ring-2 focus:ring-white/60'
              : 'bg-white/10 border-white/20 text-white placeholder:text-indigo-200 focus:bg-white focus:text-slate-800 focus:placeholder:text-slate-500 focus:ring-2 focus:ring-white/60'
          }`}
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label={S.clear}
            className={`absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 max-md:w-10 max-md:h-10 flex items-center justify-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              onSearch && !isDesktop ? 'text-slate-500 hover:text-slate-800' : 'text-indigo-200 group-focus-within:text-slate-500 hover:text-slate-800'
            }`}
          >
            <X size={16} />
          </button>
        ) : (
          isDesktop && (
            <kbd
              aria-hidden="true"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 border border-white/30 rounded px-1.5 text-[11px] text-indigo-100 font-sans group-focus-within:hidden"
            >
              {S.kbdHint}
            </kbd>
          )
        )}
      </div>
    </div>
  );
}

/** Mobile title-row icon that opens search (03-ux §1.2). */
export function MobileSearchButton({ onOpen }: { onOpen: () => void }) {
  const rankLevel = useAppStore((s) => s.lastLesson.level);
  const prefetch = () => prefetchSearchIndex(rankLevel);
  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={prefetch}
      aria-label={S.fieldLabel}
      className="md:hidden w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
    >
      <Search size={20} />
    </button>
  );
}

