import { AlertCircle } from 'lucide-react';

/** Inline failure under an AI button: what went wrong and what to do. Renders nothing when null. */
export default function AiErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-rose-700">
      <AlertCircle size={14} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </p>
  );
}
