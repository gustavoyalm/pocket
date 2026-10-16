import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import {
  accountColors,
  accountTypes,
  useDeleteAccount,
  useSaveAccount,
  type Account,
  type AccountType,
} from '@/lib/accounts';
import { cn, parseMoney, toMoneyInput } from '@/lib/utils';
import { Button } from './ui/button';
import { Input, Label } from './ui/input';
import { Select } from './ui/select';

type Props = { account?: Account; onDone: () => void };

export function AccountForm({ account, onDone }: Props) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [initial, setInitial] = useState(account ? toMoneyInput(account.initial_balance) : '');
  const [color, setColor] = useState(account?.color ?? accountColors[0]);
  const [archived, setArchived] = useState(account?.archived ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useSaveAccount();
  const remove = useDeleteAccount();
  const busy = save.isPending || remove.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const initial_balance = initial.trim() === '' ? 0 : parseMoney(initial);
    if (initial_balance === null) return setError('Saldo inicial inválido.');
    setError(null);
    try {
      await save.mutateAsync({ id: account?.id, name: name.trim(), type, initial_balance, color, archived });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  async function onDelete() {
    if (!account) return;
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await remove.mutateAsync(account.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="acc-name">Nome</Label>
        <Input
          id="acc-name"
          required
          maxLength={80}
          placeholder="Ex.: Nubank, Carteira"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="acc-type">Tipo</Label>
          <Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(accountTypes).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="acc-initial">Saldo inicial</Label>
          <Input
            id="acc-initial"
            inputMode="decimal"
            placeholder="0,00"
            className="money"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
          />
        </div>
      </div>
      {type === 'credit_card' && (
        <p className="text-muted-foreground -mt-2 text-xs">
          Para cartão, use valor negativo se já houver fatura em aberto (ex.: -350,00).
        </p>
      )}

      <div className="space-y-2">
        <Label>Cor</Label>
        <div className="flex flex-wrap gap-2">
          {accountColors.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className="ring-offset-card flex size-7 items-center justify-center rounded-full transition-shadow aria-pressed:ring-2 aria-pressed:ring-current aria-pressed:ring-offset-2"
              style={{ backgroundColor: c, color: c }}
            >
              {color === c && <Check className="size-3.5 text-white" />}
            </button>
          ))}
        </div>
      </div>

      {account && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
            className="accent-primary size-4"
          />
          Arquivar conta
          <span className="text-muted-foreground">(some da lista e do saldo total)</span>
        </label>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
        {account && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onDelete}
            className={cn('text-destructive hover:text-destructive', confirmDelete && 'bg-destructive/10')}
          >
            {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
          </Button>
        )}
        <div className="flex gap-2 sm:ml-auto">
          <Button type="button" variant="outline" onClick={onDone} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button type="submit" disabled={busy} className="flex-1 sm:flex-none">
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
      {confirmDelete && (
        <p className="text-muted-foreground text-xs">
          Excluir apaga também todas as transações desta conta. Se quiser só escondê-la, arquive.
        </p>
      )}
    </form>
  );
}
