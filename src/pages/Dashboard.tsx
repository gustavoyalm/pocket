import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useTransactionDialog } from '@/components/TransactionDialog';
import { TransactionTable } from '@/components/TransactionTable';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { useAccounts } from '@/lib/accounts';
import { currentMonth, formatMonth } from '@/lib/dates';
import { summarize, useTransactions } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';

export function Dashboard() {
  const month = currentMonth();
  const { data: accounts } = useAccounts();
  const { data: transactions } = useTransactions(month);
  const { openTransaction } = useTransactionDialog();

  const active = accounts?.filter((a) => !a.archived) ?? [];
  const total = active.reduce((sum, a) => sum + a.balance, 0);
  const { income, expense, net } = summarize(transactions);
  const recent = transactions?.slice(0, 12) ?? [];

  const tone = (v: number) => (v < 0 ? 'text-destructive' : v > 0 ? 'text-success' : '');
  const stats = [
    { label: 'Saldo total', value: total, className: total < 0 ? 'text-destructive' : '' },
    { label: 'Receitas do mês', value: income, className: 'text-success' },
    { label: 'Despesas do mês', value: expense, className: 'text-destructive' },
    { label: 'Resultado do mês', value: net, className: tone(net) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Visão geral"
        actions={
          active.length > 0 && (
            <Button size="sm" onClick={() => openTransaction()}>
              <Plus />
              Nova transação
            </Button>
          )
        }
      >
        <span className="text-muted-foreground text-sm">{formatMonth(month)}</span>
      </PageHeader>

      <div className="bg-card grid grid-cols-2 rounded-lg border lg:grid-cols-4">
        {stats.map(({ label, value, className }, i) => (
          <div
            key={label}
            className={cn(
              'px-4 py-3',
              i % 2 === 0 && 'border-r',
              i < 2 && 'border-b lg:border-b-0',
              i < 3 && 'lg:border-r',
            )}
          >
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className={cn('money mt-0.5 text-xl font-semibold', className)}>{formatMoney(value)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="min-w-0 space-y-2">
          <SectionTitle title="Últimas transações" link={recent.length > 0 ? '/transacoes' : undefined} />
          {recent.length > 0 ? (
            <TransactionTable transactions={recent} onSelect={openTransaction} />
          ) : (
            <Empty>
              {accounts && active.length === 0 ? (
                <>
                  Comece cadastrando suas contas.{' '}
                  <Link to="/contas" className="text-foreground font-medium underline-offset-4 hover:underline">
                    Ir para Contas
                  </Link>
                </>
              ) : (
                'Nenhuma transação este mês.'
              )}
            </Empty>
          )}
        </section>

        <section className="min-w-0 space-y-2">
          <SectionTitle title="Contas" link="/contas" />
          {active.length > 0 ? (
            <Table>
              <THead>
                <tr>
                  <Th>Conta</Th>
                  <Th className="text-right">Saldo</Th>
                </tr>
              </THead>
              <tbody>
                {active.map((a) => (
                  <Tr key={a.id}>
                    <Td className="w-full max-w-0">
                      <span className="flex items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: a.color ?? '#71717a' }} />
                        <span className="truncate">{a.name}</span>
                      </span>
                    </Td>
                    <Td className={cn('money text-right', a.balance < 0 && 'text-destructive')}>
                      {formatMoney(a.balance)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>Nenhuma conta cadastrada.</Empty>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ title, link }: { title: string; link?: string }) {
  return (
    <div className="flex h-6 items-center justify-between">
      <h2 className="text-sm font-medium">{title}</h2>
      {link && (
        <Link to={link} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">
          Ver todas
        </Link>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
      {children}
    </div>
  );
}
