import { getTagMeta } from '../../utils/tags';

interface TagBadgeProps {
  tagId: string;
}

const colorClasses: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function TagBadge({ tagId }: TagBadgeProps) {
  const meta = getTagMeta(tagId);
  if (!meta) return null;

  return (
    <span
      data-tooltip={meta.description}
      className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
        colorClasses[meta.color] || colorClasses.indigo
      }`}
    >
      {meta.label}
    </span>
  );
}
