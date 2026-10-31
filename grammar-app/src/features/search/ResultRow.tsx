import { Link } from 'react-router-dom';
import type { Level, SearchHit } from '../../services/search/types';
import HighlightedText from '../../components/common/HighlightedText';
import LevelLessonBadge from '../../components/common/LevelLessonBadge';
import TagBadge from '../../components/common/TagBadge';
import { rangesFor } from './highlight';
import { occurrences, optionId, reasonLine, rowTags } from './resultDisplay';
import { itemPath } from './searchUrl';
import { S } from './strings';
import type { FromSearchState } from './SearchReturnBar';

interface ResultRowProps {
  hit: SearchHit;
  rankLevel: Level;
  active: boolean;
  fromSearch: string;
  showTranslations: boolean;
  onOpen: (id: string) => void;
}

const titleColor = { grammar: 'text-indigo-950', vocab: 'text-emerald-950', kanji: 'text-slate-800' } as const;

function Meaning({ hit, showTranslations }: { hit: SearchHit; showTranslations: boolean }) {
  if (!showTranslations) {
    return (
      <p className="text-sm text-slate-500 truncate">
        <span aria-hidden="true">••••••••</span>
        <span className="sr-only">{S.translationHidden}</span>
      </p>
    );
  }
  return <HighlightedText text={hit.meaning} ranges={rangesFor(hit, 'meaning')} className="block text-sm text-slate-600 truncate" />;
}

function Reason({ hit }: { hit: SearchHit }) {
  const r = reasonLine(hit);
  if (!r) return null;
  return (
    <p className="text-xs text-slate-500 mt-0.5">
      {r.from && <span lang="ja">{r.from} </span>}
      {r.to && (
        <>
          <span className="text-indigo-600" aria-hidden="true">
            →{' '}
          </span>
          <span lang="ja" className="font-semibold text-slate-600">
            {r.to}
          </span>{' '}
        </>
      )}
      {r.from && r.to && r.note ? '· ' : ''}
      {r.note && <span>{r.note}</span>}
    </p>
  );
}

function kanjiReadings(hit: SearchHit): string {
  return [...(hit.onyomi ?? []).slice(0, 2), ...(hit.kunyomi ?? []).slice(0, 2)].join(' · ');
}

/** One result: a stretched primary link, level·lesson badge(s), meaning and reason line (03-ux §3.3). */
export default function ResultRow({ hit, rankLevel, active, fromSearch, showTranslations, onOpen }: ResultRowProps) {
  const { primary, all } = occurrences(hit, rankLevel);
  const state: FromSearchState = { fromSearch };
  const to = itemPath(primary);
  const open = () => onOpen(optionId(hit.uid));
  const showStructure = hit.type === 'grammar' && hit.matchField === 'structure' && hit.structure;
  const tags = hit.type === 'grammar' && !showStructure ? rowTags(hit.tags) : [];

  const title = (
    <HighlightedText
      text={hit.title}
      ranges={rangesFor(hit, 'title')}
      lang="ja"
      className={`font-bold ${titleColor[hit.type]} ${hit.type === 'kanji' ? 'text-lg' : 'text-base'}`}
    />
  );

  return (
    <div
      role="option"
      id={optionId(hit.uid)}
      aria-selected={active}
      className={`relative px-4 py-3 max-md:min-h-14 border-b border-slate-100 last:border-0 transition-colors ${
        active ? 'bg-indigo-50 shadow-[inset_3px_0_0] shadow-indigo-500' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {hit.type === 'kanji' && (
          <div
            lang="ja"
            aria-hidden="true"
            className="w-12 h-12 shrink-0 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-2xl font-bold text-slate-800"
          >
            {hit.title}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3 max-md:flex-col max-md:gap-1">
            <Link
              to={to}
              state={state}
              tabIndex={-1}
              onClick={open}
              className="min-w-0 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-indigo-600 focus-visible:after:rounded-sm"
            >
              {title}
              {hit.type === 'vocab' && hit.reading && hit.reading !== hit.title && (
                <HighlightedText
                  text={hit.reading}
                  ranges={rangesFor(hit, 'reading')}
                  lang="ja"
                  className="ml-2 text-sm text-slate-500"
                />
              )}
              {hit.type === 'kanji' && kanjiReadings(hit) && (
                <span lang="ja" className="ml-2 text-sm text-slate-500">
                  {kanjiReadings(hit)}
                </span>
              )}
            </Link>
            <div className="flex flex-wrap gap-1 shrink-0">
              {all.length === 1 ? (
                <LevelLessonBadge level={primary.level} lesson={primary.lesson} type={hit.type} />
              ) : (
                all.map((o) => (
                  <LevelLessonBadge
                    key={o.uid}
                    level={o.level}
                    lesson={o.lesson}
                    type={hit.type}
                    variant={o.primary ? 'solid' : 'outline'}
                    to={itemPath(o)}
                    state={state}
                    onClick={open}
                  />
                ))
              )}
            </div>
          </div>
          <Meaning hit={hit} showTranslations={showTranslations} />
          {showStructure && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {S.structure}:{' '}
              <HighlightedText
                text={hit.structure ?? ''}
                ranges={rangesFor(hit, 'structure')}
                lang="ja"
                className="font-mono text-indigo-900"
              />
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {tags.map((t) => (
                <TagBadge key={t} tagId={t} />
              ))}
            </div>
          )}
          <Reason hit={hit} />
        </div>
      </div>
    </div>
  );
}
