import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  paid: boolean;
  /** Pendente com data já passada */
  overdue?: boolean;
  kind?: 'expense' | 'income' | 'transfer';
  onToggle: () => void;
  disabled?: boolean;
};

const labels = {
  expense: ['Pago', 'Pendente'],
  income: ['Recebido', 'A receber'],
  transfer: ['Efetivada', 'Pendente'],
} as const;

/** Bolinha de pago/pendente: preenchida = pago; vazia = pendente; borda vermelha = atrasado. */
export function PaidToggle({ paid, overdue, kind = 'expense', onToggle, disabled }: Props) {
  const [yes, no] = labels[kind];
  const label = paid ? `${yes} — clique para marcar como ${no.toLowerCase()}` : `${overdue ? 'Atrasado' : no} — clique para marcar como ${yes.toLowerCase()}`;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={paid}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation(); // não abre a edição da linha
        onToggle();
      }}
      className={cn(
        'flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors',
        'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-50',
        paid
          ? 'border-success bg-success text-white hover:brightness-110'
          : overdue
            ? 'border-destructive hover:bg-destructive/15 border-[1.5px]'
            : 'border-muted-foreground/50 hover:border-foreground hover:bg-accent',
      )}
    >
      {paid && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}
