import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

type Level = 'N5' | 'N4' | 'N3';
type ContentSection = 'grammar' | 'vocab' | 'kanji';

// Mirrors grammar-app/src/utils/levels.ts's LESSON_RANGES. Scripts run outside
// the app's Vite/browser TS project, so this is a deliberate plain-value copy
// rather than an import - keep it in sync if the ranges ever change.
const LESSON_RANGES: Record<Level, { min: number; max: number }> = {
  N5: { min: 1, max: 25 },
  N4: { min: 26, max: 50 },
  N3: { min: 1, max: 24 },
};

interface FileTarget {
  path: string;
  level: Level;
  section: ContentSection;
}

const LEVELS: Level[] = ['N5', 'N4', 'N3'];
const SECTIONS: ContentSection[] = ['grammar', 'vocab', 'kanji'];

const FILES: FileTarget[] = LEVELS.flatMap((level) =>
  SECTIONS.map((section) => ({
    path: `grammar-app/src/data/${level.toLowerCase()}/${section}.json`,
    level,
    section,
  }))
);

const baseItemSchema = z.object({
  uid: z.string(),
  level: z.enum(['N5', 'N4', 'N3']),
  section: z.enum(['grammar', 'vocab', 'kanji']),
  lesson: z.number().int(),
  id: z.union([z.string(), z.number()]).optional(),
});

const grammarItemSchema = baseItemSchema.extend({
  title: z.string(),
  meaning: z.string(),
  structure: z.string(),
  explanation: z.string(),
  summary: z.string().optional(),
  details: z.string().optional(),
  tags: z.array(z.string()).optional(),
  examples: z.array(z.object({ jp: z.string(), en: z.string() })).optional(),
});

const vocabItemSchema = baseItemSchema.extend({
  word: z.string(),
  reading: z.string(),
  romaji: z.string().optional(),
  pos: z.string().optional(),
  meaning: z.string(),
  exampleJp: z.string().optional(),
  exampleEn: z.string().optional(),
});

const kanjiItemSchema = baseItemSchema.extend({
  kanji: z.string(),
  meaning: z.string(),
  onyomi: z.array(z.string()).optional(),
  kunyomi: z.array(z.string()).optional(),
  strokes: z.number(),
  radical: z.string().optional(),
  strokeOrderLink: z.string().optional(),
  exampleJp: z.string().optional(),
  exampleEn: z.string().optional(),
  // reading/meaning are nullable, not just optional: 150 existing N4 kanji compound
  // entries have literal `null` here rather than a string or a missing key - a
  // pre-existing content gap, surfaced as a warning below rather than a schema error.
  compounds: z
    .array(
      z.object({
        word: z.string(),
        reading: z.string().nullable(),
        meaning: z.string().nullable(),
      })
    )
    .optional(),
});

const SCHEMAS = {
  grammar: grammarItemSchema,
  vocab: vocabItemSchema,
  kanji: kanjiItemSchema,
};

const UID_RE = /^(n5|n4|n3)-(grammar|vocab|kanji)-(\d+)-(\d+)$/;

const errors: string[] = [];
const warnings: string[] = [];
const seenUids = new Map<string, string>();
let totalItems = 0;

function validateFile(target: FileTarget): void {
  const filePath = resolve(process.cwd(), target.path);
  const raw = readFileSync(filePath, 'utf-8');
  const data: Record<string, unknown[]> = JSON.parse(raw);
  const schema = SCHEMAS[target.section];
  const range = LESSON_RANGES[target.level];

  for (const lessonKey of Object.keys(data)) {
    const lessonFromKey = Number(lessonKey);

    data[lessonKey].forEach((rawItem, index) => {
      totalItems += 1;
      const location = `${target.path}#${lessonKey}[${index}]`;

      const parsed = schema.safeParse(rawItem);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ');
        errors.push(`${location}: schema violation - ${detail}`);
        return;
      }
      const item = parsed.data;

      // uid format
      const match = UID_RE.exec(item.uid);
      if (!match) {
        errors.push(`${location}: malformed uid "${item.uid}"`);
      } else {
        const [, uidLevel, uidSection, uidLesson, uidN] = match;
        if (uidLevel !== target.level.toLowerCase()) {
          errors.push(`${location}: uid level "${uidLevel}" does not match file level "${target.level}"`);
        }
        if (uidSection !== target.section) {
          errors.push(`${location}: uid section "${uidSection}" does not match file section "${target.section}"`);
        }
        if (Number(uidLesson) !== lessonFromKey) {
          errors.push(`${location}: uid lesson ${uidLesson} does not match lesson key ${lessonKey}`);
        }
        if (Number(uidN) !== index + 1) {
          errors.push(`${location}: uid position ${uidN} does not match array index ${index + 1}`);
        }
      }

      // uid uniqueness across every file
      const seenAt = seenUids.get(item.uid);
      if (seenAt) {
        errors.push(`${location}: duplicate uid "${item.uid}" (also at ${seenAt})`);
      } else {
        seenUids.set(item.uid, location);
      }

      // item fields vs. the file/lesson they actually live in
      if (item.level !== target.level) {
        errors.push(`${location}: item.level "${item.level}" does not match file level "${target.level}"`);
      }
      if (item.section !== target.section) {
        errors.push(`${location}: item.section "${item.section}" does not match file section "${target.section}"`);
      }
      if (item.lesson !== lessonFromKey) {
        errors.push(`${location}: item.lesson ${item.lesson} does not match lesson key ${lessonKey}`);
      }

      // lesson range
      if (item.lesson < range.min || item.lesson > range.max) {
        errors.push(
          `${location}: lesson ${item.lesson} outside ${target.level}'s range [${range.min}, ${range.max}]`
        );
      }

      // warnings - known content-quality issues, surfaced but not blocking
      if (target.section === 'kanji') {
        const kanjiItem = item as z.infer<typeof kanjiItemSchema>;
        if (kanjiItem.strokes === 0) {
          warnings.push(`${location}: strokes is 0`);
        }
        if (kanjiItem.radical !== undefined && kanjiItem.radical.trim() === '') {
          warnings.push(`${location}: radical is empty`);
        }
        if (kanjiItem.exampleEn && kanjiItem.meaning === kanjiItem.exampleEn) {
          warnings.push(`${location}: meaning is identical to exampleEn`);
        }
        kanjiItem.compounds?.forEach((compound, compoundIndex) => {
          if (compound.reading === null || compound.meaning === null) {
            warnings.push(`${location}: compounds[${compoundIndex}] has a null reading and/or meaning`);
          }
        });
      }
      if (target.section === 'vocab') {
        const vocabItem = item as z.infer<typeof vocabItemSchema>;
        if (vocabItem.exampleEn && vocabItem.meaning === vocabItem.exampleEn) {
          warnings.push(`${location}: meaning is identical to exampleEn`);
        }
      }
      if (target.section === 'grammar') {
        const grammarItem = item as z.infer<typeof grammarItemSchema>;
        if (!grammarItem.examples || grammarItem.examples.length === 0) {
          warnings.push(`${location}: no examples`);
        }
      }
    });
  }
}

function updateFindingsWarnings(): void {
  const findingsPath = resolve(process.cwd(), 'docs/refactor/FINDINGS.md');
  const original = readFileSync(findingsPath, 'utf-8');
  const startMarker = '<!-- validate-content:start -->';
  const endMarker = '<!-- validate-content:end -->';

  const body = warnings.length > 0 ? warnings.map((w) => `- ${w}`).join('\n') : '_None._';
  const block = `${startMarker}\n${body}\n${endMarker}`;

  let updated: string;
  const startIdx = original.indexOf(startMarker);
  const endIdx = original.indexOf(endMarker);
  if (startIdx !== -1 && endIdx !== -1) {
    updated = original.slice(0, startIdx) + block + original.slice(endIdx + endMarker.length);
  } else {
    const section = [
      '',
      '## Content Validation Warnings',
      '',
      '_Auto-generated by `npm run validate:data` — do not edit this section by hand._',
      '',
      block,
      '',
    ].join('\n');
    updated = `${original.trimEnd()}\n${section}`;
  }

  writeFileSync(findingsPath, updated, 'utf-8');
}

for (const target of FILES) {
  validateFile(target);
}

console.log(`Validated ${totalItems} items across ${FILES.length} files.`);

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log(`  - ${w}`));
}

updateFindingsWarnings();

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log('\nContent validation passed.');
