/**
 * Golden queries: docs/search/02-requirements.md §5 acceptance list (T-01…T-42, as amended:
 * T-33 deinflected above prefix, T-42 "no word match", T-24 per current data) run against
 * MemorySearchSource built in memory from the real src/data. N2/N1 rows are matched by
 * word + level (their uids are positional and regenerated), N5–N3 by uid where the PM
 * list gives one.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { DocType, Level, SearchHit, SearchOptions, SearchResponse } from '../types';
import { realIndex } from './realIndex';
import { titleAliases } from './dedupedAliases';

const { source } = realIndex();

interface Ref {
  /** Display title (grammar title / vocab word / kanji), exact. */
  t: string;
  level: Level;
  lesson?: number;
  uid?: string;
}

const N5 = { rankLevel: 'N5' } as const satisfies SearchOptions;

async function run(q: string, opts: Partial<SearchOptions> = {}): Promise<SearchResponse> {
  return source.search(q, { ...N5, ...opts });
}

function matches(h: SearchHit, r: Ref): boolean {
  if (r.uid) return h.uid === r.uid;
  if (h.title === r.t) return h.level === r.level && (r.lesson === undefined || h.lesson === r.lesson);
  // A dictionary form removed by scripts/dedupe-vocab.ts is now taught by its ます row.
  return titleAliases(h.title).includes(r.t);
}

/** A ref is present when it is a row or a collapsed duplicate (alsoAt) of one. */
function present(list: SearchHit[], r: Ref): boolean {
  return list.some((h) => matches(h, r) || (r.uid !== undefined && h.alsoAt?.some((a) => a.uid === r.uid)));
}

function expectContains(res: SearchResponse, type: DocType, refs: Ref[]): void {
  for (const r of refs) {
    expect(present(res.groups[type], r), `${type} should contain ${r.t} ${r.level}${r.lesson ? ' L' + r.lesson : ''}`).toBe(true);
  }
}

function expectTop(res: SearchResponse, type: DocType, r: Ref): void {
  const top = res.groups[type][0];
  expect(top, `${type} group is empty`).toBeDefined();
  expect(matches(top, r), `${type} top is ${top?.title} ${top?.level} L${top?.lesson}, expected ${r.t}`).toBe(true);
}

const titles = (list: SearchHit[]) => list.map((h) => `${h.title} ${h.level} L${h.lesson}`);

beforeAll(async () => {
  await source.warmup();
});

describe('§5 acceptance list (golden queries)', () => {
  it('T-01 わかります: exact row, 分かる as lemma hit, grammar N5 L9', async () => {
    const r = await run('わかります');
    expectTop(r, 'vocab', { t: 'わかります', level: 'N5', uid: 'n5-vocab-9-1' });
    const wakaru = r.groups.vocab.find((h) => h.title === '分かる' && h.level === 'N5' && h.lesson === 4);
    expect(wakaru?.matchKind).toMatch(/lemma|deinflected/);
    expect(r.groups.grammar.some((h) => h.level === 'N5' && h.lesson === 9 && h.title.startsWith('N が あります／わかります'))).toBe(true);
  });

  // 分る (rare okurigana variant) left N2: N5 わかります now covers it (cumulative coverage).
  it('T-02 わかる: 分かる top, and わかります', async () => {
    const r = await run('わかる');
    expectTop(r, 'vocab', { t: '分かる', level: 'N5', lesson: 4 });
    expectContains(r, 'vocab', [{ t: 'わかります', level: 'N5', uid: 'n5-vocab-9-1' }]);
  });

  it("T-03 kan'i → 簡易 N1 L28", async () => {
    const r = await run("kan'i");
    expectTop(r, 'vocab', { t: '簡易', level: 'N1' });
    expect(r.queryAs).toBe('かんい');
  });

  it('T-04 kani never reads as かんい', async () => {
    const r = await run('kani');
    expect(present(r.groups.vocab, { t: '簡易', level: 'N1' })).toBe(false);
    expect(r.totals.vocab).toBeGreaterThanOrEqual(0);
  });

  it('T-05 因: kanji first, 因 N3 L21 #1', async () => {
    const r = await run('因');
    expect(r.groupOrder[0]).toBe('kanji');
    expectTop(r, 'kanji', { t: '因', level: 'N3', uid: 'n3-kanji-21-12' });
  });

  it('T-06 分: kanji first; vocab 自分, 十分, 半分; grammar 今 -時-分です', async () => {
    const r = await run('分');
    expect(r.groupOrder[0]).toBe('kanji');
    expectTop(r, 'kanji', { t: '分', level: 'N5', lesson: 4 });
    expectContains(r, 'vocab', [
      { t: '自分', level: 'N5', lesson: 4 },
      { t: '十分', level: 'N4', lesson: 7 },
    ]);
    // 半分 is an N5-list word (N5, with the N4 L19 textbook row as a repeat).
    const all = await run('分', { limitPerType: Infinity });
    expectContains(all, 'vocab', [{ t: '半分', level: 'N5' }]);
    // Same top rows for an N3 learner: the current level gets no priority (orchestrator decision).
    expectContains(await run('分', { rankLevel: 'N3' }), 'vocab', [{ t: '自分', level: 'N5', lesson: 4 }, { t: '十分', level: 'N4', lesson: 7 }]);
    expect(r.groups.grammar.some((h) => h.title === '今 -時-分です' && h.level === 'N5')).toBe(true);
  });

  it('T-07 ぷん / pun → 分 (on プン)', async () => {
    for (const q of ['ぷん', 'pun']) expectContains(await run(q), 'kanji', [{ t: '分', level: 'N5', lesson: 4 }]);
  });

  it('T-08 mei = めい = メイ: kanji with on メイ in level, lesson order (any rank level)', async () => {
    const expected = ['明 N5 L16', '名 N5 L18', '迷 N3 L1', '命 N3 L1', '鳴 N3 L12', '謎 N3 L14', '盟 N1 L2', '銘 N1 L12'];
    for (const q of ['mei', 'めい', 'メイ']) {
      const r = await run(q, { limitPerType: Infinity, rankLevel: 'N3' });
      const exact = r.groups.kanji.filter((h) => h.tier === 0);
      expect(titles(exact), q).toEqual(expected);
    }
  });

  it('T-09 although (amended): the 8 meaning hits, plus the Concession / Contrast chip members after them', async () => {
    // Fix round 2: a chip match also lists that chip's grammar, so the group is no longer
    // exactly 8. The 8 points whose meaning says "although" are all there, as english hits.
    const r = await run('although', { limitPerType: Infinity });
    const meaningHits = r.groups.grammar.filter((h) => h.matchKind === 'english');
    expect(titles(meaningHits).sort()).toEqual(
      [
        'けど／けれども N5 L8', '〜ながらも N3 L8', '〜といっても N3 L9', '〜ものの N2 L4', '〜つつ（も） N2 L4',
        '〜とはいえ N1 L1', '〜ものを N1 L1', '〜ところを N1 L32',
      ].sort()
    );
    expect(r.groupOrder[0]).toBe('grammar');
    // けど and のに are the teacher's core answers for "although".
    expect(r.groups.grammar.slice(0, 2).map((h) => h.title)).toEqual(['けど／けれども', 'V／い-adj／な-adj plain form／N（だ→な）＋ のに、〜']);
  });

  // 17 → 18: 〜わりに（は） N3 L8 added for the 2026-11 regression (R15).
  it('T-10 ?tag=comparison: exactly 18, N5 → N1', async () => {
    const list = await source.listByTag('comparison');
    expect(list).toHaveLength(18);
    expect(list[0].title).toBe('Aは Bより adjective です');
    expect(list[0].level).toBe('N5');
    expect(list[0].lesson).toBe(12);
    expect(list[17].title).toBe('〜きっての');
    expect(list[17].level).toBe('N1');
    expect(list[17].lesson).toBe(26);
    expect(present(list, { t: '〜に比べて', level: 'N3', lesson: 18 })).toBe(true);
    // Same list through search() with a tag filter and no query.
    const viaSearch = await run('', { tag: 'comparison', limitPerType: Infinity });
    expect(viaSearch.groups.grammar.map((h) => h.uid)).toEqual(list.map((h) => h.uid));
  });

  it('T-11 comparison typed: chip "Comparison · 18", grammar has 〜に比べて', async () => {
    const r = await run('comparison');
    expect(r.categories.map((c) => [c.label, c.count])).toContainEqual(['Comparison', 18]);
    expectContains(r, 'grammar', [{ t: '〜に比べて', level: 'N3', lesson: 18 }]);
  });

  it('T-12 degree/extent: chip "Degree / Extent · 45"; tapping lists 45 incl. ばかりか, ずつ, だらけ', async () => {
    const r = await run('degree/extent');
    const chip = r.categories.find((c) => c.label === 'Degree / Extent');
    expect(chip?.count).toBe(45);
    const list = await run('', { category: chip?.id, limitPerType: Infinity });
    expect(list.totals.grammar).toBe(45);
    expectContains(list, 'grammar', [
      { t: '〜ばかりか', level: 'N2', lesson: 9 },
      { t: '〜ずつ', level: 'N3', lesson: 5 },
      { t: '〜だらけ', level: 'N3', lesson: 7 },
    ]);
  });

  it('T-13 in addition / not only (meaning search)', async () => {
    const a = await run('in addition', { limitPerType: Infinity });
    const b = await run('not only', { limitPerType: Infinity });
    const both: SearchResponse = { ...a, groups: { ...a.groups, grammar: [...a.groups.grammar, ...b.groups.grammar] } };
    expectContains(both, 'grammar', [
      { t: 'それに', level: 'N4', lesson: 3 },
      { t: 'さらに', level: 'N3', lesson: 3 },
      { t: '〜上に', level: 'N3', lesson: 13 },
      { t: '〜ばかりでなく／〜だけでなく', level: 'N3', lesson: 5 },
      { t: '〜に加えて', level: 'N2', lesson: 1 },
      { t: '〜ばかりか', level: 'N2', lesson: 9 },
      { t: '〜のみならず', level: 'N1', lesson: 22 },
    ]);
  });

  it('T-14 contrast: chip "Concession / Contrast · 50" (49 + 〜わりに); に対して and にひきかえ by meaning; 反面 via the chip', async () => {
    const r = await run('contrast');
    const chip = r.categories.find((c) => c.label === 'Concession / Contrast');
    expect(chip?.count).toBe(50);
    expectContains(r, 'grammar', [{ t: '〜にひきかえ', level: 'N1', lesson: 21 }]);
    // Amended: chip members now appear in the results, so 〜反面 (meaning "On the other
    // hand") is in the group; with 56 rows it and 〜に対して sit behind "Show all".
    const all = await run('contrast', { limitPerType: Infinity });
    expectContains(all, 'grammar', [
      { t: '〜に対して', level: 'N3', lesson: 8 },
      { t: '〜反面', level: 'N2', lesson: 4 },
    ]);
  });

  it('T-15 ものの: grammar first, 〜ものの N2 L4 #1', async () => {
    const r = await run('ものの');
    expect(r.groupOrder[0]).toBe('grammar');
    expectTop(r, 'grammar', { t: '〜ものの', level: 'N2', lesson: 4 });
  });

  it('T-16 ばかりか in four tilde spellings gives identical lists', async () => {
    const lists = await Promise.all(['ばかりか', '〜ばかりか', '~ばかりか', '～ばかりか'].map((q) => run(q)));
    for (const l of lists) expect(l.groups).toEqual(lists[0].groups);
    expectTop(lists[0], 'grammar', { t: '〜ばかりか', level: 'N2', lesson: 9 });
  });

  it('T-17 ばかり: grammar first with all 8', async () => {
    const r = await run('ばかり');
    expect(r.groupOrder[0]).toBe('grammar');
    const want: [Level, number][] = [['N4', 21], ['N3', 5], ['N3', 9], ['N2', 9], ['N2', 17], ['N2', 19], ['N1', 17], ['N1', 17]];
    const got = r.groups.grammar.map((h) => [h.level, h.lesson]);
    for (const w of want) expect(got).toContainEqual(w);
    expect(r.groups.grammar.filter((h) => h.level === 'N1' && h.lesson === 17)).toHaveLength(2);
  });

  it('T-18 ばかり + N2: exactly ばかりか, ばかりだ, ばかりに', async () => {
    const r = await run('ばかり', { levels: ['N2'], limitPerType: Infinity });
    expect(r.groups.grammar.map((h) => h.title).sort()).toEqual(['〜ばかりか', '〜ばかりだ', '〜ばかりに'].sort());
  });

  it('T-19 わけにはいかない', async () => {
    expectTop(await run('わけにはいかない'), 'grammar', { t: '〜わけにはいかない', level: 'N3', lesson: 18 });
  });

  it('T-20 いただけませんか: N4 L1 top, contains N4 L8 and N4 L23', async () => {
    const r = await run('いただけませんか');
    expectTop(r, 'grammar', { t: 'Vて-form + いただけませんか', level: 'N4', lesson: 1 });
    const at = r.groups.grammar.map((h) => `${h.level}-${h.lesson}`);
    expect(at).toContain('N4-8');
    expect(at).toContain('N4-23');
  });

  it('T-21 迷う: vocab top 迷う [道に〜] shown with the bracket', async () => {
    expectTop(await run('迷う'), 'vocab', { t: '迷う [道に〜]', level: 'N3', lesson: 1 });
  });

  it('T-22 迷惑: vocab top 迷惑, かける [迷惑を〜] below, kanji 迷 and 惑', async () => {
    const r = await run('迷惑');
    expectTop(r, 'vocab', { t: '迷惑', level: 'N3', lesson: 12 });
    const i = r.groups.vocab.findIndex((h) => h.title === 'かける [迷惑を〜]' && h.level === 'N3');
    expect(i).toBeGreaterThan(0);
    expectContains(r, 'kanji', [{ t: '迷', level: 'N3', lesson: 1 }, { t: '惑', level: 'N1', lesson: 4 }]);
  });

  it('T-23 花見 → [お]花見', async () => {
    expectContains(await run('花見'), 'vocab', [{ t: '[お]花見', level: 'N5', lesson: 6 }]);
  });

  it('T-24 ありがとう / arigatou → [どうも]ありがとう[ございます] (the only row)', async () => {
    for (const q of ['ありがとう', 'arigatou']) {
      const r = await run(q);
      expectTop(r, 'vocab', { t: '[どうも]ありがとう[ございます]', level: 'N5', uid: 'n5-vocab-2-10' });
    }
  });

  // Amended (owner decision D3, docs/search/07-regression.md): exact and lemma hits rank
  // by level, so the N5 word お酒 leads and 酒 N3 follows.
  it('T-25 さけ: お酒 N5 above 酒 N3', async () => {
    const r = await run('さけ');
    const sake = r.groups.vocab.findIndex((h) => h.title === '酒' && h.level === 'N3');
    const osake = r.groups.vocab.findIndex((h) => h.title === 'お酒' && h.level === 'N5');
    expect(osake).toBe(0);
    expect(sake).toBeGreaterThan(osake);
  });

  it('T-26 たくしー → タクシー', async () => {
    expectTop(await run('たくしー'), 'vocab', { t: 'タクシー', level: 'N5', lesson: 16 });
  });

  it('T-27 ミル → 見る and 見ます', async () => {
    expectContains(await run('ミル'), 'vocab', [{ t: '見る', level: 'N5', lesson: 9 }, { t: '見ます', level: 'N5', lesson: 6 }]);
  });

  it('T-28 食べる / taberu → 食べる and 食べます', async () => {
    for (const q of ['食べる', 'taberu']) {
      expectContains(await run(q), 'vocab', [{ t: '食べる', level: 'N5', lesson: 7 }, { t: '食べます', level: 'N5', lesson: 6 }]);
    }
  });

  it('T-29 食べられない → 食べる / 食べます (potential/passive, negative)', async () => {
    const r = await run('食べられない');
    for (const ref of [{ t: '食べる', level: 'N5' as Level, lesson: 7 }, { t: '食べます', level: 'N5' as Level, lesson: 6 }]) {
      const h = r.groups.vocab.find((x) => matches(x, ref));
      expect(h?.deinflection?.lemma).toBe('食べる');
      expect(h?.deinflection?.steps.map((s) => s.en)).toEqual(['potential/passive', 'negative']);
    }
  });

  it('T-30 待たされた → 待つ (causative-passive, past)', async () => {
    const r = await run('待たされた');
    const h = r.groups.vocab.find((x) => titleAliases(x.title).includes('待つ') && x.level === 'N5' && x.lesson === 14);
    expect(h?.deinflection?.steps.map((s) => s.en)).toEqual(['causative-passive', 'past']);
    expect(h?.deinflection?.steps.map((s) => s.ja)).toEqual(['使役受身', '過去']);
  });

  it('T-31 読まずに → 読む; grammar 〜ずに', async () => {
    const r = await run('読まずに');
    expectContains(r, 'vocab', [{ t: '読む', level: 'N5', lesson: 9 }]);
    expectContains(r, 'grammar', [{ t: '〜ずに', level: 'N3', lesson: 10 }]);
  });

  it('T-32 高かった → 高い; 寒くて → 寒い', async () => {
    expectContains(await run('高かった'), 'vocab', [{ t: '高い', level: 'N5', lesson: 8 }]);
    expectContains(await run('寒くて'), 'vocab', [{ t: '寒い', level: 'N5', lesson: 5 }]);
  });

  it('T-33 (amended) かえって: 帰る first among deinflections, never 変える (its te-form is 変えて)', async () => {
    const r = await run('かえって');
    const deinflected = r.groups.vocab.filter((h) => h.matchKind === 'deinflected');
    expect(titleAliases(deinflected[0].title)).toContain('帰る');
    expect(deinflected[0].level).toBe('N5');
    for (const ichidan of ['変える', '替える', '換える', '代える']) expect(r.groups.vocab.some((h) => h.title === ichidan)).toBe(false);
    const prefix = r.groups.vocab.findIndex((h) => h.title === 'かえって来ます' && h.level === 'N4');
    expect(prefix).toBeGreaterThan(r.groups.vocab.indexOf(deinflected[deinflected.length - 1]));
    expect(r.groups.vocab[prefix].matchKind).toBe('prefix');
  });

  it('T-34 きた: 北 first, then 来る and 着る above every prefix hit; kanji 来 and 北', async () => {
    const r = await run('きた');
    expectTop(r, 'vocab', { t: '北', level: 'N5', lesson: 20 });
    const idx = (t: string) => r.groups.vocab.findIndex((h) => titleAliases(h.title).includes(t) && h.level === 'N5');
    const firstPrefix = r.groups.vocab.findIndex((h) => h.matchKind === 'prefix');
    expect(idx('来る')).toBeGreaterThan(0);
    expect(idx('着る')).toBeGreaterThan(0);
    if (firstPrefix >= 0) {
      expect(idx('来る')).toBeLessThan(firstPrefix);
      expect(idx('着る')).toBeLessThan(firstPrefix);
    }
    expectContains(r, 'kanji', [{ t: '来', level: 'N5', lesson: 4 }, { t: '北', level: 'N5', lesson: 20 }]);
  });

  it('T-35 kyoushitsu / kyōshitsu / kyousitu exact, kyoshitsu folded', async () => {
    for (const q of ['kyoushitsu', 'kyōshitsu', 'kyousitu', 'kyoshitsu']) {
      expectTop(await run(q), 'vocab', { t: '教室', level: 'N5', lesson: 3 });
    }
    expect((await run('kyoshitsu')).groups.vocab[0].matchKind).toBe('folded');
  });

  it('T-36 jouzu / zyouzu → 上手[な]; kitte → 切手', async () => {
    for (const q of ['jouzu', 'zyouzu']) expectTop(await run(q), 'vocab', { t: '上手[な]', level: 'N5', lesson: 9 });
    expectTop(await run('kitte'), 'vocab', { t: '切手', level: 'N5', lesson: 11 });
  });

  it('T-37 lost: 迷子, 迷う and 無くなる in the top 8; kanji 迷', async () => {
    expectContains(await run('lost', { rankLevel: 'N3' }), 'vocab', [
      { t: '迷子', level: 'N3', lesson: 8 },
      { t: '迷う [道に〜]', level: 'N3', lesson: 1 },
    ]);
    // D1 (docs/search/07-regression.md): core N5/N4 words make the visible top 8.
    expectContains(await run('lost', { rankLevel: 'N3' }), 'vocab', [{ t: '無くなる', level: 'N4', lesson: 13 }]);
    expectContains(await run('lost'), 'kanji', [{ t: '迷', level: 'N3', lesson: 1 }]);
  });

  it('T-38 even never matches "event"', async () => {
    const r = await run('even', { limitPerType: Infinity });
    expect(r.groups.grammar.some((h) => h.title.startsWith('A(place)で Bが あります') && h.level === 'N5')).toBe(false);
    expect(r.groups.vocab.some((h) => /\bevent/i.test(h.meaning) && !/\beven\b/i.test(h.meaning))).toBe(false);
  });

  it('T-39 に: exact-only, particle grammar, vocab 二 and 荷, ≤ 40', async () => {
    const top = await run('に', { rankLevel: 'N3' });
    expect(titles(top.groups.grammar).slice(0, 2)).toEqual(['N(time)に V N5 L4', 'N(person)に あげます、etc. N5 L7']);
    const r = await run('に', { limitPerType: Infinity });
    expect(r.exactOnly).toBe(true);
    expect(titles(r.groups.grammar)).toContain('N(time)に V N5 L4');
    expect(titles(r.groups.grammar)).toContain('N(person)に あげます、etc. N5 L7');
    expect(r.groups.vocab.every((h) => h.reading === 'に')).toBe(true);
    expect(present(r.groups.vocab, { t: '二', level: 'N5', uid: 'n5-vocab-2-29' })).toBe(true);
    expect(present(r.groups.vocab, { t: '荷', level: 'N1' })).toBe(true);
    const total = r.totals.grammar + r.totals.vocab + r.totals.kanji;
    expect(total).toBeLessThanOrEqual(40);
  });

  // Amended 2026-11: 余程 N1 was merged into よほど N3 (SAME_WORD_SPELLINGS); the kanji
  // spelling still finds it.
  it('T-40 よほど → よっぽど/よほど, よほど; 余程 finds よほど', async () => {
    expectContains(await run('よほど'), 'vocab', [
      { t: 'よっぽど/よほど', level: 'N3', lesson: 17 },
      { t: 'よほど', level: 'N3', lesson: 22 },
    ]);
    expect((await run('よほど')).groups.vocab.some((h) => h.title === '余程')).toBe(false);
    for (const [kanji, kana] of [['余程', 'よほど'], ['相応しい', 'ふさわしい'], ['是非', 'ぜひ']]) {
      expect((await run(kanji)).groups.vocab[0].title).toBe(kana);
    }
  });

  // N3 repeats removed by scripts/dedupe-vocab.ts; N5 (list word) + N4 L21 (textbook) collapse.
  it('T-41 ちょうど: one row with N5 and N4 L21 badges', async () => {
    const r = await run('ちょうど');
    const row = r.groups.vocab.find((h) => h.title === 'ちょうど');
    const at = [row, ...(row?.alsoAt ?? [])].map((x) => `${x?.level}-${x?.lesson}`).sort();
    expect(at).toEqual(['N4-21', 'N5-22']);
  });

  it('T-42 丁度: no word match; kanji 丁 and 度 listed', async () => {
    const r = await run('丁度');
    expect(r.wordMatch).toBe(false);
    expect(r.totals.vocab + r.totals.grammar).toBe(0);
    expect(r.groups.kanji.map((h) => h.uid).sort()).toEqual(['n1-kanji-11-6', 'n5-kanji-22-6'].sort());
  });

  it('T-43 (data side) ものの with level N2 and ばかり with N2,N3 filter by level', async () => {
    const a = await run('ものの', { levels: ['N2'] });
    expectTop(a, 'grammar', { t: '〜ものの', level: 'N2', lesson: 4 });
    const b = await run('ばかり', { levels: ['N2', 'N3'], limitPerType: Infinity });
    expect(b.groups.grammar.every((h) => h.level === 'N2' || h.level === 'N3')).toBe(true);
    expect(b.otherLevelsCount).toBeGreaterThan(0);
  });

  it('T-44 (data side) 〜ものの hit carries the uid for ?focus=', async () => {
    const r = await run('ものの');
    expect(r.groups.grammar[0].uid).toMatch(/^n2-grammar-4-\d+$/);
  });
});

/** docs/search/07-regression.md: the browser regression's open items and owner decisions. */
describe('regression 2026-11 (R1–R14, D1–D3)', () => {
  const top = (list: SearchHit[], n: number) => list.slice(0, n).map((h) => h.title);

  it('R1 direct meaning hits rank above chip members that merely share the function', async () => {
    const soon = await run('as soon as');
    expect(top(soon.groups.grammar, 5)).toEqual(expect.arrayContaining(['〜次第（だ／で）', '〜か〜ないかのうちに']));
    expect(top(soon.groups.grammar, 5)).not.toContain('今 -時-分です');
    const acc = await run('according to');
    expect(acc.groups.grammar[0].title).toBe('〜によると／〜によれば');
    const even = await run('even', { limitPerType: Infinity });
    expect(even.groups.grammar.findIndex((h) => h.title === '〜さえ')).toBeLessThan(4);
  });

  it('R2 a word leads over a kanji reading or a same-level grammar fragment', async () => {
    for (const q of ['たべる', 'taberu', 'のむ']) expect((await run(q)).groupOrder[0]).toBe('vocab');
    for (const q of ['いくら', 'だれ']) expect((await run(q)).groupOrder[0]).toBe('vocab');
  });

  it('D2 an exact grammar key leads over a derived or rarer word (みたい, ます)', async () => {
    expect((await run('みたい')).groupOrder[0]).toBe('grammar');
    expect((await run('ます')).groupOrder[0]).toBe('grammar');
    expect((await run('わかります')).groupOrder[0]).toBe('vocab');
  });

  it('R3 kana readings find grammar written in kanji', async () => {
    expectTop(await run('うえで'), 'grammar', { t: '〜上で', level: 'N3' });
    expectContains(await run('しだい'), 'grammar', [{ t: '〜次第（だ／で）', level: 'N2' }]);
    expectTop(await run('ぎみ'), 'grammar', { t: '〜気味（ぎみ）', level: 'N3' });
  });

  it('R4 plain-form look-ups find grammar titled in ます/です', async () => {
    expectContains(await run('たほうがいい'), 'grammar', [{ t: 'Vた-form／Vない-form ない + ほうがいいです', level: 'N4' }]);
    expectContains(await run('かもしれない'), 'grammar', [{ t: 'plain form + かもしれません', level: 'N4' }]);
  });

  it('R5 いく is not いい; ii is romaji for いい', async () => {
    expect((await run('いく')).groups.vocab.some((h) => h.title === 'いい')).toBe(false);
    expectTop(await run('ii'), 'vocab', { t: 'いい', level: 'N5' });
    expectTop(await run('いいです'), 'vocab', { t: 'いい', level: 'N5' });
  });

  it('R6 / D1 / D3 exact and lemma hits rank core levels first', async () => {
    expect((await run('いる')).groups.vocab[0].title).toBe('います');
    const bun = await run('分');
    expect(top(bun.groups.vocab, 3)).toEqual(expect.arrayContaining(['自分']));
    expect(bun.groups.vocab[0].title).not.toBe('分');
  });

  it('R9 / R10 no kanji-in-phrase rows for kana queries, no 2-kana noise inside other keys', async () => {
    expect((await run('です')).groups.kanji).toHaveLength(0);
    expect((await run('さい')).groups.grammar.some((h) => h.title.includes('ください'))).toBe(false);
    expect((await run('だけ')).groups.kanji.some((h) => h.title === '砕')).toBe(false);
    expect((await run('きいた')).groups.kanji.some((h) => h.title === '北')).toBe(false);
    expect((await run('すき')).groups.grammar.some((h) => h.title.includes('きる'))).toBe(false);
  });

  it('R7 / R8 / R15 content: 行く reads いく, core expressions in N5 lessons 1/3/7, new grammar points', async () => {
    expectTop(await run('iku'), 'vocab', { t: '行く', level: 'N5', lesson: 4 });
    expectTop(await run('nihongo'), 'vocab', { t: '日本語', level: 'N5', lesson: 3 });
    expectTop(await run('こんにちは'), 'vocab', { t: 'こんにちは', level: 'N5', lesson: 1 });
    // The N2/N3 copies were deduped: one row, at N5 only.
    expect((await run('こんにちは')).groups.vocab.filter((h) => h.title === 'こんにちは')).toHaveLength(1);
    expectTop(await run('わりに'), 'grammar', { t: '〜わりに（は）', level: 'N3' });
    expectTop(await run('なんて'), 'grammar', { t: '〜なんて', level: 'N3' });
    expectContains(await run('なきゃ'), 'grammar', [{ t: 'Vない-formなければ なりません', level: 'N4' }]);
  });

  it('R14 want → the たい point first; a gloss match before an explanation-sentence match', async () => {
    const g = (await run('want')).groups.grammar.map((h) => h.title);
    expect(g[0]).toBe('V ます-form たいです');
    expect(g.indexOf('V-て ほしい / V-ないで ほしい')).toBeLessThan(g.indexOf('Word(s) ですか'));
  });

  it('a set phrase leads its casual short form (おはよう → おはようございます N5)', async () => {
    for (const [q, top] of [['おはよう', 'おはようございます'], ['ごめん', 'ごめんなさい'], ['おやすみ', 'おやすみなさい']]) {
      expect((await run(q)).groups.vocab[0].title).toBe(top);
    }
  });
});
