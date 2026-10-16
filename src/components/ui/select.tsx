import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'border-input h-9 w-full appearance-none rounded-md border bg-transparent pr-8 pl-3 text-sm shadow-xs transition-colors',
          'dark:bg-input/30 [&_optgroup]:bg-card [&_optgroup]:text-foreground [&_option]:bg-card [&_option]:text-foreground',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
    </div>
  );
}
