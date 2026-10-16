import { useMemo, type ReactNode } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useAccounts } from '@/lib/accounts';
import { formatInvoice } from '@/lib/cards';
import { useCategoryLookup } from '@/lib/categories';
import { formatShortDate, todayISO } from '@/lib/dates';
import { DEFAULT_TAG_COLOR, useTagLookup } from '@/lib/tags';
import { useToggleTransactionPaid, type Transaction } from '@/lib/transactions';
import { useToggleTransferPaid, type Transfer } from '@/lib/transfers';
import { cn, formatMoney } from '@/lib/utils';
import { PaidToggle } from './PaidToggle';
import { Table, Td, Th, THead, Tr } from './ui/table';

type Props = {
  transactions: Transaction[];
  onSelect: (t: Transaction) => void;
  /** Transferências exibidas junto, ordenadas pela data */
  transfers?: Transfer[];
  onSelectTransfer?: (t: Transfer) => void;
  /** Clique numa tag (recebe o id; ex.: para filtrar). Sem isso, as tags só são exibidas. */
  onTagClick?: (tagId: string) => void;
  /** Linha extra no topo (ex.: digitação rápida de uma nova transação) */
  newRow?: ReactNode;
  /** Versão para espaços estreitos (ex.: Visão geral): sem coluna Conta e colunas menores */
  compact?: boolean;
};

type Row =
  | { kind: 'transaction'; date: string; created: string; item: Transaction }
  | { kind: 'transfer'; date: string; created: string; item: Transfer };

export function TransactionTable({
  transactions,
  onSelect,
  transfers = [],
  onSelectTransfer,
  onTagClick,
  newRow,
  compact = false,
}: Props) {
  // Larguras das colunas fixas (a Descrição fica com o resto)
  const col = compact
    ? { category: 'w-48 min-w-48', categoryMax: 'max-w-48', value: 'w-32 min-w-32' }
    : {
        category: 'w-56 min-w-56 xl:w-64 xl:min-w-64',
        categoryMax: 'max-w-56 xl:max-w-64',
        value: 'w-44 min-w-44 xl:w-48 xl:min-w-48',
      };
  const accountCell = cn('text-muted-foreground hidden', !compact && 'md:table-cell');
  const { data: accounts } = useAccounts();
  const categories = useCategoryLookup();
  const tags = useTagLookup();
  const toggleTransaction = useToggleTransactionPaid();
  const toggleTransfer = useToggleTransferPaid();
  const today = todayISO();
  const accountsById = useMemo(() => new Map(accounts?.map((a) => [a.id, a])), [accounts]);

  const rows = useMemo<Row[]>(
    () =>
      [
        ...transactions.map((item) => ({ kind: 'transaction' as const, date: item.date, created: item.created_at, item })),
        ...transfers.map((item) => ({ kind: 'transfer' as const, date: item.date, created: item.created_at, item })),
      ].sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created)),
    [transactions, transfers],
  );

  return (
    <Table>
      <THead>
        <tr>
          {/* min-w: a Descrição é flexível e, sem mínimo, espremeria as demais colunas */}
          <Th className="w-9 min-w-9 pr-0">
            <span className="sr-only">Situação</span>
          </Th>
          <Th className="w-28 min-w-28">Data</Th>
          <Th>Descrição</Th>
          <Th className={cn('hidden md:table-cell', col.category)}>Categoria</Th>
          <Th className={cn('hidden w-48 min-w-48 xl:w-56 xl:min-w-56', !compact && 'md:table-cell')}>Conta</Th>
          <Th className={cn('text-right', col.value)}>Valor</Th>
        </tr>
      </THead>
      <tbody>
        {newRow}
        {rows.map((row) => {
          const { date, weekday } = formatShortDate(row.date);
          const paid = row.item.paid;
          const overdue = !paid && row.date < today;
          const dateCell = (
            <Td className={cn('money text-xs', overdue && 'text-destructive')}>
              {date} <span className={overdue ? 'text-destructive/70' : 'text-muted-foreground'}>{weekday}</span>
            </Td>
          );

          if (row.kind === 'transfer') {
            const t = row.item;
            const from = accountsById.get(t.from_account_id);
            const to = accountsById.get(t.to_account_id);
            return (
              <Tr key={`tr-${t.id}`} onClick={onSelectTransfer && (() => onSelectTransfer(t))}>
                <Td className="pr-0">
                  <PaidToggle
                    paid={t.paid}
                    overdue={overdue}
                    kind="transfer"
                    onToggle={() => toggleTransfer.mutate({ id: t.id, paid: !t.paid })}
                  />
                </Td>
                {dateCell}
                <Td className="w-full max-w-0">
                  <span className="block truncate">
                    {t.description || (to?.type === 'credit_card' ? 'Pagamento de fatura' : 'Transferência')}
                    {t.invoice_month && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        fatura {formatInvoice(t.invoice_month.slice(0, 7))}
                      </span>
                    )}
                  </span>
                </Td>
                <Td className="text-muted-foreground hidden md:table-cell">
                  <span className="flex items-center gap-2">
                    <ArrowLeftRight className="size-3 shrink-0" />
                    Transferência
                  </span>
                </Td>
                <Td className={accountCell}>
                  <span className="block max-w-48 truncate xl:max-w-56">
                    {from?.name} → {to?.name}
                  </span>
                </Td>
                <Td className={cn('money text-muted-foreground text-right font-medium', !paid && 'opacity-60')}>
                  {formatMoney(t.amount)}
                </Td>
              </Tr>
            );
          }

          const t = row.item;
          const sub = categories.get(t.category_id);
          const parent = categories.parentOf(sub);
          const account = accountsById.get(t.account_id);
          return (
            <Tr key={t.id} onClick={() => onSelect(t)}>
              <Td className="pr-0">
                <PaidToggle
                  paid={t.paid}
                  overdue={overdue}
                  kind={t.type}
                  onToggle={() => toggleTransaction.mutate({ id: t.id, paid: !t.paid })}
                />
              </Td>
              {dateCell}
              <Td className="w-full max-w-0">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="truncate">
                    {t.description || <span className="text-muted-foreground">{sub?.name ?? 'Sem descrição'}</span>}
                    {t.notes && <span className="text-muted-foreground ml-2 text-xs">{t.notes}</span>}
                  </span>
                  {t.installment_total && (
                    <span className="money text-muted-foreground shrink-0 rounded border px-1 text-[11px] leading-4">
                      {t.installment_number}/{t.installment_total}
                    </span>
                  )}
                  {t.tagIds.map((tagId) => {
                    const tag = tags.get(tagId);
                    if (!tag) return null;
                    const color = tag.color ?? DEFAULT_TAG_COLOR;
                    return (
                      <button
                        key={tagId}
                        type="button"
                        title={onTagClick ? `Filtrar por "${tag.name}"` : undefined}
                        onClick={(e) => {
                          if (!onTagClick) return;
                          e.stopPropagation();
                          onTagClick(tagId);
                        }}
                        style={{ backgroundColor: `${color}26`, color }}
                        className={cn(
                          'shrink-0 rounded px-1.5 text-[11px] leading-5 font-medium',
                          onTagClick ? 'cursor-pointer hover:brightness-125' : 'cursor-default',
                        )}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </Td>
              <Td className="hidden md:table-cell">
                <span className={cn('flex items-center gap-2', col.categoryMax)}>
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: categories.colorOf(sub) }}
                  />
                  <span className="truncate">
                    {parent && <span className="text-muted-foreground">{parent.name} › </span>}
                    {sub?.name}
                  </span>
                </span>
              </Td>
              <Td className={accountCell}>
                <span className="block max-w-48 truncate xl:max-w-56">
                  {account?.name}
                  {t.invoice_month && (
                    <span className="text-muted-foreground/70 text-xs" title="Fatura">
                      {' '}
                      · {formatInvoice(t.invoice_month.slice(0, 7))}
                    </span>
                  )}
                </span>
              </Td>
              <Td
                className={cn(
                  'money text-right font-medium',
                  t.type === 'income' ? 'text-success' : 'text-destructive',
                  !paid && 'opacity-60',
                )}
              >
                {t.type === 'income' ? '+' : '−'}
                {formatMoney(t.amount)}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
