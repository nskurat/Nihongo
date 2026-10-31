import { Link } from 'react-router-dom';
import { getTagMeta } from '../../utils/tags';

interface TagBadgeProps {
  tagId: string;
  /** Router path; when set the badge links there (e.g. `/search?tag=<id>`). */
  to?: string;
}

const colorClasses: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function TagBadge({ tagId, to }: TagBadgeProps) {
  const meta = getTagMeta(tagId);
  if (!meta) return null;

  const cls = `inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
    colorClasses[meta.color] || colorClasses.indigo
  }`;

  if (to) {
    return (
      <Link
        to={to}
        data-tooltip={meta.description}
        className={`${cls} hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1`}
      >
        {meta.label}
        <span className="sr-only">: browse every grammar point with this tag</span>
      </Link>
    );
  }

  return (
    <span data-tooltip={meta.description} className={cls}>
      {meta.label}
    </span>
  );
}
