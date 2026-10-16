import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAccounts } from './accounts';
import { formatInvoice, isCard } from './cards';
import { todayISO } from './dates';

/**
 * Previsão de caixa: quanto vai ter nas contas de banco (tudo que não é cartão) dia a dia.
 *
 * Parte do saldo atual dessas contas e aplica, na data em que o dinheiro se move:
 *  • transações pendentes das contas de banco (compras no cartão NÃO entram: quem sai do banco é a fatura)
 *  • transferências pendentes que entram/saem do conjunto de contas de banco (ex.: pagamento de fatura agendado)
 *  • faturas de cartão no vencimento, pelo que ainda falta pagar (total − pago − já agendado)
 * Pendências atrasadas entram como se fossem hoje.
 */

export type ForecastEvent = {
  key: string;
  date: string; // data em que o dinheiro se move (atrasados = hoje)
  originalDate: string;
  overdue: boolean;
  kind: 'income' | 'expense' | 'transfer' | 'invoice';
  description: string;
  accountName: string;
  amount: number; // com sinal: + entra, − sai
  balance: number; // saldo previsto logo após este evento
};

export type ForecastPoint = { date: string; balance: number };

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function useForecast(days: number) {
  const today = todayISO();
  const end = addDays(today, days);
  const { data: accounts } = useAccounts();

  const pending = useQuery({
    queryKey: ['reports', 'forecast', 'transactions', end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, date, description, amount, type, account_id, category_id')
        .eq('paid', false)
        .lte('date', end);
      if (error) throw error;
      return data;
    },
  });

  const transfers = useQuery({
    queryKey: ['reports', 'forecast', 'transfers', end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transfers')
        .select('id, date, description, amount, from_account_id, to_account_id')
        .eq('paid', false)
        .lte('date', end);
      if (error) throw error;
      return data;
    },
  });

  const invoices = useQuery({
    queryKey: ['reports', 'forecast', 'invoices', end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_invoices')
        .select('account_id, invoice_month, due_date, total, paid, scheduled')
        .lte('due_date', end);
      if (error) throw error;
      return data;
    },
  });

  const result = useMemo(() => {
    if (!accounts || !pending.data || !transfers.data || !invoices.data) return null;
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const isBank = (id: string) => {
      const a = byId.get(id);
      return !!a && !a.archived && !isCard(a);
    };
    const start = accounts.filter((a) => isBank(a.id)).reduce((s, a) => s + a.balance, 0);
    const when = (date: string) => (date < today ? today : date);

    const events: Omit<ForecastEvent, 'balance'>[] = [];

    for (const t of pending.data) {
      if (!isBank(t.account_id)) continue; // compras no cartão entram pela fatura
      events.push({
        key: `t-${t.id}`,
        date: when(t.date),
        originalDate: t.date,
        overdue: t.date < today,
        kind: t.type,
        description: t.description || (t.type === 'income' ? 'Receita' : 'Despesa'),
        accountName: byId.get(t.account_id)?.name ?? '',
        amount: t.type === 'income' ? Number(t.amount) : -Number(t.amount),
      });
    }

    for (const t of transfers.data) {
      const out = isBank(t.from_account_id);
      const inn = isBank(t.to_account_id);
      if (out === inn) continue; // entre duas contas de banco (ou fora delas): não muda o total
      const to = byId.get(t.to_account_id);
      events.push({
        key: `tr-${t.id}`,
        date: when(t.date),
        originalDate: t.date,
        overdue: t.date < today,
        kind: 'transfer',
        description: t.description || (isCard(to) ? `Pagamento ${to?.name}` : 'Transferência'),
        accountName: `${byId.get(t.from_account_id)?.name} → ${to?.name}`,
        amount: out ? -Number(t.amount) : Number(t.amount),
      });
    }

    for (const i of invoices.data) {
      const card = byId.get(i.account_id!);
      if (!card || card.archived) continue;
      const remaining = Number(i.total) - Number(i.paid) - Number(i.scheduled);
      if (remaining <= 0.004) continue;
      events.push({
        key: `inv-${i.account_id}-${i.invoice_month}`,
        date: when(i.due_date!),
        originalDate: i.due_date!,
        overdue: i.due_date! < today,
        kind: 'invoice',
        description: `Fatura ${formatInvoice(i.invoice_month!.slice(0, 7))}`,
        accountName: card.name,
        amount: -remaining,
      });
    }

    // No mesmo dia, entradas antes das saídas: assim o saldo após o último evento do dia é o
    // saldo de fim do dia, e tabela, gráfico e "menor saldo" mostram sempre os mesmos números
    events.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);

    let running = start;
    const withBalance: ForecastEvent[] = events.map((e) => ({ ...e, balance: (running += e.amount) }));

    // Série diária (saldo ao fim de cada dia) para o gráfico
    const series: ForecastPoint[] = [];
    let i = 0;
    let balance = start;
    for (let d = today; d <= end; d = addDays(d, 1)) {
      while (i < withBalance.length && withBalance[i].date === d) balance = withBalance[i++].balance;
      series.push({ date: d, balance });
    }

    const min = series.reduce((m, p) => (p.balance < m.balance ? p : m), series[0]);
    const income = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const expense = events.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
    return { start, end: balance, min, income, expense, events: withBalance, series };
  }, [accounts, pending.data, transfers.data, invoices.data, today, end]);

  return {
    data: result,
    isLoading: pending.isLoading || transfers.isLoading || invoices.isLoading || !accounts,
    error: pending.error ?? transfers.error ?? invoices.error,
  };
}
