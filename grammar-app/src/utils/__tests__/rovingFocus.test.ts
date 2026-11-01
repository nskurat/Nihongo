import { describe, expect, it } from 'vitest';
import { rovingIndex } from '../rovingFocus';

describe('rovingIndex', () => {
  it('moves with the arrows of its orientation and wraps at both ends', () => {
    expect(rovingIndex('ArrowRight', 0, 3)).toBe(1);
    expect(rovingIndex('ArrowRight', 2, 3)).toBe(0);
    expect(rovingIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(rovingIndex('ArrowDown', 0, 3, 'vertical')).toBe(1);
    expect(rovingIndex('ArrowUp', 0, 3, 'vertical')).toBe(2);
  });

  it('jumps to the ends with Home and End', () => {
    expect(rovingIndex('Home', 2, 3)).toBe(0);
    expect(rovingIndex('End', 0, 3)).toBe(2);
  });

  it('ignores keys it does not handle, including the other orientation', () => {
    expect(rovingIndex('ArrowDown', 0, 3)).toBeNull();
    expect(rovingIndex('ArrowRight', 0, 3, 'vertical')).toBeNull();
    expect(rovingIndex('Enter', 0, 3)).toBeNull();
    expect(rovingIndex('ArrowRight', 0, 0)).toBeNull();
  });
});
