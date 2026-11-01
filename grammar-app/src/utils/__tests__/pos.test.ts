import { describe, expect, it } from 'vitest';
import { posLabel } from '../pos';

describe('posLabel', () => {
  it('labels single values and ／ pairs, passing unknown text through', () => {
    expect(posLabel('verb-godan')).toBe('Verb (Group I, godan)');
    expect(posLabel('verb-ichidan / verb-godan')).toBe('Verb (Group II, ichidan) / Verb (Group I, godan)');
    expect(posLabel('na-adjective')).toBe('な-adjective');
    expect(posLabel('something else')).toBe('something else');
  });
});
