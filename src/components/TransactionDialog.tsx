import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Transaction } from '@/lib/transactions';
import { TransactionForm } from './TransactionForm';
import { Dialog } from './ui/dialog';

type Editing = { transaction?: Transaction } | null;
type Ctx = {
  openTransaction: (transaction?: Transaction) => void;
  /** Uma tela pode assumir o atalho "N" (ex.: digitação rápida na tabela); null devolve ao diálogo */
  setNewTransactionHandler: (handler: (() => void) | null) => void;
};

const TransactionDialogContext = createContext<Ctx>({
  openTransaction: () => {},
  setNewTransactionHandler: () => {},
});

export const useTransactionDialog = () => useContext(TransactionDialogContext);

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

// Um único diálogo de transação para o app inteiro, aberto também pela tecla "N"
export function TransactionDialogProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<Editing>(null);
  const handlerRef = useRef<(() => void) | null>(null);
  const setNewTransactionHandler = useCallback((h: (() => void) | null) => {
    handlerRef.current = h;
  }, []);
  const openTransaction = useCallback((transaction?: Transaction) => setEditing({ transaction }), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      if (handlerRef.current) handlerRef.current();
      else setEditing({});
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <TransactionDialogContext.Provider value={{ openTransaction, setNewTransactionHandler }}>
      {children}
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.transaction ? 'Editar transação' : 'Nova transação'}
      >
        {editing && <TransactionForm transaction={editing.transaction} onDone={() => setEditing(null)} />}
      </Dialog>
    </TransactionDialogContext.Provider>
  );
}
