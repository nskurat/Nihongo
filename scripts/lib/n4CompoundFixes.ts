/**
 * N4 kanji `compounds[]` rows extracted from the textbook PDF with no reading, no meaning, or
 * English that leaked into the word (`夢を見ます dream a` / `dream`). Teacher-authored: each
 * fix gives the clean phrase, its reading in hiragana and an English gloss. Keyed by kanji
 * uid + the stored word, so a fix only applies to the row it was written for. Pure data plus
 * an idempotent `apply`, used by scripts/fix-n4-compounds.ts.
 */

type Json = Record<string, unknown>;
export type LessonFile = Record<string, Json[]>;

export interface CompoundFix {
  uid: string;
  /** The word as stored (the guard). */
  from: string;
  word: string;
  reading: string;
  meaning: string;
}

const f = (uid: string, from: string, word: string, reading: string, meaning: string): CompoundFix => ({ uid, from, word, reading, meaning });

export const N4_COMPOUND_FIXES: readonly CompoundFix[] = [
  f('n4-kanji-1-1', '絵をかきます', '絵をかきます', 'えをかきます', 'draw a picture'),
  f('n4-kanji-2-8', '夢を見ます dream a', '夢を見ます', 'ゆめをみます', 'have a dream'),
  f('n4-kanji-2-9', '1日に1回 once a', '1日に1回', 'いちにちにいっかい', 'once a day'),
  f('n4-kanji-2-10', '泳ぎます', '泳ぎます', 'およぎます', 'swim'),
  f('n4-kanji-2-11', 'いすに座ります', 'いすに座ります', 'いすにすわります', 'sit on a chair'),
  f('n4-kanji-2-12', '駅まで走ります', '駅まで走ります', 'えきまではしります', 'run to the station'),
  f('n4-kanji-2-13', '役に立ちます be', '役に立ちます', 'やくにたちます', 'be useful'),
  f('n4-kanji-3-11', '選びます', '選びます', 'えらびます', 'choose'),
  f('n4-kanji-3-12', '大学に通います', '大学に通います', 'だいがくにかよいます', 'go to university (regularly)'),
  f('n4-kanji-4-7', '落とします drop,', '落とします', 'おとします', 'drop, lose'),
  f('n4-kanji-4-8', '消えます go', '消えます', 'きえます', 'go off, go out (a light, a fire)'),
  f('n4-kanji-4-9', '汚れます get', '汚れます', 'よごれます', 'get dirty'),
  f('n4-kanji-4-10', '割れます break,', '割れます', 'われます', 'break, smash'),
  f('n4-kanji-5-9', '置きます put,', '置きます', 'おきます', 'put, place'),
  f('n4-kanji-5-10', '掛けます', '掛けます', 'かけます', 'hang'),
  f('n4-kanji-5-11', '片づけます tidy', '片づけます', 'かたづけます', 'tidy up'),
  f('n4-kanji-6-10', '試験を受けます take an', '試験を受けます', 'しけんをうけます', 'take an exam'),
  f('n4-kanji-6-13', '連れて行きます take (someone)', '連れて行きます', 'つれていきます', 'take (someone) along'),
  f('n4-kanji-6-14', '残ります', '残ります', 'のこります', 'remain'),
  f('n4-kanji-7-8', '試合に勝ちます win a', '試合に勝ちます', 'しあいにかちます', 'win a match'),
  f('n4-kanji-7-9', '試合に負けます lose a', '試合に負けます', 'しあいにまけます', 'lose a match'),
  f('n4-kanji-7-10', '雨が続きます rain', '雨が続きます', 'あめがつづきます', 'the rain continues'),
  f('n4-kanji-7-11', '時計が直ります the clock gets', '時計が直ります', 'とけいがなおります', 'the clock gets fixed'),
  f('n4-kanji-7-12', '病気が治ります recover from', '病気が治ります', 'びょうきがなおります', 'recover from an illness'),
  f('n4-kanji-7-13', '山に登ります climb a', '山に登ります', 'やまにのぼります', 'climb a mountain'),
  f('n4-kanji-7-14', '会社に戻ります return to the', '会社に戻ります', 'かいしゃにもどります', 'return to the office'),
  f('n4-kanji-8-7', '触ります', '触ります', 'さわります', 'touch'),
  f('n4-kanji-8-8', 'たばこを吸います', 'たばこを吸います', 'たばこをすいます', 'smoke a cigarette'),
  f('n4-kanji-8-9', '伝えます', '伝えます', 'つたえます', 'convey, tell'),
  f('n4-kanji-8-10', '投げます', '投げます', 'なげます', 'throw'),
  f('n4-kanji-8-11', '右へ曲がります turn', '右へ曲がります', 'みぎへまがります', 'turn right'),
  f('n4-kanji-9-8', '踊ります', '踊ります', 'おどります', 'dance'),
  f('n4-kanji-9-9', '歯を磨きます brush', '歯を磨きます', 'はをみがきます', 'brush one\'s teeth'),
  f('n4-kanji-9-10', '乗り換えます transfer,', '乗り換えます', 'のりかえます', 'transfer, change (trains)'),
  f('n4-kanji-10-1', '島に住んでいます', '島に住んでいます', 'しまにすんでいます', 'live on an island'),
  f('n4-kanji-10-2', '村の学校', '村の学校', 'むらのがっこう', 'the village school'),
  f('n4-kanji-10-3', '葉の色が変わります', '葉の色が変わります', 'はのいろがかわります', 'the leaves change colour'),
  f('n4-kanji-10-4', '緑が多いです', '緑が多いです', 'みどりがおおいです', 'there is a lot of greenery'),
  f('n4-kanji-10-6', '向こうの島', '向こうの島', 'むこうのしま', 'the island over there'),
  f('n4-kanji-10-7', '珍しい動物', '珍しい動物', 'めずらしいどうぶつ', 'a rare animal'),
  f('n4-kanji-10-8', '色が変わります', '色が変わります', 'いろがかわります', 'the colour changes'),
  f('n4-kanji-10-9', 'ごみを捨てます', 'ごみを捨てます', 'ごみをすてます', 'throw away rubbish'),
  f('n4-kanji-10-10', '道で拾いました', '道で拾いました', 'みちでひろいました', 'picked (it) up on the street'),
  f('n4-kanji-11-3', '耳が痛いです', '耳が痛いです', 'みみがいたいです', 'my ear hurts'),
  f('n4-kanji-11-4', '歯を磨きます', '歯を磨きます', 'はをみがきます', 'brush one\'s teeth'),
  f('n4-kanji-11-6', '野菜ジュース', '野菜ジュース', 'やさいジュース', 'vegetable juice'),
  f('n4-kanji-11-7', '低いテーブル', '低いテーブル', 'ひくいテーブル', 'a low table'),
  f('n4-kanji-11-8', '太いひも', '太いひも', 'ふといひも', 'a thick string'),
  f('n4-kanji-11-9', '体が弱いです', '体が弱いです', 'からだがよわいです', 'have a weak constitution'),
  f('n4-kanji-11-10', '若い人', '若い人', 'わかいひと', 'a young person'),
  f('n4-kanji-11-11', '別な料理', '別な料理', 'べつなりょうり', 'a different dish'),
  f('n4-kanji-11-12', 'ワープロを打ちます', 'ワープロを打ちます', 'ワープロをうちます', 'type on a word processor'),
  f('n4-kanji-11-13', '5時を過ぎます', '5時を過ぎます', 'ごじをすぎます', 'pass five o\'clock'),
  f('n4-kanji-11-14', 'サイズが違います', 'サイズが違います', 'サイズがちがいます', 'the size is different'),
  f('n4-kanji-11-15', '必ず連絡してください', '必ず連絡してください', 'かならずれんらくしてください', 'be sure to get in touch'),
  f('n4-kanji-12-1', '米を洗います', '米を洗います', 'こめをあらいます', 'wash rice'),
  f('n4-kanji-12-2', '古いお寺', '古いお寺', 'ふるいおてら', 'an old temple'),
  f('n4-kanji-12-3', '船に乗ります', '船に乗ります', 'ふねにのります', 'get on a ship'),
  f('n4-kanji-12-5', '子どもを呼びます', '子どもを呼びます', 'こどもをよびます', 'call a child'),
  f('n4-kanji-12-6', '買い物を頼みます', '買い物を頼みます', 'かいものをたのみます', 'ask (someone) to do the shopping'),
  f('n4-kanji-13-1', '木の枝', '木の枝', 'きのえだ', 'a tree branch'),
  f('n4-kanji-13-3', '卵を買います', '卵を買います', 'たまごをかいます', 'buy eggs'),
  f('n4-kanji-13-4', '新しい橋', '新しい橋', 'あたらしいはし', 'a new bridge'),
  f('n4-kanji-13-5', '本を2冊借ります', '本を2冊借ります', 'ほんをにさつかります', 'borrow two books'),
  f('n4-kanji-13-6', '日本製', '日本製', 'にほんせい', 'made in Japan'),
  f('n4-kanji-13-8', '難しい問題', '難しい問題', 'むずかしいもんだい', 'a difficult problem'),
  f('n4-kanji-13-9', '易しい日本語', '易しい日本語', 'やさしいにほんご', 'easy Japanese'),
  f('n4-kanji-13-11', '子どもを育てます', '子どもを育てます', 'こどもをそだてます', 'bring up a child'),
  f('n4-kanji-13-12', '母が亡くなりました', '母が亡くなりました', 'ははがなくなりました', 'my mother passed away'),
  f('n4-kanji-14-2', '狭い部屋', '狭い部屋', 'せまいへや', 'a small room'),
  f('n4-kanji-14-4', '恥ずかしい話', '恥ずかしい話', 'はずかしいはなし', 'an embarrassing story'),
  f('n4-kanji-14-5', '困ったことがあります', '困ったことがあります', 'こまったことがあります', 'have a problem'),
  f('n4-kanji-14-6', '火事で2人死にました', '火事で2人死にました', 'かじでふたりしにました', 'two people died in the fire'),
  f('n4-kanji-14-8', 'ビルが倒れました', 'ビルが倒れました', 'ビルがたおれました', 'the building collapsed'),
  f('n4-kanji-14-9', '人が並んでいます', '人が並んでいます', 'ひとがならんでいます', 'people are standing in line'),
  f('n4-kanji-15-2', 'サイズが合います', 'サイズが合います', 'サイズがあいます', 'the size fits'),
  f('n4-kanji-15-3', '紙の表', '紙の表', 'かみのおもて', 'the front of the paper'),
  f('n4-kanji-15-4', '本を返します', '本を返します', 'ほんをかえします', 'return a book'),
  f('n4-kanji-15-5', '次の電車', '次の電車', 'つぎのでんしゃ', 'the next train'),
  f('n4-kanji-15-6', 'りんごを5個買います', 'りんごを5個買います', 'りんごをごこかいます', 'buy five apples'),
  f('n4-kanji-15-7', '危ない所', '危ない所', 'あぶないところ', 'a dangerous place'),
  f('n4-kanji-15-10', '予定を決めます', '予定を決めます', 'よていをきめます', 'decide on a plan'),
  f('n4-kanji-15-11', '道が込んでいます', '道が込んでいます', 'みちがこんでいます', 'the road is busy'),
  f('n4-kanji-15-13', '地図で道を調べます', '地図で道を調べます', 'ちずでみちをしらべます', 'look up the way on a map'),
  f('n4-kanji-15-14', '初めて日本へ来ました', '初めて日本へ来ました', 'はじめてにほんへきました', 'came to Japan for the first time'),
  f('n4-kanji-16-1', 'お祝いをします', 'お祝いをします', 'おいわいをします', 'celebrate'),
  f('n4-kanji-16-3', 'お見舞いに行きます', 'お見舞いに行きます', 'おみまいにいきます', 'visit (someone) in hospital'),
  f('n4-kanji-16-4', 'お土産を買います', 'お土産を買います', 'おみやげをかいます', 'buy a souvenir'),
  f('n4-kanji-16-6', '靴をはきます', '靴をはきます', 'くつをはきます', 'put on shoes'),
  f('n4-kanji-16-11', 'はさみを取ってください', 'はさみを取ってください', 'はさみをとってください', 'please pass me the scissors'),
  f('n4-kanji-16-12', '靴を取り替えます', '靴を取り替えます', 'くつをとりかえます', 'exchange shoes'),
  f('n4-kanji-17-1', '大きい石', '大きい石', 'おおきいいし', 'a big stone'),
  f('n4-kanji-17-7', '厚い本', '厚い本', 'あついほん', 'a thick book'),
  f('n4-kanji-17-8', '薄いノート', '薄いノート', 'うすいノート', 'a thin notebook'),
  f('n4-kanji-17-9', 'プレゼントを包みます', 'プレゼントを包みます', 'プレゼントをつつみます', 'wrap a present'),
  f('n4-kanji-17-10', 'お湯を沸かします', 'お湯を沸かします', 'おゆをわかします', 'boil water'),
  f('n4-kanji-18-2', 'シャツを2枚買います', 'シャツを2枚買います', 'シャツをにまいかいます', 'buy two shirts'),
  f('n4-kanji-18-3', '暑い日', '暑い日', 'あついひ', 'a hot day'),
  f('n4-kanji-18-4', '寒い日', '寒い日', 'さむいひ', 'a cold day'),
  f('n4-kanji-18-5', '暖かい部屋', '暖かい部屋', 'あたたかいへや', 'a warm room'),
  f('n4-kanji-18-6', '涼しい風', '涼しい風', 'すずしいかぜ', 'a cool breeze'),
  f('n4-kanji-18-7', '花が咲きます', '花が咲きます', 'はながさきます', 'flowers bloom'),
  f('n4-kanji-18-8', 'お金を払います', 'お金を払います', 'おかねをはらいます', 'pay money'),
  f('n4-kanji-18-9', '人が増えます', '人が増えます', 'ひとがふえます', 'the number of people increases'),
  f('n4-kanji-18-10', '友達を迎えに行きます', '友達を迎えに行きます', 'ともだちをむかえにいきます', 'go to meet a friend'),
  f('n4-kanji-19-1', '頭が痛いです', '頭が痛いです', 'あたまがいたいです', 'I have a headache'),
  f('n4-kanji-19-2', 'かわいい顔', 'かわいい顔', 'かわいいかお', 'a cute face'),
  f('n4-kanji-19-3', '長い髪', '長い髪', 'ながいかみ', 'long hair'),
  f('n4-kanji-19-4', '2倍になりました', '2倍になりました', 'にばいになりました', 'it doubled'),
  f('n4-kanji-19-6', 'スイッチを押します', 'スイッチを押します', 'スイッチをおします', 'press a switch'),
  f('n4-kanji-19-7', '頭が痛いです', '頭が痛いです', 'あたまがいたいです', 'I have a headache'),
  f('n4-kanji-19-8', '静かな部屋', '静かな部屋', 'しずかなへや', 'a quiet room'),
  f('n4-kanji-19-9', '子どもが泣きます', '子どもが泣きます', 'こどもがなきます', 'a child cries'),
  f('n4-kanji-19-10', '赤ちゃんが笑います', '赤ちゃんが笑います', 'あかちゃんがわらいます', 'the baby laughs'),
  f('n4-kanji-20-1', '贈り物をします', '贈り物をします', 'おくりものをします', 'give a present'),
  f('n4-kanji-20-2', '試験の点', '試験の点', 'しけんのてん', 'exam score'),
  f('n4-kanji-20-4', '特急は速いです', '特急は速いです', 'とっきゅうははやいです', 'the limited express is fast'),
  f('n4-kanji-20-6', '漢字を覚えます', '漢字を覚えます', 'かんじをおぼえます', 'memorise kanji'),
  f('n4-kanji-20-7', '本屋で働きます', '本屋で働きます', 'ほんやではたらきます', 'work at a bookshop'),
  f('n4-kanji-21-1', 'かぜの薬', 'かぜの薬', 'かぜのくすり', 'cold medicine'),
  f('n4-kanji-21-2', '一億', '一億', 'いちおく', 'one hundred million'),
  f('n4-kanji-21-3', '彼はインド人です', '彼はインド人です', 'かれはインドじんです', 'he is Indian'),
  f('n4-kanji-21-4', '手を洗います', '手を洗います', 'てをあらいます', 'wash one\'s hands'),
  f('n4-kanji-21-6', '洗濯物が乾きます', '洗濯物が乾きます', 'せんたくものがかわきます', 'the laundry dries'),
  f('n4-kanji-21-7', 'パンを焼きます', 'パンを焼きます', 'パンをやきます', 'bake bread, make toast'),
  f('n4-kanji-21-8', 'メモを渡します', 'メモを渡します', 'メモをわたします', 'hand over a note'),
  f('n4-kanji-22-1', 'お祭りが好きです', 'お祭りが好きです', 'おまつりがすきです', 'I like festivals'),
  f('n4-kanji-22-3', '小さい庭', '小さい庭', 'ちいさいにわ', 'a small garden'),
  f('n4-kanji-22-6', '80歳です', '80歳です', 'はちじゅっさいです', 'be eighty years old'),
  f('n4-kanji-22-7', '火事は怖いです', '火事は怖いです', 'かじはこわいです', 'fires are frightening'),
  f('n4-kanji-22-8', '風が吹きます', '風が吹きます', 'かぜがふきます', 'the wind blows'),
  f('n4-kanji-23-3', '娘が3人います', '娘が3人います', 'むすめがさんにんいます', 'have three daughters'),
  f('n4-kanji-23-5', '君の本', '君の本', 'きみのほん', 'your book (casual)'),
  f('n4-kanji-23-6', '社長は忙しいです', '社長は忙しいです', 'しゃちょうはいそがしいです', 'the company president is busy'),
  f('n4-kanji-23-7', '荷物を届けます', '荷物を届けます', 'にもつをとどけます', 'deliver a parcel'),
  f('n4-kanji-23-8', '子どもと遊びます', '子どもと遊びます', 'こどもとあそびます', 'play with a child'),
  f('n4-kanji-23-9', '久しぶりですね', '久しぶりですね', 'ひさしぶりですね', 'long time no see'),
  f('n4-kanji-24-4', '1階', '1階', 'いっかい', 'first floor, ground floor'),
  f('n4-kanji-24-5', '田中様', '田中様', 'たなかさま', 'Mr./Ms. Tanaka (respectful)'),
  f('n4-kanji-24-6', 'お食事を召し上がります', 'お食事を召し上がります', 'おしょくじをめしあがります', 'have a meal (respectful)'),
  f('n4-kanji-24-7', '花屋に寄ります', '花屋に寄ります', 'はなやによります', 'stop by a flower shop'),
  f('n4-kanji-24-8', '目が疲れました', '目が疲れました', 'めがつかれました', 'my eyes are tired'),
  f('n4-kanji-24-9', '貿易会社に勤めています', '貿易会社に勤めています', 'ぼうえきがいしゃにつとめています', 'work for a trading company'),
  f('n4-kanji-24-10', 'ホテルに泊まります', 'ホテルに泊まります', 'ホテルにとまります', 'stay at a hotel'),
  f('n4-kanji-25-4', '私の意見', '私の意見', 'わたしのいけん', 'my opinion'),
  f('n4-kanji-25-8', '私が参ります', '私が参ります', 'わたしがまいります', 'I will go (humble)'),
  f('n4-kanji-25-9', 'あした伺います', 'あした伺います', 'あしたうかがいます', 'I will visit tomorrow (humble)'),
  f('n4-kanji-25-10', 'ミラーと申します', 'ミラーと申します', 'ミラーともうします', 'my name is Miller (humble)'),
];

export interface CompoundFixReport {
  changed: string[];
  skipped: string[];
}

/** Applies the fixes in place. Idempotent: a row already fixed (word = fix.word, reading set) is left alone. */
export function applyN4CompoundFixes(file: LessonFile, report: CompoundFixReport): void {
  const byUid = new Map(Object.values(file).flat().map((r) => [r.uid as string, r]));
  for (const fix of N4_COMPOUND_FIXES) {
    const kanji = byUid.get(fix.uid);
    const compounds = (kanji?.compounds ?? []) as Json[];
    const row = compounds.find((c) => c.word === fix.from) ?? compounds.find((c) => c.word === fix.word);
    if (!row) {
      report.skipped.push(`${fix.uid}: no compound "${fix.from}"`);
      continue;
    }
    if (row.word === fix.word && row.reading === fix.reading && row.meaning === fix.meaning) continue;
    row.word = fix.word;
    row.reading = fix.reading;
    row.meaning = fix.meaning;
    report.changed.push(`${fix.uid} ${fix.word}【${fix.reading}】 ${fix.meaning}`);
  }
}
