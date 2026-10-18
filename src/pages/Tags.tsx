import { useState, type FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { DEFAULT_TAG_COLOR, tagColors, useDeleteTag, useSaveTag, useTags, type Tag } from '@/lib/tags';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormFooter } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Table, Td, Th, THead, Tr } from '@/components/ui/table';

type Editing = { tag?: Tag } | null;

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export function Tags() {
  const { data: tags, isLoading, error } = useTags();
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Tags"
        actions={
          <Button size="sm" onClick={() => setEditing({})}>
            <Plus />
            Nova tag
          </Button>
        }
      >
        <span className="text-muted-foreground text-xs">
          Criadas automaticamente ao digitar nas transações · clique para mudar nome ou cor
        </span>
      </PageHeader>

      {error && <p className="text-destructive text-sm">Erro ao carregar tags: {error.message}</p>}

      {isLoading ? (
        <div className="bg-muted/50 h-40 animate-pulse rounded-lg border" />
      ) : !tags?.length ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
          Nenhuma tag ainda. Digite tags ao lançar uma transação, ou crie uma aqui.
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Tag</Th>
              <Th className="w-32 min-w-32 text-right">Transações</Th>
              <Th className="hidden w-32 min-w-32 text-right sm:table-cell">Criada em</Th>
            </tr>
          </THead>
          <tbody>
            {tags.map((tag) => (
              <Tr key={tag.id} onClick={() => setEditing({ tag })}>
                <Td className="w-full max-w-0">
                  <TagChip tag={tag} />
                </Td>
                <Td className="money text-muted-foreground text-right text-xs">{tag.uses || '—'}</Td>
                <Td className="money text-muted-foreground hidden text-right text-xs sm:table-cell">
                  {dateFmt.format(new Date(tag.created_at))}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.tag ? 'Editar tag' : 'Nova tag'}
      >
        {editing && <TagForm tag={editing.tag} onDone={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

function TagChip({ tag }: { tag: Pick<Tag, 'name' | 'color'> }) {
  const color = tag.color ?? DEFAULT_TAG_COLOR;
  return (
    <span
      className="inline-block max-w-full truncate rounded px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {tag.name || 'tag'}
    </span>
  );
}

function TagForm({ tag, onDone }: { tag?: Tag; onDone: () => void }) {
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? tagColors[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveTag();
  const remove = useDeleteTag();
  const busy = save.isPending || remove.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ id: tag?.id, name, color });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  async function onDelete() {
    if (!tag) return;
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await remove.mutateAsync(tag.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Nome" htmlFor="tag-name">
        <Input
          id="tag-name"
          required
          maxLength={40}
          autoFocus
          placeholder="Ex.: Viagem Japão"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label="Cor">
        <div className="flex flex-wrap gap-2">
          {tagColors.map((c) => (
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

      <Field label="Prévia">
        <div>
          <TagChip tag={{ name: name.trim(), color }} />
        </div>
      </Field>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {confirmDelete && tag && tag.uses > 0 && (
        <p className="text-muted-foreground text-xs">
          A tag será removida de {tag.uses} {tag.uses === 1 ? 'transação' : 'transações'} (as transações continuam
          existindo).
        </p>
      )}

      <FormFooter
        left={
          tag && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
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
