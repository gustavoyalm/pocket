import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Tables, TablesInsert, TablesUpdate } from './database.types';
import type { TransactionType } from './transactions';

export type Category = Tables<'categories'>;
export type CategoryGroup = Category & { children: Category[] };

export const DEFAULT_COLOR = '#71717a';

export const categoryColors = [
  '#22c55e',
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#14b8a6',
  '#64748b',
  '#a1a1aa',
];

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Quantas transações usam cada categoria (para mostrar e para saber se dá pra excluir). */
export function useCategoryUsage() {
  return useQuery({
    queryKey: ['categories', 'usage'],
    queryFn: async () => {
      const { data, error } = await supabase.from('category_usage').select('*');
      if (error) throw error;
      return new Map(data.map((u) => [u.category_id!, u.transaction_count ?? 0]));
    },
  });
}

/** Categorias agrupadas: pais (ordem alfabética) com suas subcategorias. */
export function groupCategories(categories: Category[] | undefined, type?: TransactionType) {
  const list = (categories ?? []).filter((c) => !type || c.type === type);
  const groups: CategoryGroup[] = list
    .filter((c) => !c.parent_id)
    .map((p) => ({ ...p, children: list.filter((c) => c.parent_id === p.id) }));
  return groups;
}

/** Acesso rápido por id + nome completo ("Alimentação › Delivery") e cor herdada do pai. */
export function useCategoryLookup() {
  const { data: categories } = useCategories();
  return useMemo(() => {
    const byId = new Map(categories?.map((c) => [c.id, c]));
    return {
      get: (id: string | null | undefined) => (id ? byId.get(id) : undefined),
      parentOf: (c: Category | undefined) => (c?.parent_id ? byId.get(c.parent_id) : undefined),
      colorOf: (c: Category | undefined) =>
        c?.color ?? (c?.parent_id ? byId.get(c.parent_id)?.color : null) ?? DEFAULT_COLOR,
    };
  }, [categories]);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['categories'] });
}

export function useSaveCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...values }: TablesInsert<'categories'> & TablesUpdate<'categories'>) => {
      const { error } = id
        ? await supabase.from('categories').update(values).eq('id', id)
        : await supabase.from('categories').insert(values);
      if (error) throw new Error(friendlyError(error));
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw new Error(friendlyError(error));
    },
    onSuccess: invalidate,
  });
}

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === '23505') return 'Já existe uma categoria com esse nome aqui.';
  if (error.code === '23503') return 'Há transações usando esta categoria. Arquive-a em vez de excluir.';
  return error.message;
}
