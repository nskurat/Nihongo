/**
 * The teacher's 65 regression queries (docs/search/06-teacher-review.md §3), against the
 * real data with rankLevel N5. Each row names the finding it locks in.
 */
import { describe, expect, it } from 'vitest';
import type { DocType, SearchHit, SearchOptions, SearchResponse } from '../types';
import { realIndex } from './realIndex';
import { titleAliases } from './dedupedAliases';

const { source } = realIndex();
const run = (q: string, opts: Partial<SearchOptions> = {}): Promise<SearchResponse> =>
  source.search(q, { rankLevel: 'N5', ...opts });

const titles = (list: SearchHit[]) => list.flatMap((h) => titleAliases(h.title));
const has = (r: SearchResponse, type: DocType, title: string) =>
  r.groups[type].some((h) => titleAliases(h.title).includes(title));
const idx = (r: SearchResponse, type: DocType, title: string) =>
  r.groups[type].findIndex((h) => titleAliases(h.title).includes(title));
const deinflected = (r: SearchResponse) => r.groups.vocab.filter((h) => h.matchKind === 'deinflected');

describe('teacher regression set (06-teacher-review §3)', () => {
  // ---- F1 verb class
  it('#1 して → します first; 知る and 刷る absent', async () => {
    const r = await run('して');
    expect(deinflected(r)[0].title).toBe('します');
    for (const t of ['知る', '刷る', '知ります／知っています']) expect(has(r, 'vocab', t), t).toBe(false);
  });
  it('#2 しない → します; 知る absent', async () => {
    const r = await run('しない');
    expect(has(r, 'vocab', 'します')).toBe(true);
    expect(has(r, 'vocab', '知る')).toBe(false);
  });
  it('#3 しろ → 白 first; します present; 知る absent', async () => {
    const r = await run('しろ');
    expect(r.groups.vocab[0].title).toBe('白');
    expect(has(r, 'vocab', 'します')).toBe(true);
    expect(has(r, 'vocab', '知る')).toBe(false);
  });
  it('#4 かえって → 却って, 帰る, 帰ります; no ichidan かえる', async () => {
    const r = await run('かえって');
    expect(r.groups.vocab[0].title).toBe('却って');
    expect(titles(deinflected(r))).toEqual(expect.arrayContaining(['帰る', '帰ります']));
    for (const t of ['変える', '替える', '換える', '代える']) expect(has(r, 'vocab', t), t).toBe(false);
  });
  it('#5 かえった → 帰る, 帰ります; 変える absent', async () => {
    const r = await run('かえった');
    expect(titles(deinflected(r))).toEqual(expect.arrayContaining(['帰る', '帰ります']));
    expect(has(r, 'vocab', '変える')).toBe(false);
  });
  it('#6 きって → 切手 exact, 切る deinflected; 着る absent', async () => {
    const r = await run('きって');
    expect(r.groups.vocab[0].title).toBe('切手');
    expect(deinflected(r).some((h) => h.title.startsWith('切る'))).toBe(true);
    expect(has(r, 'vocab', '着る')).toBe(false);
  });
  it('#7 きて → 来る, 来ます, 着る; 切る/斬る absent', async () => {
    const r = await run('きて');
    expect(titles(r.groups.vocab)).toEqual(expect.arrayContaining(['来る', '来ます', '着る']));
    expect(r.groups.vocab.some((h) => h.title.startsWith('切る') || h.title === '斬る')).toBe(false);
  });
  it('#8 いって → 行く first; 要る, 言う present; いつ and います absent', async () => {
    const r = await run('いって');
    expect(titleAliases(r.groups.vocab[0].title)).toContain('行く');
    expect(titles(r.groups.vocab)).toEqual(expect.arrayContaining(['要る', '言う']));
    expect(has(r, 'vocab', 'いつ')).toBe(false);
    expect(has(r, 'vocab', 'います')).toBe(false);
  });
  it('#9 いて → います first; いつ absent', async () => {
    const r = await run('いて');
    expect(r.groups.vocab[0].title).toBe('います');
    expect(has(r, 'vocab', 'いつ')).toBe(false);
  });
  it('#10 もった → 持つ first; もう／まだ absent', async () => {
    const r = await run('もった');
    expect(r.groups.vocab[0].title.startsWith('持つ')).toBe(true);
    expect(has(r, 'vocab', 'もう／まだ')).toBe(false);
  });
  it('#11 ねて → 寝る/寝ます; 練る absent', async () => {
    const r = await run('ねて');
    expect(titles(deinflected(r))).toEqual(expect.arrayContaining(['寝る', '寝ます']));
    expect(has(r, 'vocab', '練る')).toBe(false);
  });
  it('#12 おきて → 起きる/起きます; 送ります absent', async () => {
    const r = await run('おきて');
    expect(titles(r.groups.vocab)).toEqual(expect.arrayContaining(['起きる', '起きます']));
    expect(has(r, 'vocab', '送ります')).toBe(false);
  });
  it('#13 させる → します (causative) above 差す', async () => {
    const r = await run('させる');
    expect(idx(r, 'vocab', 'します')).toBeLessThan(idx(r, 'vocab', '差す'));
    expect(idx(r, 'vocab', 'します')).toBeGreaterThanOrEqual(0);
  });
  // ---- F7 する → noun
  it('#14 話して → 話す, 話します; 話 absent', async () => {
    const r = await run('話して');
    expect(titles(r.groups.vocab)).toEqual(expect.arrayContaining(['話す', '話します']));
    expect(has(r, 'vocab', '話')).toBe(false);
  });
  it('#15 として → grammar 〜として（は）… top; vocab と absent', async () => {
    const r = await run('として');
    expect(r.groups.grammar[0].title.startsWith('〜として（は）')).toBe(true);
    expect(has(r, 'vocab', 'と')).toBe(false);
  });
  it('#16 ことにする → grammar 〜ことに する top; 殊に absent', async () => {
    const r = await run('ことにする');
    expect(r.groups.grammar[0].title.startsWith('〜ことに する')).toBe(true);
    expect(has(r, 'vocab', '殊に')).toBe(false);
  });
  it('#17 見れる → 見る with a ら抜き step', async () => {
    const h = (await run('見れる')).groups.vocab.find((x) => titleAliases(x.title).includes('見る'));
    expect(h?.deinflection?.steps.map((s) => s.en).join(' ')).toContain('ら抜き');
  });
  // ---- F5 missing rules
  it.each([
    ['#18', '食べちゃった', '食べる'],
    ['#19', '食べてる', '食べる'],
    ['#20', '静かだった', '静か'],
    ['#21', '元気です', '元気'],
    ['#23', '早く', '早い'],
    ['#24', '食べるなら', '食べる'],
  ])('%s %s → %s', async (_n, q, lemma) => {
    const r = await run(q);
    expect(deinflected(r).some((h) => titleAliases(h.title).includes(lemma))).toBe(true);
  });
  it('#18b 食べちゃった also reaches 食べます', async () => {
    expect(has(await run('食べちゃった'), 'vocab', '食べます')).toBe(true);
  });
  it('#22 いいです → いい top vocab', async () => {
    expect((await run('いいです')).groups.vocab[0].title).toBe('いい');
  });
  // ---- F6 plain-form grammar keys
  it('#25 てしまう → Vて-form + しまいました／しまいます top', async () => {
    expect((await run('てしまう')).groups.grammar[0]).toMatchObject({ title: 'Vて-form + しまいました／しまいます', level: 'N4', lesson: 4 });
  });
  it('#26 はずだ → …はずです (N4 L21) top', async () => {
    const top = (await run('はずだ')).groups.grammar[0];
    expect(top.title.endsWith('はずです')).toBe(true);
    expect([top.level, top.lesson]).toEqual(['N4', 21]);
  });
  it('#27 ようになる → Vようになります／Vなくなります top', async () => {
    expect((await run('ようになる')).groups.grammar[0].title).toBe('Vようになります／Vなくなります');
  });
  // ---- F2 romaji
  it('#28 konnichiwa → こんにちは', async () => {
    const r = await run('konnichiwa');
    expect(r.groups.vocab[0].title).toBe('こんにちは');
    expect(r.queryAs).toBe('こんにちは');
  });
  it('#29 minna → みんな top', async () => {
    expect((await run('minna')).groups.vocab[0]).toMatchObject({ title: 'みんな', level: 'N5', lesson: 18 });
  });
  it('#30 onna → 女 top', async () => {
    expect((await run('onna')).groups.vocab[0]).toMatchObject({ title: '女', level: 'N5', lesson: 8 });
  });
  it('#31 こんにちわ → こんにちは', async () => {
    expect((await run('こんにちわ')).groups.vocab[0].title).toBe('こんにちは');
  });
  it("#32 kan'i → 簡易; kani does not", async () => {
    expect((await run("kan'i")).groups.vocab[0].title).toBe('簡易');
    expect(has(await run('kani', { limitPerType: Infinity }), 'vocab', '簡易')).toBe(false);
  });
  // ---- F3 English function words
  it('#33 because → grammar first; から and ので in the top 3', async () => {
    const r = await run('because');
    expect(r.groupOrder[0]).toBe('grammar');
    const top3 = titles(r.groups.grammar.slice(0, 3));
    expect(top3).toContain('S1から、S2');
    expect(top3.some((t) => t.includes('ので'))).toBe(true);
  });
  it('#34 before → まえに in grammar top 3', async () => {
    expect(titles((await run('before')).groups.grammar.slice(0, 3)).some((t) => t.includes('まえに'))).toBe(true);
  });
  it('#35 when → とき in grammar top 3', async () => {
    const top = (await run('when')).groups.grammar.slice(0, 3);
    expect(top.some((h) => h.title.includes('とき') && h.level === 'N5' && h.lesson === 23)).toBe(true);
  });
  // ---- F8 Latin ranking
  it('#36 rain → 雨 top; オンライン not in the top 3', async () => {
    const r = await run('rain');
    expect(r.groups.vocab[0].title).toBe('雨');
    expect(titles(r.groups.vocab.slice(0, 3))).not.toContain('オンライン');
  });
  it('#37 so → chips Cause / reason + Result / consequence; no kanji read as そ', async () => {
    const r = await run('so');
    expect(r.categories.map((c) => c.label)).toEqual(expect.arrayContaining(['Cause / reason', 'Result / consequence']));
    // Kanji whose MEANING says "so" (然 "so, like that") are English hits and stay; only
    // romaji readings (祖, 組, 訴…) are gone.
    expect(r.groups.kanji.every((h) => h.matchKind === 'english')).toBe(true);
  });
  it('#38 ate → 食べる in the top 3; ある absent', async () => {
    const r = await run('ate');
    expect(titles(r.groups.vocab.slice(0, 3))).toContain('食べる');
    expect(has(r, 'vocab', 'ある')).toBe(false);
  });
  // ---- F4 group order
  it('#39 わかります → vocab first; わかります then 分かる; ≤ 2 contains grammar rows', async () => {
    const r = await run('わかります', { limitPerType: Infinity });
    expect(r.groupOrder[0]).toBe('vocab');
    expect(titles(r.groups.vocab.slice(0, 2))).toEqual(['わかります', '分かる']);
    expect(r.groups.grammar.filter((h) => h.matchKind === 'contains').length).toBeLessThanOrEqual(2);
  });
  it.each([
    ['#40', 'みずから', '自ら'],
    ['#41', 'たかい', '高い'],
    ['#42', 'カタカナ', '片仮名'],
    ['#43', 'otosan', 'お父さん'],
  ])('%s %s → vocab first, %s top', async (_n, q, word) => {
    const r = await run(q);
    expect(r.groupOrder[0]).toBe('vocab');
    expect(r.groups.vocab[0].title).toBe(word);
  });
  it('#44 にもかかわらず → grammar top; S1か、S2か absent', async () => {
    const r = await run('にもかかわらず');
    expect(r.groups.grammar[0].title).toBe('〜にもかかわらず');
    expect(r.groups.grammar.some((h) => h.title.startsWith('S1か、S2か'))).toBe(false);
  });
  it('#45 食べれば食べるほど → 〜ば〜ほど top of grammar', async () => {
    expect((await run('食べれば食べるほど')).groups.grammar[0].title).toBe('〜ば〜ほど');
  });
  // ---- F10 fold guard
  it('#46 いい → no folded kanji', async () => {
    const r = await run('いい', { limitPerType: Infinity });
    expect(r.groups.kanji.some((h) => h.matchKind === 'folded')).toBe(false);
  });
  it('#47 おおきい → 大きい top; 沖 absent', async () => {
    const r = await run('おおきい', { limitPerType: Infinity });
    expect(r.groups.vocab[0].title).toBe('大きい');
    expect(has(r, 'vocab', '沖') || has(r, 'kanji', '沖')).toBe(false);
  });
  // ---- F12 okurigana pairs
  it('#48 落とす → 落とす (N3) and 落す (N4)', async () => {
    const r = await run('落とす');
    expect(r.groups.vocab.some((h) => h.title.startsWith('落とす') && h.level === 'N3')).toBe(true);
    expect(r.groups.vocab.some((h) => h.title === '落す' && h.level === 'N4')).toBe(true);
  });
  it('#49 引っ越し → 引越し (N2)', async () => {
    expect((await run('引っ越し')).groups.vocab.some((h) => h.title === '引越し' && h.level === 'N2')).toBe(true);
  });
  // ---- F9 honorific lemmas
  it('#50 いらっしゃって → lemma いらっしゃる (not いらっしゃう)', async () => {
    const r = await run('いらっしゃって');
    const h = r.groups.vocab.find((x) => titleAliases(x.title).includes('いらっしゃいます'));
    expect(h?.deinflection?.lemma).toBe('いらっしゃる');
  });
  // ---- F11 chips
  it("#51 can't help → Feelings chip, no Obligation chip", async () => {
    const labels = (await run("can't help")).categories.map((c) => c.label);
    expect(labels).toContain('Feelings / attitude');
    expect(labels).not.toContain('Obligation');
  });
  it('#52 have ever → Experience chip; Vた-form ことが あります in grammar', async () => {
    const r = await run('have ever');
    expect(r.categories.map((c) => c.label)).toContain('Experience');
    expect(r.groups.grammar.some((h) => h.title === 'Vた-form ことが あります' && h.level === 'N5')).toBe(true);
  });
  // ---- F13 kanji
  it('#53 日 → kanji group is 日 only', async () => {
    expect(titles((await run('日', { limitPerType: Infinity })).groups.kanji)).toEqual(['日']);
  });
  // ---- F15 locked-in behaviour
  it('#54 食べさせられた → 食べる: causative-passive → past', async () => {
    const h = (await run('食べさせられた')).groups.vocab.find((x) => titleAliases(x.title).includes('食べる'));
    expect(h?.deinflection?.steps.map((s) => s.en)).toEqual(['causative-passive', 'past']);
  });
  it('#55 高くなかった → 高い: negative → past', async () => {
    const h = (await run('高くなかった')).groups.vocab.find((x) => titleAliases(x.title).includes('高い'));
    expect(h?.deinflection?.steps.map((s) => s.en)).toEqual(['negative', 'past']);
  });
  it.each(['来られる', 'こられる'])('#56 %s → 来る: potential/passive', async (q) => {
    const h = (await run(q)).groups.vocab.find((x) => titleAliases(x.title).includes('来る'));
    expect(h?.deinflection?.steps.map((s) => s.en)).toEqual(['potential/passive']);
  });
  it('#57 行こう → 行く: volitional', async () => {
    const h = (await run('行こう')).groups.vocab.find((x) => titleAliases(x.title).includes('行く'));
    expect(h?.deinflection?.steps.map((s) => s.en)).toEqual(['volitional']);
  });
  it('#58 読みながら → 読む: while (ながら)', async () => {
    const h = (await run('読みながら')).groups.vocab.find((x) => titleAliases(x.title).includes('読む'));
    expect(h?.deinflection?.steps.map((s) => s.en)).toEqual(['while (ながら)']);
  });
  it('#59 よかった → いい top (deinflected)', async () => {
    expect((await run('よかった')).groups.vocab[0]).toMatchObject({ title: 'いい', matchKind: 'deinflected' });
  });
  it('#60 覚ます → exact, no 覚る', async () => {
    const r = await run('覚ます');
    expect(r.groups.vocab[0]).toMatchObject({ title: '覚ます', matchKind: 'exact' });
    expect(r.groups.vocab.some((h) => h.deinflection?.lemma === '覚る')).toBe(false);
  });
  it('#61 ～ばかりか → 〜ばかりか (N2 L9) top', async () => {
    expect((await run('～ばかりか')).groups.grammar[0]).toMatchObject({ title: '〜ばかりか', level: 'N2', lesson: 9 });
  });
  it('#62 の → exactOnly; grammar Aの B top; ≤ 40', async () => {
    const r = await run('の', { limitPerType: Infinity });
    expect(r.exactOnly).toBe(true);
    expect(r.groups.grammar[0].title.startsWith('Aの B')).toBe(true);
    expect(r.totals.grammar + r.totals.vocab + r.totals.kanji).toBeLessThanOrEqual(40);
  });
  it('#63 ﾀﾍﾞﾙ → 食べる exact', async () => {
    const top = (await run('ﾀﾍﾞﾙ')).groups.vocab[0];
    expect(titleAliases(top.title)).toContain('食べる');
    expect(top.matchKind).toMatch(/exact|lemma/); // 食べる is now taught by its ます row
  });
  it('#64 mei → 明, 名, 迷 exact', async () => {
    expect(titles((await run('mei')).groups.kanji.slice(0, 3))).toEqual(['明', '名', '迷']);
  });
  it('#65 ころぶ → kanji 転 exact, vocab 転ぶ', async () => {
    const r = await run('ころぶ');
    expect(r.groups.kanji[0]).toMatchObject({ title: '転', matchKind: 'exact' });
    expect(has(r, 'vocab', '転ぶ')).toBe(true);
  });
});

describe('QA P3: single Latin letters', () => {
  it.each(['n', 'x'])('%s gives no grammar placeholder noise', async (q) => {
    const r = await run(q, { limitPerType: Infinity });
    expect(r.totals.grammar).toBeLessThanOrEqual(2);
  });
});
