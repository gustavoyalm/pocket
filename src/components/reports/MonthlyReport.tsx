import { useNavigate } from 'react-router-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatInvoice } from '@/lib/cards';
import { formatMonth, shiftMonth } from '@/lib/dates';
import { formatCompact, monthCount, useMonthlyReport, type MonthlyBasis, type ReportFilters } from '@/lib/reports';
import { cn, formatMoney } from '@/lib/utils';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';
import { EmptyReport, formatPercent } from './shared';

const INCOME = 'var(--chart-income)';
const EXPENSE = 'var(--chart-expense)';
const NET = 'var(--foreground)';

type Point = { month: string; label: string; income: number; expense: number; net: number };

export function MonthlyReport({ filters, basis }: { filters: ReportFilters; basis: MonthlyBasis }) {
  const navigate = useNavigate();
  // Evolução com 1–2 meses não diz nada: nesse caso mostra os 12 meses até o fim do período
  const short = monthCount(filters.period) < 3;
  const period = short ? { from: shiftMonth(filters.period.to, -11), to: filters.period.to } : filters.period;
  const { data, isLoading, isFetching, error } = useMonthlyReport({ ...filters, period, basis });

  if (isLoading) return <div className="bg-muted/50 h-96 animate-pulse rounded-lg border" />;
  if (error) return <p className="text-destructive text-sm">Erro ao carregar: {error.message}</p>;
  const points: Point[] = (data ?? []).map((d) => ({ ...d, label: formatInvoice(d.month) }));
  if (!points.some((p) => p.income || p.expense)) return <EmptyReport>Nenhuma movimentação no período.</EmptyReport>;

  const totals = points.reduce(
    (t, p) => ({ income: t.income + p.income, expense: t.expense + p.expense, net: t.net + p.net }),
    { income: 0, expense: 0, net: 0 },
  );
  const n = points.length;
  const open = (month: string) => navigate(`/transacoes?mes=${month}`);

  return (
    <div className={cn('space-y-3 transition-opacity', isFetching && 'opacity-60')}>
      <p className="text-muted-foreground text-xs">
        {basis === 'cash'
          ? 'Saída do caixa: compras no cartão contam no mês em que a fatura vence (quando o dinheiro sai da conta).'
          : 'Data da compra: cada transação conta no mês em que aconteceu (quanto você gastou em cada mês).'}
      </p>
      {short && (
        <p className="text-muted-foreground text-xs">
          O período escolhido tem menos de 3 meses; mostrando os 12 meses até {formatMonth(filters.period.to)}.
        </p>
      )}

      <div className="bg-card rounded-lg border p-4">
        {/* Legenda sempre visível (a cor nunca é a única pista) */}
        <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <LegendItem swatch={<span className="size-2.5 rounded-[2px]" style={{ backgroundColor: INCOME }} />}>
            Receitas
          </LegendItem>
          <LegendItem swatch={<span className="size-2.5 rounded-[2px]" style={{ backgroundColor: EXPENSE }} />}>
            Despesas
          </LegendItem>
          <LegendItem
            swatch={
              <span className="relative flex w-4 items-center">
                <span className="h-0.5 w-full" style={{ backgroundColor: NET }} />
                <span className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full" style={{ backgroundColor: NET }} />
              </span>
            }
          >
            Resultado
          </LegendItem>
          <span className="ml-auto">clique num mês para ver as transações</span>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={points}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              barGap={2}
              barCategoryGap="30%"
              onClick={(state) => {
                const i = Number(state?.activeTooltipIndex);
                if (Number.isInteger(i) && points[i]) open(points[i].month);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                // Começa no zero; só desce abaixo dele se algum mês tiver resultado negativo
                domain={[(min: number) => Math.min(0, min), 'auto']}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
              <Tooltip
                cursor={{ fill: 'var(--accent)', opacity: 0.6 }}
                content={({ active, payload }) => <ChartTooltip active={active} payload={payload} />}
                isAnimationActive={false}
              />
              <Bar dataKey="income" name="Receitas" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              <Bar dataKey="expense" name="Despesas" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              <Line
                dataKey="net"
                name="Resultado"
                stroke={NET}
                strokeWidth={2}
                dot={{ r: 4, fill: NET, stroke: 'var(--card)', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: NET, stroke: 'var(--card)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela: a mesma informação, legível sem o gráfico */}
      <Table>
        <THead>
          <tr>
            <Th>Mês</Th>
            <Th className="w-40 min-w-36 text-right">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-[2px]" style={{ backgroundColor: INCOME }} />
                Receitas
              </span>
            </Th>
            <Th className="w-40 min-w-36 text-right">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-[2px]" style={{ backgroundColor: EXPENSE }} />
                Despesas
              </span>
            </Th>
            <Th className="w-40 min-w-36 text-right">Resultado</Th>
            <Th className="hidden w-32 min-w-32 text-right sm:table-cell" title="Resultado ÷ receitas">
              % guardado
            </Th>
          </tr>
        </THead>
        <tbody>
          {[...points].reverse().map((p) => (
            <Tr key={p.month} onClick={() => open(p.month)}>
              <Td className="w-full">{formatMonth(p.month)}</Td>
              <Td className="money text-right">{formatMoney(p.income)}</Td>
              <Td className="money text-right">{formatMoney(p.expense)}</Td>
              <Td className={cn('money text-right font-medium', p.net < 0 && 'text-destructive')}>{formatMoney(p.net)}</Td>
              <Td className="money text-muted-foreground hidden text-right text-xs sm:table-cell">
                {p.income ? formatPercent(p.net / p.income) : '—'}
              </Td>
            </Tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 border-t font-medium">
            <Td className="text-muted-foreground text-xs">Total ({n} meses)</Td>
            <Td className="money text-right">{formatMoney(totals.income)}</Td>
            <Td className="money text-right">{formatMoney(totals.expense)}</Td>
            <Td className={cn('money text-right', totals.net < 0 && 'text-destructive')}>{formatMoney(totals.net)}</Td>
            <Td className="money text-muted-foreground hidden text-right text-xs sm:table-cell">
              {totals.income ? formatPercent(totals.net / totals.income) : '—'}
            </Td>
          </tr>
          <tr className="bg-muted/40 text-muted-foreground">
            <Td className="text-xs">Média mensal</Td>
            <Td className="money text-right text-xs">{formatMoney(totals.income / n)}</Td>
            <Td className="money text-right text-xs">{formatMoney(totals.expense / n)}</Td>
            <Td className="money text-right text-xs">{formatMoney(totals.net / n)}</Td>
            <Td className="hidden sm:table-cell" />
          </tr>
        </tfoot>
      </Table>
    </div>
  );
}

function LegendItem({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="text-foreground flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  const rows = [
    { label: 'Receitas', value: p.income, swatch: INCOME },
    { label: 'Despesas', value: p.expense, swatch: EXPENSE },
    { label: 'Resultado', value: p.net, swatch: NET },
  ];
  return (
    <div className="bg-card text-card-foreground min-w-48 rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{formatMonth(p.month)}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ backgroundColor: r.swatch }} />
            {r.label}
          </span>
          <span className={cn('money', r.label === 'Resultado' && 'font-medium')}>{formatMoney(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
