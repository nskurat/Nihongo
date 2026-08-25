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
- `grammar-app/src/utils/levels.ts` — N5's LESSON_RANGES caps at lesson 15 (`{ min: 1,
  max: 15 }`), but `src/data/n5/{grammar,vocab,kanji}.json` actually contain lessons
  1–25. Any URL or legacy link targeting N5 lesson 16–25 gets silently clamped back to
  lesson 1 by `clampLessonForLevel`, even though that lesson's content exists and
  renders fine once reached by clicking the sidebar. N4 (26–50) and N3 (1–24) configs
  match their data correctly — only N5 is wrong. One-line fix once someone confirms
  25 is the intended max: `N5: { min: 1, max: 25, default: 1 }`.
