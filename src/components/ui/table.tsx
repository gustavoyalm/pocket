import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Tabela densa: linhas baixas, cabeçalho fixo, sem enfeite
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="bg-muted/40 sticky top-0 z-10" {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'text-muted-foreground h-8 border-b px-3 text-left text-xs font-medium whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, onClick, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b last:border-b-0',
        onClick && 'hover:bg-accent/60 cursor-pointer',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('h-9 px-3 whitespace-nowrap', className)} {...props} />;
}
