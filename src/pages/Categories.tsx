import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  groupCategories,
  useCategories,
  useCategoryUsage,
  DEFAULT_COLOR,
  type Category,
  type CategoryGroup,
} from '@/lib/categories';
import type { TransactionType } from '@/lib/transactions';
import { cn } from '@/lib/utils';
import { CategoryForm, type CategoryFormTarget } from '@/components/CategoryForm';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';

const titles: Record<TransactionType, string> = { expense: 'Despesas', income: 'Receitas' };

export function Categories() {
  const { data: categories, isLoading, error } = useCategories();
  const [target, setTarget] = useState<CategoryFormTarget | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = categories?.filter((c) => c.archived).length ?? 0;

  const dialogTitle = !target
    ? ''
    : target.mode === 'edit'
      ? target.category.parent_id
        ? 'Editar subcategoria'
        : 'Editar categoria'
      : target.parentId
        ? 'Nova subcategoria'
        : `Nova categoria de ${titles[target.type].toLowerCase()}`;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Categorias"
        actions={
          archivedCount > 0 && (
            <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-primary"
              />
              Mostrar arquivadas ({archivedCount})
            </label>
          )
        }
      />

      {error && <p className="text-destructive text-sm">Erro ao carregar categorias: {error.message}</p>}

      {isLoading ? (
        <div className="bg-muted/50 h-96 animate-pulse rounded-lg border" />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {(['expense', 'income'] as const).map((type) => (
            <CategoryTable
              key={type}
              type={type}
              groups={groupCategories(categories, type)}
              showArchived={showArchived}
              onNew={(parentId) => setTarget({ mode: 'new', type, parentId })}
              onEdit={(category) => setTarget({ mode: 'edit', category })}
            />
          ))}
        </div>
      )}

      <Dialog open={target !== null} onClose={() => setTarget(null)} title={dialogTitle}>
        {target && <CategoryForm target={target} onDone={() => setTarget(null)} />}
      </Dialog>
    </div>
  );
}

type TableProps = {
  type: TransactionType;
  groups: CategoryGroup[];
  showArchived: boolean;
  onNew: (parentId: string | null) => void;
  onEdit: (category: Category) => void;
};

function CategoryTable({ type, groups, showArchived, onNew, onEdit }: TableProps) {
  const { data: usage } = useCategoryUsage();
  const count = (id: string) => usage?.get(id) ?? 0;
  const visible = (c: Category) => showArchived || !c.archived;

  return (
    <section className="min-w-0 space-y-2">
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-sm font-medium">{titles[type]}</h2>
        <Button variant="ghost" size="sm" className="h-7" onClick={() => onNew(null)}>
          <Plus />
          Categoria
        </Button>
      </div>
      <Table>
        <THead>
          <tr>
            <Th>Nome</Th>
            <Th className="w-28 text-right">Transações</Th>
            <Th className="w-32" />
          </tr>
        </THead>
        <tbody>
          {groups.filter(visible).map((group) => {
            const color = group.color ?? DEFAULT_COLOR;
            const children = group.children.filter(visible);
            const total = group.children.reduce((s, c) => s + count(c.id), 0);
            return [
              <Tr
                key={group.id}
                onClick={() => onEdit(group)}
                className={cn('group bg-muted/20', group.archived && 'opacity-50')}
              >
                <Td className="w-full max-w-0 font-medium">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="truncate">{group.name}</span>
                    {group.archived && <span className="text-muted-foreground text-xs font-normal">arquivada</span>}
                  </span>
                </Td>
                <Td className="money text-muted-foreground text-right text-xs">{total || '—'}</Td>
                <Td className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNew(group.id);
                    }}
                  >
                    <Plus />
                    Subcategoria
                  </Button>
                </Td>
              </Tr>,
              ...children.map((sub) => (
                <Tr key={sub.id} onClick={() => onEdit(sub)} className={cn(sub.archived && 'opacity-50')}>
                  <Td className="w-full max-w-0 pl-8">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-1.5 shrink-0 rounded-full opacity-70"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{sub.name}</span>
                      {sub.archived && <span className="text-muted-foreground text-xs">arquivada</span>}
                    </span>
                  </Td>
                  <Td className="money text-muted-foreground text-right text-xs">{count(sub.id) || '—'}</Td>
                  <Td />
                </Tr>
              )),
              children.length === 0 && (
                <Tr key={`${group.id}-empty`}>
                  <Td colSpan={3} className="text-muted-foreground pl-8 text-xs">
                    Sem subcategorias — crie uma para poder usar esta categoria.
                  </Td>
                </Tr>
              ),
            ];
          })}
        </tbody>
      </Table>
    </section>
  );
}
