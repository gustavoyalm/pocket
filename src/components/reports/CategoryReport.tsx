import { useMemo, useState } from 'react';
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { DEFAULT_COLOR, useCategories } from '@/lib/categories';
import { change, monthCount, previousPeriod, useCategoryReport, type ReportFilters } from '@/lib/reports';
import type { TransactionType } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { DetailRows } from './DetailRows';
import { Change, EmptyReport, InlineBar, formatPercent, seriesColor } from './shared';

type Sub = { id: string; name: string; total: number; previous: number; count: number };
type Group = Sub & { color: string; children: Sub[] };

/**
 * Relatório por categoria em árvore: categoria → subcategoria → gastos.
 * Os gastos só são buscados quando a subcategoria é aberta.
 */
export function CategoryReport({ filters, type }: { filters: ReportFilters; type: TransactionType }) {
  const { data: categories } = useCategories();
  const current = useCategoryReport({ ...filters, type });
  const previous = useCategoryReport({ ...filters, type, period: previousPeriod(filters.period) });
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());

  // Agrupa subcategorias nas categorias-pai, com o valor do período anterior ao lado
  const rows = useMemo<Group[]>(() => {
    if (!categories || !current.data) return [];
    const byId = new Map(categories.map((c) => [c.id, c]));
    const prev = new Map(previous.data?.map((r) => [r.categoryId, r.total]));
    const groups = new Map<string, Group>();
    const ids = new Set([...current.data.map((r) => r.categoryId), ...prev.keys()]);
    for (const id of ids) {
      const sub = byId.get(id);
      const parent = sub?.parent_id ? byId.get(sub.parent_id) : sub;
      if (!sub || !parent) continue;
      const cur = current.data.find((r) => r.categoryId === id);
      let g = groups.get(parent.id);
      if (!g) {
        g = { id: parent.id, name: parent.name, color: parent.color ?? DEFAULT_COLOR, total: 0, previous: 0, count: 0, children: [] };
        groups.set(parent.id, g);
      }
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
  const months = monthCount(filters.period);
  const allOpen = rows.length > 0 && rows.every((r) => openGroups.has(r.id));

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  if (current.isLoading) return <div className="bg-muted/50 h-80 animate-pulse rounded-lg border" />;
  if (current.error) return <p className="text-destructive text-sm">Erro ao carregar: {current.error.message}</p>;
  if (!rows.length) return <EmptyReport>Nenhuma {label.slice(0, -1)} no período.</EmptyReport>;

  const cells = (r: Sub, muted = false) => (
    <>
      <Td className="w-full">
        <InlineBar value={r.total} max={max} color={color} muted={muted} />
      </Td>
      <Td className={cn('money text-right', !muted && 'font-medium')}>{formatMoney(r.total)}</Td>
      <Td className="money text-muted-foreground text-right text-xs">{formatPercent(r.total / total)}</Td>
      <Td className="money text-muted-foreground hidden text-right text-xs lg:table-cell">
        {months > 1 ? formatMoney(r.total / months) : r.previous ? formatMoney(r.previous) : '—'}
      </Td>
      <Td className="money text-right text-xs">
        <Change value={change(r.total, r.previous)} goodWhenUp={goodWhenUp} />
      </Td>
      <Td className="money text-muted-foreground hidden text-right text-xs md:table-cell">{r.count}</Td>
    </>
  );

  return (
    <div className={cn('space-y-2 transition-opacity', current.isFetching && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-muted-foreground text-xs">
          Total de {label}: <span className="money text-foreground font-semibold">{formatMoney(total)}</span>
          {months > 1 && (
            <>
              {' '}
              · média <span className="money text-foreground">{formatMoney(total / months)}</span>/mês
            </>
          )}
          {previousTotal > 0 && (
            <>
              {' '}
              · período anterior <span className="money">{formatMoney(previousTotal)}</span>{' '}
              <Change value={change(total, previousTotal)} goodWhenUp={goodWhenUp} />
            </>
          )}
          <span className="ml-2">· clique para abrir: categoria → subcategoria → gastos</span>
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7"
          onClick={() => {
            setOpenGroups(allOpen ? new Set() : new Set(rows.map((r) => r.id)));
            if (allOpen) setOpenSubs(new Set());
          }}
        >
          {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
          {allOpen ? 'Fechar todas' : 'Abrir todas'}
        </Button>
      </div>

      <Table>
        <THead>
          <tr>
            <Th className="w-80 min-w-64">Categoria</Th>
            <Th className="min-w-32">
              <span className="sr-only">Proporção</span>
            </Th>
            <Th className="w-36 min-w-36 text-right">Valor</Th>
            <Th className="w-20 min-w-20 text-right">% total</Th>
            <Th className="hidden w-36 min-w-36 text-right lg:table-cell">
              {months > 1 ? 'Média/mês' : 'Período anterior'}
            </Th>
            <Th className="w-24 min-w-24 text-right" title="Em relação ao período anterior, de mesmo tamanho">
              Variação
            </Th>
            <Th className="hidden w-24 min-w-24 text-right md:table-cell">Transações</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((g) => {
            const groupOpen = openGroups.has(g.id);
            return [
              <Tr key={g.id} onClick={() => setOpenGroups((s) => toggle(s, g.id))} aria-expanded={groupOpen}>
                <Td className="max-w-80 font-medium">
                  <span className="flex items-center gap-2">
                    <ChevronRight
                      className={cn('text-muted-foreground size-3.5 shrink-0 transition-transform', groupOpen && 'rotate-90')}
                    />
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                    <span className="truncate">{g.name}</span>
                  </span>
                </Td>
                {cells(g)}
              </Tr>,
              ...(groupOpen
                ? g.children.flatMap((c) => {
                    const subOpen = openSubs.has(c.id);
                    return [
                      <Tr
                        key={c.id}
                        onClick={() => setOpenSubs((s) => toggle(s, c.id))}
                        aria-expanded={subOpen}
                        className="bg-muted/20"
                      >
                        <Td className="max-w-80 pl-8">
                          <span className="flex items-center gap-2">
                            <ChevronRight
                              className={cn(
                                'text-muted-foreground size-3 shrink-0 transition-transform',
                                subOpen && 'rotate-90',
                              )}
                            />
                            <span className="size-1.5 shrink-0 rounded-full opacity-70" style={{ backgroundColor: g.color }} />
                            <span className="truncate">{c.name}</span>
                          </span>
                        </Td>
                        {cells(c, true)}
                      </Tr>,
                      subOpen && (
                        <DetailRows
                          key={`${c.id}-detail`}
                          filters={filters}
                          type={type}
                          categoryIds={[c.id]}
                          indent="pl-16"
                          parentTotal={c.total}
                        />
                      ),
                    ];
                  })
                : []),
            ];
          })}
        </tbody>
      </Table>
    </div>
  );
}
