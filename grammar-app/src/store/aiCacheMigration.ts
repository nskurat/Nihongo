/**
 * Pure migration helpers for the persisted AI cache (useAiArtifactStore).
 */
import { ArtifactCache, CachedArtifact, LegacyAiMaps, artifactKey, fromLegacyMaps } from '../services/ai/artifactCache';

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

// v7: N5/N4 coverage became cumulative (fill-n5-n4-gaps.ts): N5/N4 gained list words, so
// the regenerated N2/N1 vocab lessons shifted and one N3 repeat (言う) was removed.
export const V7_FIRST_SHIFTED_VOCAB_UIDS: readonly string[] = [
  'n3-vocab-23-124',
  'n2-vocab-1-2',
  'n2-vocab-2-2',
  'n2-vocab-3-3',
  'n2-vocab-4-3',
  'n2-vocab-5-1',
  'n2-vocab-6-8',
  'n2-vocab-7-7',
  'n2-vocab-8-3',
  'n2-vocab-9-4',
  'n2-vocab-10-3',
  'n2-vocab-11-2',
  'n2-vocab-12-5',
  'n2-vocab-13-1',
  'n2-vocab-14-3',
  'n2-vocab-15-7',
  'n2-vocab-16-7',
  'n2-vocab-17-2',
  'n2-vocab-18-4',
  'n2-vocab-19-9',
  'n2-vocab-20-6',
  'n2-vocab-21-2',
  'n2-vocab-22-4',
  'n2-vocab-23-11',
  'n2-vocab-24-2',
  'n2-vocab-25-3',
  'n2-vocab-26-2',
  'n1-vocab-2-73',
  'n1-vocab-3-64',
  'n1-vocab-4-38',
  'n1-vocab-5-24',
  'n1-vocab-6-24',
  'n1-vocab-7-17',
  'n1-vocab-8-16',
  'n1-vocab-9-10',
  'n1-vocab-10-3',
  'n1-vocab-11-2',
  'n1-vocab-12-3',
  'n1-vocab-13-3',
  'n1-vocab-14-7',
  'n1-vocab-15-7',
  'n1-vocab-16-1',
  'n1-vocab-17-3',
  'n1-vocab-18-1',
  'n1-vocab-19-2',
  'n1-vocab-20-2',
  'n1-vocab-21-2',
  'n1-vocab-22-1',
  'n1-vocab-23-1',
  'n1-vocab-24-1',
  'n1-vocab-25-6',
  'n1-vocab-26-4',
  'n1-vocab-27-4',
  'n1-vocab-28-8',
  'n1-vocab-29-3',
  'n1-vocab-30-4',
  'n1-vocab-31-7',
  'n1-vocab-32-1',
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

// v9: the N5 core expressions left the separate lesson 26 for lessons 1, 3 and 7, and
// scripts/dedupe-vocab.ts then removed six rows they duplicated. Unlike v6/v7, every
// affected uid has a known successor, so cached vocab notes are renamed, not dropped.

/** Former N5 lesson 26 rows → their place in lessons 1, 3 and 7 (scripts/lib/coreExpressions.ts). */
export const V9_MOVED_VOCAB_UIDS: Readonly<Record<string, string>> = {
  'n5-vocab-26-1': 'n5-vocab-3-38',
  'n5-vocab-26-2': 'n5-vocab-1-44',
  'n5-vocab-26-3': 'n5-vocab-1-45',
  'n5-vocab-26-4': 'n5-vocab-1-46',
  'n5-vocab-26-5': 'n5-vocab-1-47',
  'n5-vocab-26-6': 'n5-vocab-1-48',
  'n5-vocab-26-7': 'n5-vocab-7-39',
  'n5-vocab-26-8': 'n5-vocab-7-40',
  'n5-vocab-26-9': 'n5-vocab-7-41',
  'n5-vocab-26-10': 'n5-vocab-7-42',
  'n5-vocab-26-11': 'n5-vocab-7-43',
  'n5-vocab-26-12': 'n5-vocab-7-44',
  'n5-vocab-26-13': 'n5-vocab-3-39',
  'n5-vocab-26-14': 'n5-vocab-7-45',
  'n5-vocab-26-15': 'n5-vocab-1-49',
};

/** Removed duplicate → the kept row of the same word (its uid after the change). */
export const V9_REMOVED_VOCAB_UIDS: Readonly<Record<string, string>> = {
  'n5-vocab-4-34': 'n5-vocab-5-1', // 行く → 行きます
  'n3-vocab-1-82': 'n5-vocab-3-39', // ごめんなさい
  'n3-vocab-11-84': 'n5-vocab-1-45', // こんにちは
  'n2-vocab-11-19': 'n5-vocab-1-48', // さようなら
  'n2-vocab-19-8': 'n5-vocab-7-42', // いってらっしゃい
  'n2-vocab-19-23': 'n5-vocab-1-46', // こんばんは
};

/** A vocab renumbering: rows moved to a known uid, and removed rows → their kept twin. */
export interface VocabRenumbering {
  moved: Readonly<Record<string, string>>;
  removed: Readonly<Record<string, string>>;
}

/** A vocab uid's successor: moved, redirected to its kept twin, or shifted down past removed rows of its lesson. */
export function vocabUidSuccessor(uid: string, change: VocabRenumbering): string {
  const direct = change.moved[uid] ?? change.removed[uid];
  if (direct) return direct;
  const m = UID_RE.exec(uid);
  if (!m) return uid;
  const removedBefore = Object.keys(change.removed).filter((r) => {
    const rm = UID_RE.exec(r);
    return rm?.[1] === m[1] && Number(rm[2]) < Number(m[2]);
  }).length;
  return removedBefore ? `${m[1]}-${Number(m[2]) - removedBefore}` : uid;
}

/**
 * Renames vocab artifacts to their successors. A removed row's note only fills its kept
 * twin's slot when that has no note of its own; everything else keeps its data and ts.
 */
export function renumberVocabArtifacts(artifacts: ArtifactCache, change: VocabRenumbering): ArtifactCache {
  const out: ArtifactCache = {};
  const redirected: CachedArtifact[] = [];
  for (const [key, entry] of Object.entries(artifacts)) {
    if (entry.kind !== 'vocab-help') {
      out[key] = entry;
      continue;
    }
    const next = { ...entry, uid: vocabUidSuccessor(entry.uid, change) };
    if (change.removed[entry.uid]) redirected.push(next);
    else out[artifactKey('vocab-help', next.uid)] = next;
  }
  for (const entry of redirected) {
    const key = artifactKey('vocab-help', entry.uid);
    if (!out[key]) out[key] = entry;
  }
  return out;
}

const V9: VocabRenumbering = { moved: V9_MOVED_VOCAB_UIDS, removed: V9_REMOVED_VOCAB_UIDS };

/** v9 successor of a vocab uid (kept for its tests and the v9 tables' documentation). */
export function v9VocabUid(uid: string): string {
  return vocabUidSuccessor(uid, V9);
}

export function renameV9VocabArtifacts(artifacts: ArtifactCache): ArtifactCache {
  return renumberVocabArtifacts(artifacts, V9);
}

// v10: the near-repeat review (scripts/lib/vocabDedupe.ts SAME_SENSE, jlptContent.ts
// SAME_WORD_SPELLINGS) merged 21 rows into the row of the same word; later rows shifted.
export const V10_REMOVED_VOCAB_UIDS: Readonly<Record<string, string>> = {
  'n1-vocab-1-85': 'n3-vocab-18-72', // 相応しい → ふさわしい
  'n1-vocab-13-24': 'n2-vocab-1-20', // ご馳走さま → ごちそうさま
  'n1-vocab-13-72': 'n2-vocab-15-51', // 惨め → みじめ
  'n1-vocab-13-76': 'n3-vocab-19-13', // やり遂げる → やりとげる
  'n1-vocab-17-31': 'n4-vocab-11-12', // この頃 → このごろ
  'n1-vocab-17-47': 'n2-vocab-12-32', // その外 → そのほか
  'n1-vocab-17-5': 'n3-vocab-18-70', // お洒落 → おしゃれ
  'n1-vocab-21-10': 'n3-vocab-18-9', // 恐らく → おそらく
  'n1-vocab-25-9': 'n3-vocab-11-27', // 慌てる → あわてる
  'n1-vocab-26-11': 'n3-vocab-2-69', // 今更 → いまさら
  'n1-vocab-28-8': 'n2-vocab-6-3', // 当てはまる → あてはまる
  'n1-vocab-3-28': 'n3-vocab-16-6', // 素早い → すばやい
  'n1-vocab-3-80': 'n3-vocab-21-134', // 善し悪し → よしあし
  'n1-vocab-30-81': 'n3-vocab-22-50', // 余程 → よほど (its uid after the shift)
  'n1-vocab-31-4': 'n3-vocab-17-101', // 呆れる → あきれる
  'n3-vocab-1-127': 'n5-vocab-18-11', // 是非 → ぜひ
  'n3-vocab-16-95': 'n5-vocab-25-6', // チャンス
  'n3-vocab-22-128': 'n3-vocab-7-13', // 大した → たいした
  'n3-vocab-22-50': 'n3-vocab-10-11', // めったに
  'n3-vocab-3-38': 'n4-vocab-18-9', // 幸せ
  'n3-vocab-9-51': 'n4-vocab-15-30', // しっかり
};

const V10: VocabRenumbering = { moved: {}, removed: V10_REMOVED_VOCAB_UIDS };

/**
 * Migrates any persisted AI cache to v10: one artifact map (the v8 shape) with vocab notes
 * under their current uids. v4–v7 keep their entries, minus the uids later content changes
 * reassigned; anything older starts empty (its keys were the pre-uid ids, which collide
 * across levels).
 */
export function migrateAiCache(persisted: unknown, version: number): { artifacts: ArtifactCache } {
  if (version >= 8) {
    let artifacts = (persisted as { artifacts?: ArtifactCache } | undefined)?.artifacts ?? {};
    if (version < 9) artifacts = renumberVocabArtifacts(artifacts, V9);
    if (version < 10) artifacts = renumberVocabArtifacts(artifacts, V10);
    return { artifacts };
  }
  const maps = persisted as LegacyAiMaps | undefined;
  if (!maps || version < 4) return { artifacts: {} };

  const mnemonics =
    version === 4 ? withoutKeys(maps.aiKanjiMnemonics ?? {}, V5_REPLACED_KANJI_UIDS) : maps.aiKanjiMnemonics ?? {};
  let notes = maps.aiVocabNotes ?? {};
  if (version < 6) notes = withoutShiftedUids(notes, V6_FIRST_SHIFTED_VOCAB_UIDS);
  if (version < 7) notes = withoutShiftedUids(notes, V7_FIRST_SHIFTED_VOCAB_UIDS);

  const artifacts = fromLegacyMaps({ ...maps, aiKanjiMnemonics: mnemonics, aiVocabNotes: notes });
  return { artifacts: renumberVocabArtifacts(renumberVocabArtifacts(artifacts, V9), V10) };
}
