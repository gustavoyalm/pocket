import { useState } from 'react';
import { Plus } from 'lucide-react';
import { accountTypes, useAccounts, type Account } from '@/lib/accounts';
import { cn, formatMoney } from '@/lib/utils';
import { AccountForm } from '@/components/AccountForm';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';

type Editing = { account?: Account } | null;

export function Accounts() {
  const { data: accounts, isLoading, error } = useAccounts();
  const [editing, setEditing] = useState<Editing>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = accounts?.filter((a) => !a.archived) ?? [];
  const archived = accounts?.filter((a) => a.archived) ?? [];
  const visible = showArchived ? [...active, ...archived] : active;
  const total = active.reduce((sum, a) => sum + a.balance, 0);
  const projectedTotal = active.reduce((sum, a) => sum + a.projectedBalance, 0);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Contas"
        actions={
          <>
            {archived.length > 0 && (
              <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="accent-primary"
                />
                Mostrar arquivadas ({archived.length})
              </label>
            )}
            <Button size="sm" onClick={() => setEditing({})}>
              <Plus />
              Nova conta
            </Button>
          </>
        }
      />

      {error && <p className="text-destructive text-sm">Erro ao carregar contas: {error.message}</p>}

      {isLoading ? (
        <div className="bg-muted/50 h-40 animate-pulse rounded-lg border" />
      ) : visible.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-sm">
          Cadastre suas contas bancárias, cartões e carteira com o saldo atual de cada uma.
          <Button variant="outline" size="sm" onClick={() => setEditing({})}>
            <Plus />
            Cadastrar primeira conta
          </Button>
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Conta</Th>
              <Th className="hidden w-64 sm:table-cell">Tipo</Th>
              <Th className="hidden w-40 text-right md:table-cell">Limite disponível</Th>
              <Th className="w-40 min-w-40 text-right">Saldo atual</Th>
              <Th className="hidden w-40 min-w-40 text-right sm:table-cell" title="Inclui transações pendentes">
                Saldo previsto
              </Th>
            </tr>
          </THead>
          <tbody>
            {visible.map((a) => (
              <Tr key={a.id} onClick={() => setEditing({ account: a })} className={cn(a.archived && 'opacity-50')}>
                <Td className="w-full max-w-0">
                  <span className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: a.color ?? '#71717a' }} />
                    <span className="truncate">{a.name}</span>
                    {a.archived && <span className="text-muted-foreground text-xs">arquivada</span>}
                  </span>
                </Td>
                <Td className="text-muted-foreground hidden sm:table-cell">
                  {accountTypes[a.type].label}
                  {a.type === 'credit_card' && (
                    <span className="ml-2 text-xs">
                      fecha dia {a.closing_day} · vence dia {a.due_day}
                    </span>
                  )}
                </Td>
                <Td className="money text-muted-foreground hidden text-right md:table-cell">
                  {/* o limite é consumido por todas as compras, pagas ou não */}
                  {a.credit_limit != null ? formatMoney(Number(a.credit_limit) + a.projectedBalance) : ''}
                </Td>
                <Td className={cn('money text-right font-medium', a.balance < 0 && 'text-destructive')}>
                  {formatMoney(a.balance)}
                </Td>
                <Td
                  className={cn(
                    'money text-muted-foreground hidden text-right sm:table-cell',
                    a.projectedBalance < 0 && 'text-destructive/80',
                  )}
                >
                  {formatMoney(a.projectedBalance)}
                </Td>
              </Tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 border-t">
              <Td className="text-muted-foreground text-xs font-medium">Total</Td>
              <Td className="hidden sm:table-cell" />
              <Td className="hidden md:table-cell" />
              <Td className={cn('money text-right font-semibold', total < 0 && 'text-destructive')}>
                {formatMoney(total)}
              </Td>
              <Td
                className={cn(
                  'money text-muted-foreground hidden text-right font-semibold sm:table-cell',
                  projectedTotal < 0 && 'text-destructive/80',
                )}
              >
                {formatMoney(projectedTotal)}
              </Td>
            </tr>
          </tfoot>
        </Table>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.account ? 'Editar conta' : 'Nova conta'}
      >
        {editing && <AccountForm account={editing.account} onDone={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}
