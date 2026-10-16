import { useSearchParams } from 'react-router-dom';
import { useAccounts } from '@/lib/accounts';
import { currentMonth, formatMonth, isValidMonth } from '@/lib/dates';
import {
  monthCount,
  presetPeriod,
  presets,
  type MonthlyBasis,
  type Period,
  type PresetKey,
  type ReportFilters,
} from '@/lib/reports';
import { useTags } from '@/lib/tags';
import type { TransactionType } from '@/lib/transactions';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CategoryReport } from '@/components/reports/CategoryReport';
import { ForecastReport } from '@/components/reports/ForecastReport';
import { MonthlyReport } from '@/components/reports/MonthlyReport';
import { TagReport } from '@/components/reports/TagReport';

const tabs = {
  categoria: 'Por categoria',
  mensal: 'Evolução mensal',
  tags: 'Por tag',
  previsao: 'Previsão',
} as const;

const horizons = [3, 6, 12] as const;
type Tab = keyof typeof tabs;

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const { data: accounts } = useAccounts();
  const { data: tags } = useTags();

  // Estado dos filtros fica no endereço (dá pra voltar, recarregar e salvar o link)
  const tab: Tab = (params.get('r') as Tab) in tabs ? (params.get('r') as Tab) : 'categoria';
  const preset: PresetKey = (params.get('p') as PresetKey) in presets ? (params.get('p') as PresetKey) : '6m';
  const type: TransactionType = params.get('tipo') === 'receitas' ? 'income' : 'expense';
  const accountId = params.get('conta') ?? '';
  const tagId = params.get('tag') ?? '';
  const paidOnly = params.get('pagos') === '1';
  const basis: MonthlyBasis = params.get('base') === 'caixa' ? 'cash' : 'purchase';
  const months = horizons.find((h) => String(h) === params.get('meses')) ?? 6;
  const isForecast = tab === 'previsao';

  const fallback = presetPeriod('6m');
  const period: Period =
    preset === 'custom'
      ? {
          from: isValidMonth(params.get('de')) ? params.get('de')! : fallback.from,
          to: isValidMonth(params.get('ate')) ? params.get('ate')! : fallback.to,
        }
      : presetPeriod(preset);
  // Período invertido (de > até) é corrigido trocando as pontas
  if (period.from > period.to) [period.from, period.to] = [period.to, period.from];

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  }

  const filters: ReportFilters = { period, paidOnly, accountId, tagId: tab === 'tags' ? undefined : tagId };
  const periodLabel =
    monthCount(period) === 1
      ? formatMonth(period.from)
      : `${formatMonth(period.from)} – ${formatMonth(period.to)}`;

  return (
    <div className="space-y-3">
      <PageHeader title="Relatórios">
        <div className="bg-muted inline-flex rounded-md p-0.5">
          {(Object.keys(tabs) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => update({ r: t === 'categoria' ? null : t })}
              className={cn(
                'text-muted-foreground rounded-sm px-3 py-1 text-xs font-medium transition-colors',
                tab === t && 'bg-background text-foreground shadow-xs',
              )}
            >
              {tabs[t]}
            </button>
          ))}
        </div>
        {!isForecast && <span className="text-muted-foreground text-xs">{periodLabel}</span>}
      </PageHeader>

      {isForecast && (
        <div className="flex items-center gap-2">
          <div className="bg-muted inline-flex rounded-md p-0.5">
            {horizons.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={months === h}
                onClick={() => update({ meses: h === 6 ? null : String(h) })}
                className={cn(
                  'text-muted-foreground rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                  months === h && 'bg-background text-foreground shadow-xs',
                )}
              >
                {h} meses
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Uma linha de filtros para tudo que está abaixo */}
      <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', isForecast && 'hidden')}>
        <div className="sm:w-44">
          <Select
            aria-label="Período"
            className="h-8 text-xs"
            value={preset}
            onChange={(e) => {
              const p = e.target.value as PresetKey;
              // Ao escolher "Personalizado", começa do período que estava na tela
              update(p === 'custom' ? { p, de: period.from, ate: period.to } : { p: p === '6m' ? null : p, de: null, ate: null });
            }}
          >
            {(Object.keys(presets) as PresetKey[]).map((k) => (
              <option key={k} value={k}>
                {presets[k]}
              </option>
            ))}
          </Select>
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-1.5 text-xs">
            <Input
              type="month"
              aria-label="De"
              className="h-8 w-36 text-xs"
              value={period.from}
              max={currentMonth()}
              onChange={(e) => isValidMonth(e.target.value) && update({ de: e.target.value })}
            />
            <span className="text-muted-foreground">até</span>
            <Input
              type="month"
              aria-label="Até"
              className="h-8 w-36 text-xs"
              value={period.to}
              onChange={(e) => isValidMonth(e.target.value) && update({ ate: e.target.value })}
            />
          </div>
        )}

        {tab === 'mensal' && (
          <div className="bg-muted inline-flex shrink-0 rounded-md p-0.5" title="Quando uma compra no cartão conta">
            {(['purchase', 'cash'] as const).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={basis === b}
                onClick={() => update({ base: b === 'cash' ? 'caixa' : null })}
                className={cn(
                  'text-muted-foreground rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                  basis === b && 'bg-background text-foreground shadow-xs',
                )}
              >
                {b === 'cash' ? 'Saída do caixa' : 'Data da compra'}
              </button>
            ))}
          </div>
        )}

        {tab !== 'mensal' && (
          <div className="bg-muted inline-flex shrink-0 rounded-md p-0.5">
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => update({ tipo: t === 'income' ? 'receitas' : null })}
                className={cn(
                  'text-muted-foreground flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                  type === t && 'bg-background text-foreground shadow-xs',
                )}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: t === 'income' ? 'var(--chart-income)' : 'var(--chart-expense)' }}
                />
                {t === 'income' ? 'Receitas' : 'Despesas'}
              </button>
            ))}
          </div>
        )}

        <div className="sm:w-44">
          <Select aria-label="Conta" className="h-8 text-xs" value={accountId} onChange={(e) => update({ conta: e.target.value })}>
            <option value="">Todas as contas</option>
            {accounts?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        {tab !== 'tags' && (tags?.length ?? 0) > 0 && (
          <div className="sm:w-40">
            <Select aria-label="Tag" className="h-8 text-xs" value={tagId} onChange={(e) => update({ tag: e.target.value })}>
              <option value="">Todas as tags</option>
              {tags?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs sm:ml-auto">
          <input
            type="checkbox"
            checked={paidOnly}
            onChange={(e) => update({ pagos: e.target.checked ? '1' : null })}
            className="accent-primary"
          />
          Só pagos / recebidos
        </label>
      </div>

      {tab === 'categoria' && <CategoryReport filters={filters} type={type} />}
      {tab === 'mensal' && <MonthlyReport filters={filters} basis={basis} />}
      {tab === 'tags' && <TagReport filters={filters} type={type} />}
      {isForecast && <ForecastReport months={months} />}
    </div>
  );
}
