import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { change, monthCount, previousPeriod, useCategoryReport, useTagReport, type ReportFilters } from '@/lib/reports';
import { DEFAULT_TAG_COLOR, useTagLookup } from '@/lib/tags';
import type { TransactionType } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { DetailRows } from './DetailRows';
import { Change, EmptyReport, InlineBar, formatPercent, seriesColor } from './shared';

export function TagReport({ filters, type }: { filters: ReportFilters; type: TransactionType }) {
  const tags = useTagLookup();
  const current = useTagReport({ ...filters, type });
  const previous = useTagReport({ ...filters, type, period: previousPeriod(filters.period) });
  // Total do período (sem dupla contagem) para o "% do total"
  const totals = useCategoryReport({ ...filters, type });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const months = monthCount(filters.period);

  const rows = useMemo(() => {
    const prev = new Map(previous.data?.map((r) => [r.tagId, r.total]));
    return (current.data ?? [])
      .map((r) => {
        const tag = r.tagId ? tags.get(r.tagId) : undefined;
        return {
          tagId: r.tagId,
          key: r.tagId ?? 'none',
          name: r.tagId ? (tag?.name ?? '…') : 'Sem tag',
          color: r.tagId ? (tag?.color ?? DEFAULT_TAG_COLOR) : null,
          total: r.total,
          previous: prev.get(r.tagId) ?? 0,
          count: r.count,
        };
      })
      .sort((a, b) => (a.color === null ? 1 : b.color === null ? -1 : b.total - a.total));
  }, [current.data, previous.data, tags]);

  const periodTotal = totals.data?.reduce((s, r) => s + r.total, 0) ?? 0;
  const max = Math.max(0, ...rows.map((r) => r.total));
  const color = seriesColor(type);
  const goodWhenUp = type === 'income';
  const label = type === 'income' ? 'receitas' : 'despesas';

  if (current.isLoading) return <div className="bg-muted/50 h-64 animate-pulse rounded-lg border" />;
  if (current.error) return <p className="text-destructive text-sm">Erro ao carregar: {current.error.message}</p>;
  if (!rows.length) return <EmptyReport>Nenhuma {label.slice(0, -1)} no período.</EmptyReport>;

  return (
    <div className={cn('space-y-2 transition-opacity', current.isFetching && 'opacity-60')}>
      <p className="text-muted-foreground text-xs">
        Total de {label} no período: <span className="money text-foreground font-semibold">{formatMoney(periodTotal)}</span>
        <span className="ml-2">
          · clique numa tag para ver os gastos · uma transação com mais de uma tag conta em todas elas, então os
          percentuais podem somar mais de 100%
        </span>
      </p>
      <Table>
        <THead>
          <tr>
            <Th className="w-64 min-w-48">Tag</Th>
            <Th className="min-w-40">
              <span className="sr-only">Proporção</span>
            </Th>
            <Th className="w-36 min-w-36 text-right">Valor</Th>
            <Th className="w-20 min-w-20 text-right">% total</Th>
            <Th className="hidden w-36 min-w-36 text-right lg:table-cell">{months > 1 ? 'Média/mês' : 'Período anterior'}</Th>
            <Th className="w-24 min-w-24 text-right">Variação</Th>
            <Th className="hidden w-24 min-w-24 text-right md:table-cell">Transações</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((r) => {
            const expandable = !!r.tagId;
            const isOpen = expandable && open.has(r.key);
            return [
            <Tr
              key={r.key}
              className={cn(r.color === null && 'text-muted-foreground')}
              onClick={
                expandable
                  ? () =>
                      setOpen((s) => {
                        const next = new Set(s);
                        if (next.has(r.key)) next.delete(r.key);
                        else next.add(r.key);
                        return next;
                      })
                  : undefined
              }
              aria-expanded={expandable ? isOpen : undefined}
            >
              <Td className="max-w-64">
                <span className="flex items-center gap-2">
                <ChevronRight
                  className={cn(
                    'text-muted-foreground size-3.5 shrink-0 transition-transform',
                    isOpen && 'rotate-90',
                    !expandable && 'invisible',
                  )}
                />
                {r.color ? (
                  <span
                    className="inline-block max-w-full truncate rounded px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${r.color}26`, color: r.color }}
                  >
                    {r.name}
                  </span>
                ) : (
                  <span className="text-xs italic">{r.name}</span>
                )}
                </span>
              </Td>
              <Td className="w-full">
                <InlineBar value={r.total} max={max} color={color} muted={r.color === null} />
              </Td>
              <Td className="money text-right font-medium">{formatMoney(r.total)}</Td>
              <Td className="money text-muted-foreground text-right text-xs">
                {periodTotal ? formatPercent(r.total / periodTotal) : '—'}
              </Td>
              <Td className="money text-muted-foreground hidden text-right text-xs lg:table-cell">
                {months > 1 ? formatMoney(r.total / months) : r.previous ? formatMoney(r.previous) : '—'}
              </Td>
              <Td className="money text-right text-xs">
                <Change value={change(r.total, r.previous)} goodWhenUp={goodWhenUp} />
              </Td>
              <Td className="money text-muted-foreground hidden text-right text-xs md:table-cell">{r.count}</Td>
            </Tr>,
            isOpen && (
              <DetailRows
                key={`${r.key}-detail`}
                filters={filters}
                type={type}
                tagId={r.tagId}
                indent="pl-10"
                parentTotal={r.total}
              />
            ),
            ];
          })}
        </tbody>
      </Table>
    </div>
  );
}
