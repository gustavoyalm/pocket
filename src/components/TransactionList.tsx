import { useMemo } from 'react';
import { useAccounts } from '@/lib/accounts';
import { categoryIcon, useCategories } from '@/lib/categories';
import { formatDay } from '@/lib/dates';
import type { Transaction } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';
import { Card } from './ui/card';

type Props = {
  transactions: Transaction[];
  onSelect: (t: Transaction) => void;
  /** Agrupa por dia com cabeçalho e total diário */
  grouped?: boolean;
};

export function TransactionList({ transactions, onSelect, grouped = true }: Props) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const accountsById = useMemo(() => new Map(accounts?.map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map(categories?.map((c) => [c.id, c])), [categories]);

  const groups = useMemo(() => {
    if (!grouped) return [{ date: '', items: transactions }];
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map].map(([date, items]) => ({ date, items }));
  }, [transactions, grouped]);

  return (
    <div className="space-y-4">
      {groups.map(({ date, items }) => {
        const dayNet = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
        return (
          <section key={date || 'all'} className="space-y-1.5">
            {grouped && (
              <div className="text-muted-foreground flex items-center justify-between px-1 text-xs font-medium">
                <span className="capitalize">{formatDay(date)}</span>
                <span className="money">{formatMoney(dayNet)}</span>
              </div>
            )}
            <Card className="divide-y overflow-hidden">
              {items.map((t) => {
                const category = t.category_id ? categoriesById.get(t.category_id) : undefined;
                const account = accountsById.get(t.account_id);
                const Icon = categoryIcon(category?.icon);
                const color = category?.color ?? '#71717a';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t)}
                    className="hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                  >
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t.description || category?.name || 'Sem descrição'}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[
                          category && t.description ? category.name : null,
                          account?.name,
                          grouped ? null : formatDay(t.date),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <p
                      className={cn(
                        'money shrink-0 text-sm font-semibold',
                        t.type === 'income' ? 'text-success' : 'text-destructive',
                      )}
                    >
                      {t.type === 'income' ? '+' : '−'}
                      {formatMoney(t.amount)}
                    </p>
                  </button>
                );
              })}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
