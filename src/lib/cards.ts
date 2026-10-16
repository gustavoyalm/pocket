import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { shiftMonth, todayISO } from './dates';
import type { Account } from './accounts';

// Mesmas regras do banco (migration credit_cards):
//  • compra antes do dia de fechamento → fecha no mês da compra; no dia ou depois → mês seguinte
//  • vence no mesmo mês do fechamento se due_day > closing_day; senão no mês seguinte
//  • fatura = mês do vencimento ("YYYY-MM")

type CardDays = Pick<Account, 'closing_day' | 'due_day'>;

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
const dayOf = (month: string, day: number) => `${month}-${pad(Math.min(day, daysIn(month)))}`;

export function isCard(account: Pick<Account, 'type'> | undefined | null) {
  return account?.type === 'credit_card';
}

/** Fatura ("YYYY-MM") em que cai uma compra feita em `date` ("YYYY-MM-DD"). */
export function invoiceFor(date: string, card: CardDays) {
  let month = date.slice(0, 7);
  if (date >= dayOf(month, card.closing_day!)) month = shiftMonth(month, 1);
  if (card.due_day! <= card.closing_day!) month = shiftMonth(month, 1);
  return month;
}

/** Datas de fechamento e vencimento de uma fatura ("YYYY-MM"). */
export function invoiceDates(invoice: string, card: CardDays) {
  const closingMonth = card.due_day! > card.closing_day! ? invoice : shiftMonth(invoice, -1);
  return { closing: dayOf(closingMonth, card.closing_day!), due: dayOf(invoice, card.due_day!) };
}

const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
/** "2026-11" → "nov/26" */
export function formatInvoice(invoice: string) {
  const [y, m] = invoice.split('-').map(Number);
  return `${monthShort.format(new Date(y, m - 1, 1)).replace('.', '')}/${String(y).slice(2)}`;
}

export type Invoice = {
  month: string; // "YYYY-MM"
  closing: string;
  due: string;
  total: number;
  paid: number;
  scheduled: number; // pagamentos lançados mas ainda pendentes
  count: number;
};

export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue' | 'empty';

export function invoiceStatus(inv: Invoice, today = todayISO()): InvoiceStatus {
  const remaining = inv.total - inv.paid;
  if (inv.total <= 0 && inv.paid <= 0) return 'empty';
  if (remaining <= 0.004) return 'paid';
  if (today < inv.closing) return 'open';
  if (today > inv.due) return 'overdue';
  return 'closed';
}

export const statusLabel: Record<InvoiceStatus, string> = {
  open: 'Aberta',
  closed: 'Fechada',
  paid: 'Paga',
  overdue: 'Vencida',
  empty: 'Sem lançamentos',
};

/** Faturas existentes de um cartão (com lançamento ou pagamento), em ordem cronológica. */
export function useInvoices(accountId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from('card_invoices')
        .select('*')
        .eq('account_id', accountId!)
        .order('invoice_month');
      if (error) throw error;
      return data.map((i) => ({
        month: i.invoice_month!.slice(0, 7),
        closing: i.closing_date!,
        due: i.due_date!,
        total: Number(i.total ?? 0),
        paid: Number(i.paid ?? 0),
        scheduled: Number(i.scheduled ?? 0),
        count: i.transaction_count ?? 0,
      }));
    },
  });
}
