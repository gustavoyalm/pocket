import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { useAccounts } from '@/lib/accounts';
import {
  formatInvoice,
  invoiceDates,
  invoiceFor,
  invoiceStatus,
  isCard,
  statusLabel,
  useInvoices,
  type Invoice,
  type InvoiceStatus,
} from '@/lib/cards';
import { formatShortDate, shiftMonth, todayISO } from '@/lib/dates';
import { useInvoiceTransactions } from '@/lib/transactions';
import { useInvoicePayments } from '@/lib/transfers';
import { cn, formatMoney } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { useTransactionDialog } from '@/components/TransactionDialog';
import { TransactionTable } from '@/components/TransactionTable';
import { Button } from '@/components/ui/button';

const statusDot: Record<InvoiceStatus, string> = {
  open: 'bg-sky-500',
  closed: 'bg-amber-500',
  overdue: 'bg-destructive',
  paid: 'bg-success',
  empty: 'bg-muted-foreground/40',
};

const statusStyle: Record<InvoiceStatus, string> = {
  open: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  closed: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  overdue: 'bg-destructive/15 text-destructive',
  paid: 'bg-success/15 text-success',
  empty: 'bg-muted text-muted-foreground',
};

export function Invoices() {
  const { data: accounts, isLoading } = useAccounts();
  const cards = accounts?.filter((a) => isCard(a) && !a.archived) ?? [];
  const [params, setParams] = useSearchParams();
  const card = cards.find((c) => c.id === params.get('cartao')) ?? cards[0];
  const { data: invoices } = useInvoices(card?.id);
  const { openTransaction, openTransfer } = useTransactionDialog();

  const today = todayISO();
  const openMonth = card ? invoiceFor(today, card) : '';

  // Faturas existentes + a fatura aberta atual (mesmo sem lançamentos)
  const list = useMemo<Invoice[]>(() => {
    if (!card) return [];
    const byMonth = new Map((invoices ?? []).map((i) => [i.month, i]));
    if (!byMonth.has(openMonth)) {
      const { closing, due } = invoiceDates(openMonth, card);
      byMonth.set(openMonth, { month: openMonth, closing, due, total: 0, paid: 0, count: 0 });
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [invoices, card, openMonth]);

  // Fatura padrão: a mais antiga fechada e não paga; senão a aberta
  const defaultMonth =
    list.find((i) => ['closed', 'overdue'].includes(invoiceStatus(i, today)))?.month ?? openMonth;
  const month = params.get('fatura') ?? defaultMonth;
  const selected =
    list.find((i) => i.month === month) ??
    (card && month ? { month, ...invoiceDates(month, card), total: 0, paid: 0, count: 0 } : undefined);

  const { data: transactions } = useInvoiceTransactions(card?.id, selected?.month);
  const { data: payments } = useInvoicePayments(card?.id, selected?.month);

  function select(next: { cartao?: string; fatura?: string }) {
    setParams(
      { cartao: next.cartao ?? card?.id ?? '', ...(next.fatura ? { fatura: next.fatura } : {}) },
      { replace: true },
    );
  }

  if (isLoading) return <div className="bg-muted/50 h-64 animate-pulse rounded-lg border" />;

  if (!card) {
    return (
      <div className="space-y-3">
        <PageHeader title="Faturas" />
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-sm">
          <CreditCard className="size-5" />
          Nenhum cartão de crédito cadastrado.
          <Link to="/contas" className="text-foreground font-medium underline-offset-4 hover:underline">
            Cadastrar um cartão em Contas
          </Link>
        </div>
      </div>
    );
  }

  const status = selected ? invoiceStatus(selected, today) : 'empty';
  const remaining = selected ? Math.max(0, selected.total - selected.paid) : 0;
  const limit = card.credit_limit != null ? Number(card.credit_limit) : null;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Faturas"
        actions={
          selected &&
          remaining > 0 && (
            <Button
              size="sm"
              onClick={() =>
                openTransfer(undefined, {
                  toAccountId: card.id,
                  invoice: selected.month,
                  amount: remaining,
                  description: `Fatura ${formatInvoice(selected.month)} — ${card.name}`,
                })
              }
            >
              Pagar fatura
            </Button>
          )
        }
      >
        {cards.length > 1 && (
          <div className="bg-muted inline-flex rounded-md p-0.5">
            {cards.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === card.id}
                onClick={() => select({ cartao: c.id })}
                className={cn(
                  'text-muted-foreground flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium',
                  c.id === card.id && 'bg-background text-foreground shadow-xs',
                )}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: c.color ?? '#71717a' }} />
                {c.name}
              </button>
            ))}
          </div>
        )}
        <span className="text-muted-foreground text-xs">
          {cards.length === 1 && <span className="text-foreground mr-2 font-medium">{card.name}</span>}
          fecha dia {card.closing_day} · vence dia {card.due_day}
          {limit != null && (
            <>
              {' '}
              · limite <span className="money">{formatMoney(limit)}</span> · disponível{' '}
              <span className={cn('money', limit + card.balance < 0 && 'text-destructive')}>
                {formatMoney(limit + card.balance)}
              </span>
            </>
          )}
        </span>
      </PageHeader>

      {/* Faixa de faturas: passadas, aberta e futuras (parcelas) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {list.map((inv) => {
          const st = invoiceStatus(inv, today);
          return (
            <button
              key={inv.month}
              type="button"
              onClick={() => select({ fatura: inv.month })}
              className={cn(
                'bg-card hover:bg-accent/50 min-w-28 shrink-0 rounded-md border px-3 py-1.5 text-left transition-colors',
                inv.month === selected?.month && 'border-foreground/40 bg-accent/60',
              )}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{formatInvoice(inv.month)}</span>
                <span className={cn('size-1.5 rounded-full', statusDot[st])} title={statusLabel[st]} />
              </div>
              <p className="money text-muted-foreground text-xs">{formatMoney(inv.total)}</p>
            </button>
          );
        })}
      </div>

      {selected && (
        <>
          <div className="bg-card grid grid-cols-2 rounded-lg border sm:grid-cols-3 lg:grid-cols-6">
            <Cell label="Situação">
              <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', statusStyle[status])}>
                {statusLabel[status]}
              </span>
            </Cell>
            <Cell label="Fechamento">
              <DateText iso={selected.closing} />
            </Cell>
            <Cell label="Vencimento">
              <DateText iso={selected.due} />
            </Cell>
            <Cell label="Total">
              <span className="money font-semibold">{formatMoney(selected.total)}</span>
            </Cell>
            <Cell label="Pago">
              <span className="money text-success">{formatMoney(selected.paid)}</span>
            </Cell>
            <Cell label="Restante" last>
              <span className={cn('money font-semibold', remaining > 0 && 'text-destructive')}>
                {formatMoney(remaining)}
              </span>
            </Cell>
          </div>

          {(transactions?.length ?? 0) + (payments?.length ?? 0) === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
              Nenhum lançamento na fatura de {formatInvoice(selected.month)}.
            </div>
          ) : (
            <TransactionTable
              transactions={transactions ?? []}
              transfers={payments ?? []}
              onSelect={openTransaction}
              onSelectTransfer={(t) => openTransfer(t)}
            />
          )}
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <button
              type="button"
              className="hover:text-foreground underline-offset-4 hover:underline"
              onClick={() => select({ fatura: shiftMonth(selected.month, -1) })}
            >
              ← {formatInvoice(shiftMonth(selected.month, -1))}
            </button>
            <button
              type="button"
              className="hover:text-foreground underline-offset-4 hover:underline"
              onClick={() => select({ fatura: shiftMonth(selected.month, 1) })}
            >
              {formatInvoice(shiftMonth(selected.month, 1))} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn('border-b px-4 py-2.5 lg:border-b-0', !last && 'lg:border-r')}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function DateText({ iso }: { iso: string }) {
  const { date, weekday } = formatShortDate(iso);
  return (
    <span className="money">
      {date}/{iso.slice(2, 4)} <span className="text-muted-foreground text-xs">{weekday}</span>
    </span>
  );
}
