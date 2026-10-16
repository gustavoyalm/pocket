import { useMemo, type ReactNode } from 'react';
import { useAccounts } from '@/lib/accounts';
import { useCategoryLookup } from '@/lib/categories';
import { formatShortDate } from '@/lib/dates';
import type { Transaction } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';
import { Table, Td, Th, THead, Tr } from './ui/table';

type Props = {
  transactions: Transaction[];
  onSelect: (t: Transaction) => void;
  /** Clique numa tag (ex.: para filtrar). Sem isso, as tags só são exibidas. */
  onTagClick?: (tag: string) => void;
  /** Linha extra no topo (ex.: digitação rápida de uma nova transação) */
  newRow?: ReactNode;
};

export function TransactionTable({ transactions, onSelect, onTagClick, newRow }: Props) {
  const { data: accounts } = useAccounts();
  const categories = useCategoryLookup();
  const accountsById = useMemo(() => new Map(accounts?.map((a) => [a.id, a])), [accounts]);

  return (
    <Table>
      <THead>
        <tr>
          <Th className="w-28">Data</Th>
          <Th>Descrição</Th>
          <Th className="hidden w-64 md:table-cell">Categoria</Th>
          <Th className="hidden w-44 md:table-cell">Conta</Th>
          <Th className="w-36 text-right">Valor</Th>
        </tr>
      </THead>
      <tbody>
        {newRow}
        {transactions.map((t) => {
          const sub = categories.get(t.category_id);
          const parent = categories.parentOf(sub);
          const account = accountsById.get(t.account_id);
          const { date, weekday } = formatShortDate(t.date);
          return (
            <Tr key={t.id} onClick={() => onSelect(t)}>
              <Td className="money text-xs">
                {date} <span className="text-muted-foreground">{weekday}</span>
              </Td>
              <Td className="w-full max-w-0">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="truncate">
                    {t.description || <span className="text-muted-foreground">{sub?.name ?? 'Sem descrição'}</span>}
                    {t.notes && <span className="text-muted-foreground ml-2 text-xs">{t.notes}</span>}
                  </span>
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
                <span className="flex max-w-64 items-center gap-2">
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
                <span className="block max-w-44 truncate">{account?.name}</span>
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
