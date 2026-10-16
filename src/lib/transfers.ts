import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { monthBounds } from './dates';
import type { Tables, TablesInsert, TablesUpdate } from './database.types';

export type Transfer = Tables<'transfers'>;

/** Transferências com data dentro do mês ("YYYY-MM"). */
export function useTransfers(month: string) {
  return useQuery({
    queryKey: ['transfers', month],
    queryFn: async (): Promise<Transfer[]> => {
      const [start, end] = monthBounds(month);
      const { data, error } = await supabase
        .from('transfers')
        .select('*')
        .gte('date', start)
        .lt('date', end)
        .order('date', { ascending: false });
      if (error) throw error;
      return data.map((t) => ({ ...t, amount: Number(t.amount) }));
    },
  });
}

/** Pagamentos feitos para uma fatura específica de um cartão. */
export function useInvoicePayments(accountId: string | undefined, invoice: string | undefined) {
  return useQuery({
    queryKey: ['transfers', 'invoice', accountId, invoice],
    enabled: !!accountId && !!invoice,
    queryFn: async (): Promise<Transfer[]> => {
      const { data, error } = await supabase
        .from('transfers')
        .select('*')
        .eq('to_account_id', accountId!)
        .eq('invoice_month', `${invoice}-01`)
        .order('date');
      if (error) throw error;
      return data.map((t) => ({ ...t, amount: Number(t.amount) }));
    },
  });
}

// Transferências mexem em saldos e em faturas
function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ['transfers', 'accounts', 'invoices'].map((key) => qc.invalidateQueries({ queryKey: [key] })),
    );
}

export function useSaveTransfer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...values }: TablesInsert<'transfers'> & TablesUpdate<'transfers'>) => {
      const { error } = id
        ? await supabase.from('transfers').update(values).eq('id', id)
        : await supabase.from('transfers').insert(values);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Marca como efetivada/pendente, com atualização otimista. */
export function useToggleTransferPaid() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from('transfers').update({ paid }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, paid }) => {
      await qc.cancelQueries({ queryKey: ['transfers'] });
      const previous = qc.getQueriesData<Transfer[]>({ queryKey: ['transfers'] });
      qc.setQueriesData<Transfer[]>({ queryKey: ['transfers'] }, (rows) =>
        Array.isArray(rows) ? rows.map((t) => (t.id === id ? { ...t, paid } : t)) : rows,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: invalidate,
  });
}

export function useDeleteTransfer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transfers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
