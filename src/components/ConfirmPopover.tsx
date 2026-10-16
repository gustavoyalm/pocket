import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

type Props = {
  /** Posição do elemento que abriu a confirmação */
  anchor: DOMRect;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
};

const WIDTH = 288;

/** Confirmação pequena ancorada num elemento: Enter confirma, Esc / clique fora / rolar cancela. */
export function ConfirmPopover({ anchor, title, children, confirmLabel, tone = 'default', onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onCancel();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('scroll', onCancel, true);
    window.addEventListener('resize', onCancel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('scroll', onCancel, true);
      window.removeEventListener('resize', onCancel);
    };
  }, [onCancel]);

  // Abre abaixo do elemento; se não couber, acima
  const below = anchor.bottom + 160 < window.innerHeight;
  const left = Math.min(Math.max(8, anchor.left - 8), window.innerWidth - WIDTH - 8);

  return createPortal(
    <div
      ref={ref}
      role="alertdialog"
      aria-label={title}
      style={{
        position: 'fixed',
        left,
        width: WIDTH,
        ...(below ? { top: anchor.bottom + 6 } : { bottom: window.innerHeight - anchor.top + 6 }),
      }}
      className="bg-card text-card-foreground z-50 rounded-lg border p-3 text-sm shadow-lg"
    >
      <p className="font-medium">{title}</p>
      {children && <div className="text-muted-foreground mt-1 text-xs">{children}</div>}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          ref={confirmRef}
          type="button"
          size="sm"
          onClick={onConfirm}
          className={cn(tone === 'success' && 'bg-success hover:bg-success/90 text-white')}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
