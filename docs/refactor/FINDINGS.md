# Findings

Out-of-scope observations noticed while running a phase. One line each: what, where,
why it matters. Do not fix these in-phase — that is what this file is for.

Content warnings emitted by `npm run validate:data` are appended here automatically.

## Open

- `src/data/n3/kanji.json` — `strokes: 0` and empty `radical` throughout the file;
  needs a real kanji data source, not a code fix.
- `src/data/n3/kanji.json` — 迷 has `"meaning": "I lost my way."`, its example sentence
  copied into the meaning field. Likely a generation bug; check sibling rows.
- `grammar-app/index.html` — Google Fonts is loaded from a CDN, which breaks the
  offline-capable premise of the app. Consider self-hosting Inter.
