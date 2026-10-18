import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { monthBounds } from './dates';
import type { Enums, Tables, TablesInsert, TablesUpdate } from './database.types';

export type TransactionType = Enums<'transaction_type'>;
/** Transação com os ids das suas tags (nome e cor vêm de useTags/useTagLookup). */
export type Transaction = Tables<'transactions'> & { tagIds: string[] };

// Traz as tags junto, pela tabela de ligação
export const TRANSACTION_SELECT = '*, transaction_tags(tag_id)';
const SELECT = TRANSACTION_SELECT;

type Row = Tables<'transactions'> & { transaction_tags: { tag_id: string }[] };
export const parseTransactions = (rows: Row[]): Transaction[] =>
  rows.map(({ transaction_tags, ...t }) => ({
    ...t,
    amount: Number(t.amount),
    tagIds: transaction_tags.map((tt) => tt.tag_id),
  }));

/** Transações com data dentro do mês ("YYYY-MM"), inclusive as de cartão (pela data da compra). */
export function useTransactions(month: string) {
  return useQuery({
    queryKey: ['transactions', month],
    queryFn: async (): Promise<Transaction[]> => {
      const [start, end] = monthBounds(month);
      const { data, error } = await supabase
        .from('transactions')
        .select(SELECT)
        .gte('date', start)
        .lt('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return parseTransactions(data);
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
        .select(SELECT)
        .eq('account_id', accountId!)
        .eq('invoice_month', `${invoice}-01`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return parseTransactions(data);
    },
  });
}

/** Todas as parcelas de uma compra parcelada, em ordem. */
export function useInstallments(group: string | null | undefined) {
  return useQuery({
    queryKey: ['transactions', 'installments', group],
    enabled: !!group,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select(SELECT)
        .eq('installment_group', group!)
        .order('installment_number', { ascending: true });
      if (error) throw error;
      return parseTransactions(data);
    },
  });
}

/** Totais do período (pagos + pendentes) e quanto ainda está pendente de cada lado. */
export function summarize(transactions: Transaction[] | undefined) {
  let income = 0;
  let expense = 0;
  let pendingIncome = 0;
  let pendingExpense = 0;
  for (const t of transactions ?? []) {
    if (t.type === 'income') {
      income += t.amount;
      if (!t.paid) pendingIncome += t.amount;
    } else {
      expense += t.amount;
      if (!t.paid) pendingExpense += t.amount;
    }
  }
  return { income, expense, net: income - expense, pendingIncome, pendingExpense };
}

// Transações mudam saldos, faturas e o uso das categorias e tags
function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['tags'] }),
      qc.invalidateQueries({ queryKey: ['reports'] }),
      qc.invalidateQueries({ queryKey: ['accounts'] }),
      qc.invalidateQueries({ queryKey: ['invoices'] }),
      qc.invalidateQueries({ queryKey: ['categories', 'usage'] }),
    ]);
}

type SaveTransaction = TablesInsert<'transactions'> &
  TablesUpdate<'transactions'> & {
    /** Nomes das tags; as que não existem são criadas. Omitir = não mexe nas tags. */
    tags?: string[];
  };

export function useSaveTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, tags, ...values }: SaveTransaction) => {
      const { data, error } = id
        ? await supabase.from('transactions').update(values).eq('id', id).select('id').single()
        : await supabase.from('transactions').insert(values).select('id').single();
      if (error) throw error;
      if (tags) {
        const { error: tagError } = await supabase.rpc('set_transaction_tags', {
          p_transaction_ids: [data.id],
          p_names: tags,
        });
        if (tagError) throw tagError;
      }
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

/** Marca como pago/pendente. A lista muda na hora; se o banco recusar, volta ao estado anterior. */
export function useToggleTransactionPaid() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from('transactions').update({ paid }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, paid }) => {
      await qc.cancelQueries({ queryKey: ['transactions'] });
      const previous = qc.getQueriesData<Transaction[]>({ queryKey: ['transactions'] });
      qc.setQueriesData<Transaction[]>({ queryKey: ['transactions'] }, (rows) =>
        Array.isArray(rows) ? rows.map((t) => (t.id === id ? { ...t, paid } : t)) : rows,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: invalidate,
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
