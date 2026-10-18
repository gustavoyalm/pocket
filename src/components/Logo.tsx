import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M9 10h14v6a7 7 0 0 1-14 0z"
          fill="none"
          strokeWidth="2.5"
          strokeLinejoin="round"
          className="stroke-primary-foreground"
        />
      </svg>
      <span className="text-lg">pocket</span>
    </div>
  );
}
