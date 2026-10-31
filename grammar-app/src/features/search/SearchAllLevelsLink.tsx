import { Link } from 'react-router-dom';
import { buildSearchPath } from './searchUrl';
import { S } from './strings';

/** Shown when a per-lesson filter has no hits: hands the query to global search. */
export default function SearchAllLevelsLink({ q }: { q: string }) {
  return (
    <Link
      to={buildSearchPath({ q: q.trim() })}
      state={{ searchEntry: true }}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 max-md:min-h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
    >
      {S.searchAllLevelsFor(q.trim())}
    </Link>
  );
}
