import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

// Modal baseado no <dialog> nativo: foco, Esc e backdrop já vêm de graça
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        'bg-card text-card-foreground m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border p-0 shadow-lg',
        'backdrop:bg-black/50 backdrop:backdrop-blur-[2px]',
        className,
      )}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{title}</h2>
              {description && <p className="text-muted-foreground text-sm">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="text-muted-foreground hover:text-foreground -m-1 rounded-sm p-1 [&_svg]:size-4"
            >
              <X />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
