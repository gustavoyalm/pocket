import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Tables } from './database.types';

export type Tag = Tables<'tags'> & { uses: number };

export const DEFAULT_TAG_COLOR = '#71717a';

export const tagColors = [
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

/** Mesma padronização do banco: sem espaços extras (maiúsculas são mantidas). */
export function normalizeTag(tag: string) {
  return tag.trim().replace(/\s+/g, ' ');
}

/** Todas as tags do usuário com a quantidade de usos, das mais usadas para as menos. */
export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async (): Promise<Tag[]> => {
      const [tags, usage] = await Promise.all([
        supabase.from('tags').select('*').order('name'),
        supabase.from('tag_usage').select('*'),
      ]);
      if (tags.error) throw tags.error;
      if (usage.error) throw usage.error;
      const uses = new Map(usage.data.map((u) => [u.tag_id, u.uses ?? 0]));
      return tags.data
        .map((t) => ({ ...t, uses: uses.get(t.id) ?? 0 }))
        .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
    },
  });
}

/** Acesso rápido por id. */
export function useTagLookup() {
  const { data: tags } = useTags();
  return useMemo(() => new Map(tags?.map((t) => [t.id, t])), [tags]);
}

// Tags aparecem nas transações (nome/cor), então invalida as duas coisas
function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['tags'] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
    ]);
}

export function useSaveTag() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, name, color }: { id?: string; name: string; color: string }) => {
      const values = { name: normalizeTag(name), color };
      const { error } = id
        ? await supabase.from('tags').update(values).eq('id', id)
        : await supabase.from('tags').insert(values);
      if (error) throw new Error(error.code === '23505' ? 'Já existe uma tag com esse nome.' : error.message);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTag() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
