import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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

// Modal baseado no <dialog> nativo: foco, Esc e backdrop já vêm de graça.
// Cabeçalho fixo; o corpo rola quando não cabe na tela.
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // O conteúdo só monta depois do showModal, para o autoFocus dos campos funcionar
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    setShown(open);
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        'bg-card text-card-foreground m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border p-0 shadow-2xl',
        'max-h-[calc(100dvh-2rem)] open:flex open:flex-col',
        'backdrop:bg-black/60 backdrop:backdrop-blur-[2px]',
        className,
      )}
    >
      {open && shown && (
        <>
          <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{title}</h2>
              {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="text-muted-foreground hover:text-foreground hover:bg-muted -mr-2 rounded-md p-1.5 [&_svg]:size-4"
            >
              <X />
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto px-6 pt-5 pb-5">{children}</div>
        </>
      )}
    </dialog>
  );
}
