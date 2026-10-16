import { useMemo } from 'react';
import { useAccounts } from '@/lib/accounts';
import { useCategoryLookup } from '@/lib/categories';
import { formatShortDate } from '@/lib/dates';
import type { Transaction } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';
import { Table, Td, Th, THead, Tr } from './ui/table';

type Props = {
  transactions: Transaction[];
  onSelect: (t: Transaction) => void;
};

export function TransactionTable({ transactions, onSelect }: Props) {
  const { data: accounts } = useAccounts();
  const categories = useCategoryLookup();
  const accountsById = useMemo(() => new Map(accounts?.map((a) => [a.id, a])), [accounts]);

  return (
    <Table>
      <THead>
        <tr>
          <Th className="w-24">Data</Th>
          <Th>Descrição</Th>
          <Th className="hidden w-64 md:table-cell">Categoria</Th>
          <Th className="hidden w-44 md:table-cell">Conta</Th>
          <Th className="w-36 text-right">Valor</Th>
        </tr>
      </THead>
      <tbody>
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
                <div className="truncate">
                  {t.description || <span className="text-muted-foreground">{sub?.name ?? 'Sem descrição'}</span>}
                  {t.notes && <span className="text-muted-foreground ml-2 text-xs">{t.notes}</span>}
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
