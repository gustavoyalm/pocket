import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useAccounts } from '@/lib/accounts';
import { useCategories } from '@/lib/categories';
import { currentMonth, formatMonth, isValidMonth, shiftMonth } from '@/lib/dates';
import { summarize, useTransactions, type TransactionType } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';
import { useTransactionDialog } from '@/components/TransactionDialog';
import { TransactionTable } from '@/components/TransactionTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/PageHeader';

type TypeFilter = 'all' | TransactionType;

const typeFilters: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
];

export function Transactions() {
  const [params, setParams] = useSearchParams();
  const month = isValidMonth(params.get('mes')) ? params.get('mes')! : currentMonth();
  const setMonth = (m: string) =>
    setParams(m === currentMonth() ? {} : { mes: m }, { replace: true });

  const { data: transactions, isLoading, error } = useTransactions(month);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { openTransaction } = useTransactionDialog();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [accountFilter, setAccountFilter] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const categoryName = new Map(categories?.map((c) => [c.id, c.name.toLowerCase()]));
    return (transactions ?? []).filter(
      (t) =>
        (typeFilter === 'all' || t.type === typeFilter) &&
        (!accountFilter || t.account_id === accountFilter) &&
        (!q ||
          t.description?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          (t.category_id && categoryName.get(t.category_id)?.includes(q))),
    );
  }, [transactions, categories, typeFilter, accountFilter, search]);

  const totals = summarize(filtered);
  const hasFilters = typeFilter !== 'all' || accountFilter || search;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Transações"
        actions={
          <Button size="sm" onClick={() => openTransaction()}>
            <Plus />
            Nova transação
          </Button>
        }
      >
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="size-7" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft />
          </Button>
          <span className="w-36 text-center text-sm font-medium">{formatMonth(month)}</span>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight />
          </Button>
          {month !== currentMonth() && (
            <button
              type="button"
              onClick={() => setMonth(currentMonth())}
              className="text-muted-foreground hover:text-foreground ml-1 text-xs underline-offset-4 hover:underline"
            >
              hoje
            </button>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="bg-muted inline-flex shrink-0 rounded-md p-0.5">
            {typeFilters.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={typeFilter === value}
                onClick={() => setTypeFilter(value)}
                className={cn(
                  'text-muted-foreground flex-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                  typeFilter === value && 'bg-background text-foreground shadow-xs',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="sm:w-44">
            <Select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              aria-label="Conta"
              className="h-8 text-xs"
            >
              <option value="">Todas as contas</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative sm:w-64">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              placeholder="Buscar"
              aria-label="Buscar"
              className="h-8 pl-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <dl className="flex gap-5 text-xs">
          <Stat label="Receitas" value={totals.income} className="text-success" />
          <Stat label="Despesas" value={totals.expense} className="text-destructive" />
          <Stat
            label="Resultado"
            value={totals.net}
            className={totals.net < 0 ? 'text-destructive' : totals.net > 0 ? 'text-success' : ''}
          />
        </dl>
      </div>

      {error && <p className="text-destructive text-sm">Erro ao carregar transações: {error.message}</p>}

      {isLoading ? (
        <div className="bg-muted/50 h-64 animate-pulse rounded-lg border" />
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-sm">
          {hasFilters ? (
            'Nenhuma transação encontrada com esses filtros.'
          ) : (
            <>
              Nenhuma transação em {formatMonth(month)}.
              <Button variant="outline" size="sm" onClick={() => openTransaction()}>
                <Plus />
                Lançar transação
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <TransactionTable transactions={filtered} onSelect={openTransaction} />
          <p className="text-muted-foreground text-xs">
            {filtered.length} {filtered.length === 1 ? 'transação' : 'transações'}
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('money font-medium', className)}>{formatMoney(value)}</dd>
    </div>
  );
}
