import { useMemo, type ReactNode } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useAccounts } from '@/lib/accounts';
import { formatInvoice } from '@/lib/cards';
import { useCategoryLookup } from '@/lib/categories';
import { formatShortDate } from '@/lib/dates';
import type { Transaction } from '@/lib/transactions';
import type { Transfer } from '@/lib/transfers';
import { cn, formatMoney } from '@/lib/utils';
import { Table, Td, Th, THead, Tr } from './ui/table';

type Props = {
  transactions: Transaction[];
  onSelect: (t: Transaction) => void;
  /** Transferências exibidas junto, ordenadas pela data */
  transfers?: Transfer[];
  onSelectTransfer?: (t: Transfer) => void;
  /** Clique numa tag (ex.: para filtrar). Sem isso, as tags só são exibidas. */
  onTagClick?: (tag: string) => void;
  /** Linha extra no topo (ex.: digitação rápida de uma nova transação) */
  newRow?: ReactNode;
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
}: Props) {
  const { data: accounts } = useAccounts();
  const categories = useCategoryLookup();
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
          <Th className="w-28 min-w-28">Data</Th>
          <Th>Descrição</Th>
          <Th className="hidden w-56 min-w-56 md:table-cell xl:w-64 xl:min-w-64">Categoria</Th>
          <Th className="hidden w-48 min-w-48 md:table-cell xl:w-56 xl:min-w-56">Conta</Th>
          <Th className="w-44 min-w-44 text-right xl:w-48 xl:min-w-48">Valor</Th>
        </tr>
      </THead>
      <tbody>
        {newRow}
        {rows.map((row) => {
          const { date, weekday } = formatShortDate(row.date);
          const dateCell = (
            <Td className="money text-xs">
              {date} <span className="text-muted-foreground">{weekday}</span>
            </Td>
          );

          if (row.kind === 'transfer') {
            const t = row.item;
            const from = accountsById.get(t.from_account_id);
            const to = accountsById.get(t.to_account_id);
            return (
              <Tr key={`tr-${t.id}`} onClick={onSelectTransfer && (() => onSelectTransfer(t))}>
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
                <Td className="text-muted-foreground hidden md:table-cell">
                  <span className="block max-w-48 truncate xl:max-w-56">
                    {from?.name} → {to?.name}
                  </span>
                </Td>
                <Td className="money text-muted-foreground text-right font-medium">{formatMoney(t.amount)}</Td>
              </Tr>
            );
          }

          const t = row.item;
          const sub = categories.get(t.category_id);
          const parent = categories.parentOf(sub);
          const account = accountsById.get(t.account_id);
          return (
            <Tr key={t.id} onClick={() => onSelect(t)}>
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
                  {t.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      title={onTagClick ? `Filtrar por "${tag}"` : undefined}
                      onClick={(e) => {
                        if (!onTagClick) return;
                        e.stopPropagation();
                        onTagClick(tag);
                      }}
                      className={cn(
                        'bg-secondary text-muted-foreground shrink-0 rounded px-1.5 text-[11px] leading-5',
                        onTagClick ? 'hover:text-foreground cursor-pointer' : 'cursor-default',
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </Td>
              <Td className="hidden md:table-cell">
                <span className="flex max-w-56 items-center gap-2 xl:max-w-64">
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
              <Td className="text-muted-foreground hidden md:table-cell">
                <span className="block max-w-48 truncate xl:max-w-56">{account?.name}</span>
              </Td>
              <Td
                className={cn(
                  'money text-right font-medium',
                  t.type === 'income' ? 'text-success' : 'text-destructive',
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
