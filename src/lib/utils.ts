import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoney(value: number) {
  return brl.format(value);
}

/** Converte o que o usuário digitou ("1.234,56", "-50", "R$ 10,5") em número. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

/** Formata um número para edição num input ("1234,56"). */
export function toMoneyInput(value: number) {
  return value.toFixed(2).replace('.', ',');
}
