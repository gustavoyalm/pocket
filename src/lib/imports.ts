import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Tables } from './database.types';

export type ImportStatus = 'pending' | 'approved' | 'rejected';
export type ImportItem = Omit<Tables<'import_items_review'>, 'amount'> & { id: string; amount: number };
export type ImportToken = Tables<'import_tokens'>;

/** Data da compra (o banco normaliza; parcelas guardam a data original da compra). */
export const spentOn = (i: Pick<ImportItem, 'purchase_date' | 'date'>) => i.purchase_date ?? i.date!;

const cleanDescription = (d: string | null) => (d ?? '').replace(/\s*\d+\s*\/\s*\d+\s*$/, '').trim().toLowerCase();

/**
 * Parcelas da mesma compra (inclui o próprio item): pela data/hora exata da compra;
 * sem ela, mesmo final, data da compra, loja, nº de parcelas e valor de parcela compatível.
 */
export function samePurchase(item: ImportItem, items: ImportItem[]) {
  const total = item.installment_total;
  if (!total) return [item];
  return items.filter((o) =>
    item.purchase_ref
      ? o.purchase_ref === item.purchase_ref
      : !o.purchase_ref &&
        o.card_final === item.card_final &&
        o.purchase_date === item.purchase_date &&
        o.installment_total === total &&
        cleanDescription(o.description) === cleanDescription(item.description) &&
        Math.abs(o.amount - item.amount) <= 0.01 * total,
  );
}

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/** Hora da compra ("15:22", horário de Brasília), quando o banco informou o horário exato da compra. */
export function purchaseTime(i: Pick<ImportItem, 'purchase_ref'>) {
  if (!i.purchase_ref) return null;
  const d = new Date(i.purchase_ref);
  return Number.isNaN(d.getTime()) ? null : timeFmt.format(d);
}

/**
 * Itens da caixa de entrada por status.
 * Pendentes: compra mais recente primeiro (parcelas da mesma compra em ordem: 1/10, 2/10…).
 * Aprovadas/rejeitadas: decisão mais recente primeiro.
 */
export function useImportItems(status: ImportStatus) {
  return useQuery({
    queryKey: ['imports', 'items', status],
    queryFn: async (): Promise<ImportItem[]> => {
      const { data, error } = await supabase
        .from('import_items_review')
        .select('*')
        .eq('status', status)
        .order(status === 'pending' ? 'date' : 'decided_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      const items = data.map((i) => ({ ...i, id: i.id!, amount: Number(i.amount) }));
      // A ordem pela data da compra é feita aqui (no banco ela depende de duas colunas)
      if (status === 'pending') {
        // Compra mais recente primeiro; dentro do mesmo dia, as parcelas de cada compra ficam juntas
        // (mesma loja + valor da parcela arredondado — a 1ª parcela pode ter centavos a mais)
        const store = (i: ImportItem) => (i.description ?? '').replace(/\s*\d+\s*\/\s*\d+\s*$/, '').toLowerCase();
        items.sort(
          (a, b) =>
            spentOn(b).localeCompare(spentOn(a)) ||
            store(a).localeCompare(store(b)) ||
            Math.round(a.amount) - Math.round(b.amount) ||
            (a.installment_number ?? 0) - (b.installment_number ?? 0),
        );
      }
      return items;
    },
  });
}

/** Quantidade de pendentes (para o contador no menu). */
export function usePendingImportCount() {
  return useQuery({
    queryKey: ['imports', 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('import_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ['imports', 'transactions', 'accounts', 'invoices', 'reports', 'categories'].map((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

/** Define cartão e/ou categoria de itens pendentes (atualiza a tela na hora). */
export function useUpdateImportItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      values,
    }: {
      ids: string[];
      values: { account_id?: string | null; category_id?: string | null; note?: string | null; tags?: string[] };
    }) => {
      const { error } = await supabase.from('import_items').update(values).in('id', ids);
      if (error) throw error;
    },
    onMutate: async ({ ids, values }) => {
      await qc.cancelQueries({ queryKey: ['imports', 'items', 'pending'] });
      const previous = qc.getQueryData<ImportItem[]>(['imports', 'items', 'pending']);
      qc.setQueryData<ImportItem[]>(['imports', 'items', 'pending'], (rows) =>
        rows?.map((r) => (ids.includes(r.id) ? { ...r, ...values } : r)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['imports', 'items', 'pending'], ctx?.previous),
    // Trocar o cartão muda o aviso de "possível duplicada", que vem do banco
    onSettled: () => qc.invalidateQueries({ queryKey: ['imports', 'items', 'pending'] }),
  });
}

/** Aprova itens (só os que têm cartão e categoria); devolve quantos entraram. */
export function useApproveImports() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc('approve_import_items', { p_ids: ids });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useSetImportStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: 'rejected' | 'pending' }) => {
      const { error } = await supabase
        .from('import_items')
        .update({ status, decided_at: status === 'rejected' ? new Date().toISOString() : null })
        .in('id', ids)
        .neq('status', 'approved');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Acrescenta um final ao cadastro do cartão (para as próximas importações caírem nele sozinhas). */
export function useAddCardFinal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ accountId, final }: { accountId: string; final: string }) => {
      const { data, error } = await supabase.from('accounts').select('card_finals').eq('id', accountId).single();
      if (error) throw error;
      const finals = [...new Set([...(data.card_finals ?? []), final])];
      const { error: updateError } = await supabase.from('accounts').update({ card_finals: finals }).eq('id', accountId);
      if (updateError) throw updateError;
    },
    onSuccess: invalidate,
  });
}

// ─── Tokens do n8n ───────────────────────────────────────────────────

export function useImportTokens() {
  return useQuery({
    queryKey: ['imports', 'tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_tokens')
        .select('id, label, token_hint, created_at, last_used_at, revoked_at')
        .is('revoked_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Gera um token; o valor completo só existe na resposta desta chamada. */
export function useCreateImportToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => {
      const { data, error } = await supabase.rpc('create_import_token', { p_label: label });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imports', 'tokens'] }),
  });
}

export function useRevokeImportToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('import_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imports', 'tokens'] }),
  });
}
