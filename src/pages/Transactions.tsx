import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useAccounts } from '@/lib/accounts';
import { groupCategories, useCategories } from '@/lib/categories';
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
  // Filtro de categoria: id de uma categoria-pai (pega todas as subs) ou de uma subcategoria
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byId = new Map(categories?.map((c) => [c.id, c]));
    // Texto pesquisável da categoria: "pai sub"
    const categoryText = (id: string) => {
      const sub = byId.get(id);
      const parent = sub?.parent_id ? byId.get(sub.parent_id) : undefined;
      return `${parent?.name ?? ''} ${sub?.name ?? ''}`.toLowerCase();
    };
    return (transactions ?? []).filter(
      (t) =>
        (typeFilter === 'all' || t.type === typeFilter) &&
        (!accountFilter || t.account_id === accountFilter) &&
        (!categoryFilter ||
          t.category_id === categoryFilter ||
          byId.get(t.category_id)?.parent_id === categoryFilter) &&
        (!q ||
          t.description?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          categoryText(t.category_id).includes(q)),
    );
  }, [transactions, categories, typeFilter, accountFilter, categoryFilter, search]);

  const totals = summarize(filtered);
  const hasFilters = typeFilter !== 'all' || accountFilter || categoryFilter || search;
  const categoryGroups = groupCategories(categories).filter(
    (g) => typeFilter === 'all' || g.type === typeFilter,
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title="Transações"
        actions={
          <>
            <Totals totals={totals} className="mr-3 hidden lg:flex" />
            <Button size="sm" onClick={() => openTransaction()}>
              <Plus />
              Nova transação
            </Button>
          </>
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

      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
          <div className="sm:w-52">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Categoria"
              className="h-8 text-xs"
            >
              <option value="">Todas as categorias</option>
              {categoryGroups.map((g) => (
                <optgroup key={g.id} label={`${g.name}${typeFilter === 'all' ? (g.type === 'income' ? ' (receita)' : '') : ''}`}>
                  <option value={g.id}>{g.name} — todas</option>
                  {g.children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          <div className="relative sm:w-56">
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
      </div>

      <Totals totals={totals} className="flex lg:hidden" />

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

function Totals({ totals, className }: { totals: ReturnType<typeof summarize>; className?: string }) {
  return (
    <dl className={cn('flex-wrap gap-x-5 gap-y-1 text-xs', className)}>
      <Stat label="Receitas" value={totals.income} className="text-success" />
      <Stat label="Despesas" value={totals.expense} className="text-destructive" />
      <Stat
        label="Resultado"
        value={totals.net}
        className={totals.net < 0 ? 'text-destructive' : totals.net > 0 ? 'text-success' : ''}
      />
    </dl>
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
