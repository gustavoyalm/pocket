import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const options: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Claro' },
  { value: 'system', icon: Monitor, label: 'Sistema' },
  { value: 'dark', icon: Moon, label: 'Escuro' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="bg-muted inline-flex rounded-md p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            'text-muted-foreground rounded-sm p-1.5 transition-colors [&_svg]:size-3.5',
            theme === value && 'bg-background text-foreground shadow-xs',
          )}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
