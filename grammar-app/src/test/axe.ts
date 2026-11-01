import axe from 'axe-core';

/**
 * Rules jsdom cannot evaluate: it does no layout or painting, so colour contrast
 * (and anything else needing computed rendering) would only produce noise. Those are
 * covered by the manual checklist in docs/a11y.md instead.
 */
const DISABLED_RULES = ['color-contrast', 'color-contrast-enhanced'] as const;

/** One-line summary per violation, readable straight from a failed assertion. */
export function formatViolations(violations: axe.Result[]): string[] {
  return violations.map(
    (v) => `${v.id} (${v.impact ?? 'n/a'}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
  );
}

/**
 * Runs axe-core (WCAG 2.x A/AA + best-practice rules) over `root` and resolves to the
 * violations, formatted. Tests assert `expect(await axeViolations()).toEqual([])` so a
 * failure prints exactly which rule broke and where. `exempt` switches off further rules
 * for one call; every use must point at its open entry in docs/backlog.md (none today).
 */
export async function axeViolations(
  root: Element = document.body,
  { exempt = [] }: { exempt?: string[] } = {}
): Promise<string[]> {
  const results = await axe.run(root, {
    rules: Object.fromEntries([...DISABLED_RULES, ...exempt].map((id) => [id, { enabled: false }])),
    resultTypes: ['violations'],
  });
  return formatViolations(results.violations);
}
