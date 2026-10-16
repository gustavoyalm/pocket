import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useAccounts } from '@/lib/accounts';
import { useCategories } from '@/lib/categories';
import { currentMonth, formatMonth, isValidMonth, shiftMonth } from '@/lib/dates';
import { summarize, useTransactions, type Transaction, type TransactionType } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';
import { TransactionForm } from '@/components/TransactionForm';
import { TransactionList } from '@/components/TransactionList';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

type Editing = { transaction?: Transaction } | null;
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

  const [editing, setEditing] = useState<Editing>(null);
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
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
        <Button onClick={() => setEditing({})}>
          <Plus />
          Nova transação
        </Button>
      </header>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="font-medium capitalize">{formatMonth(month)}</p>
          {month !== currentMonth() && (
            <button
              type="button"
              onClick={() => setMonth(currentMonth())}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              voltar para o mês atual
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Summary label="Receitas" value={totals.income} className="text-success" />
        <Summary label="Despesas" value={totals.expense} className="text-destructive" />
        <Summary
          label="Resultado"
          value={totals.net}
          className={totals.net < 0 ? 'text-destructive' : totals.net > 0 ? 'text-success' : ''}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="bg-muted inline-flex shrink-0 rounded-md p-0.5">
          {typeFilters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={typeFilter === value}
              onClick={() => setTypeFilter(value)}
              className={cn(
                'text-muted-foreground flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
                typeFilter === value && 'bg-background text-foreground shadow-xs',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="sm:w-44">
          <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} aria-label="Conta">
            <option value="">Todas as contas</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar"
            aria-label="Buscar"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <Card className="text-destructive p-4 text-sm">Erro ao carregar transações: {error.message}</Card>
      )}

      {isLoading ? (
        <Card className="bg-muted/50 h-48 animate-pulse" />
      ) : filtered.length === 0 ? (
        <Card className="text-muted-foreground flex flex-col items-center gap-3 p-10 text-center text-sm">
          {hasFilters ? (
            'Nenhuma transação encontrada com esses filtros.'
          ) : (
            <>
              Nenhuma transação em {formatMonth(month)}.
              <Button variant="outline" onClick={() => setEditing({})}>
                <Plus />
                Lançar transação
              </Button>
            </>
          )}
        </Card>
      ) : (
        <TransactionList transactions={filtered} onSelect={(t) => setEditing({ transaction: t })} />
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.transaction ? 'Editar transação' : 'Nova transação'}
      >
        {editing && (
          <TransactionForm transaction={editing.transaction} onDone={() => setEditing(null)} />
        )}
      </Dialog>
    </div>
  );
}

function Summary({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn('money mt-1 truncate text-sm font-semibold sm:text-base', className)}>
        {formatMoney(value)}
      </p>
    </Card>
  );
}
