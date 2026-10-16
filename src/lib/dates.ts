// Datas trafegam como strings "YYYY-MM-DD" (coluna `date` do Postgres) e meses como "YYYY-MM".
// Tudo é montado com componentes locais para não sofrer com fuso horário.

const pad = (n: number) => String(n).padStart(2, '0');

function fromISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d ?? 1);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth() {
  return todayISO().slice(0, 7);
}

export function isValidMonth(value: string | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, delta: number) {
  const d = fromISO(month);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Intervalo [início, fim) do mês, para filtrar `date >= início and date < fim`. */
export function monthBounds(month: string): [string, string] {
  return [`${month}-01`, `${shiftMonth(month, 1)}-01`];
}

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });

/** "Outubro de 2026" */
export function formatMonth(month: string) {
  const s = monthFmt.format(fromISO(month));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Lê uma data digitada no estilo planilha, relativa ao mês informado ("YYYY-MM"):
 * "5" → dia 5 do mês · "5/9" → 05/09 do mesmo ano · "5/9/25" ou "5/9/2025".
 * Retorna "YYYY-MM-DD" ou null se for inválida.
 */
export function parseDateInput(text: string, month: string): string | null {
  const match = text.trim().match(/^(\d{1,2})(?:[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?)?$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : Number(month.slice(0, 4));
  const mon = m ? Number(m) : Number(month.slice(5, 7));
  const day = Number(d);
  const date = new Date(year, mon - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== mon - 1 || date.getDate() !== day) return null;
  return `${year}-${pad(mon)}-${pad(day)}`;
}

/** "2026-10-05" → "05/10" (ou "05/10/2025" se o ano for diferente do ano de referência). */
export function formatDateInput(iso: string, referenceMonth: string) {
  const [y, m, d] = iso.split('-');
  return y === referenceMonth.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y}`;
}

const weekdayFmt =new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

/** "15/10" + dia da semana ("qua"), para colunas de tabela. */
export function formatShortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return { date: `${d}/${m}`, weekday: weekdayFmt.format(fromISO(iso)).replace('.', '') };
}

export function formatDay(iso: string) {
  const today = todayISO();
  if (iso === today) return 'Hoje';
  const y = fromISO(today);
  y.setDate(y.getDate() - 1);
  if (iso === `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`) return 'Ontem';
  return dayFmt.format(fromISO(iso)).replace(/\./g, '');
}
