import { NavLink, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, LayoutDashboard, LogOut, Tags, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { TransactionDialogProvider } from './TransactionDialog';
import { Button } from './ui/button';

const nav = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, ready: true },
  { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight, ready: true },
  { to: '/contas', label: 'Contas', icon: Wallet, ready: true },
  { to: '/categorias', label: 'Categorias', icon: Tags, ready: false },
];

const itemClass =
  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors [&_svg]:size-4';

export function AppLayout() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear(); // não deixa dados em cache para o próximo usuário
  };

  return (
    <TransactionDialogProvider>
      <div className="flex min-h-svh flex-col md:flex-row">
        <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 flex-col border-b md:sticky md:top-0 md:h-svh md:w-52 md:border-r md:border-b-0">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo />
            <div className="flex items-center gap-1 md:hidden">
              <ThemeToggle />
              <Button variant="ghost" size="icon" title="Sair" aria-label="Sair" onClick={signOut}>
                <LogOut />
              </Button>
            </div>
          </div>
          <nav className="flex gap-0.5 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:pb-0">
            {nav.map(({ to, label, icon: Icon, ready }) =>
              ready ? (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className={({ isActive }) =>
                    cn(
                      itemClass,
                      isActive
                        ? 'bg-sidebar-accent font-medium'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    )
                  }
                >
                  <Icon />
                  {label}
                </NavLink>
              ) : (
                <span key={to} className={cn(itemClass, 'text-muted-foreground/50 cursor-default')} title="Em breve">
                  <Icon />
                  {label}
                </span>
              ),
            )}
          </nav>
          <div className="border-sidebar-border hidden space-y-2 border-t p-3 md:block">
            <p className="text-muted-foreground px-1 text-xs">
              <kbd className="bg-muted rounded border px-1 font-mono text-[10px]">N</kbd> nova transação
            </p>
            <div className="flex items-center justify-between gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" title="Sair" aria-label="Sair" onClick={signOut}>
                <LogOut />
              </Button>
            </div>
            <p className="text-muted-foreground truncate px-1 text-xs">{session?.user.email}</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-5">
          <Outlet />
        </main>
      </div>
    </TransactionDialogProvider>
  );
}
