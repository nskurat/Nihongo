// Generated from grammar-app/src/data/*.json for tests and local dev only.
// A small, real subset; the production index is built by the data layer.
import type { SearchHit } from '../../../services/search/types';

export type FixtureItem = Pick<SearchHit, 'uid' | 'type' | 'level' | 'lesson' | 'title' | 'reading' | 'meaning' | 'onyomi' | 'kunyomi' | 'structure' | 'tags'>;

export const FIXTURE_ITEMS: FixtureItem[] = [
  {
    "uid": "n5-grammar-12-3",
    "type": "grammar",
    "level": "N5",
    "lesson": 12,
    "title": "Aは Bより adjective です",
    "meaning": "Describes A's quality/state compared with B, using より ('than').",
    "structure": "Aは Bより adjective です",
    "tags": [
      "comparison"
    ]
  },
  {
    "uid": "n5-grammar-12-4",
    "type": "grammar",
    "level": "N5",
    "lesson": 12,
    "title": "Aと Bと どちらが adjective ですか",
    "meaning": "Asks the listener to choose between exactly two items using どちら; answered with N のほうが adjective です.",
    "structure": "Aと Bと どちらが adjective ですか …A／Bの ほうが adjective です",
    "tags": [
      "comparison"
    ]
  },
  {
    "uid": "n5-grammar-12-5",
    "type": "grammar",
    "level": "N5",
    "lesson": 12,
    "title": "A[の中]で 何／どこ／だれ／いつが いちばん adjective ですか",
    "meaning": "Asks the listener to pick the most [adjective] item out of a category A, using いちばん ('the most').",
    "structure": "A[の中]で 何／どこ／だれ／いつが いちばん adjective ですか …Bが いちばん adjective です",
    "tags": [
      "comparison",
      "degree-extent"
    ]
  },
  {
    "uid": "n4-grammar-10-3",
    "type": "grammar",
    "level": "N4",
    "lesson": 10,
    "title": "〜ば vs 〜と vs 〜たら",
    "meaning": "〜と expresses an inevitable, predictable result and cannot be followed by the speaker's wishes, judgments, permission, hopes, or requests — the same restriction usually applies to 〜ば.",
    "structure": "〜ば vs 〜と vs 〜たら",
    "tags": [
      "conditional",
      "comparison"
    ]
  },
  {
    "uid": "n4-grammar-11-1",
    "type": "grammar",
    "level": "N4",
    "lesson": 11,
    "title": "V potential-form／V ない-form ＋ ように、V2",
    "meaning": "Expresses a purpose or goal.",
    "structure": "V potential-form／V ない-form ＋ ように、V2",
    "tags": [
      "purpose"
    ]
  },
  {
    "uid": "n4-grammar-21-2",
    "type": "grammar",
    "level": "N4",
    "lesson": 21,
    "title": "Vた-form ＋ ばかりです",
    "meaning": "Means that not much time has passed since a certain action or event occurred.",
    "structure": "Vた-form ＋ ばかりです",
    "tags": [
      "time-relative"
    ]
  },
  {
    "uid": "n3-grammar-1-1",
    "type": "grammar",
    "level": "N3",
    "lesson": 1,
    "title": "〜ように 言う / 頼む / 注意する",
    "meaning": "Indirect requests, commands, or advice",
    "structure": "Verb (Dictionary / ない form) + ように + 言う/頼む/注意する",
    "tags": [
      "quotation",
      "request"
    ]
  },
  {
    "uid": "n3-grammar-2-6",
    "type": "grammar",
    "level": "N3",
    "lesson": 2,
    "title": "むしろ",
    "meaning": "Rather / On the contrary / If anything",
    "structure": "AよりむしろB / むしろ + clause",
    "tags": [
      "comparison",
      "emphasis-assertion"
    ]
  },
  {
    "uid": "n3-grammar-5-3",
    "type": "grammar",
    "level": "N3",
    "lesson": 5,
    "title": "〜ばかりでなく／〜だけでなく",
    "meaning": "Not only ~ but also ~",
    "structure": "Plain form / N + ばかりでなく／だけでなく、〜も",
    "tags": [
      "emphasis-limitation",
      "listing-examples"
    ]
  },
  {
    "uid": "n3-grammar-5-5",
    "type": "grammar",
    "level": "N3",
    "lesson": 5,
    "title": "〜ほど〜ない",
    "meaning": "Not as ~ as ~",
    "structure": "A は B ほど + negative adjective / verb",
    "tags": [
      "comparison",
      "degree-extent"
    ]
  },
  {
    "uid": "n3-grammar-9-2",
    "type": "grammar",
    "level": "N3",
    "lesson": 9,
    "title": "〜ばかり / 〜てばかりいる",
    "meaning": "Only / Doing nothing but ~",
    "structure": "Noun + ばかり / Verb (て form) + ばかりいる",
    "tags": [
      "emphasis-limitation",
      "habit-effort"
    ]
  },
  {
    "uid": "n3-grammar-9-4",
    "type": "grammar",
    "level": "N3",
    "lesson": 9,
    "title": "〜というより",
    "meaning": "Rather than ~ / More ~ than ~",
    "structure": "A というより、B",
    "tags": [
      "comparison",
      "viewpoint-standpoint"
    ]
  },
  {
    "uid": "n3-grammar-13-4",
    "type": "grammar",
    "level": "N3",
    "lesson": 13,
    "title": "〜ほど",
    "meaning": "To the extent that ~ / So ~ that ~",
    "structure": "Verb (Plain) / Noun + ほど",
    "tags": [
      "degree-extent",
      "comparison"
    ]
  },
  {
    "uid": "n3-grammar-18-2",
    "type": "grammar",
    "level": "N3",
    "lesson": 18,
    "title": "〜に比べて",
    "meaning": "Compared to",
    "structure": "Noun + に比べて",
    "tags": [
      "comparison"
    ]
  },
  {
    "uid": "n3-grammar-23-7",
    "type": "grammar",
    "level": "N3",
    "lesson": 23,
    "title": "〜よりも",
    "meaning": "More than ~ / Rather than ~",
    "structure": "Noun / clause + よりも",
    "tags": [
      "comparison",
      "emphasis-assertion"
    ]
  },
  {
    "uid": "n2-grammar-4-1",
    "type": "grammar",
    "level": "N2",
    "lesson": 4,
    "title": "〜ものの",
    "meaning": "Although / Even though",
    "structure": "Verb/い-Adj (Plain) / な-Adj + な・である / Noun + である + ものの",
    "tags": [
      "concession-contrast",
      "formal-written"
    ]
  },
  {
    "uid": "n2-grammar-9-2",
    "type": "grammar",
    "level": "N2",
    "lesson": 9,
    "title": "〜ばかりか",
    "meaning": "Not only ~ but (even) ~",
    "structure": "Verb/い-Adj (Plain) / な-Adj + な・である / Noun + ばかりか",
    "tags": [
      "degree-extent",
      "emphasis-assertion"
    ]
  },
  {
    "uid": "n2-grammar-15-2",
    "type": "grammar",
    "level": "N2",
    "lesson": 15,
    "title": "〜くらいなら／〜ぐらいなら",
    "meaning": "Rather than ~ / If it comes to ~ (I'd rather)",
    "structure": "Verb (Dictionary) + くらいなら・ぐらいなら",
    "tags": [
      "comparison",
      "alternative-choice"
    ]
  },
  {
    "uid": "n2-grammar-17-2",
    "type": "grammar",
    "level": "N2",
    "lesson": 17,
    "title": "〜ばかりだ",
    "meaning": "Keep ~ing (for the worse) / Only continue to ~",
    "structure": "Verb (Dictionary) + ばかりだ",
    "tags": [
      "change-of-state",
      "degree-extent"
    ]
  },
  {
    "uid": "n2-grammar-19-2",
    "type": "grammar",
    "level": "N2",
    "lesson": 19,
    "title": "〜ばかりに",
    "meaning": "Just because ~ / Simply because ~ (with a bad result)",
    "structure": "Verb/い-Adj (Plain) / な-Adj + な・である / Noun + である + ばかりに",
    "tags": [
      "cause-reason",
      "result-consequence"
    ]
  },
  {
    "uid": "n1-grammar-1-4",
    "type": "grammar",
    "level": "N1",
    "lesson": 1,
    "title": "〜ならまだしも",
    "meaning": "If it were ~, it might be OK, but ~",
    "structure": "Noun / Verb (Plain) + ならまだしも",
    "tags": [
      "concession-contrast",
      "comparison"
    ]
  },
  {
    "uid": "n1-grammar-21-2",
    "type": "grammar",
    "level": "N1",
    "lesson": 21,
    "title": "〜にひきかえ",
    "meaning": "In contrast to ~ / Unlike ~",
    "structure": "Noun / Verb (Plain) + の + にひきかえ",
    "tags": [
      "comparison",
      "concession-contrast"
    ]
  },
  {
    "uid": "n1-grammar-26-3",
    "type": "grammar",
    "level": "N1",
    "lesson": 26,
    "title": "〜きっての",
    "meaning": "The best in ~ / The most ~ in ~",
    "structure": "Noun (group, place) + きっての + Noun",
    "tags": [
      "comparison",
      "emphasis-assertion"
    ]
  },
  {
    "uid": "n5-grammar-1-1",
    "type": "grammar",
    "level": "N5",
    "lesson": 1,
    "title": "Aは Bです",
    "meaning": "States that A is/equals B — the basic Japanese sentence of identification.",
    "structure": "Aは Bです",
    "tags": [
      "topic-focus-particle",
      "definition-meaning"
    ]
  },
  {
    "uid": "n5-vocab-3-2",
    "type": "vocab",
    "level": "N5",
    "lesson": 3,
    "title": "教室",
    "reading": "きょうしつ",
    "meaning": "classroom"
  },
  {
    "uid": "n5-vocab-4-41",
    "type": "vocab",
    "level": "N5",
    "lesson": 4,
    "title": "分かる",
    "reading": "わかる",
    "meaning": "to understand"
  },
  {
    "uid": "n5-vocab-6-1",
    "type": "vocab",
    "level": "N5",
    "lesson": 6,
    "title": "食べます",
    "reading": "たべます",
    "meaning": "eat"
  },
  {
    "uid": "n5-vocab-7-27",
    "type": "vocab",
    "level": "N5",
    "lesson": 7,
    "title": "食べる",
    "reading": "たべる",
    "meaning": "to eat"
  },
  {
    "uid": "n5-vocab-9-1",
    "type": "vocab",
    "level": "N5",
    "lesson": 9,
    "title": "わかります",
    "reading": "わかります",
    "meaning": "understand"
  },
  {
    "uid": "n5-vocab-14-4",
    "type": "vocab",
    "level": "N5",
    "lesson": 14,
    "title": "待ちます",
    "reading": "まちます",
    "meaning": "wait"
  },
  {
    "uid": "n5-vocab-14-26",
    "type": "vocab",
    "level": "N5",
    "lesson": 14,
    "title": "待つ",
    "reading": "まつ",
    "meaning": "to wait"
  },
  {
    "uid": "n4-vocab-21-10",
    "type": "vocab",
    "level": "N4",
    "lesson": 21,
    "title": "ちょうど",
    "reading": "ちょうど",
    "meaning": "Just, exactly"
  },
  {
    "uid": "n3-vocab-1-1",
    "type": "vocab",
    "level": "N3",
    "lesson": 1,
    "title": "迷う [道に〜]",
    "reading": "まよう",
    "meaning": "lose [one's way]"
  },
  {
    "uid": "n3-vocab-1-35",
    "type": "vocab",
    "level": "N3",
    "lesson": 1,
    "title": "ちょうど",
    "reading": "ちょうど",
    "meaning": "just (as in 'X is just like Y')"
  },
  {
    "uid": "n3-vocab-8-19",
    "type": "vocab",
    "level": "N3",
    "lesson": 8,
    "title": "迷子",
    "reading": "まいご",
    "meaning": "lost child, getting lost"
  },
  {
    "uid": "n3-vocab-12-25",
    "type": "vocab",
    "level": "N3",
    "lesson": 12,
    "title": "迷惑",
    "reading": "めいわく",
    "meaning": "nuisance, trouble"
  },
  {
    "uid": "n3-vocab-15-155",
    "type": "vocab",
    "level": "N3",
    "lesson": 15,
    "title": "ちょうど",
    "reading": "ちょうど",
    "meaning": "precisely, exactly"
  },
  {
    "uid": "n2-vocab-8-57",
    "type": "vocab",
    "level": "N2",
    "lesson": 8,
    "title": "分る",
    "reading": "わかる",
    "meaning": "to be understood"
  },
  {
    "uid": "n5-kanji-4-2",
    "type": "kanji",
    "level": "N5",
    "lesson": 4,
    "title": "分",
    "meaning": "minute(s), to divide",
    "onyomi": [
      "フン",
      "プン",
      "ブ"
    ],
    "kunyomi": [
      "わ"
    ]
  },
  {
    "uid": "n5-kanji-7-11",
    "type": "kanji",
    "level": "N5",
    "lesson": 7,
    "title": "食",
    "meaning": "to eat",
    "onyomi": [
      "ショク",
      "ジキ"
    ],
    "kunyomi": [
      "た・べる",
      "く・う",
      "く・らう"
    ]
  },
  {
    "uid": "n5-kanji-14-1",
    "type": "kanji",
    "level": "N5",
    "lesson": 14,
    "title": "待",
    "meaning": "to wait",
    "onyomi": [
      "タイ"
    ],
    "kunyomi": [
      "ま・つ"
    ]
  },
  {
    "uid": "n5-kanji-14-2",
    "type": "kanji",
    "level": "N5",
    "lesson": 14,
    "title": "教",
    "meaning": "to teach, to tell",
    "onyomi": [
      "キョウ"
    ],
    "kunyomi": [
      "おし・える",
      "おそ・わる"
    ]
  },
  {
    "uid": "n5-kanji-16-1",
    "type": "kanji",
    "level": "N5",
    "lesson": 16,
    "title": "明",
    "meaning": "bright, light, clear",
    "onyomi": [
      "メイ",
      "ミョウ"
    ],
    "kunyomi": [
      "あか・るい",
      "あき・らか",
      "あ・ける",
      "あ・く",
      "あ・くる",
      "あ・かす"
    ]
  },
  {
    "uid": "n5-kanji-22-6",
    "type": "kanji",
    "level": "N5",
    "lesson": 22,
    "title": "度",
    "meaning": "times, degree",
    "onyomi": [
      "ド",
      "ト",
      "タク"
    ],
    "kunyomi": [
      "たび"
    ]
  },
  {
    "uid": "n3-kanji-1-1",
    "type": "kanji",
    "level": "N3",
    "lesson": 1,
    "title": "迷",
    "meaning": "astray, be perplexed, in doubt, lost",
    "onyomi": [
      "メイ"
    ],
    "kunyomi": [
      "まよ・う"
    ]
  },
  {
    "uid": "n3-kanji-21-12",
    "type": "kanji",
    "level": "N3",
    "lesson": 21,
    "title": "因",
    "meaning": "cause, factor, be associated with, depend on",
    "onyomi": [
      "イン"
    ],
    "kunyomi": [
      "よ・る",
      "ちな・む"
    ]
  },
  {
    "uid": "n1-kanji-4-2",
    "type": "kanji",
    "level": "N1",
    "lesson": 4,
    "title": "惑",
    "meaning": "beguile, delusion, perplexity",
    "onyomi": [
      "ワク"
    ],
    "kunyomi": [
      "まど・う"
    ]
  },
  {
    "uid": "n1-kanji-11-6",
    "type": "kanji",
    "level": "N1",
    "lesson": 11,
    "title": "丁",
    "meaning": "street, ward, town",
    "onyomi": [
      "チョウ",
      "テイ",
      "チン",
      "トウ",
      "チ"
    ],
    "kunyomi": [
      "ひのと"
    ]
  }
];
