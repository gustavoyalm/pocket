import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Transaction } from '@/lib/transactions';
import { TransactionForm } from './TransactionForm';
import { Dialog } from './ui/dialog';

type Editing = { transaction?: Transaction } | null;
type Ctx = { openTransaction: (transaction?: Transaction) => void };

const TransactionDialogContext = createContext<Ctx>({ openTransaction: () => {} });

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      setEditing({});
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <TransactionDialogContext.Provider value={{ openTransaction: (transaction) => setEditing({ transaction }) }}>
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
