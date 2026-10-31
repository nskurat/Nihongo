/** Pure keyboard predicates for the global search shortcuts (03-ux §4.3). */

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

/** IME composition in progress (Safari reports keyCode 229 without isComposing on the last key). */
export function isComposingKey(e: Pick<KeyLike, 'isComposing' | 'keyCode'>): boolean {
  return !!e.isComposing || e.keyCode === 229;
}

/** `/` (no modifiers) or Ctrl/Cmd+K. */
export function isSearchShortcut(e: KeyLike): boolean {
  if (isComposingKey(e)) return false;
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) return true;
  return (e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey;
}

/** Whether focus is somewhere typing should go to (inputs, textareas, editable content). */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (el as HTMLElement).isContentEditable === true;
}
