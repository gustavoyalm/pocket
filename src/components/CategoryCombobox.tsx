import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { groupCategories, useCategories, type Category } from '@/lib/categories';
import type { TransactionType } from '@/lib/transactions';
import { cn } from '@/lib/utils';

type Option = { sub: Category; parent: Category; label: string; search: string };

type Props = {
  value: string;
  onChange: (categoryId: string) => void;
  className?: string;
  'aria-invalid'?: boolean;
  /** Só oferece subcategorias desse tipo (sem isso: despesas e receitas) */
  type?: TransactionType;
  placeholder?: string;
};

export type CategoryComboboxHandle = { focus: () => void };

// Ignora acentos e maiúsculas na busca ("saude" encontra "Saúde")
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca de subcategoria por texto ("merc" → Mercado › Supermercado), de despesa e de receita. */
export const CategoryCombobox = forwardRef<CategoryComboboxHandle, Props>(function CategoryCombobox(
  { value, onChange, className, type, placeholder = 'Categoria', ...aria },
  ref,
) {
  const { data: categories } = useCategories();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<string | null>(null); // null = mostrando o valor escolhido
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const options = useMemo<Option[]>(
    () =>
      (type ? [type] : (['expense', 'income'] as const)).flatMap((t) =>
        groupCategories(categories, t)
          .filter((p) => !p.archived)
          .flatMap((parent) =>
            parent.children
              .filter((c) => !c.archived)
              .map((sub) => ({
                sub,
                parent,
                label: `${parent.name} › ${sub.name}`,
                search: fold(`${parent.name} ${sub.name}`),
              })),
          ),
      ),
    [categories, type],
  );

  const selected = options.find((o) => o.sub.id === value);
  const terms = fold(query ?? '').split(/\s+/).filter(Boolean);
  // Todas as palavras precisam aparecer ("ali del" → Alimentação › Delivery)
  const matches = query === null ? [] : options.filter((o) => terms.every((t) => o.search.includes(t)));
  const open = query !== null && matches.length > 0;

  function pick(option: Option | undefined) {
    if (option) onChange(option.sub.id);
    setQuery(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => (h + delta + matches.length) % matches.length);
    } else if (e.key === 'Enter' || (e.key === 'Tab' && query)) {
      // Enter/Tab aceitam a sugestão destacada (o Enter não salva a linha nesse momento)
      if (e.key === 'Enter') e.preventDefault();
      e.stopPropagation();
      pick(matches[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setQuery(null);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={query ?? selected?.label ?? ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setRect(inputRef.current?.getBoundingClientRect() ?? null);
        }}
        onFocus={(e) => {
          e.target.select();
          setRect(e.target.getBoundingClientRect());
        }}
        onBlur={() => setQuery(null)}
        onKeyDown={onKeyDown}
        className={cn(selected?.sub.type === 'income' && query === null && 'text-success', className)}
        {...aria}
      />
      {open &&
        rect &&
        createPortal(
          <ul
            role="listbox"
            style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: rect.width }}
            className="bg-card z-50 max-h-64 overflow-y-auto rounded-md border py-1 text-sm shadow-lg"
          >
            {matches.map((o, i) => (
              <li
                key={o.sub.id}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-1 whitespace-nowrap',
                  i === highlight && 'bg-accent',
                )}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: o.parent.color ?? '#71717a' }} />
                <span className="text-muted-foreground">{o.parent.name} ›</span>
                <span>{o.sub.name}</span>
                {o.sub.type === 'income' && <span className="text-success ml-auto pl-3 text-xs">receita</span>}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
});
