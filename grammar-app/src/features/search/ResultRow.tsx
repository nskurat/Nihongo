import { memo, type MouseEvent } from 'react';
import type { Level, SearchHit } from '../../services/search/types';
import HighlightedText from '../../components/common/HighlightedText';
import LevelLessonBadge from '../../components/common/LevelLessonBadge';
import TagBadge from '../../components/common/TagBadge';
import { rangesFor } from './highlight';
import { occurrences, optionId, reasonLine, rowTags } from './resultDisplay';
import { itemPath, toAbsoluteHref } from './searchUrl';
import { S } from './strings';

interface ResultRowProps {
  hit: SearchHit;
  rankLevel: Level;
  active: boolean;
  showTranslations: boolean;
  /** Opens a row: `to` is the router path; plain clicks navigate in-app, modified clicks fall through. */
  onOpen: (id: string, to: string, e: MouseEvent<HTMLAnchorElement>) => void;
}

const titleColor = { grammar: 'text-indigo-950', vocab: 'text-emerald-950', kanji: 'text-slate-800' } as const;

function Meaning({ hit, showTranslations }: { hit: SearchHit; showTranslations: boolean }) {
  if (!showTranslations) {
    return (
      <p className="text-sm text-slate-600 truncate">
        <span aria-hidden="true">••••••••</span>
        <span className="sr-only">{S.translationHidden}</span>
      </p>
    );
  }
  return <HighlightedText text={hit.meaning} ranges={rangesFor(hit, 'meaning')} className="block text-sm text-slate-700 truncate" />;
}

function Reason({ hit }: { hit: SearchHit }) {
  const r = reasonLine(hit);
  if (!r) return null;
  return (
    <p className="text-xs text-slate-600 mt-0.5">
      {r.from && <span lang="ja">{r.from} </span>}
      {r.to && (
        <>
          <span className="text-indigo-700" aria-hidden="true">
            →{' '}
          </span>
          <span lang="ja" className="font-semibold text-slate-700">
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

/**
 * One result (03-ux §3.3). The `role="option"` element holds text only; the pointer links
 * (a stretched primary link and the level·lesson badges, plain anchors so rows don't
 * re-render on every URL change) are its siblings, hidden from
 * assistive tech and out of the tab order, so options never nest interactive content
 * (axe nested-interactive). Keyboard users open rows from the combobox with Enter.
 */
function ResultRow({ hit, rankLevel, active, showTranslations, onOpen }: ResultRowProps) {
  const { primary, all } = occurrences(hit, rankLevel);
  const id = optionId(hit.uid);
  const to = itemPath(primary);
  const showStructure = hit.type === 'grammar' && hit.matchField === 'structure' && hit.structure;
  const tags = hit.type === 'grammar' && !showStructure ? rowTags(hit.tags) : [];
  const where = all.map((o) => `${o.level} lesson ${o.lesson}`).join(', ');

  return (
    <div
      role="presentation"
      className={`relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-3 max-md:min-h-14 border-b border-slate-100 last:border-0 transition-colors ${
        active ? 'bg-indigo-50 shadow-[inset_3px_0_0] shadow-indigo-600' : 'hover:bg-slate-50'
      }`}
    >
      <a
        href={toAbsoluteHref(to)}
        tabIndex={-1}
        aria-hidden="true"
        onClick={(e) => onOpen(id, to, e)}
        className="absolute inset-0 z-0"
      />
      <div role="option" id={id} aria-selected={active} className="relative z-0 min-w-0 flex items-start gap-3 pointer-events-none">
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
          <p className="min-w-0">
            <HighlightedText
              text={hit.title}
              ranges={rangesFor(hit, 'title')}
              lang="ja"
              className={`font-bold ${titleColor[hit.type]} ${hit.type === 'kanji' ? 'text-lg' : 'text-base'}`}
            />
            {hit.type === 'vocab' && hit.reading && hit.reading !== hit.title && (
              <HighlightedText text={hit.reading} ranges={rangesFor(hit, 'reading')} lang="ja" className="ml-2 text-sm text-slate-600" />
            )}
            {hit.type === 'kanji' && kanjiReadings(hit) && (
              <span lang="ja" className="ml-2 text-sm text-slate-600">
                {kanjiReadings(hit)}
              </span>
            )}
            <span className="sr-only">, {where}</span>
          </p>
          <Meaning hit={hit} showTranslations={showTranslations} />
          {showStructure && (
            <p className="text-xs text-slate-600 mt-0.5 truncate">
              {S.structure}:{' '}
              <HighlightedText text={hit.structure ?? ''} ranges={rangesFor(hit, 'structure')} lang="ja" className="font-mono text-indigo-900" />
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
      <div aria-hidden="true" className="relative z-10 flex flex-wrap justify-end content-start gap-1 max-w-48">
        {all.length === 1 ? (
          <LevelLessonBadge level={primary.level} lesson={primary.lesson} type={hit.type} className="pointer-events-none" />
        ) : (
          all.map((o) => (
            <LevelLessonBadge
              key={o.uid}
              level={o.level}
              lesson={o.lesson}
              type={hit.type}
              variant={o.primary ? 'solid' : 'outline'}
              to={itemPath(o)}
              onClick={(e) => onOpen(id, itemPath(o), e)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default memo(ResultRow);
