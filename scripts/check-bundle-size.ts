/**
 * Fails (exit 1) when the production build is over its size budget. Run after
 * `npm run build`: `npm run check:bundle`. Budgets and what they measure:
 * scripts/lib/bundleBudget.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { checkBudget, formatReport, type AssetSize } from './lib/bundleBudget';

const DIST = join(import.meta.dirname, '..', 'dist');
const BASE = process.env.VITE_BASE_PATH || '/Nihongo/';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let html: string;
try {
  html = readFileSync(join(DIST, 'index.html'), 'utf8');
} catch {
  console.error('dist/index.html not found: run `npm run build` first.');
  process.exit(1);
}

const assets: AssetSize[] = walk(DIST)
  .filter((p) => /\.(js|css)$/.test(p))
  .map((p) => ({ file: relative(DIST, p).split(sep).join('/'), gzip: gzipSync(readFileSync(p), { level: 9 }).length }));

const report = checkBudget(html, BASE, assets);
console.log(formatReport(report));
if (report.failures.length) {
  console.error(`\nBundle budget exceeded:\n${report.failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('\nBundle budget OK.');
