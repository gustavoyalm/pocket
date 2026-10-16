import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAccounts } from '@/lib/accounts';
import { formatInvoice, invoiceFor, isCard } from '@/lib/cards';
import { shiftMonth, todayISO } from '@/lib/dates';
import { useDeleteTransfer, useSaveTransfer, type Transfer } from '@/lib/transfers';
import { cn, parseMoney, toMoneyInput } from '@/lib/utils';
import { Button } from './ui/button';
import { Input, Label } from './ui/input';
import { Select } from './ui/select';

export type TransferDefaults = {
  toAccountId?: string;
  invoice?: string; // "YYYY-MM"
  amount?: number;
  description?: string;
};

type Props = { transfer?: Transfer; defaults?: TransferDefaults; onDone: () => void };

export function TransferForm({ transfer, defaults, onDone }: Props) {
  const { data: accounts } = useAccounts();
  const usable = accounts?.filter((a) => !a.archived || a.id === transfer?.from_account_id || a.id === transfer?.to_account_id) ?? [];

  const [fromId, setFromId] = useState(transfer?.from_account_id ?? '');
  const [toId, setToId] = useState(transfer?.to_account_id ?? defaults?.toAccountId ?? '');
  const [amount, setAmount] = useState(
    transfer ? toMoneyInput(transfer.amount) : defaults?.amount ? toMoneyInput(defaults.amount) : '',
  );
  const [date, setDate] = useState(transfer?.date ?? todayISO());
  const [description, setDescription] = useState(transfer?.description ?? defaults?.description ?? '');
  const [invoice, setInvoice] = useState(transfer?.invoice_month?.slice(0, 7) ?? defaults?.invoice ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useSaveTransfer();
  const remove = useDeleteTransfer();
  const busy = save.isPending || remove.isPending;

  // Origem padrão: primeira conta que não é cartão (de onde normalmente sai o dinheiro)
  const from = fromId || usable.find((a) => !isCard(a) && a.id !== toId)?.id || '';
  const to = toId || usable.find((a) => a.id !== from)?.id || '';
  const toAccount = usable.find((a) => a.id === to);
  const card = isCard(toAccount) ? toAccount : undefined;
  // Fatura sugerida para um pagamento: a que fechou mais recentemente
  const suggested = card ? shiftMonth(invoiceFor(date, card), -1) : '';
  const invoiceOptions = suggested ? [-1, 0, 1, 2].map((d) => shiftMonth(suggested, d)) : [];
  if (invoice && !invoiceOptions.includes(invoice)) invoiceOptions.push(invoice);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = parseMoney(amount);
    if (value === null || value <= 0) return setError('Informe um valor maior que zero.');
    if (!from || !to) return setError('Escolha as duas contas.');
    if (from === to) return setError('Origem e destino precisam ser contas diferentes.');
    setError(null);
    try {
      await save.mutateAsync({
        id: transfer?.id,
        from_account_id: from,
        to_account_id: to,
        amount: value,
        date,
        description: description.trim() || null,
        invoice_month: card ? `${invoice || suggested}-01` : null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  async function onDelete() {
    if (!transfer) return;
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await remove.mutateAsync(transfer.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-2">
          <Label htmlFor="tr-from">De</Label>
          <Select id="tr-from" value={from} onChange={(e) => setFromId(e.target.value)}>
            {usable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <ArrowRight className="text-muted-foreground mx-auto mb-2.5 hidden size-4 sm:block" />
        <div className="space-y-2">
          <Label htmlFor="tr-to">Para</Label>
          <Select
            id="tr-to"
            value={to}
            onChange={(e) => {
              setToId(e.target.value);
              setInvoice('');
            }}
          >
            {usable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className={cn('grid gap-4', card ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        <div className="space-y-2">
          <Label htmlFor="tr-amount">Valor</Label>
          <Input
            id="tr-amount"
            inputMode="decimal"
            placeholder="0,00"
            required
            autoFocus
            className="money"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tr-date">Data</Label>
          <Input id="tr-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {card && (
          <div className="space-y-2">
            <Label htmlFor="tr-invoice">Paga a fatura</Label>
            <Select id="tr-invoice" value={invoice || suggested} onChange={(e) => setInvoice(e.target.value)}>
              {invoiceOptions.sort().map((m) => (
                <option key={m} value={m}>
                  {formatInvoice(m)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tr-desc">
          Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Input
          id="tr-desc"
          maxLength={200}
          placeholder={card ? 'Pagamento da fatura' : 'Ex.: Reserva de emergência'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Transferências não contam como receita nem despesa: só movem dinheiro entre suas contas.
      </p>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
        {transfer && (
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
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </form>
  );
}
