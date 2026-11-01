import { describe, expect, it } from 'vitest';
import { checkBudget, initialAssets } from '../../../../scripts/lib/bundleBudget';

const HTML = `<!doctype html><html><head>
  <link rel="icon" type="image/svg+xml" href="/Nihongo/favicon.svg" />
  <script type="module" crossorigin src="/Nihongo/assets/index-a.js"></script>
  <link rel="modulepreload" crossorigin href="/Nihongo/assets/vendor-b.js">
  <link rel="stylesheet" crossorigin href="/Nihongo/assets/index-c.css">
  <link rel="preconnect" href="https://fonts.example.com">
</head><body><div id="root"></div></body></html>`;

const KB = 1024;
const budget = { initialGzip: 100 * KB, chunkGzip: 50 * KB };

describe('initialAssets', () => {
  it('collects the entry script, modulepreloads and stylesheets, minus the base path', () => {
    expect(initialAssets(HTML, '/Nihongo/')).toEqual(['assets/index-a.js', 'assets/vendor-b.js', 'assets/index-c.css']);
  });

  it('works for a root base path too', () => {
    expect(initialAssets('<script type="module" src="/assets/x.js"></script>', '/')).toEqual(['assets/x.js']);
  });
});

describe('checkBudget', () => {
  const sizes = (index: number, lazy: number) => [
    { file: 'assets/index-a.js', gzip: index * KB },
    { file: 'assets/vendor-b.js', gzip: 30 * KB },
    { file: 'assets/index-c.css', gzip: 10 * KB },
    { file: 'assets/grammar-d.js', gzip: lazy * KB },
  ];

  it('passes a build within budget and reports the initial total and largest lazy chunk', () => {
    const r = checkBudget(HTML, '/Nihongo/', sizes(40, 20), budget);
    expect(r.failures).toEqual([]);
    expect(r.initialTotal).toBe(80 * KB);
    expect(r.largestLazy?.file).toBe('assets/grammar-d.js');
  });

  it('fails when the initial load is over budget (e.g. content inlined into the entry again)', () => {
    const r = checkBudget(HTML, '/Nihongo/', sizes(70, 20), budget);
    expect(r.failures).toEqual(['initial load is 110.0 KB gzipped, over the 100.0 KB budget']);
  });

  it('fails when one lazy chunk is over the per-chunk budget', () => {
    const r = checkBudget(HTML, '/Nihongo/', sizes(40, 60), budget);
    expect(r.failures).toEqual(['assets/grammar-d.js is 60.0 KB gzipped, over the 50.0 KB per-chunk budget']);
  });

  it('fails when the HTML references a file the build did not emit', () => {
    const r = checkBudget(HTML, '/Nihongo/', sizes(40, 20).slice(1), budget);
    expect(r.failures).toEqual(['index.html references assets/index-a.js, which is not in the build output']);
  });
});
