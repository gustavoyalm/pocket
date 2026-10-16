import type { ReactNode } from 'react';

type Props = {
  title: string;
  /** Conteúdo ao lado do título (ex.: seletor de mês, subtítulo) */
  children?: ReactNode;
  /** Botões alinhados à direita */
  actions?: ReactNode;
};

export function PageHeader({ title, children, actions }: Props) {
  return (
    <header className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </header>
  );
}
