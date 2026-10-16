import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { accountTypes, useAccounts, type Account } from '@/lib/accounts';
import { cn, formatMoney } from '@/lib/utils';
import { AccountForm } from '@/components/AccountForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';

type Editing = { account?: Account } | null;

export function Accounts() {
  const { data: accounts, isLoading, error } = useAccounts();
  const [editing, setEditing] = useState<Editing>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = accounts?.filter((a) => !a.archived) ?? [];
  const archived = accounts?.filter((a) => a.archived) ?? [];
  const total = active.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contas</h1>
          <p className="text-muted-foreground text-sm">
            Saldo total{' '}
            <span className={cn('money text-foreground font-medium', total < 0 && 'text-destructive')}>
              {formatMoney(total)}
            </span>
          </p>
        </div>
        <Button onClick={() => setEditing({})}>
          <Plus />
          Nova conta
        </Button>
      </header>

      {error && (
        <Card className="text-destructive p-4 text-sm">Erro ao carregar contas: {error.message}</Card>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="bg-muted/50 h-[88px] animate-pulse" />
          ))}
        </div>
      ) : active.length === 0 && archived.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-medium">Nenhuma conta ainda</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Cadastre suas contas bancárias, cartões e carteira com o saldo atual de cada uma.
          </p>
          <Button className="mt-2" onClick={() => setEditing({})}>
            <Plus />
            Cadastrar primeira conta
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((a) => (
            <AccountCard key={a.id} account={a} onClick={() => setEditing({ account: a })} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            <ChevronRight className={cn('size-4 transition-transform', showArchived && 'rotate-90')} />
            Arquivadas ({archived.length})
          </button>
          {showArchived && (
            <div className="grid gap-3 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((a) => (
                <AccountCard key={a.id} account={a} onClick={() => setEditing({ account: a })} />
              ))}
            </div>
          )}
        </section>
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

function AccountCard({ account, onClick }: { account: Account; onClick: () => void }) {
  const { label, icon: Icon } = accountTypes[account.type];
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="hover:bg-accent/50 flex items-center gap-4 p-4 transition-colors">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${account.color ?? '#71717a'}22`, color: account.color ?? '#71717a' }}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account.name}</p>
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
        <p className={cn('money text-sm font-semibold', account.balance < 0 && 'text-destructive')}>
          {formatMoney(account.balance)}
        </p>
      </Card>
    </button>
  );
}
