import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Transaction } from '@/lib/transactions';
import type { Transfer } from '@/lib/transfers';
import { TransactionForm } from './TransactionForm';
import { TransferForm, type TransferDefaults } from './TransferForm';
import { Dialog } from './ui/dialog';

type Editing =
  | { kind: 'transaction'; transaction?: Transaction }
  | { kind: 'transfer'; transfer?: Transfer; defaults?: TransferDefaults }
  | null;

type Ctx = {
  openTransaction: (transaction?: Transaction) => void;
  openTransfer: (transfer?: Transfer, defaults?: TransferDefaults) => void;
  /** Uma tela pode assumir o atalho "N" (ex.: digitação rápida na tabela); null devolve ao diálogo */
  setNewTransactionHandler: (handler: (() => void) | null) => void;
};

const TransactionDialogContext = createContext<Ctx>({
  openTransaction: () => {},
  openTransfer: () => {},
  setNewTransactionHandler: () => {},
});

export const useTransactionDialog = () => useContext(TransactionDialogContext);

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

// Diálogos de transação e transferência para o app inteiro; "N" abre nova transação
export function TransactionDialogProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<Editing>(null);
  const handlerRef = useRef<(() => void) | null>(null);
  const setNewTransactionHandler = useCallback((h: (() => void) | null) => {
    handlerRef.current = h;
  }, []);
  const openTransaction = useCallback(
    (transaction?: Transaction) => setEditing({ kind: 'transaction', transaction }),
    [],
  );
  const openTransfer = useCallback(
    (transfer?: Transfer, defaults?: TransferDefaults) => setEditing({ kind: 'transfer', transfer, defaults }),
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      if (handlerRef.current) handlerRef.current();
      else setEditing({ kind: 'transaction' });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => setEditing(null);
  const title =
    editing?.kind === 'transfer'
      ? editing.transfer
        ? 'Editar transferência'
        : editing.defaults?.invoice
          ? 'Pagar fatura'
          : 'Nova transferência'
      : editing?.transaction
        ? 'Editar transação'
        : 'Nova transação';

  return (
    <TransactionDialogContext.Provider value={{ openTransaction, openTransfer, setNewTransactionHandler }}>
      {children}
      <Dialog open={editing !== null} onClose={close} title={title}>
        {editing?.kind === 'transaction' && <TransactionForm transaction={editing.transaction} onDone={close} />}
        {editing?.kind === 'transfer' && (
          <TransferForm transfer={editing.transfer} defaults={editing.defaults} onDone={close} />
        )}
      </Dialog>
    </TransactionDialogContext.Provider>
  );
}
