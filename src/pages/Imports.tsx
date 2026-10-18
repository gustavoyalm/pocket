import { useMemo, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, Check, RotateCcw, Settings, X } from 'lucide-react';
import { useAccounts } from '@/lib/accounts';
import { formatInvoice, invoiceFor, isCard } from '@/lib/cards';
import { useCategoryLookup } from '@/lib/categories';
import { formatShortDate } from '@/lib/dates';
import {
  useAddCardFinal,
  useApproveImports,
  useImportItems,
  useSetImportStatus,
  useUpdateImportItems,
  purchaseTime,
  samePurchase,
  spentOn,
  type ImportItem,
  type ImportStatus,
} from '@/lib/imports';
import { normalizeTag } from '@/lib/tags';
import { cn, formatMoney } from '@/lib/utils';
import { CategoryCombobox } from '@/components/CategoryCombobox';
import { ImportSetup } from '@/components/ImportSetup';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';

const tabs: Record<ImportStatus, string> = { pending: 'Pendentes', approved: 'Aprovadas', rejected: 'Rejeitadas' };

const cellInput =
  'h-7 w-full rounded-md border border-border bg-background/60 px-2 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring';

export function Imports() {
  const [tab, setTab] = useState<ImportStatus>('pending');
  const [setupOpen, setSetupOpen] = useState(false);
  const { data: items, isLoading, error } = useImportItems(tab);
  const pendingCount = useImportItems('pending').data?.length ?? 0;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Importações"
        actions={
          <Button size="sm" variant="outline" onClick={() => setSetupOpen(true)}>
            <Settings />
            Configurar n8n
          </Button>
        }
      >
        <div className="bg-muted inline-flex rounded-md p-0.5">
          {(Object.keys(tabs) as ImportStatus[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'text-muted-foreground rounded-sm px-3 py-1 text-xs font-medium transition-colors',
                tab === t && 'bg-background text-foreground shadow-xs',
              )}
            >
              {tabs[t]}
              {t === 'pending' && pendingCount > 0 && (
                <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 text-[10px]">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </PageHeader>

      {error && <p className="text-destructive text-sm">Erro ao carregar: {error.message}</p>}

      {isLoading ? (
        <div className="bg-muted/50 h-64 animate-pulse rounded-lg border" />
      ) : !items?.length ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          {tab === 'pending'
            ? 'Nada para revisar. Quando o n8n enviar transações, elas aparecem aqui antes de entrar nas faturas. Só chegam transações a partir da fatura definida em cada cartão (Contas → cartão → "Importar a partir da fatura").'
            : `Nenhuma importação ${tabs[tab].toLowerCase()}.`}
        </div>
      ) : tab === 'pending' ? (
        <PendingTable items={items} />
      ) : (
        <DecidedTable items={items} status={tab} />
      )}

      <Dialog open={setupOpen} onClose={() => setSetupOpen(false)} title="Configurar importação (n8n)" className="max-w-2xl">
        <ImportSetup />
      </Dialog>
    </div>
  );
}

function PendingTable({ items }: { items: ImportItem[] }) {
  const { data: accounts } = useAccounts();
  const cards = accounts?.filter((a) => isCard(a) && !a.archived) ?? [];
  const update = useUpdateImportItems();
  const approve = useApproveImports();
  const setStatus = useSetImportStatus();
  const addFinal = useAddCardFinal();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const ready = (i: ImportItem) => !!i.account_id && !!i.category_id;
  const selectedIds = useMemo(() => items.filter((i) => selected.has(i.id)).map((i) => i.id), [items, selected]);
  const allSelected = selectedIds.length === items.length;

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approveIds(ids: string[]) {
    setMessage(null);
    try {
      const n = await approve.mutateAsync(ids);
      const skipped = ids.length - n;
      setMessage(
        `${n} ${n === 1 ? 'transação aprovada' : 'transações aprovadas'}` +
          (skipped ? ` · ${skipped} ficaram pendentes (falta cartão ou categoria)` : ''),
      );
      setSelected(new Set());
    } catch (err) {
      setMessage(err instanceof Error ? `Erro: ${err.message}` : 'Erro ao aprovar.');
    }
  }

  // Complemento e tags valem para todas as parcelas pendentes da mesma compra
  const setNote = (item: ImportItem, note: string) =>
    update.mutate({ ids: samePurchase(item, items).map((i) => i.id), values: { note: note.trim() || null } });
  const setTags = (item: ImportItem, text: string) => {
    const tags: string[] = [];
    for (const part of text.split(',')) {
      const t = normalizeTag(part);
      if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
    }
    update.mutate({ ids: samePurchase(item, items).map((i) => i.id), values: { tags } });
  };

  const setCategory = (ids: string[], categoryId: string) =>
    update.mutate({ ids, values: { category_id: categoryId } });
  // Categoria em lote só faz sentido para itens do mesmo tipo (despesa x estorno)
  const selectedTypes = new Set(items.filter((i) => selected.has(i.id)).map((i) => i.type));
  const bulkType = selectedTypes.size === 1 ? [...selectedTypes][0] ?? undefined : undefined;

  return (
    <div className="space-y-2">
      <div className="flex min-h-8 flex-wrap items-center gap-2 text-xs">
        {selectedIds.length > 0 ? (
          <>
            <span className="text-muted-foreground">{selectedIds.length} selecionadas</span>
            <div className="w-72">
              <CategoryCombobox
                value=""
                onChange={(id) => bulkType && setCategory(selectedIds, id)}
                type={bulkType}
                placeholder={bulkType ? 'Categoria para as selecionadas…' : 'Selecione só despesas ou só estornos'}
                className={cellInput}
              />
            </div>
            <Button size="sm" className="h-7" disabled={approve.isPending} onClick={() => approveIds(selectedIds)}>
              <Check />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={setStatus.isPending}
              onClick={() => {
                setStatus.mutate({ ids: selectedIds, status: 'rejected' });
                setSelected(new Set());
              }}
            >
              <X />
              Rejeitar
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">
            Confira cartão e categoria e aprove. Para dar a mesma categoria a vários itens, selecione-os.
          </span>
        )}
        {message && <span className={cn('ml-auto', message.startsWith('Erro') ? 'text-destructive' : 'text-success')}>{message}</span>}
      </div>

      <Table>
        <THead>
          <tr>
            <Th className="w-9 min-w-9 pr-0">
              <input
                type="checkbox"
                aria-label="Selecionar todas"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
                className="accent-primary"
              />
            </Th>
            <Th className="w-32 min-w-32" title="Data e hora da compra, horário de Brasília (mais recente primeiro)">Compra</Th>
            <Th>Descrição</Th>
            <Th className="w-20 min-w-20" title="Fatura em que vai entrar">Fatura</Th>
            <Th className="w-64 min-w-64">Cartão</Th>
            <Th className="w-64 min-w-64 2xl:w-72 2xl:min-w-72">Categoria · tags</Th>
            <Th className="w-28 min-w-28 text-right">Valor</Th>
            <Th className="w-20 min-w-20">
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </THead>
        <tbody>
          {items.map((i) => {
            const card = cards.find((c) => c.id === i.account_id);
            const finalMissing = !!card && !!i.card_final && !card.card_finals.includes(i.card_final);
            const purchase = spentOn(i);
            const { date, weekday } = formatShortDate(purchase);
            const time = purchaseTime(i);
            // Fatura: a informada pelo banco; sem ela, calculada pelo fechamento do cartão escolhido
            const bankInvoice = i.invoice_month?.slice(0, 7) ?? null;
            const invoice = bankInvoice ?? (card ? invoiceFor(i.date!, card) : null);
            return (
              <Tr key={i.id} className={cn(selected.has(i.id) && 'bg-accent/40')}>
                <Td className="pr-0">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${i.description}`}
                    checked={selected.has(i.id)}
                    onChange={() => toggle(i.id)}
                    className="accent-primary"
                  />
                </Td>
                <Td className="money text-xs whitespace-nowrap" title={time ? undefined : 'O banco não informou o horário desta compra'}>
                  {date}/{purchase.slice(2, 4)} {time ?? <span className="text-muted-foreground">{weekday}</span>}
                </Td>
                <Td className="w-full max-w-0 py-1.5">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="truncate" title="Texto do banco (não é alterado)">
                      {i.description}
                    </span>
                    {i.installment_total && (
                      <span className="money text-muted-foreground shrink-0 rounded border px-1 text-[11px] leading-4">
                        {i.installment_number}/{i.installment_total}
                      </span>
                    )}
                    {i.type === 'income' && <span className="text-success shrink-0 text-[11px]">estorno/crédito</span>}
                    {i.possible_duplicate && (
                      <span
                        className="flex shrink-0 items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
                        title="Já existe neste cartão uma transação com o mesmo valor e data próxima"
                      >
                        <AlertTriangle className="size-3" />
                        possível duplicada
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <DraftInput
                      value={i.note ?? ''}
                      onSave={(v) => setNote(i, v)}
                      placeholder="+ complemento da descrição"
                      title={
                        i.installment_total
                          ? 'Vai depois do texto do banco: "banco | complemento". Vale para todas as parcelas desta compra.'
                          : 'Vai depois do texto do banco: "banco | complemento".'
                      }
                      maxLength={200}
                      className={cellInput}
                    />
                  </div>
                </Td>
                <Td
                  className="money text-xs whitespace-nowrap"
                  title={
                    invoice
                      ? `Vai para a fatura de ${formatInvoice(invoice)} (${bankInvoice ? 'informada pelo banco' : 'calculada pelo fechamento do cartão'})`
                      : 'Escolha o cartão para calcular a fatura'
                  }
                >
                  {invoice ? (
                    <>
                      <span className="text-muted-foreground">→ </span>
                      {formatInvoice(invoice)}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
                <Td>
                  <select
                    aria-label="Cartão"
                    title={card?.name}
                    value={i.account_id ?? ''}
                    onChange={(e) => update.mutate({ ids: [i.id], values: { account_id: e.target.value || null } })}
                    className={cn(cellInput, '[&_option]:bg-card', !i.account_id && 'border-destructive text-muted-foreground')}
                  >
                    <option value="">{i.card_final ? `Final ${i.card_final}: escolher…` : 'Escolher cartão…'}</option>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {finalMissing && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground mt-0.5 block text-[11px] underline-offset-2 hover:underline"
                      disabled={addFinal.isPending}
                      onClick={() => addFinal.mutate({ accountId: card.id, final: i.card_final! })}
                    >
                      salvar final {i.card_final} neste cartão
                    </button>
                  )}
                </Td>
                <Td className="py-1.5">
                  <div className="flex flex-col gap-1">
                  <CategoryCombobox
                    value={i.category_id ?? ''}
                    onChange={(id) => setCategory([i.id], id)}
                    type={i.type ?? undefined}
                    placeholder="Escolher categoria…"
                    className={cn(cellInput, !i.category_id && 'border-destructive')}
                  />
                  <DraftInput
                    value={(i.tags ?? []).join(', ')}
                    onSave={(v) => setTags(i, v)}
                    placeholder="tags, separadas por vírgula"
                    title={i.installment_total ? 'Vale para todas as parcelas desta compra.' : undefined}
                    className={cellInput}
                  />
                  </div>
                </Td>
                <Td className={cn('money text-right font-medium', i.type === 'income' ? 'text-success' : 'text-destructive')}>
                  {i.type === 'income' ? '+' : '−'}
                  {formatMoney(i.amount)}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-success size-7"
                      disabled={!ready(i) || approve.isPending}
                      title={ready(i) ? 'Aprovar' : 'Escolha o cartão e a categoria para aprovar'}
                      aria-label="Aprovar"
                      onClick={() => approveIds([i.id])}
                    >
                      <Check />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive size-7"
                      title="Rejeitar"
                      aria-label="Rejeitar"
                      onClick={() => setStatus.mutate({ ids: [i.id], status: 'rejected' })}
                    >
                      <X />
                    </Button>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

function DecidedTable({ items, status }: { items: ImportItem[]; status: Exclude<ImportStatus, 'pending'> }) {
  const { data: accounts } = useAccounts();
  const categories = useCategoryLookup();
  const setStatus = useSetImportStatus();
  const accountName = (id: string | null) => accounts?.find((a) => a.id === id)?.name;

  return (
    <Table>
      <THead>
        <tr>
          <Th className="w-32 min-w-32">Compra</Th>
          <Th>Descrição</Th>
          <Th className="w-48 min-w-48">Cartão</Th>
          <Th className="w-56 min-w-56">Categoria</Th>
          <Th className="w-32 min-w-32 text-right">Valor</Th>
          {status === 'rejected' && <Th className="w-28 min-w-28" />}
        </tr>
      </THead>
      <tbody>
        {items.map((i) => {
          const sub = categories.get(i.category_id);
          const parent = categories.parentOf(sub);
          return (
            <Tr key={i.id}>
              <Td className="money text-xs whitespace-nowrap">
                {formatShortDate(spentOn(i)).date}/{spentOn(i).slice(2, 4)}{' '}
                {purchaseTime(i) ?? ''}
              </Td>
              <Td className="w-full max-w-0">
                <span className="block truncate">
                  {i.description}
                  {i.note && <span className="text-muted-foreground"> | {i.note}</span>}
                  {!!i.tags?.length && <span className="text-muted-foreground ml-2 text-xs">{i.tags.join(', ')}</span>}
                </span>
              </Td>
              <Td className="text-muted-foreground text-xs">{accountName(i.account_id) ?? (i.card_final ? `final ${i.card_final}` : '—')}</Td>
              <Td className="text-xs">
                {sub ? (
                  <>
                    {parent && <span className="text-muted-foreground">{parent.name} › </span>}
                    {sub.name}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Td>
              <Td className="money text-right">{formatMoney(i.amount)}</Td>
              {status === 'rejected' && (
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6"
                    onClick={() => setStatus.mutate({ ids: [i.id], status: 'pending' })}
                  >
                    <RotateCcw />
                    Restaurar
                  </Button>
                </Td>
              )}
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** Campo de texto que só grava ao sair dele (Tab/clique fora) ou com Enter; Esc desfaz. */
function DraftInput({
  value,
  onSave,
  className,
  ...props
}: { value: string; onSave: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // Valor novo vindo do servidor (ex.: preenchido em outra parcela da mesma compra)
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft.trim() !== value.trim()) onSave(draft);
  };
  return (
    <input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
}
