/**
 * Keyboard model for a one-dimensional composite widget (a WAI-ARIA tablist, a
 * segmented control): which item a key moves to, or null when the key is not one the
 * widget handles. Arrows wrap; Home / End jump to the ends.
 */
export function rovingIndex(
  key: string,
  current: number,
  count: number,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
): number | null {
  if (count <= 0) return null;
  const [prev, next] = orientation === 'horizontal' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
  switch (key) {
    case prev:
      return (current - 1 + count) % count;
    case next:
      return (current + 1) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
