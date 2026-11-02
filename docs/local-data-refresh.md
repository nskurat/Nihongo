# Local data refresh (run on the owner's laptop)

Two content jobs need downloads that the cloud sandbox can't reach (edrdg.org, tatoeba.org
and GitHub release assets all return 403 there). Run them where the network is open. Both
follow the usual rules (`docs/content-data.md`): vendored, trimmed sources in
`scripts/sources/`, pure logic with unit tests in `scripts/lib/`, no hand edits to
`grammar-app/src/data/`, no paid AI calls, uids never move.

Before and after each job, run: `npm run validate:data && npm run typecheck && npm run lint && npm test`.

---

## A. Refresh JMdict (part of speech)

**Why:** `scripts/sources/jmdict-pos.json` comes from the April 2021 JMdict inside
`jamdict-data` 1.5 on PyPI (the only copy reachable from the sandbox). A current JMdict fixes
5 years of upstream corrections and may match some of the 127 rows that are still blank.

**Source to use:** jmdict-simplified, `jmdict-eng-<version>.json.zip`, from
<https://github.com/scriptin/jmdict-simplified/releases/latest>. Its `partOfSpeech` values
are the same JMdict entity codes we already store (`v5k`, `adj-na`, `n`), so no mapping change
is needed. (EDRDG's `JMdict_e.gz` XML works too but needs entity parsing.)

**Steps:**

1. **Teach the fetch script the new source.** In `scripts/fetch-jmdict-pos.ts`, add
   `--simplified <path-to-jmdict-eng.json>` next to the existing `--db`. It reads `words[]`:
   - `id` becomes `seq`;
   - `kanji[].text` becomes `k`, and `kana[].text` becomes `r`;
   - each `sense[]` becomes `{ p: partOfSpeech, g: gloss[].text.join('; ') }`.

   The selection of entries to keep and the output format stay exactly as they are. Add a
   unit test that converts a two-entry fixture in that shape. Record the version and date in
   `scripts/sources/README.md`, and drop the PyPI pin note.
2. **Run it.** Run `npx tsx scripts/fetch-jmdict-pos.ts --simplified ~/Downloads/jmdict-eng-X.json`,
   then check the `git diff --stat scripts/sources/jmdict-pos.json`. The entry count should be
   close to 9,610.
3. **Re-label rows that came from JMdict, never the hand-labelled ones.** `fill-vocab-pos.ts`
   only fills blanks today, so a refresh alone changes nothing that is already labelled.
   - Add `--relabel`, which recomputes `pos` on every row except the hand-labelled ones.
   - The hand-labelled set is the 571 N5/N4 rows that had `pos` before the JMdict fill, i.e.
     at commit `57bcfd6`. Snapshot their uids once into `scripts/sources/pos-hand-labelled.json`
     (a script reads them from `git show 57bcfd6:…`), so `--relabel` never touches them.
4. **Run and review.** Run `npx tsx scripts/fill-vocab-pos.ts --level N5 --level N4 --level N3 --level N2 --level N1 --relabel --dry-run`
   and read every changed label. Most should be newly matched rows. A changed label on an
   existing row needs a reason (sense split or retag upstream). Then run it without `--dry-run`.
5. **Update the record.** Update the coverage table in `docs/content-data.md` ("Part of
   speech") and the `pos` entry in `docs/backlog.md` §4.

**Done when:** the source is the current JMdict, recorded in the README; the hand-labelled
rows are unchanged (`git diff` shows only `pos` lines, none on those uids); and the checks pass.

---

## B. Vocab example sentences from Tatoeba (N5–N3)

**Scope (owner, 2026-11-02):** N5, N4 and N3 only. N2/N1 get no examples. 2,329 rows have no
`exampleJp` today (N5 528, N4 492, N3 1,309). Textbook examples that already exist are never
replaced.

**Source:** Tatoeba, CC BY 2.0 FR. These files are at <https://downloads.tatoeba.org/exports/>:
- `per_language/jpn/jpn_sentences.tsv.bz2` and `per_language/eng/eng_sentences.tsv.bz2`;
- `links.tar.bz2` (ja↔en translation pairs);
- `jpn_indices.tar.bz2` (the Tanaka-corpus index: sentence id → JMdict headwords, with
  sense numbers and a "checked" marker `~`).

**Steps:**

1. **Fetch.** `scripts/fetch-tatoeba-examples.ts` downloads the files to the OS temp dir,
   pinned by SHA-256 like `fetch-jmdict-pos.ts`. It keeps only the sentences indexed to a word
   on our N5–N3 rows, using the JMdict ids in `scripts/sources/jmdict-pos.json`, and writes
   `scripts/sources/tatoeba-examples.json`: `{ id, jp, en, enId, headwords: [{ seq, sense?, checked }] }`.
   Trimmed, it should be a few MB at most.
2. **Select.** `scripts/lib/exampleSelect.ts` is pure, with tests. For a row it chooses one sentence:
   - **Hard filters:** the indexed headword is the row's JMdict id, with the sense matching
     the row's meaning where the index gives one; the sentence is no longer than 25
     characters at N5, 30 at N4 and 35 at N3; every kanji is on the row's level or below
     (`scripts/sources/jlpt-kanji.json`); it has an English translation.
   - **Ranking:** checked (`~`) index entries first, then the shortest, then the lowest
     Tatoeba id (oldest and most reviewed). Deterministic.
   - **No sentence passes:** leave the row blank. Never loosen the filters to fill it.
3. **Write.** `scripts/fill-vocab-examples.ts --level N5 --level N4 --level N3 [--dry-run]` sets
   `exampleJp`, `exampleEn` and `exampleSource: { tatoeba: <jp id> }` only on rows with no
   `exampleJp`. Add `exampleSource` to the vocab schema (`scripts/validate-content.ts`) and to
   the `VocabItem` type. It prints coverage per level and the rows left blank.
4. **Teacher spot-check (blocks the write).** Run the dry run and print a sample of 60 picks,
   20 per level and spread across lessons. Review it with the `japanese-teacher` skill:
   natural, level-appropriate, the right sense of the word. If more than 3 in 60 fail, tighten
   the filters and repeat.
5. **App.** Ship the attribution below in the same PR. The data must not ship without it.

### Attribution (PM decision, 2026-11-02)

CC BY 2.0 FR needs credit given in a reasonable way, and Tatoeba asks for a link to each
sentence. The app currently credits none of its sources, even though Waller's lists are CC BY
and KANJIDIC/JMdict are CC BY-SA, so this fixes that too.

- **Must (ships with the data): a source link on each Tatoeba example.** On a vocab row, show a
  small "Tatoeba" link under the example (`text-xs text-slate-500`, AA on white). It opens
  `https://tatoeba.org/en/sentences/show/<id>` in a new tab with `rel="noopener noreferrer"`.
  It stays visible when English is hidden: it is a credit, not a translation. Textbook examples
  (no `exampleSource`) show no link.
- **Must (can ship first, on its own): "Sources & licences" in the footer.** This opens a
  `Modal` that lists every source with its licence and a link: Waller's JLPT lists (CC BY),
  EDRDG KANJIDIC/KRADFILE/JMdict (CC BY-SA 4.0), kanjium (CC BY-SA 4.0), Tatoeba (CC BY 2.0 FR),
  and jamdict (MIT). Its text comes from `scripts/sources/README.md`.
- **Won't:** licence text on each row; a credits route of its own (a dialog is enough, and the
  footer is on every route).

**Acceptance:**
- *Given* an N5 vocab row whose example came from Tatoeba, *when* it renders, *then* a link
  named "Example sentence source: Tatoeba sentence <id> (opens in a new tab)" points to that
  sentence. It is there with English on and off.
- *Given* a row with a textbook example, *then* it shows no source link.
- *Given* any route, *when* the footer's "Sources & licences" is activated by click or
  keyboard, *then* the dialog lists all five sources with licence names and links, closes on
  Esc, and returns focus to the button. It also gets an `axeViolations()` case in
  `src/__tests__/a11y.test.tsx`.
- Bundle: the vocab chunk grows only by the new data (≈ 2,000 × ~60 bytes before gzip), and
  `npm run check:bundle` passes.

**Done when:** the coverage per level is recorded in `docs/content-data.md`, the teacher's
sample has passed, the attribution is live, and the backlog §4 entry is replaced by what's left
(rows no sentence fits).
