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

export function formatMonth(month: string) {
  return monthFmt.format(fromISO(month));
}

export function formatDay(iso: string) {
  const today = todayISO();
  if (iso === today) return 'Hoje';
  const y = fromISO(today);
  y.setDate(y.getDate() - 1);
  if (iso === `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`) return 'Ontem';
  return dayFmt.format(fromISO(iso)).replace(/\./g, '');
}
