import { useState } from 'react';
import { formatInvoice } from '@/lib/cards';
import { formatMonth, formatShortDate } from '@/lib/dates';
import { useForecast, type ForecastMonth } from '@/lib/forecast';
import { cn, formatMoney } from '@/lib/utils';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { EmptyReport } from './shared';

const BAR = 'var(--chart-expense)';
const CHART_HEIGHT = 160; // px da área das barras

export function ForecastReport({ months }: { months: number }) {
  const { data, isLoading, error } = useForecast(months);
  const [selected, setSelected] = useState<string | null>(null);

  if (isLoading || !data) return <div className="bg-muted/50 h-96 animate-pulse rounded-lg border" />;
  if (error) return <p className="text-destructive text-sm">Erro ao carregar: {error.message}</p>;

  const max = Math.max(0, ...data.months.map((m) => m.payable));
  const avg = data.months.reduce((s, m) => s + m.payable, 0) / data.months.length;
  const visible = selected ? data.months.filter((m) => m.month === selected) : data.months;
  const sel = data.months.find((m) => m.month === selected);

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">A pagar por mês</h2>
            <p className="text-muted-foreground text-xs">
              Contas pendentes, faturas de cartão (no vencimento) e pagamentos agendados. Clique num mês para
              ver o que vence nele.
            </p>
          </div>
        </div>

        {max === 0 ? (
          <EmptyReport>Nada a pagar nos próximos {months} meses.</EmptyReport>
        ) : (
          <div className="relative">
            {/* Linha da média: deixa óbvio quais meses estão acima do normal */}
            <div
              className="pointer-events-none absolute inset-x-0 z-0"
              style={{ top: 20 + CHART_HEIGHT - (avg / max) * CHART_HEIGHT }}
            >
              <div className="border-muted-foreground/40 border-t" />
              <span className="bg-card text-muted-foreground absolute -top-2 right-0 pl-1.5 text-[10px]">
                média <span className="money">{formatMoney(avg)}</span>
              </span>
            </div>

            <div className="flex gap-1">
              {data.months.map((m) => (
                <MonthColumn
                  key={m.month}
                  m={m}
                  max={max}
                  heavy={m.payable > avg * 1.001 && m.payable > 0}
                  selected={selected === m.month}
                  dimmed={!!selected && selected !== m.month}
                  onClick={() => setSelected(selected === m.month ? null : m.month)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {sel && (
        <p className="text-sm">
          <span className="font-medium">{formatMonth(sel.month)}</span>
          <span className="text-muted-foreground">
            {' '}
            · a pagar <span className="money text-foreground">{formatMoney(sel.payable)}</span>
            {sel.invoices > 0 && (
              <>
                {' '}
                (faturas <span className="money">{formatMoney(sel.invoices)}</span>, outras contas{' '}
                <span className="money">{formatMoney(sel.bills)}</span>)
              </>
            )}{' '}
            · a receber <span className="money text-foreground">{formatMoney(sel.receivable)}</span>
          </span>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-muted-foreground hover:text-foreground ml-3 text-xs underline-offset-4 hover:underline"
          >
            ver todos os meses
          </button>
        </p>
      )}

      {data.events.length > 0 && (
        <Table>
          <THead>
            <tr>
              <Th className="w-28 min-w-28">Data</Th>
              <Th>Descrição</Th>
              <Th className="hidden w-56 min-w-48 md:table-cell">Conta</Th>
              <Th className="w-40 min-w-36 text-right">Valor</Th>
            </tr>
          </THead>
          <tbody>
            {visible.map((m) =>
              m.events.length === 0
                ? null
                : [
                    // Cabeçalho do mês com o subtotal
                    <tr key={`h-${m.month}`} className="bg-muted/40 border-b">
                      <Td colSpan={3} className="text-xs font-medium">
                        {formatMonth(m.month)}
                      </Td>
                      <Td className="money text-muted-foreground text-right text-xs">
                        a pagar {formatMoney(m.payable)}
                      </Td>
                    </tr>,
                    ...m.events.map((e) => {
                      const { date, weekday } = formatShortDate(e.date);
                      return (
                        <Tr key={e.key}>
                          <Td className="money text-xs">
                            {date} <span className="text-muted-foreground">{weekday}</span>
                          </Td>
                          <Td className="w-full max-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate">{e.description}</span>
                              {e.kind === 'invoice' && (
                                <span className="text-muted-foreground shrink-0 rounded border px-1 text-[11px] leading-4">
                                  fatura
                                </span>
                              )}
                              {e.overdue && (
                                <span className="text-destructive shrink-0 text-[11px]">
                                  atrasada desde {formatShortDate(e.originalDate).date}
                                </span>
                              )}
                            </span>
                          </Td>
                          <Td className="text-muted-foreground hidden md:table-cell">
                            <span className="block max-w-56 truncate">{e.accountName}</span>
                          </Td>
                          <Td className={cn('money text-right', e.amount > 0 && 'text-success')}>
                            {e.amount > 0 ? '+' : '−'}
                            {formatMoney(Math.abs(e.amount))}
                          </Td>
                        </Tr>
                      );
                    }),
                  ],
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
}

type ColumnProps = {
  m: ForecastMonth;
  max: number;
  heavy: boolean;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
};

/** Uma coluna = um mês: valor em cima, barra, e o resumo embaixo. */
function MonthColumn({ m, max, heavy, selected, dimmed, onClick }: ColumnProps) {
  const height = max > 0 ? (m.payable / max) * CHART_HEIGHT : 0;
  const breakdown =
    m.invoices > 0
      ? `Faturas ${formatMoney(m.invoices)} · outras contas ${formatMoney(m.bills)}`
      : `${m.payableCount} contas`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={breakdown}
      className={cn(
        'flex min-w-16 flex-1 flex-col items-center rounded-md px-1 pb-2 transition-colors',
        'hover:bg-accent/50 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
        selected && 'bg-accent',
        dimmed && 'opacity-50',
      )}
    >
      {/* Valor em cima da barra */}
      <div className="flex flex-col items-center justify-end" style={{ height: 20 + CHART_HEIGHT }}>
        {/* Fundo do cartão atrás do valor: a linha da média passa por trás, sem cortar o número */}
        <span
          className={cn(
            'money bg-card relative z-10 mb-1 rounded px-1 text-xs whitespace-nowrap',
            heavy ? 'font-semibold' : 'text-muted-foreground',
            selected && 'bg-accent',
          )}
        >
          {m.payable > 0 ? formatMoney(m.payable) : '—'}
        </span>
        <div
          className="relative z-10 w-6 rounded-t-[4px]"
          style={{ height: Math.max(height, m.payable > 0 ? 2 : 0), backgroundColor: BAR, opacity: heavy ? 1 : 0.45 }}
        />
      </div>
      <div className="border-border w-full border-t pt-1.5 text-center">
        <p className="text-sm font-medium">{formatInvoice(m.month)}</p>
        <p className="text-muted-foreground text-[11px]">
          {m.payableCount} {m.payableCount === 1 ? 'conta' : 'contas'}
        </p>
      </div>
    </button>
  );
}
