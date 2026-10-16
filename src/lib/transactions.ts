import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { monthBounds } from './dates';
import type { Enums, Tables, TablesInsert, TablesUpdate } from './database.types';

export type TransactionType = Enums<'transaction_type'>;
export type Transaction = Tables<'transactions'>;

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
      return data.map((t) => ({ ...t, amount: Number(t.amount) }));
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

// Transações mudam o saldo das contas e o uso das categorias
function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['accounts'] }),
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

export function useDeleteTransaction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
