import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { normalizeTag } from '@/lib/tags';
import { cn } from '@/lib/utils';

type Props = {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
};

/** Campo de tags: vírgula ou Enter fecha a tag; Backspace no campo vazio apaga a última. */
export function TagInput({ id, value, onChange, suggestions = [], placeholder }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const query = normalizeTag(text).toLowerCase();
  const chosen = new Set(value.map((v) => v.toLowerCase()));
  const matches = query
    ? suggestions.filter((s) => !chosen.has(s.toLowerCase()) && s.toLowerCase().includes(query)).slice(0, 6)
    : [];
  const showList = open && matches.length > 0;

  function add(raw: string) {
    // Aceita várias de uma vez ("a, b, c" colado)
    const next = [...value];
    for (const part of raw.split(',')) {
      const typed = normalizeTag(part);
      // Se já existe uma tag com esse nome (ignorando maiúsculas), usa a grafia dela
      const tag = suggestions.find((s) => s.toLowerCase() === typed.toLowerCase()) ?? typed;
      if (tag && tag.length <= 40 && !next.some((t) => t.toLowerCase() === tag.toLowerCase())) next.push(tag);
    }
    onChange(next.slice(0, 20));
    setText('');
    setHighlight(0);
  }

  // Vírgula é tratada no onChange (cria a tag exatamente como digitada)
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && text.trim()) {
      // Enter escolhe a sugestão destacada; sem sugestões, cria a tag digitada.
      // Com o campo vazio, o Enter segue para o formulário (salvar).
      e.preventDefault();
      add(showList ? matches[highlight] : text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'ArrowDown' && showList) {
      e.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault(); // fecha só a lista, não o diálogo
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'border-input dark:bg-input/30 flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border bg-transparent px-2 py-1 text-sm shadow-xs',
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        )}
      >
        {value.map((tag) => (
          <span key={tag} className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
            {tag}
            <button
              type="button"
              aria-label={`Remover ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((t) => t !== tag));
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={text}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          autoComplete="off"
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',')) add(v);
            else {
              setText(v);
              setHighlight(0);
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (text.trim()) add(text);
            setOpen(false);
          }}
          onKeyDown={onKeyDown}
          className="placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent px-1 outline-none"
        />
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="bg-card absolute z-20 mt-1 w-full overflow-hidden rounded-md border py-1 text-sm shadow-md"
        >
          {matches.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault(); // não deixa o input perder o foco
                add(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn('cursor-pointer px-3 py-1', i === highlight && 'bg-accent')}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
