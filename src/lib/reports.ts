import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { currentMonth, shiftMonth } from './dates';
import type { TransactionType } from './transactions';

/** Período em meses, inclusivo nas duas pontas ("YYYY-MM"). */
export type Period = { from: string; to: string };

export const presets = {
  'este-mes': 'Este mês',
  'mes-passado': 'Mês passado',
  '3m': 'Últimos 3 meses',
  '6m': 'Últimos 6 meses',
  '12m': 'Últimos 12 meses',
  'este-ano': 'Este ano',
  'ano-passado': 'Ano passado',
  custom: 'Personalizado',
} as const;

export type PresetKey = keyof typeof presets;

export function presetPeriod(key: Exclude<PresetKey, 'custom'>, today = currentMonth()): Period {
  const year = today.slice(0, 4);
  switch (key) {
    case 'este-mes':
      return { from: today, to: today };
    case 'mes-passado': {
      const m = shiftMonth(today, -1);
      return { from: m, to: m };
    }
    case '3m':
      return { from: shiftMonth(today, -2), to: today };
    case '6m':
      return { from: shiftMonth(today, -5), to: today };
    case '12m':
      return { from: shiftMonth(today, -11), to: today };
    case 'este-ano':
      return { from: `${year}-01`, to: today };
    case 'ano-passado':
      return { from: `${Number(year) - 1}-01`, to: `${Number(year) - 1}-12` };
  }
}

export function monthCount({ from, to }: Period) {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/** Período de mesmo tamanho imediatamente antes (para comparação). */
export function previousPeriod(p: Period): Period {
  const n = monthCount(p);
  return { from: shiftMonth(p.from, -n), to: shiftMonth(p.to, -n) };
}

/** Intervalo de datas para o banco: [início, fim) */
const range = ({ from, to }: Period) => ({ p_start: `${from}-01`, p_end: `${shiftMonth(to, 1)}-01` });

export type ReportFilters = {
  period: Period;
  paidOnly: boolean;
  accountId?: string;
  tagId?: string;
};

const common = (f: ReportFilters) => ({
  ...range(f.period),
  p_paid_only: f.paidOnly,
  p_account_id: f.accountId || undefined,
});

// keepPreviousData: ao trocar filtros, o relatório anterior continua na tela até o novo chegar
const options = { placeholderData: keepPreviousData, staleTime: 0 } as const;

export function useCategoryReport(f: ReportFilters & { type: TransactionType }) {
  return useQuery({
    queryKey: ['reports', 'category', f],
    ...options,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_by_category', {
        ...common(f),
        p_type: f.type,
        p_tag_id: f.tagId || undefined,
      });
      if (error) throw error;
      return data.map((r) => ({ categoryId: r.category_id, total: Number(r.total), count: r.transaction_count }));
    },
  });
}

/**
 * 'purchase': pela data da transação (quanto gastei em cada mês).
 * 'cash': pela saída do caixa — compras no cartão contam no mês do vencimento da fatura.
 */
export type MonthlyBasis = 'purchase' | 'cash';

export function useMonthlyReport(f: ReportFilters & { basis: MonthlyBasis }) {
  return useQuery({
    queryKey: ['reports', 'monthly', f],
    ...options,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_monthly', {
        ...common(f),
        p_tag_id: f.tagId || undefined,
        p_basis: f.basis,
      });
      if (error) throw error;
      const byMonth = new Map(data.map((r) => [r.month.slice(0, 7), r]));
      // Inclui meses sem movimento (com zero), para o gráfico não "pular" meses
      const months: { month: string; income: number; expense: number; net: number }[] = [];
      for (let m = f.period.from; m <= f.period.to; m = shiftMonth(m, 1)) {
        const r = byMonth.get(m);
        const income = Number(r?.income ?? 0);
        const expense = Number(r?.expense ?? 0);
        months.push({ month: m, income, expense, net: income - expense });
      }
      return months;
    },
  });
}

export function useTagReport(f: ReportFilters & { type: TransactionType }) {
  return useQuery({
    queryKey: ['reports', 'tag', f],
    ...options,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_by_tag', { ...common(f), p_type: f.type });
      if (error) throw error;
      return data.map((r) => ({ tagId: r.tag_id, total: Number(r.total), count: r.transaction_count }));
    },
  });
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
/** 1234 → "1,2 mil" (eixos de gráfico) */
export const formatCompact = (v: number) => compact.format(v);

/** Variação percentual; null quando não há base de comparação. */
export function change(current: number, previous: number) {
  if (!previous) return null;
  return (current - previous) / previous;
}
