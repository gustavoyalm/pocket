import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Plus, Wallet } from 'lucide-react';
import { TransactionForm } from '@/components/TransactionForm';
import { TransactionList } from '@/components/TransactionList';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { useAccounts } from '@/lib/accounts';
import { currentMonth, formatMonth } from '@/lib/dates';
import { summarize, useTransactions, type Transaction } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';

type Editing = { transaction?: Transaction } | null;

export function Dashboard() {
  const month = currentMonth();
  const { data: accounts } = useAccounts();
  const { data: transactions } = useTransactions(month);
  const [editing, setEditing] = useState<Editing>(null);

  const active = accounts?.filter((a) => !a.archived) ?? [];
  const total = active.reduce((sum, a) => sum + a.balance, 0);
  const { income, expense } = summarize(transactions);
  const recent = transactions?.slice(0, 6) ?? [];

  const stats = [
    { label: 'Saldo total', value: total, icon: Wallet, tone: total < 0 ? 'text-destructive' : '' },
    { label: 'Receitas do mês', value: income, icon: ArrowUpRight, tone: 'text-success' },
    { label: 'Despesas do mês', value: expense, icon: ArrowDownRight, tone: 'text-destructive' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-muted-foreground text-sm capitalize">{formatMonth(month)}</p>
        </div>
        {active.length > 0 && (
          <Button onClick={() => setEditing({})}>
            <Plus />
            Nova transação
          </Button>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="p-5">
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              {label}
              <Icon className={cn('size-4', tone)} />
            </div>
            <p className={cn('money mt-2 text-2xl font-semibold', tone)}>{formatMoney(value)}</p>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Últimas transações</h2>
          {recent.length > 0 && (
            <Link
              to="/transacoes"
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              Ver todas
            </Link>
          )}
        </div>
        {recent.length > 0 ? (
          <TransactionList
            transactions={recent}
            grouped={false}
            onSelect={(t) => setEditing({ transaction: t })}
          />
        ) : (
          <Card className="text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
            {accounts && active.length === 0 ? (
              <>
                Comece cadastrando suas contas.
                <Link to="/contas" className="text-foreground font-medium underline-offset-4 hover:underline">
                  Ir para Contas
                </Link>
              </>
            ) : (
              'Nenhuma transação este mês.'
            )}
          </Card>
        )}
      </section>

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
