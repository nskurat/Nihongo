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
