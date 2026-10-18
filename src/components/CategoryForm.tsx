import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import {
  categoryColors,
  groupCategories,
  useCategories,
  useCategoryUsage,
  useDeleteCategory,
  useSaveCategory,
  type Category,
} from '@/lib/categories';
import type { TransactionType } from '@/lib/transactions';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Field, FormFooter, SwitchRow } from './ui/form';
import { Input } from './ui/input';
import { Select } from './ui/select';

export type CategoryFormTarget =
  | { mode: 'edit'; category: Category }
  | { mode: 'new'; type: TransactionType; parentId: string | null };

type Props = { target: CategoryFormTarget; onDone: () => void };

export function CategoryForm({ target, onDone }: Props) {
  const editing = target.mode === 'edit' ? target.category : undefined;
  const type = editing?.type ?? (target.mode === 'new' ? target.type : 'expense');
  const initialParent = editing ? editing.parent_id : target.mode === 'new' ? target.parentId : null;
  const isSub = initialParent !== null;

  const { data: categories } = useCategories();
  const { data: usage } = useCategoryUsage();
  const parents = groupCategories(categories, type).filter((p) => !p.archived || p.id === initialParent);

  const [name, setName] = useState(editing?.name ?? '');
  const [parentId, setParentId] = useState(initialParent ?? '');
  const [color, setColor] = useState(editing?.color ?? categoryColors[0]);
  const [archived, setArchived] = useState(editing?.archived ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const busy = save.isPending || remove.isPending;

  const childCount = editing ? (categories?.filter((c) => c.parent_id === editing.id).length ?? 0) : 0;
  const inUse = editing
    ? [editing.id, ...(categories?.filter((c) => c.parent_id === editing.id).map((c) => c.id) ?? [])].reduce(
        (sum, id) => sum + (usage?.get(id) ?? 0),
        0,
      )
    : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: editing?.id,
        name: name.trim(),
        type,
        parent_id: isSub ? parentId : null,
        // Subcategoria usa a cor da categoria-pai
        color: isSub ? null : color,
        archived,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await remove.mutateAsync(editing.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
      setConfirmDelete(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Nome" htmlFor="cat-name">
        <Input
          id="cat-name"
          required
          maxLength={60}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isSub ? 'Ex.: Supermercado' : 'Ex.: Mercado'}
        />
      </Field>

      {isSub ? (
        <Field label="Categoria" htmlFor="cat-parent">
          <Select id="cat-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label="Cor">
          <div className="flex flex-wrap gap-2">
            {categoryColors.map((c) => (
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
      )}

      {editing && (
        <SwitchRow
          checked={archived}
          onChange={setArchived}
          label="Arquivar"
          description="Não aparece mais ao lançar transações."
        />
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
      {editing && inUse > 0 && (
        <p className="text-muted-foreground text-xs">
          {inUse} {inUse === 1 ? 'transação usa' : 'transações usam'} esta categoria, por isso ela não pode ser
          excluída. Arquive para escondê-la.
        </p>
      )}
      {confirmDelete && childCount > 0 && (
        <p className="text-muted-foreground text-xs">As {childCount} subcategorias também serão excluídas.</p>
      )}

      <FormFooter
        left={
          editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || inUse > 0}
              title={inUse > 0 ? 'Em uso por transações — arquive em vez de excluir' : undefined}
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
