import { Area, CartesianGrid, ComposedChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { formatShortDate } from '@/lib/dates';
import { useForecast, type ForecastPoint } from '@/lib/forecast';
import { formatCompact } from '@/lib/reports';
import { cn, formatMoney } from '@/lib/utils';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { EmptyReport } from './shared';

const LINE = 'var(--chart-income)';

const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
const formatLong = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return longDate.format(new Date(y, m - 1, d)).replace(/\./g, '');
};

export function ForecastReport({ days }: { days: number }) {
  const { data, isLoading, error } = useForecast(days);

  if (isLoading || !data) return <div className="bg-muted/50 h-96 animate-pulse rounded-lg border" />;
  if (error) return <p className="text-destructive text-sm">Erro ao carregar: {error.message}</p>;

  const goesNegative = data.min.balance < 0;
  const firstNegative = data.series.find((p) => p.balance < 0);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Saldo das contas de banco (sem cartões) dia a dia. Compras no cartão entram pela fatura, no dia do
        vencimento, pelo valor que ainda falta pagar. Pendências atrasadas contam como hoje.
      </p>

      {/* Números principais */}
      <div className="bg-card grid grid-cols-2 rounded-lg border lg:grid-cols-5">
        <Stat label="Saldo hoje" value={data.start} />
        <Stat label="Entradas previstas" value={data.income} />
        <Stat label="Saídas previstas" value={-data.expense} />
        <Stat
          label="Menor saldo"
          value={data.min.balance}
          note={formatLong(data.min.date)}
          negative={data.min.balance < 0}
        />
        <Stat label={`Saldo em ${days} dias`} value={data.end} negative={data.end < 0} last />
      </div>

      {goesNegative && firstNegative && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          O saldo fica negativo a partir de {formatLong(firstNegative.date)} e chega a{' '}
          <span className="money font-semibold">{formatMoney(data.min.balance)}</span> em {formatLong(data.min.date)}.
        </p>
      )}

      <div className="bg-card rounded-lg border p-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.series} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => formatShortDate(d).date}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                minTickGap={32}
              />
              <YAxis
                domain={[(min: number) => Math.min(0, min), 'auto']}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              />
              <ReferenceLine y={0} stroke="var(--destructive)" strokeOpacity={0.6} />
              <Tooltip
                cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
                content={({ active, payload }) => <ChartTooltip active={active} payload={payload} />}
                isAnimationActive={false}
              />
              {/* Degraus: o saldo só muda nos dias com movimento */}
              <Area
                type="stepAfter"
                dataKey="balance"
                stroke={LINE}
                strokeWidth={2}
                fill={LINE}
                fillOpacity={0.1}
                isAnimationActive={false}
                activeDot={{ r: 4, fill: LINE, stroke: 'var(--card)', strokeWidth: 2 }}
              />
              {/* Marca o ponto mais baixo */}
              <ReferenceDot
                x={data.min.date}
                y={data.min.balance}
                r={4}
                fill={goesNegative ? 'var(--destructive)' : LINE}
                stroke="var(--card)"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.events.length === 0 ? (
        <EmptyReport>Nenhuma pendência nem fatura a pagar nos próximos {days} dias.</EmptyReport>
      ) : (
        <Table>
          <THead>
            <tr>
              <Th className="w-28 min-w-28">Data</Th>
              <Th>Descrição</Th>
              <Th className="hidden w-56 min-w-48 md:table-cell">Conta</Th>
              <Th className="w-40 min-w-36 text-right">Valor</Th>
              <Th className="w-40 min-w-36 text-right">Saldo previsto</Th>
            </tr>
          </THead>
          <tbody>
            {data.events.map((e) => {
              const { date, weekday } = formatShortDate(e.date);
              return (
                <Tr key={e.key}>
                  <Td className="money text-xs">
                    {date} <span className="text-muted-foreground">{weekday}</span>
                  </Td>
                  <Td className="w-full max-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate">{e.description}</span>
                      {e.kind === 'invoice' && (
                        <span className="text-muted-foreground shrink-0 rounded border px-1 text-[11px] leading-4">fatura</span>
                      )}
                      {e.overdue && (
                        <span className="text-destructive shrink-0 text-[11px]">
                          atrasada desde {formatShortDate(e.originalDate).date}
                        </span>
                      )}
                    </span>
                  </Td>
                  <Td className="text-muted-foreground hidden md:table-cell">
                    <span className="block max-w-56 truncate">{e.accountName}</span>
                  </Td>
                  <Td className={cn('money text-right', e.amount > 0 && 'text-success')}>
                    {e.amount > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(e.amount))}
                  </Td>
                  <Td className={cn('money text-right font-medium', e.balance < 0 && 'text-destructive')}>
                    {formatMoney(e.balance)}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function Stat(props: { label: string; value: number; note?: string; negative?: boolean; last?: boolean }) {
  return (
    <div className={cn('border-b px-4 py-3 lg:border-b-0', !props.last && 'lg:border-r')}>
      <p className="text-muted-foreground text-xs">{props.label}</p>
      <p className={cn('money mt-0.5 text-lg font-semibold', props.negative && 'text-destructive')}>
        {formatMoney(props.value)}
      </p>
      <p className="text-muted-foreground h-4 text-[11px]">{props.note}</p>
    </div>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ForecastPoint;
  return (
    <div className="bg-card text-card-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-0.5 capitalize">{formatLong(p.date)}</p>
      <p className={cn('money font-medium', p.balance < 0 && 'text-destructive')}>{formatMoney(p.balance)}</p>
    </div>
  );
}
