import { useMemo } from 'react';
import { useAccounts } from '@/lib/accounts';
import { formatShortDate } from '@/lib/dates';
import { useReportTransactions, type ReportFilters } from '@/lib/reports';
import { DEFAULT_TAG_COLOR, useTagLookup } from '@/lib/tags';
import type { TransactionType } from '@/lib/transactions';
import { cn, formatMoney } from '@/lib/utils';
import { useTransactionDialog } from '@/components/TransactionDialog';
import { Td, Tr } from '@/components/ui/table';

type Props = {
  filters: ReportFilters;
  type: TransactionType;
  categoryIds?: string[];
  tagId?: string | null;
  /** Recuo da 1ª coluna (nível na árvore) */
  indent: string;
  /** Total da linha-mãe, para o % de cada gasto */
  parentTotal: number;
};

/**
 * Último nível da árvore do relatório: os gastos em si (maiores primeiro).
 * As células seguem as colunas da tabela do relatório: nome · barra · valor · % · anterior · variação · nº.
 */
export function DetailRows({ filters, type, categoryIds, tagId, indent, parentTotal }: Props) {
  // A tag da linha (relatório por tag) ou a do filtro geral (relatório por categoria)
  const { data, isLoading, error } = useReportTransactions(
    { ...filters, type, categoryIds, tagId: tagId ?? filters.tagId ?? undefined },
    true,
  );
  const { data: accounts } = useAccounts();
  const tags = useTagLookup();
  const { openTransaction } = useTransactionDialog();
  const accountName = useMemo(() => new Map(accounts?.map((a) => [a.id, a.name])), [accounts]);

  if (isLoading || error || !data?.rows.length) {
    return (
      <tr className="border-b">
        <td colSpan={7} className={cn('text-muted-foreground py-1.5 text-xs', indent)}>
          {isLoading ? 'Carregando gastos…' : error ? `Erro: ${error.message}` : 'Nenhum gasto.'}
        </td>
      </tr>
    );
  }

  return (
    <>
      {data.rows.map((t) => {
        const { date } = formatShortDate(t.date);
        return (
          <Tr key={t.id} onClick={() => openTransaction(t)} className="bg-muted/10 text-xs" title="Abrir transação">
            <Td className={cn('max-w-0', indent)}>
              <span className="flex items-center gap-2">
                <span className="money text-muted-foreground shrink-0">{date}</span>
                <span className="truncate">{t.description || <span className="text-muted-foreground">Sem descrição</span>}</span>
                {t.installment_total && (
                  <span className="money text-muted-foreground shrink-0">
                    {t.installment_number}/{t.installment_total}
                  </span>
                )}
                {t.tagIds.map((id) => {
                  const tag = tags.get(id);
                  if (!tag) return null;
                  const color = tag.color ?? DEFAULT_TAG_COLOR;
                  return (
                    <span
                      key={id}
                      className="shrink-0 rounded px-1 text-[10px] font-medium"
                      style={{ backgroundColor: `${color}26`, color }}
                    >
                      {tag.name}
                    </span>
                  );
                })}
              </span>
            </Td>
            <Td className="text-muted-foreground truncate">
              <span className="block max-w-full truncate">{accountName.get(t.account_id)}</span>
            </Td>
            <Td className={cn('money text-right', !t.paid && 'text-muted-foreground')}>{formatMoney(t.amount)}</Td>
            <Td className="money text-muted-foreground text-right">
              {parentTotal ? `${((t.amount / parentTotal) * 100).toFixed(1).replace('.', ',')}%` : ''}
            </Td>
            <Td className="hidden lg:table-cell" />
            <Td />
            <Td className="hidden md:table-cell" />
          </Tr>
        );
      })}
      {data.total > data.rows.length && (
        <tr className="border-b">
          <td colSpan={7} className={cn('text-muted-foreground py-1.5 text-xs', indent)}>
            Mostrando os {data.rows.length} maiores de {data.total} gastos.
          </td>
        </tr>
      )}
    </>
  );
}
