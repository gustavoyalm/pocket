import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn, formatMoney } from '@/lib/utils';

const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
  new Date(),
);

// Valores fixos por enquanto — virão do Supabase quando criarmos as tabelas
const stats = [
  { label: 'Saldo total', value: 0, icon: Wallet, tone: '' },
  { label: 'Receitas do mês', value: 0, icon: ArrowUpRight, tone: 'text-success' },
  { label: 'Despesas do mês', value: 0, icon: ArrowDownRight, tone: 'text-destructive' },
];

export function Dashboard() {
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

      <Card className="text-muted-foreground flex min-h-48 items-center justify-center p-6 text-center text-sm">
        Nenhuma transação ainda. Em breve você vai poder cadastrar contas e lançamentos por aqui.
      </Card>
    </div>
  );
}
