import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAccounts } from '@/lib/accounts';
import { formatInvoice, invoiceFor, isCard } from '@/lib/cards';
import { groupCategories, useCategories } from '@/lib/categories';
import { shiftMonth, todayISO } from '@/lib/dates';
import {
  useCreateInstallments,
  useDeleteTransaction,
  useSaveTransaction,
  useTags,
  type Transaction,
  type TransactionType,
} from '@/lib/transactions';
import { cn, formatMoney, parseMoney, toMoneyInput } from '@/lib/utils';
import { Button } from './ui/button';
import { Input, Label } from './ui/input';
import { Select } from './ui/select';
import { TagInput } from './ui/tag-input';

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
  const [tags, setTags] = useState<string[]>(transaction?.tags ?? []);
  // Fatura escolhida manualmente ("YYYY-MM"); vazio = automática pela data
  const [invoice, setInvoice] = useState(() => {
    const saved = transaction?.invoice_month?.slice(0, 7);
    const account = accounts?.find((a) => a.id === transaction?.account_id);
    return saved && account && saved !== invoiceFor(transaction!.date, account) ? saved : '';
  });
  const [installments, setInstallments] = useState('1');
  const { data: tagSuggestions } = useTags();
  const [confirmDelete, setConfirmDelete] = useState<false | 'one' | 'all'>(false);
  const [error, setError] = useState<string | null>(null);

  const save = useSaveTransaction();
  const createInstallments = useCreateInstallments();
  const remove = useDeleteTransaction();
  const busy = save.isPending || remove.isPending || createInstallments.isPending;

  // Conta padrão: a primeira ativa (quando as contas terminam de carregar)
  const selectedAccount = accountId || usableAccounts[0]?.id || '';
  const account = usableAccounts.find((a) => a.id === selectedAccount);
  const card = isCard(account) ? account : undefined;
  const autoInvoice = card && date ? invoiceFor(date, card) : null;
  const invoiceOptions = autoInvoice ? [-2, -1, 0, 1, 2, 3].map((d) => shiftMonth(autoInvoice, d)) : [];

  const isInstallment = !!transaction?.installment_group;
  const canSplit = !transaction && !!card && type === 'expense';
  const parts = canSplit ? Math.max(1, Math.min(72, Number(installments) || 1)) : 1;
  const value = parseMoney(amount);

  // Só subcategorias podem ser escolhidas; arquivadas somem (exceto a já usada na transação)
  const categoryGroups = groupCategories(categories, type)
    .map((g) => ({
      ...g,
      children: g.children.filter((c) => (!c.archived && !g.archived) || c.id === categoryId),
    }))
    .filter((g) => g.children.length > 0);

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
    if (value === null || value <= 0) return setError('Informe um valor maior que zero.');
    if (!selectedAccount) return setError('Escolha uma conta.');
    if (!categoryId) return setError('Escolha uma subcategoria.');
    setError(null);
    try {
      if (parts > 1) {
        await createInstallments.mutateAsync({
          accountId: selectedAccount,
          categoryId,
          amount: value,
          installments: parts,
          date,
          description: description.trim() || null,
          tags,
          notes: notes.trim() || null,
          firstInvoice: invoice || null,
        });
      } else {
        await save.mutateAsync({
          id: transaction?.id,
          type,
          amount: value,
          description: description.trim() || null,
          date,
          account_id: selectedAccount,
          category_id: categoryId,
          notes: notes.trim() || null,
          tags,
          // null = o banco calcula a fatura pela data (ou ignora, se não for cartão)
          invoice_month: card && invoice ? `${invoice}-01` : null,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  async function onDelete(scope: 'one' | 'all') {
    if (!transaction) return;
    if (confirmDelete !== scope) return setConfirmDelete(scope);
    try {
      await remove.mutateAsync({
        id: transaction.id,
        group: scope === 'all' ? transaction.installment_group : null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!isInstallment && (
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
              {t === 'expense' ? 'Despesa' : t === 'income' && card ? 'Estorno / crédito' : 'Receita'}
            </button>
          ))}
        </div>
      )}

      {isInstallment && (
        <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-xs">
          Parcela <strong className="text-foreground">{transaction.installment_number}/{transaction.installment_total}</strong>{' '}
          de uma compra parcelada. As alterações valem só para esta parcela.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="tx-amount">{parts > 1 ? 'Valor total da compra' : 'Valor'}</Label>
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
        {canSplit && (
          <div className="space-y-2">
            <Label htmlFor="tx-parts">Parcelas</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="tx-parts"
                inputMode="numeric"
                className="money h-11 w-16 text-center"
                value={installments}
                onChange={(e) => setInstallments(e.target.value.replace(/\D/g, '').slice(0, 2))}
                onBlur={() => setInstallments(String(parts))}
              />
              <span className="text-muted-foreground text-sm">x</span>
            </div>
          </div>
        )}
      </div>
      {parts > 1 && value !== null && value > 0 && (
        <p className="text-muted-foreground -mt-2 text-xs">
          {parts}x de <span className="money">{formatMoney(Math.floor((value / parts) * 100) / 100)}</span>, uma
          por mês, a partir da fatura de {formatInvoice(invoice || autoInvoice!)}.
        </p>
      )}

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
          <Select
            id="tx-category"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={cn(!categoryId && 'text-muted-foreground')}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {categoryGroups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {g.children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tx-date">{card ? 'Data da compra' : 'Data'}</Label>
          <Input
            id="tx-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className={cn('grid gap-4', card && 'sm:grid-cols-2')}>
        <div className="space-y-2">
          <Label htmlFor="tx-account">Conta</Label>
          <Select
            id="tx-account"
            value={selectedAccount}
            disabled={isInstallment}
            onChange={(e) => {
              setAccountId(e.target.value);
              setInvoice('');
            }}
          >
            {usableAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        {card && autoInvoice && (
          <div className="space-y-2">
            <Label htmlFor="tx-invoice">{parts > 1 ? '1ª fatura' : 'Fatura'}</Label>
            <Select id="tx-invoice" value={invoice} onChange={(e) => setInvoice(e.target.value)}>
              <option value="">Automática ({formatInvoice(autoInvoice)})</option>
              {invoiceOptions
                .filter((m) => m !== autoInvoice)
                .map((m) => (
                  <option key={m} value={m}>
                    {formatInvoice(m)}
                  </option>
                ))}
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-tags">
          Tags <span className="text-muted-foreground font-normal">(separe por vírgula)</span>
        </Label>
        <TagInput
          id="tx-tags"
          value={tags}
          onChange={setTags}
          suggestions={tagSuggestions}
          placeholder="Ex.: viagem, reembolsável"
        />
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
          <div className="flex flex-col gap-1 sm:flex-row">
            <DeleteButton
              armed={confirmDelete === 'one'}
              disabled={busy}
              onClick={() => onDelete('one')}
              label={isInstallment ? 'Excluir parcela' : 'Excluir'}
            />
            {isInstallment && (
              <DeleteButton
                armed={confirmDelete === 'all'}
                disabled={busy}
                onClick={() => onDelete('all')}
                label={`Excluir as ${transaction.installment_total}`}
              />
            )}
          </div>
        )}
        <div className="flex gap-2 sm:ml-auto">
          <Button type="button" variant="outline" onClick={onDone} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || !accounts} className="flex-1 sm:flex-none">
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function DeleteButton(props: { armed: boolean; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn('text-destructive hover:text-destructive', props.armed && 'bg-destructive/10')}
    >
      {props.armed ? 'Confirmar' : props.label}
    </Button>
  );
}
