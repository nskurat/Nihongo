import { memo, type MouseEvent, type ReactNode } from 'react';
import type { DocType, Level, SearchHit } from '../../services/search/types';
import ResultRow from './ResultRow';
import { moreOptionId, optionId, type GroupView } from './resultDisplay';
import { S } from './strings';

const accent: Record<DocType, string> = {
  grammar: 'border-l-indigo-500',
  vocab: 'border-l-emerald-500',
  kanji: 'border-l-rose-500',
};

export interface RowContext {
  rankLevel: Level;
  activeId: string | null;
  showTranslations: boolean;
  onOpen: (id: string, to: string, e: MouseEvent<HTMLAnchorElement>) => void;
}

interface ResultGroupProps extends RowContext {
  view: GroupView;
  onFooter: (type: DocType) => void;
  /** Rendered between the header and the rows (e.g. the "no word match" note). */
  note?: ReactNode;
}

export interface RowContextProps extends RowContext {
  hits: SearchHit[];
}

export function ResultRows({ hits, ...ctx }: RowContextProps) {
  return hits.map((hit) => (
    <ResultRow
      key={hit.uid}
      hit={hit}
      rankLevel={ctx.rankLevel}
      active={ctx.activeId === optionId(hit.uid)}
      showTranslations={ctx.showTranslations}
      onOpen={ctx.onOpen}
    />
  ));
}

/** One type group: `<h2>Grammar 8 of 12</h2>`, rows, and the "Show all" option (03-ux §3.2). */
function ResultGroup({ view, onFooter, note, ...ctx }: ResultGroupProps) {
  const headingId = `search-group-${view.type}`;
  const footerId = moreOptionId(view.type);
  return (
    <div role="group" aria-labelledby={headingId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <h2
        id={headingId}
        className={`px-4 py-2.5 border-b border-slate-200 border-l-[3px] ${accent[view.type]} bg-slate-50/80 text-sm font-bold text-slate-800 flex items-baseline gap-2`}
      >
        {S.typeLabel[view.type]}
        <span className="text-xs font-semibold text-slate-600">{S.groupCount(view.rows.length, view.total)}</span>
      </h2>
      {note}
      <ResultRows hits={view.rows} {...ctx} />
      {view.footer && (
        <div className="px-4 py-2.5 border-t border-slate-100 flex justify-center">
          <div
            role="option"
            id={footerId}
            aria-selected={ctx.activeId === footerId}
            tabIndex={0}
            onClick={() => onFooter(view.type)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFooter(view.type);
              }
            }}
            className={`inline-flex items-center justify-center px-3.5 py-1.5 max-md:min-h-10 rounded-lg text-xs font-semibold border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
              ctx.activeId === footerId
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            {view.footer.kind === 'all' ? S.showAll(view.footer.count, view.type) : S.showMore(view.footer.count)}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ResultGroup);
