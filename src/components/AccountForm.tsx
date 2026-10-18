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
import { currentMonth, isValidMonth } from '@/lib/dates';
import { cn, parseMoney, toMoneyInput } from '@/lib/utils';
import { Button } from './ui/button';
import { Field, FormFooter, FormSection, SwitchRow } from './ui/form';
import { Input } from './ui/input';
import { Select } from './ui/select';

type Props = { account?: Account; onDone: () => void };

export function AccountForm({ account, onDone }: Props) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [initial, setInitial] = useState(account ? toMoneyInput(account.initial_balance) : '');
  const [color, setColor] = useState(account?.color ?? accountColors[0]);
  const [archived, setArchived] = useState(account?.archived ?? false);
  const [closingDay, setClosingDay] = useState(account?.closing_day?.toString() ?? '');
  const [dueDay, setDueDay] = useState(account?.due_day?.toString() ?? '');
  const [finals, setFinals] = useState((account?.card_finals ?? []).join(', '));
  // Fatura a partir da qual a importação traz transações ("YYYY-MM"); padrão: mês atual
  const [importSince, setImportSince] = useState(account?.import_since?.slice(0, 7) ?? currentMonth());
  const [limit, setLimit] = useState(account?.credit_limit != null ? toMoneyInput(Number(account.credit_limit)) : '');
  const isCard = type === 'credit_card';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useSaveAccount();
  const remove = useDeleteAccount();
  const busy = save.isPending || remove.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const initial_balance = initial.trim() === '' ? 0 : parseMoney(initial);
    if (initial_balance === null) return setError('Saldo inicial inválido.');
    const closing = Number(closingDay);
    const due = Number(dueDay);
    const credit_limit = limit.trim() === '' ? null : parseMoney(limit);
    if (isCard) {
      if (!Number.isInteger(closing) || closing < 1 || closing > 31) return setError('Dia de fechamento: de 1 a 31.');
      if (!Number.isInteger(due) || due < 1 || due > 31) return setError('Dia de vencimento: de 1 a 31.');
      if (limit.trim() && (credit_limit === null || credit_limit < 0)) return setError('Limite inválido.');
    }
    setError(null);
    try {
      await save.mutateAsync({
        id: account?.id,
        name: name.trim(),
        type,
        initial_balance,
        color,
        archived,
        // Campos de cartão só existem para cartão (o banco exige isso)
        closing_day: isCard ? closing : null,
        due_day: isCard ? due : null,
        credit_limit: isCard ? credit_limit : null,
        // "2400, 1234" → ['2400', '1234'] (só dígitos, sem repetir)
        import_since: isCard && isValidMonth(importSince) ? `${importSince}-01` : null,
        card_finals: isCard
          ? [...new Set(finals.split(/[,\s]+/).map((f) => f.replace(/\D/g, '')).filter(Boolean))]
          : [],
      });
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
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Nome" htmlFor="acc-name">
          <Input
            id="acc-name"
            required
            maxLength={80}
            placeholder="Ex.: Nubank, Carteira"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Tipo" htmlFor="acc-type">
          <Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(accountTypes).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label={isCard ? 'Saldo inicial (dívida)' : 'Saldo inicial'}
        htmlFor="acc-initial"
        className="sm:w-1/2"
        hint={
          isCard
            ? 'Negativo para uma dívida anterior ao pocket (ex.: -350,00). O ideal é deixar 0 e lançar as compras da fatura atual.'
            : undefined
        }
      >
        <Input
          id="acc-initial"
          inputMode="decimal"
          placeholder="0,00"
          className="money"
          value={initial}
          onChange={(e) => setInitial(e.target.value)}
        />
      </Field>

      {isCard && (
        <FormSection title="Cartão de crédito">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Dia de fechamento" htmlFor="acc-closing">
              <Input
                id="acc-closing"
                inputMode="numeric"
                required
                placeholder="Ex.: 28"
                className="money"
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
              />
            </Field>
            <Field label="Dia de vencimento" htmlFor="acc-due">
              <Input
                id="acc-due"
                inputMode="numeric"
                required
                placeholder="Ex.: 5"
                className="money"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
              />
            </Field>
            <Field label="Limite" htmlFor="acc-limit" optional>
              <Input
                id="acc-limit"
                inputMode="decimal"
                placeholder="0,00"
                className="money"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </Field>
          </div>
          <p className="text-muted-foreground -mt-1 text-xs">
            Compras feitas a partir do dia de fechamento entram na fatura seguinte.
          </p>
        </FormSection>
      )}

      {isCard && (
        <FormSection title="Importação">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Finais do cartão"
              htmlFor="acc-finals"
              optional
              hint="Inclua os finais de cartões virtuais e adicionais desta mesma fatura."
            >
              <Input
                id="acc-finals"
                className="money"
                placeholder="Ex.: 2400, 1234"
                value={finals}
                onChange={(e) => setFinals(e.target.value)}
              />
            </Field>
            <Field
              label="Importar a partir da fatura"
              htmlFor="acc-import-since"
              hint="Faturas anteriores são ignoradas; parcelas futuras de compras antigas continuam entrando."
            >
              <Input
                id="acc-import-since"
                type="month"
                value={importSince}
                onChange={(e) => setImportSince(e.target.value)}
              />
            </Field>
          </div>
        </FormSection>
      )}

      <Field label="Cor">
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
      </Field>

      {account && (
        <SwitchRow
          checked={archived}
          onChange={setArchived}
          label="Arquivar conta"
          description="Some da lista e do saldo total."
        />
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
      {confirmDelete && (
        <p className="text-muted-foreground text-xs">
          Excluir apaga também todas as transações desta conta. Se quiser só escondê-la, arquive.
        </p>
      )}

      <FormFooter
        left={
          account && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onDelete}
              className={cn('text-destructive hover:text-destructive', confirmDelete && 'bg-destructive/10')}
            >
              {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
            </Button>
          )
        }
      >
        <Button type="button" variant="outline" onClick={onDone} className="flex-1 sm:flex-none">
          Cancelar
        </Button>
        <Button type="submit" disabled={busy} className="flex-1 sm:flex-none">
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </FormFooter>
    </form>
  );
}
