/**
 * Pure migration helpers for the persisted AI cache (useAiCacheStore).
 */

// v5: the N3 kanji review (scripts/review-n3-kanji-vocab.ts) reused these slots, which
// held kanji already taught in N4/N5 or repeated within N3, for missing N3-list kanji.
// A cached mnemonic under one of these uids belongs to the old kanji, so it is dropped.
export const V5_REPLACED_KANJI_UIDS: readonly string[] = [
  'n3-kanji-2-5', // 飛 → 在
  'n3-kanji-4-2', // 覚 → 実
  'n3-kanji-5-2', // 横 → 当
  'n3-kanji-7-1', // 迎 → 数
  'n3-kanji-7-2', // 泣 → 感
  'n3-kanji-7-4', // 医 → 談
  'n3-kanji-8-1', // 眠 → 平
  'n3-kanji-9-1', // 決 → 市
  'n3-kanji-9-2', // 済 → 現
  'n3-kanji-9-4', // 肉 → 和
  'n3-kanji-9-5', // 雪 → 加
  'n3-kanji-11-2', // 建 → 首
  'n3-kanji-11-3', // 寄 → 原
  'n3-kanji-12-5', // 苦 → 告
  'n3-kanji-13-2', // 違 → 関
  'n3-kanji-13-5', // 辛 → 指
  'n3-kanji-14-3', // 放 → 成
  'n3-kanji-16-5', // 額 → 戦
  'n3-kanji-18-3', // 復 → 得
  'n3-kanji-20-2', // 奏 → 民
  'n3-kanji-22-1', // 企 → 期
  'n3-kanji-22-5', // 輩 → 資
  'n3-kanji-23-2', // 汚 → 共
  'n3-kanji-24-4', // 踏 → 面
];

/** Returns a copy of `entries` without the given keys. */
export function withoutKeys<T>(entries: Record<string, T>, keys: readonly string[]): Record<string, T> {
  const drop = new Set(keys);
  return Object.fromEntries(Object.entries(entries).filter(([k]) => !drop.has(k)));
}

// v6: scripts/dedupe-vocab.ts removed redundant vocab rows (食べる beside 食べます …).
// Positional uids after a removed row shifted, so for each listed lesson every vocab uid
// at or after the given position may now name a different word; their cached notes go.
export const V6_FIRST_SHIFTED_VOCAB_UIDS: readonly string[] = [
  'n3-vocab-1-35',
  'n3-vocab-11-123',
  'n3-vocab-12-49',
  'n3-vocab-15-5',
  'n3-vocab-2-70',
  'n3-vocab-22-10',
  'n3-vocab-3-112',
  'n3-vocab-4-110',
  'n3-vocab-6-87',
  'n3-vocab-7-68',
  'n4-vocab-1-14',
  'n4-vocab-10-16',
  'n4-vocab-11-22',
  'n4-vocab-12-29',
  'n4-vocab-13-21',
  'n4-vocab-14-23',
  'n4-vocab-15-13',
  'n4-vocab-18-27',
  'n4-vocab-19-28',
  'n4-vocab-2-15',
  'n4-vocab-20-13',
  'n4-vocab-21-13',
  'n4-vocab-24-13',
  'n4-vocab-25-14',
  'n4-vocab-3-1',
  'n4-vocab-4-20',
  'n4-vocab-5-18',
  'n4-vocab-6-17',
  'n4-vocab-7-26',
  'n4-vocab-8-25',
  'n4-vocab-9-26',
  'n5-vocab-11-2',
  'n5-vocab-12-28',
  'n5-vocab-13-24',
  'n5-vocab-14-13',
  'n5-vocab-15-10',
  'n5-vocab-16-4',
  'n5-vocab-17-27',
  'n5-vocab-18-12',
  'n5-vocab-19-16',
  'n5-vocab-21-23',
  'n5-vocab-22-14',
  'n5-vocab-23-13',
  'n5-vocab-24-23',
  'n5-vocab-25-22',
  'n5-vocab-3-11',
  'n5-vocab-4-12',
  'n5-vocab-5-20',
  'n5-vocab-7-27',
  'n5-vocab-9-13',
];

const UID_RE = /^(.+)-(\d+)$/;

/** Drops entries whose uid sits at or after the first shifted position of its lesson. */
export function withoutShiftedUids<T>(entries: Record<string, T>, firstShifted: readonly string[]): Record<string, T> {
  const from = new Map<string, number>();
  for (const uid of firstShifted) {
    const m = UID_RE.exec(uid);
    if (m) from.set(m[1], Number(m[2]));
  }
  return Object.fromEntries(
    Object.entries(entries).filter(([uid]) => {
      const m = UID_RE.exec(uid);
      const start = m ? from.get(m[1]) : undefined;
      return start === undefined || Number(m![2]) < start;
    })
  );
}
