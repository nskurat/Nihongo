import { ReactNode, useEffect, useLayoutEffect, useRef } from 'react';

interface ModalProps {
  /** Rendered (and shown with showModal) only while true. */
  open: boolean;
  /** Escape, a backdrop click, or any close control the children render. */
  onClose: () => void;
  /** id of the element that names the dialog (its heading). */
  labelledBy: string;
  /** Classes for the visible panel; the dialog itself is a transparent full-screen layer. */
  className?: string;
  children: ReactNode;
}

/**
 * The one modal primitive: a native `<dialog>` opened with `showModal()`, so the
 * browser supplies the focus trap, Escape (`cancel`), the inert background and
 * modal semantics. On top of that it locks page scroll while open and returns
 * focus to whatever opened it.
 */
export default function Modal({ open, onClose, labelledBy, className = '', children }: ModalProps) {
  if (!open) return null;
  return (
    <OpenDialog onClose={onClose} labelledBy={labelledBy} className={className}>
      {children}
    </OpenDialog>
  );
}

function OpenDialog({ onClose, labelledBy, className, children }: Omit<ModalProps, 'open'>) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      opener?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      // Escape: the browser would close the dialog itself; let the owner decide instead.
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      // The dialog fills the viewport around the panel, so a click whose target is the
      // dialog itself landed on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none overflow-y-auto bg-transparent p-4 open:flex items-center justify-center backdrop:bg-slate-900/60 backdrop:backdrop-blur-xs"
    >
      <div className={`my-auto animate-scale-up ${className}`}>{children}</div>
    </dialog>
  );
}
