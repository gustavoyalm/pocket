import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DEFAULT_COLOR, useCategories } from '@/lib/categories';
import { change, previousPeriod, useCategoryReport, type ReportFilters } from '@/lib/reports';
import type { TransactionType } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { Change, EmptyReport, InlineBar, formatPercent, seriesColor } from './shared';

type Row = {
  id: string;
  name: string;
  color: string;
  total: number;
  previous: number;
  count: number;
  children: Omit<Row, 'children' | 'color'>[];
};

export function CategoryReport({ filters, type }: { filters: ReportFilters; type: TransactionType }) {
  const { data: categories } = useCategories();
  const current = useCategoryReport({ ...filters, type });
  const previous = useCategoryReport({ ...filters, type, period: previousPeriod(filters.period) });
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Agrupa subcategorias nas categorias-pai, com o valor do período anterior ao lado
  const rows = useMemo<Row[]>(() => {
    if (!categories || !current.data) return [];
    const byId = new Map(categories.map((c) => [c.id, c]));
    const prev = new Map(previous.data?.map((r) => [r.categoryId, r.total]));
    const groups = new Map<string, Row>();
    const ids = new Set([...current.data.map((r) => r.categoryId), ...prev.keys()]);
    for (const id of ids) {
      const sub = byId.get(id);
      const parent = sub?.parent_id ? byId.get(sub.parent_id) : sub;
      if (!sub || !parent) continue;
      const cur = current.data.find((r) => r.categoryId === id);
      const g =
        groups.get(parent.id) ??
        groups
          .set(parent.id, {
            id: parent.id,
            name: parent.name,
            color: parent.color ?? DEFAULT_COLOR,
            total: 0,
            previous: 0,
            count: 0,
            children: [],
          })
          .get(parent.id)!;
      const item = { id, name: sub.name, total: cur?.total ?? 0, previous: prev.get(id) ?? 0, count: cur?.count ?? 0 };
      g.total += item.total;
      g.previous += item.previous;
      g.count += item.count;
      g.children.push(item);
    }
    return [...groups.values()]
      .filter((g) => g.total > 0)
      .map((g) => ({ ...g, children: g.children.filter((c) => c.total > 0).sort((a, b) => b.total - a.total) }))
      .sort((a, b) => b.total - a.total);
  }, [categories, current.data, previous.data]);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const previousTotal = previous.data?.reduce((s, r) => s + r.total, 0) ?? 0;
  const max = rows[0]?.total ?? 0;
  const color = seriesColor(type);
  const goodWhenUp = type === 'income';
  const label = type === 'income' ? 'receitas' : 'despesas';

  function toggle(id: string) {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (current.isLoading) return <div className="bg-muted/50 h-80 animate-pulse rounded-lg border" />;
  if (current.error) return <p className="text-destructive text-sm">Erro ao carregar: {current.error.message}</p>;
  if (!rows.length) return <EmptyReport>Nenhuma {label.slice(0, -1)} no período.</EmptyReport>;

  return (
    <div className={cn('space-y-2 transition-opacity', current.isFetching && 'opacity-60')}>
      <p className="text-muted-foreground text-xs">
        Total de {label}: <span className="money text-foreground font-semibold">{formatMoney(total)}</span>
        {previousTotal > 0 && (
          <>
            {' '}
            · período anterior <span className="money">{formatMoney(previousTotal)}</span>{' '}
            <Change value={change(total, previousTotal)} goodWhenUp={goodWhenUp} />
          </>
        )}
        <span className="ml-2">· clique numa categoria para ver as subcategorias</span>
      </p>
      <Table>
        <THead>
          <tr>
            <Th className="w-72 min-w-56">Categoria</Th>
            <Th className="min-w-40">
              <span className="sr-only">Proporção</span>
            </Th>
            <Th className="w-36 min-w-36 text-right">Valor</Th>
            <Th className="w-20 min-w-20 text-right">% total</Th>
            <Th className="hidden w-36 min-w-36 text-right lg:table-cell">Período anterior</Th>
            <Th className="w-24 min-w-24 text-right">Variação</Th>
            <Th className="hidden w-24 min-w-24 text-right md:table-cell">Transações</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((r) => {
            const expanded = open.has(r.id);
            return [
              <Tr key={r.id} onClick={() => toggle(r.id)} aria-expanded={expanded}>
                <Td className="max-w-72 font-medium">
                  <span className="flex items-center gap-2">
                    <ChevronRight
                      className={cn('text-muted-foreground size-3.5 shrink-0 transition-transform', expanded && 'rotate-90')}
                    />
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="truncate">{r.name}</span>
                  </span>
                </Td>
                <Td className="w-full">
                  <InlineBar value={r.total} max={max} color={color} />
                </Td>
                <Td className="money text-right font-medium">{formatMoney(r.total)}</Td>
                <Td className="money text-muted-foreground text-right text-xs">{formatPercent(r.total / total)}</Td>
                <Td className="money text-muted-foreground hidden text-right text-xs lg:table-cell">
                  {r.previous ? formatMoney(r.previous) : '—'}
                </Td>
                <Td className="money text-right text-xs">
                  <Change value={change(r.total, r.previous)} goodWhenUp={goodWhenUp} />
                </Td>
                <Td className="money text-muted-foreground hidden text-right text-xs md:table-cell">{r.count}</Td>
              </Tr>,
              ...(expanded
                ? r.children.map((c) => (
                    <Tr key={c.id} className="bg-muted/20">
                      <Td className="max-w-72 pl-12">
                        <span className="flex items-center gap-2">
                          <span className="size-1.5 shrink-0 rounded-full opacity-70" style={{ backgroundColor: r.color }} />
                          <span className="truncate">{c.name}</span>
                        </span>
                      </Td>
                      <Td>
                        <InlineBar value={c.total} max={max} color={color} muted />
                      </Td>
                      <Td className="money text-right">{formatMoney(c.total)}</Td>
                      <Td className="money text-muted-foreground text-right text-xs">{formatPercent(c.total / total)}</Td>
                      <Td className="money text-muted-foreground hidden text-right text-xs lg:table-cell">
                        {c.previous ? formatMoney(c.previous) : '—'}
                      </Td>
                      <Td className="money text-right text-xs">
                        <Change value={change(c.total, c.previous)} goodWhenUp={goodWhenUp} />
                      </Td>
                      <Td className="money text-muted-foreground hidden text-right text-xs md:table-cell">{c.count}</Td>
                    </Tr>
                  ))
                : []),
            ];
          })}
        </tbody>
      </Table>
    </div>
  );
}
