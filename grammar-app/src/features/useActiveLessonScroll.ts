import { useEffect, useRef } from 'react';

/**
 * Keeps the active lesson button visible inside its scrollable lesson list
 * (horizontal strip on mobile, vertical list on desktop) without scrolling the page.
 * `lessonCount` re-runs the effect once the list has actually rendered.
 */
export function useActiveLessonScroll<T extends HTMLElement>(activeLesson: number, lessonCount: number) {
  const listRef = useRef<T>(null);

  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !active) return;
    const listBox = list.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    list.scrollLeft += box.left - listBox.left - (listBox.width - box.width) / 2;
    list.scrollTop += box.top - listBox.top - (listBox.height - box.height) / 2;
  }, [activeLesson, lessonCount]);

  return listRef;
}
