import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAccounts } from '@/lib/accounts';
import { formatInvoice, invoiceFor, isCard } from '@/lib/cards';
import { groupCategories, useCategories } from '@/lib/categories';
import { shiftMonth, todayISO } from '@/lib/dates';
import {
  useCreateInstallments,
  useInstallments,
  useDeleteTransaction,
  useSaveTransaction,
  type Transaction,
  type TransactionType,
} from '@/lib/transactions';
import { useTagLookup, useTags } from '@/lib/tags';
import { cn, formatMoney, parseMoney, toMoneyInput } from '@/lib/utils';
import { Button } from './ui/button';
import { Field, FormFooter, FormSection, Segmented, SwitchRow, textareaClass } from './ui/form';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { TagInput } from './ui/tag-input';
import { useTransactionDialog } from './TransactionDialog';

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
  const tagLookup = useTagLookup();
  const [tags, setTags] = useState<string[]>(
    () => transaction?.tagIds.map((id) => tagLookup.get(id)?.name).filter((n): n is string => !!n) ?? [],
  );
  // Fatura escolhida manualmente ("YYYY-MM"); vazio = automática pela data
  const [invoice, setInvoice] = useState(() => {
    const saved = transaction?.invoice_month?.slice(0, 7);
    const account = accounts?.find((a) => a.id === transaction?.account_id);
    return saved && account && saved !== invoiceFor(transaction!.date, account) ? saved : '';
  });
  const [installments, setInstallments] = useState('1');
  // null = segue o padrão da conta (cartão: pago; demais: pendente)
  const [paidChoice, setPaidChoice] = useState<boolean | null>(transaction ? transaction.paid : null);
  const { data: allTags } = useTags();
  const tagSuggestions = allTags?.map((t) => t.name);
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
  const paid = paidChoice ?? !!card;
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
          paid,
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

  const typeOptions = [
    { value: 'expense' as const, label: 'Despesa', activeClass: 'text-destructive' },
    { value: 'income' as const, label: card ? 'Estorno / crédito' : 'Receita', activeClass: 'text-success' },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {isInstallment ? (
        <p className="text-muted-foreground text-xs">
          Parcela{' '}
          <strong className="money text-foreground">
            {transaction.installment_number}/{transaction.installment_total}
          </strong>{' '}
          de uma compra parcelada. As alterações valem só para esta parcela.
        </p>
      ) : (
        <Segmented label="Tipo" value={type} onChange={changeType} options={typeOptions} />
      )}

      <div className={cn('grid gap-4', canSplit ? 'sm:grid-cols-[1fr_11rem_6rem]' : 'sm:grid-cols-[1fr_11rem]')}>
        <Field label={parts > 1 ? 'Valor total da compra' : 'Valor'} htmlFor="tx-amount">
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
              R$
            </span>
            <Input
              id="tx-amount"
              inputMode="decimal"
              placeholder="0,00"
              required
              autoFocus
              className={cn(
                'money h-11 pl-10 text-lg font-semibold',
                type === 'expense' ? 'text-destructive' : 'text-success',
              )}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </Field>
        <Field label={card ? 'Data da compra' : 'Data'} htmlFor="tx-date">
          <Input id="tx-date" type="date" required className="h-11" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {canSplit && (
          <Field label="Parcelas" htmlFor="tx-parts">
            <Input
              id="tx-parts"
              inputMode="numeric"
              className="money h-11 text-center"
              value={installments}
              onChange={(e) => setInstallments(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={() => setInstallments(String(parts))}
            />
          </Field>
        )}
      </div>
      {parts > 1 && value !== null && value > 0 && (
        <p className="text-muted-foreground -mt-2 text-xs">
          {parts}x de <span className="money text-foreground">{formatMoney(Math.floor((value / parts) * 100) / 100)}</span>,
          uma por mês, a partir da fatura de {formatInvoice(invoice || autoInvoice!)}.
        </p>
      )}

      <Field label="Descrição" htmlFor="tx-desc">
        <Input
          id="tx-desc"
          maxLength={200}
          placeholder={type === 'expense' ? 'Ex.: Supermercado' : 'Ex.: Salário de outubro'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria" htmlFor="tx-category">
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
        </Field>
        <Field label="Conta" htmlFor="tx-account">
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
        </Field>
        {card && autoInvoice && (
          <Field label={parts > 1 ? '1ª fatura' : 'Fatura'} htmlFor="tx-invoice">
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
          </Field>
        )}
        <Field label="Tags" htmlFor="tx-tags" className={cn(!(card && autoInvoice) && 'sm:col-span-2')}>
          <TagInput
            id="tx-tags"
            value={tags}
            onChange={setTags}
            suggestions={tagSuggestions}
            placeholder="Ex.: viagem, reembolsável"
          />
        </Field>
      </div>

      <Field label="Observações" htmlFor="tx-notes" optional>
        <textarea
          id="tx-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={textareaClass}
        />
      </Field>

      {parts === 1 && (
        <SwitchRow
          checked={paid}
          onChange={setPaidChoice}
          tone="success"
          label={type === 'income' ? 'Recebido' : 'Pago'}
          description={paid ? 'Entra no saldo atual.' : 'Pendente: só entra no saldo previsto.'}
        />
      )}

      {isInstallment && <InstallmentList transaction={transaction} />}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <FormFooter
        left={
          transaction && (
            <>
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
            </>
          )
        }
      >
        <Button type="button" variant="outline" onClick={onDone} className="flex-1 sm:flex-none">
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || !accounts} className="flex-1 sm:flex-none">
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      </FormFooter>
    </form>
  );
}

/** Todas as parcelas da compra; a atual em destaque e as outras abrem ao clicar. */
function InstallmentList({ transaction }: { transaction: Transaction }) {
  const { data, isLoading } = useInstallments(transaction.installment_group);
  const { openTransaction } = useTransactionDialog();
  const total = data?.reduce((s, t) => s + t.amount, 0) ?? 0;
  const paidCount = data?.filter((t) => t.paid).length ?? 0;
  const missing = (transaction.installment_total ?? 0) - (data?.length ?? 0);

  return (
    <FormSection title="Parcelas da compra">
      {isLoading || !data ? (
        <p className="text-muted-foreground text-xs">Carregando parcelas…</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="w-16 px-3 py-1.5 text-left font-medium">Nº</th>
                <th className="px-3 py-1.5 text-left font-medium">Fatura</th>
                <th className="px-3 py-1.5 text-left font-medium">Data</th>
                <th className="px-3 py-1.5 text-left font-medium">Status</th>
                <th className="px-3 py-1.5 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => {
                const current = t.id === transaction.id;
                return (
                  <tr
                    key={t.id}
                    onClick={current ? undefined : () => openTransaction(t)}
                    title={current ? 'Parcela aberta' : 'Abrir esta parcela'}
                    className={cn('border-t', current ? 'bg-primary/10 font-medium' : 'hover:bg-muted/40 cursor-pointer')}
                  >
                    <td className="money px-3 py-1.5">
                      {t.installment_number}/{t.installment_total}
                    </td>
                    <td className="px-3 py-1.5">{t.invoice_month ? formatInvoice(t.invoice_month.slice(0, 7)) : '—'}</td>
                    <td className="money text-muted-foreground px-3 py-1.5">{formatDateBR(t.date)}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-xs',
                          t.paid ? 'text-success' : 'text-muted-foreground',
                        )}
                      >
                        <span className={cn('size-1.5 rounded-full', t.paid ? 'bg-success' : 'bg-muted-foreground/50')} />
                        {t.paid ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="money px-3 py-1.5 text-right">{formatMoney(t.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/40 text-xs">
              <tr className="border-t">
                <td colSpan={3} className="text-muted-foreground px-3 py-1.5">
                  {paidCount} de {data.length} pagas{missing > 0 && ` · ${missing} excluídas`}
                </td>
                <td className="text-muted-foreground px-3 py-1.5 text-right">Total</td>
                <td className="money px-3 py-1.5 text-right font-semibold">{formatMoney(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </FormSection>
  );
}

const formatDateBR = (iso: string) => iso.split('-').reverse().join('/');

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
