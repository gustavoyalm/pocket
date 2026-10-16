import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useAccounts } from '@/lib/accounts';
import { formatInvoice, invoiceFor, isCard } from '@/lib/cards';
import { useCategories } from '@/lib/categories';
import { currentMonth, formatDateInput, parseDateInput, todayISO } from '@/lib/dates';
import { normalizeTag, useCreateInstallments, useSaveTransaction } from '@/lib/transactions';
import { cn, formatMoney, parseMoney } from '@/lib/utils';
import { CategoryCombobox, type CategoryComboboxHandle } from './CategoryCombobox';

type Props = {
  /** Mês exibido ("YYYY-MM"): base para datas digitadas só com o dia */
  month: string;
  onClose: () => void;
};

type Field = 'date' | 'category' | 'account' | 'amount';

const cellInput =
  'h-8 w-full rounded-md border border-border bg-background/60 px-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:bg-background focus:ring-1 focus:ring-ring aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive';

/** Linha de digitação rápida no topo da tabela: Enter salva e abre a próxima, Esc fecha. */
export function TransactionInlineRow({ month, onClose }: Props) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const save = useSaveTransaction();
  const createInstallments = useCreateInstallments();

  const activeAccounts = accounts?.filter((a) => !a.archived) ?? [];
  const defaultDate = month === currentMonth() ? todayISO() : `${month}-01`;

  const [date, setDate] = useState(formatDateInput(defaultDate, month));
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState('');
  const [invalid, setInvalid] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);

  const descriptionRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<CategoryComboboxHandle>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => descriptionRef.current?.focus(), []);

  const account = accountId || activeAccounts[0]?.id || '';
  const type = categories?.find((c) => c.id === categoryId)?.type ?? 'expense';
  const card = activeAccounts.find((a) => a.id === account && isCard(a));
  const parsedDate = parseDateInput(date, month);
  const parts = card && type === 'expense' ? Math.max(1, Math.min(72, Number(installments) || 1)) : 1;
  const value = parseMoney(amount);
  // Dica de fatura: em qual fatura a compra (ou a 1ª parcela) vai cair
  const invoiceHint = card && parsedDate ? formatInvoice(invoiceFor(parsedDate, card)) : null;

  async function submit() {
    const problems: Field[] = [];
    if (!parsedDate) problems.push('date');
    if (!categoryId) problems.push('category');
    if (!account) problems.push('account');
    if (value === null || value <= 0) problems.push('amount');
    setInvalid(problems);
    // Leva o cursor ao primeiro campo com problema
    ({ date: dateRef, category: categoryRef, amount: amountRef, account: null })[problems[0] ?? 'account']?.current?.focus();
    if (problems.length) {
      setError(
        {
          date: 'Data inválida — use 15, 15/10 ou 15/10/2026.',
          category: 'Escolha uma subcategoria.',
          account: 'Cadastre uma conta antes.',
          amount: 'Informe um valor maior que zero.',
        }[problems[0]],
      );
      return;
    }
    setError(null);
    try {
      const tagList = tags.split(',').map(normalizeTag).filter(Boolean);
      if (parts > 1) {
        await createInstallments.mutateAsync({
          accountId: account,
          categoryId,
          amount: value!,
          installments: parts,
          date: parsedDate!,
          description: description.trim() || null,
          tags: tagList,
        });
      } else {
        await save.mutateAsync({
          date: parsedDate!,
          description: description.trim() || null,
          tags: tagList,
          category_id: categoryId,
          account_id: account,
          type,
          amount: value!,
        });
      }
      // Pronto para a próxima: mantém data e conta
      setDescription('');
      setTags('');
      setCategoryId('');
      setAmount('');
      setInstallments('');
      descriptionRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  const isInvalid = (f: Field) => invalid.includes(f);

  return (
    <>
      <tr onKeyDown={onKeyDown} className="bg-accent/40 border-b">
        <td className="px-2 py-1.5">
          <input
            ref={dateRef}
            aria-label="Data"
            aria-invalid={isInvalid('date')}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => {
              const parsed = parseDateInput(date, month);
              if (parsed) setDate(formatDateInput(parsed, month));
            }}
            className={cn(cellInput, 'money text-xs')}
          />
        </td>
        <td className="px-2 py-1.5">
          <div className="flex gap-2">
            <input
              ref={descriptionRef}
              aria-label="Descrição"
              placeholder="Descrição"
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(cellInput, 'min-w-40 flex-1')}
            />
            <input
              aria-label="Tags"
              placeholder="tags, separadas, por vírgula"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={cn(cellInput, 'w-32 shrink-0 text-xs xl:w-44')}
            />
          </div>
        </td>
        <td className="hidden px-2 py-1.5 md:table-cell">
          <CategoryCombobox
            ref={categoryRef}
            value={categoryId}
            onChange={setCategoryId}
            aria-invalid={isInvalid('category')}
            className={cellInput}
          />
        </td>
        <td className="hidden px-2 py-1.5 md:table-cell">
          <select
            aria-label="Conta"
            aria-invalid={isInvalid('account')}
            value={account}
            title={activeAccounts.find((a) => a.id === account)?.name}
            onChange={(e) => setAccountId(e.target.value)}
            className={cn(cellInput, '[&_option]:bg-card text-muted-foreground')}
          >
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-2">
          {card && type === 'expense' && (
            <label className="text-muted-foreground flex shrink-0 items-center gap-0.5 text-xs" title="Parcelas">
              <input
                aria-label="Parcelas"
                inputMode="numeric"
                placeholder="1"
                value={installments}
                onChange={(e) => setInstallments(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className={cn(cellInput, 'money w-9 px-1 text-center text-xs')}
              />
              x
            </label>
          )}
          <input
            ref={amountRef}
            aria-label="Valor"
            aria-invalid={isInvalid('amount')}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={cn(
              cellInput,
              'money text-right font-medium',
              type === 'income' ? 'text-success' : 'text-destructive',
            )}
          />
          </div>
        </td>
      </tr>
      <tr className="border-b">
        <td colSpan={5} className="text-muted-foreground px-3 py-1 text-[11px]">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : save.isPending || createInstallments.isPending ? (
            'Salvando…'
          ) : (
            <>
              {invoiceHint && (
                <span className="text-foreground mr-2">
                  {parts > 1 && value ? (
                    <>
                      {parts}x de <span className="money">{formatMoney(Math.floor((value / parts) * 100) / 100)}</span> a
                      partir da fatura {invoiceHint}
                    </>
                  ) : (
                    <>fatura {invoiceHint}</>
                  )}{' '}
                  ·
                </span>
              )}
              <Kbd>Enter</Kbd> salva e abre a próxima · <Kbd>Tab</Kbd> próximo campo · <Kbd>Esc</Kbd> cancela
              · a categoria define se é despesa ou receita
            </>
          )}
        </td>
      </tr>
    </>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="bg-muted rounded border px-1 font-mono text-[10px]">{children}</kbd>;
}
