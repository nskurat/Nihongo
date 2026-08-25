import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Level = 'N5' | 'N4' | 'N3';
type ContentSection = 'grammar' | 'vocab' | 'kanji';

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

const dropLegacyId = process.argv.includes('--drop-legacy-id');

/**
 * Stamps every item in a content file with `uid`, `level`, `section` and
 * `lesson` as its first fields. `uid` is `{level}-{section}-{lesson}-{n}`,
 * where `n` is the item's 1-based position within its lesson's array -
 * deterministic from position alone, so re-running is a no-op. With
 * `--drop-legacy-id`, also strips the superseded `id` field each item was
 * originally stamped with - a one-time migration, not the default behavior.
 */
function addUids(target: FileTarget): void {
  const filePath = resolve(process.cwd(), target.path);
  const raw = readFileSync(filePath, 'utf-8');
  const data: Record<string, Record<string, unknown>[]> = JSON.parse(raw);

  const stamped: Record<string, Record<string, unknown>[]> = {};
  for (const lessonKey of Object.keys(data)) {
    const lesson = Number(lessonKey);
    stamped[lessonKey] = data[lessonKey].map((item, index) => {
      const rest = dropLegacyId
        ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'id'))
        : item;
      return {
        uid: `${target.level.toLowerCase()}-${target.section}-${lesson}-${index + 1}`,
        level: target.level,
        section: target.section,
        lesson,
        ...rest,
      };
    });
  }

  writeFileSync(filePath, `${JSON.stringify(stamped, null, 2)}\n`, 'utf-8');
}

for (const target of FILES) {
  addUids(target);
  console.log(`Stamped uids in ${target.path}`);
}
