import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { TransactionType } from '@/lib/transactions';
import { cn } from '@/lib/utils';

export const seriesColor = (type: TransactionType) =>
  type === 'income' ? 'var(--chart-income)' : 'var(--chart-expense)';

/**
 * Barra horizontal dentro da tabela: a tabela é o próprio gráfico (e já é a versão acessível).
 * Barra fina, cantos arredondados só na ponta do dado, uma cor só (uma série).
 */
export function InlineBar({ value, max, color, muted }: { value: number; max: number; color: string; muted?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="flex h-full items-center" aria-hidden>
      <div
        className={cn('h-2.5 rounded-r-[4px]', muted && 'opacity-50')}
        style={{ width: `${pct * 100}%`, minWidth: pct > 0 ? 2 : 0, backgroundColor: color }}
      />
    </div>
  );
}

/**
 * Variação vs período anterior. A seta + texto carregam o sentido (não só a cor);
 * `goodWhenUp` define se subir é bom (receita) ou ruim (despesa).
 */
export function Change({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-muted-foreground">—</span>;
  if (Math.abs(value) < 0.005) return <span className="text-muted-foreground">0%</span>;
  const up = value > 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', good ? 'text-success' : 'text-destructive')}
      title={`${up ? 'Subiu' : 'Caiu'} ${Math.abs(value * 100).toFixed(0)}% em relação ao período anterior`}
    >
      <Icon className="size-3" />
      {Math.abs(value * 100).toFixed(0)}%
    </span>
  );
}

export function EmptyReport({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">{children}</div>
  );
}

const pctFmt = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
export const formatPercent = (v: number) => pctFmt.format(v);
