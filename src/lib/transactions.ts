import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { monthBounds } from './dates';
import type { Enums, Tables, TablesInsert, TablesUpdate } from './database.types';

export type TransactionType = Enums<'transaction_type'>;
export type Transaction = Tables<'transactions'>;

const parse = (rows: Transaction[]) => rows.map((t) => ({ ...t, amount: Number(t.amount) }));

/** Transações com data dentro do mês ("YYYY-MM"), inclusive as de cartão (pela data da compra). */
export function useTransactions(month: string) {
  return useQuery({
    queryKey: ['transactions', month],
    queryFn: async (): Promise<Transaction[]> => {
      const [start, end] = monthBounds(month);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', start)
        .lt('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return parse(data);
    },
  });
}

/** Lançamentos de uma fatura ("YYYY-MM") de um cartão. */
export function useInvoiceTransactions(accountId: string | undefined, invoice: string | undefined) {
  return useQuery({
    queryKey: ['transactions', 'invoice', accountId, invoice],
    enabled: !!accountId && !!invoice,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId!)
        .eq('invoice_month', `${invoice}-01`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return parse(data);
    },
  });
}

/** Tags já usadas, das mais usadas para as menos (para sugestões e filtro). */
export function useTags() {
  return useQuery({
    queryKey: ['transactions', 'tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_tags')
        .select('*')
        .order('uses', { ascending: false });
      if (error) throw error;
      return data.map((t) => t.tag!);
    },
  });
}

/** Mesma padronização do banco: sem espaços extras, minúsculas. */
export function normalizeTag(tag: string) {
  return tag.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function summarize(transactions: Transaction[] | undefined) {
  let income = 0;
  let expense = 0;
  for (const t of transactions ?? []) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

// Transações mudam saldos, faturas e o uso das categorias
function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['accounts'] }),
      qc.invalidateQueries({ queryKey: ['invoices'] }),
      qc.invalidateQueries({ queryKey: ['categories', 'usage'] }),
    ]);
}

export function useSaveTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      ...values
    }: TablesInsert<'transactions'> & TablesUpdate<'transactions'>) => {
      const { error } = id
        ? await supabase.from('transactions').update(values).eq('id', id)
        : await supabase.from('transactions').insert(values);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export type InstallmentPurchase = {
  accountId: string;
  categoryId: string;
  amount: number; // valor total da compra
  installments: number;
  date: string;
  description?: string | null;
  tags?: string[];
  notes?: string | null;
  firstInvoice?: string | null; // "YYYY-MM"; vazio = calculada pelo banco
};

/** Compra parcelada no cartão: o banco cria uma transação por parcela, cada uma na sua fatura. */
export function useCreateInstallments() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (p: InstallmentPurchase) => {
      const { error } = await supabase.rpc('create_installment_purchase', {
        p_account_id: p.accountId,
        p_category_id: p.categoryId,
        p_amount: p.amount,
        p_installments: p.installments,
        p_date: p.date,
        p_description: p.description ?? undefined,
        p_tags: p.tags ?? [],
        p_notes: p.notes ?? undefined,
        p_first_invoice: p.firstInvoice ? `${p.firstInvoice}-01` : undefined,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Exclui uma transação, ou todas as parcelas do grupo quando `group` é informado. */
export function useDeleteTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, group }: { id: string; group?: string | null }) => {
      const query = supabase.from('transactions').delete();
      const { error } = group ? await query.eq('installment_group', group) : await query.eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
