import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAccounts } from '@/lib/accounts';
import { useCategories } from '@/lib/categories';
import { todayISO } from '@/lib/dates';
import {
  useDeleteTransaction,
  useSaveTransaction,
  type Transaction,
  type TransactionType,
} from '@/lib/transactions';
import { cn, parseMoney, toMoneyInput } from '@/lib/utils';
import { Button } from './ui/button';
import { Input, Label } from './ui/input';
import { Select } from './ui/select';

type Props = { transaction?: Transaction; onDone: () => void };

export function TransactionForm({ transaction, onDone }: Props) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const usableAccounts =
    accounts?.filter((a) => !a.archived || a.id === transaction?.account_id) ?? [];

  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense');
  const [amount, setAmount] = useState(transaction ? toMoneyInput(transaction.amount) : '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [date, setDate] = useState(transaction?.date ?? todayISO());
  const [accountId, setAccountId] = useState(transaction?.account_id ?? '');
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? '');
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useSaveTransaction();
  const remove = useDeleteTransaction();
  const busy = save.isPending || remove.isPending;

  // Conta padrão: a primeira ativa (quando as contas terminam de carregar)
  const selectedAccount = accountId || usableAccounts[0]?.id || '';
  const typeCategories =
    categories?.filter((c) => c.type === type && (!c.archived || c.id === categoryId)) ?? [];

  if (accounts && usableAccounts.length === 0) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Você precisa de pelo menos uma conta para lançar transações.
        </p>
        <Link
          to="/contas"
          onClick={onDone}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 font-medium"
        >
          Cadastrar conta
        </Link>
      </div>
    );
  }

  function changeType(next: TransactionType) {
    setType(next);
    // Categoria de receita não serve para despesa e vice-versa
    if (categories?.find((c) => c.id === categoryId)?.type !== next) setCategoryId('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = parseMoney(amount);
    if (value === null || value <= 0) return setError('Informe um valor maior que zero.');
    if (!selectedAccount) return setError('Escolha uma conta.');
    setError(null);
    try {
      await save.mutateAsync({
        id: transaction?.id,
        type,
        amount: value,
        description: description.trim() || null,
        date,
        account_id: selectedAccount,
        category_id: categoryId || null,
        notes: notes.trim() || null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  async function onDelete() {
    if (!transaction) return;
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await remove.mutateAsync(transaction.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1" role="radiogroup" aria-label="Tipo">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => changeType(t)}
            className={cn(
              'text-muted-foreground rounded-md py-1.5 text-sm font-medium transition-colors',
              type === t && 'bg-background shadow-xs',
              type === t && (t === 'expense' ? 'text-destructive' : 'text-success'),
            )}
          >
            {t === 'expense' ? 'Despesa' : 'Receita'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-amount">Valor</Label>
        <Input
          id="tx-amount"
          inputMode="decimal"
          placeholder="0,00"
          required
          autoFocus
          className={cn('money h-11 text-lg', type === 'expense' ? 'text-destructive' : 'text-success')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-desc">Descrição</Label>
        <Input
          id="tx-desc"
          maxLength={200}
          placeholder={type === 'expense' ? 'Ex.: Supermercado' : 'Ex.: Salário de outubro'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tx-category">Categoria</Label>
          <Select id="tx-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {typeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tx-date">Data</Label>
          <Input
            id="tx-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-account">Conta</Label>
        <Select id="tx-account" value={selectedAccount} onChange={(e) => setAccountId(e.target.value)}>
          {usableAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-notes">
          Observações <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <textarea
          id="tx-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border-input placeholder:text-muted-foreground dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
        {transaction && (
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
          <Button type="submit" disabled={busy || !accounts} className="flex-1 sm:flex-none">
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </form>
  );
}
