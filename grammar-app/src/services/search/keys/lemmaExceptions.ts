/**
 * Ichidan verbs whose ます-stem ends in an i-row kana (起きます, 借ります…). Godan is the
 * default for i-row stems (§2.3 rule 8), so only this small closed set needs listing.
 * Stems are given both in kanji and in kana; reviewed against the build report.
 */
export const ICHIDAN_I_EXCEPTIONS: ReadonlySet<string> = new Set([
  'い', '居', 'み', '見', 'き', '着', 'おき', '起き', 'かり', '借り', 'おり', '降り', '下り', 'あび', '浴び',
  'でき', '出来', 'たり', '足り', 'いき', '生き', 'すぎ', '過ぎ', 'しんじ', '信じ', 'かんじ', '感じ',
  'おち', '落ち', 'のび', '伸び', 'とじ', '閉じ', '似', 'に', 'あき', '飽き',
]);
