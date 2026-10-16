import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAccounts } from '@/lib/accounts';
import { cn, formatMoney } from '@/lib/utils';

const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
  new Date(),
);

export function Dashboard() {
  const { data: accounts } = useAccounts();
  const active = accounts?.filter((a) => !a.archived) ?? [];
  const total = active.reduce((sum, a) => sum + a.balance, 0);

  // Receitas/despesas virão das transações (próxima etapa)
  const stats = [
    { label: 'Saldo total', value: total, icon: Wallet, tone: total < 0 ? 'text-destructive' : '' },
    { label: 'Receitas do mês', value: 0, icon: ArrowUpRight, tone: 'text-success' },
    { label: 'Despesas do mês', value: 0, icon: ArrowDownRight, tone: 'text-destructive' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-muted-foreground text-sm capitalize">{monthName}</p>
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

      <Card className="text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
        {accounts && active.length === 0 ? (
          <>
            Comece cadastrando suas contas.
            <Link to="/contas" className="text-foreground font-medium underline-offset-4 hover:underline">
              Ir para Contas
            </Link>
          </>
        ) : (
          'Nenhuma transação ainda. O lançamento de transações é a próxima etapa.'
        )}
      </Card>
    </div>
  );
}
