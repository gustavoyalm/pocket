import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Campo de formulário: rótulo pequeno em cima, controle, dica embaixo. */
export function Field({
  label,
  htmlFor,
  optional,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-muted-foreground text-xs font-medium">
        {label}
        {optional && <span className="text-muted-foreground/60 font-normal"> · opcional</span>}
      </label>
      {children}
      {hint && <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>}
    </div>
  );
}

/** Bloco com título discreto, para separar partes de um formulário maior. */
export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-4 border-t pt-5', className)}>
      <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Interruptor com rótulo e descrição (substitui os checkboxes soltos). */
export function SwitchRow({
  checked,
  onChange,
  label,
  description,
  tone = 'primary',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  tone?: 'primary' | 'success';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="hover:bg-muted/40 -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-1.5 text-left"
    >
      <span
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? (tone === 'success' ? 'bg-success' : 'bg-primary') : 'bg-input',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </span>
      <span className="min-w-0 text-sm">
        {label}
        {description && <span className="text-muted-foreground block text-xs">{description}</span>}
      </span>
    </button>
  );
}

/** Rodapé do diálogo: ações destrutivas à esquerda, cancelar/salvar à direita. */
export function FormFooter({ left, children }: { left?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-muted/30 -mx-6 -mb-5 mt-6 flex flex-col-reverse gap-2 border-t px-6 py-3 sm:flex-row sm:items-center">
      {left && <div className="flex flex-wrap gap-1">{left}</div>}
      <div className="flex gap-2 sm:ml-auto">{children}</div>
    </div>
  );
}

/** Seletor segmentado (ex.: Despesa | Receita). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; activeClass?: string }[];
  label: string;
}) {
  return (
    <div className="bg-muted inline-flex rounded-md p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'text-muted-foreground hover:text-foreground h-8 rounded-[5px] px-4 text-sm font-medium transition-colors',
            value === o.value && 'bg-background text-foreground shadow-xs',
            value === o.value && o.activeClass,
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const textareaClass =
  'border-input placeholder:text-muted-foreground dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none';
