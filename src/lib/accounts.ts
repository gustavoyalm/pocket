import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from './supabase';
import type { Enums, Tables, TablesInsert, TablesUpdate } from './database.types';

export type AccountType = Enums<'account_type'>;
/** balance = saldo atual (só o que foi pago); projectedBalance = inclui os pendentes */
export type Account = Tables<'accounts'> & { balance: number; projectedBalance: number };

export const accountTypes: Record<AccountType, { label: string; icon: LucideIcon }> = {
  checking: { label: 'Conta corrente', icon: Landmark },
  savings: { label: 'Poupança', icon: PiggyBank },
  cash: { label: 'Dinheiro', icon: Banknote },
  credit_card: { label: 'Cartão de crédito', icon: CreditCard },
  investment: { label: 'Investimentos', icon: TrendingUp },
  other: { label: 'Outra', icon: Wallet },
};

export const accountColors = [
  '#22c55e',
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#14b8a6',
  '#71717a',
];

const KEY = ['accounts'] as const;

async function fetchAccounts(): Promise<Account[]> {
  const [accounts, balances] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('account_balances').select('account_id, balance, projected_balance'),
  ]);
  if (accounts.error) throw accounts.error;
  if (balances.error) throw balances.error;

  const byId = new Map(balances.data.map((b) => [b.account_id, b]));
  return accounts.data.map((a) => ({
    ...a,
    initial_balance: Number(a.initial_balance),
    balance: Number(byId.get(a.id)?.balance ?? a.initial_balance),
    projectedBalance: Number(byId.get(a.id)?.projected_balance ?? a.initial_balance),
  }));
}

export function useAccounts() {
  return useQuery({ queryKey: KEY, queryFn: fetchAccounts });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}

export function useSaveAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...values }: TablesInsert<'accounts'> & TablesUpdate<'accounts'>) => {
      const { error } = id
        ? await supabase.from('accounts').update(values).eq('id', id)
        : await supabase.from('accounts').insert(values);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
