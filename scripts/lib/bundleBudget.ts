/**
 * Bundle-size budget (Phase 7). Pure: takes the built index.html and a size for each
 * emitted asset, returns what the first page load costs and whether it fits. The CLI
 * in scripts/check-bundle-size.ts does the file reading and gzipping.
 *
 * "Initial" is what every visit downloads before any lazy chunk: the entry script and
 * the scripts and stylesheets index.html references. Every other JS chunk is lazy and
 * is checked against the per-chunk ceiling, which is what catches the old single-file
 * build (all content inlined into one multi-megabyte chunk) coming back.
 */

/**
 * Gzipped bytes (zlib level 9). Phase 7 baseline: initial ≈ 159 KB (Phase 2 recorded ≈ 133 KB
 * before global search), largest lazy chunk ≈ 160 KB (a vocab level). ~25% headroom each; the
 * single-file build this guards against was several MB.
 */
export const BUDGET = {
  initialGzip: 200 * 1024,
  chunkGzip: 200 * 1024,
} as const;

export interface AssetSize {
  /** Path relative to dist/, e.g. `assets/index-abc.js`. */
  file: string;
  gzip: number;
}

export interface BudgetReport {
  initial: AssetSize[];
  initialTotal: number;
  largestLazy: AssetSize | null;
  failures: string[];
}

/**
 * Asset paths the HTML loads up front (`<script src>`, `<link rel=stylesheet|modulepreload>`),
 * relative to dist/ with the deploy base path stripped. External URLs are ignored.
 */
export function initialAssets(html: string, base: string): string[] {
  const refs = new Set<string>();
  const tag = /<(script|link)\b[^>]*>/gi;
  for (const [el, kind] of html.matchAll(tag)) {
    const attr = (name: string) => el.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
    const url = kind.toLowerCase() === 'script' ? attr('src') : attr('href');
    if (!url || /^[a-z]+:\/\//i.test(url)) continue;
    if (kind.toLowerCase() === 'link' && !/^(stylesheet|modulepreload)$/i.test(attr('rel') ?? '')) continue;
    const rel = url.startsWith(base) ? url.slice(base.length) : url.replace(/^\//, '');
    refs.add(rel);
  }
  return [...refs];
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

export function checkBudget(
  html: string,
  base: string,
  assets: AssetSize[],
  budget: { initialGzip: number; chunkGzip: number } = BUDGET
): BudgetReport {
  const byFile = new Map(assets.map((a) => [a.file, a]));
  const failures: string[] = [];

  const initialFiles = initialAssets(html, base);
  const initial: AssetSize[] = [];
  for (const file of initialFiles) {
    const asset = byFile.get(file);
    if (asset) initial.push(asset);
    else failures.push(`index.html references ${file}, which is not in the build output`);
  }
  const initialTotal = initial.reduce((sum, a) => sum + a.gzip, 0);
  if (initialTotal > budget.initialGzip) {
    failures.push(`initial load is ${kb(initialTotal)} gzipped, over the ${kb(budget.initialGzip)} budget`);
  }

  const initialSet = new Set(initialFiles);
  const lazy = assets.filter((a) => a.file.endsWith('.js') && !initialSet.has(a.file));
  const largestLazy = lazy.reduce<AssetSize | null>((max, a) => (!max || a.gzip > max.gzip ? a : max), null);
  for (const a of lazy) {
    if (a.gzip > budget.chunkGzip) {
      failures.push(`${a.file} is ${kb(a.gzip)} gzipped, over the ${kb(budget.chunkGzip)} per-chunk budget`);
    }
  }

  return { initial, initialTotal, largestLazy, failures };
}

export function formatReport(report: BudgetReport, budget = BUDGET): string {
  const lines = [
    `Initial load: ${kb(report.initialTotal)} gzipped (budget ${kb(budget.initialGzip)})`,
    ...report.initial.map((a) => `  ${a.file.padEnd(48)} ${kb(a.gzip)}`),
  ];
  if (report.largestLazy) {
    lines.push(`Largest lazy chunk: ${report.largestLazy.file} ${kb(report.largestLazy.gzip)} (budget ${kb(budget.chunkGzip)})`);
  }
  return lines.join('\n');
}
