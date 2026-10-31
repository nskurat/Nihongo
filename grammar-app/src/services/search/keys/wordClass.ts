import type { WordType } from '../deinflectRules';
import type { MasuRule } from './masuToDict';

/**
 * Word class of a vocab row, used to drop deinflections of the wrong class (teacher
 * review F1: して is する, not 知る; かえって is 帰る, not 変える). A row may have several
 * classes (slash pairs, い-words that are also な-adjectives), so a class set is a string:
 * `1` ichidan, `5` godan, `k` 来る, `s` する, `i` い-adjective, `n` everything else.
 */
export type ClassSet = string;

/** Godan verbs ending in いる/える-shaped る (the standard list, about 45 entries). */
export const GODAN_RU_EXCEPTIONS: readonly string[] = [
  '帰る', '返る', '反る', '切る', '斬る', '知る', '入る', '要る', '走る', '減る', '蹴る', '限る', '参る', '散る',
  '滑る', '握る', '喋る', '焦る', '照る', '練る', '煎る', '炒る', '茂る', '湿る', '陥る', '遮る', '覆る', '罵る',
  '嘲る', '翻る', '甦る', '蘇る', '捻る', '侮る', '遡る', '耽る', '漲る', '迸る', '混じる', '交じる', '詰る',
  '抉る', '弄る', '契る', '競る', '捩る', '削る', 'しゃべる', 'すべる', 'はいる', 'かえる',
];

const I_OR_E_ROW = /[いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ]$/;
const GODAN_END = /[うくぐすつぬぶむ]$/;

/** Class of one dictionary-form surface with its reading. */
export function dictClass(surface: string, reading: string): ClassSet {
  if (/する$/.test(surface)) return 's';
  if (/(来る|くる)$/.test(surface) && /くる$/.test(reading)) return 'k';
  if (surface.endsWith('る')) {
    const before = reading.endsWith('る') ? reading.slice(0, -1) : '';
    if (!I_OR_E_ROW.test(before)) return '5';
    // かえる is only godan when written 帰る/返る/反る; 変える/替える stay ichidan.
    const godan = GODAN_RU_EXCEPTIONS.some((w) => surface.endsWith(w) && (w !== 'かえる' || surface === 'かえる'));
    return godan ? '5' : '1';
  }
  if (GODAN_END.test(surface)) return '5';
  if (surface.endsWith('い')) return 'in'; // い-adjective, or a noun/な-adjective (きれい)
  return 'n';
}

/** Class from an N5/N4 `pos` string, or null when it does not decide (bare `verb`). */
export function posClass(pos: string | undefined, surface: string): ClassSet | null {
  if (!pos) return null;
  if (/Group III/.test(pos)) return /(来る|くる|来ます|きます)$/.test(surface) ? 'k' : 's';
  if (/Group II/.test(pos)) return '1';
  if (/Group I/.test(pos)) return '5';
  if (/い-?adj/i.test(pos)) return 'i';
  if (/^verb/i.test(pos)) return null;
  return 'n';
}

export function masuRuleClass(rule: MasuRule): ClassSet {
  if (rule === 'kuru') return 'k';
  if (rule === 'suru') return 's';
  if (rule.startsWith('godan')) return '5';
  return '1';
}

/** Class letter a deinflection result needs, or null when any class will do. */
export function classForType(type: WordType): string | null {
  switch (type) {
    case 'v1':
      return '1';
    case 'v5':
      return '5';
    case 'vk':
      return 'k';
    case 'vs':
      return 's';
    case 'adj-i':
      return 'i';
    case 'noun':
      return 'n';
    default:
      return null;
  }
}

export function mergeClasses(parts: ClassSet[]): ClassSet {
  return [...new Set(parts.join(''))].sort().join('');
}

/**
 * The class set derived from cleaned keys alone (no pos, no ます rule). The loader uses
 * this; the builder ships an explicit class only when its answer differs.
 */
export function defaultClassOf(surface: string[], readings: string[]): ClassSet {
  return mergeClasses(
    surface.map((sv, i) => dictClass(sv, (readings.length === surface.length ? readings[i] : readings[0]) ?? ''))
  );
}
