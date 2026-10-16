import { Card } from '@/components/ui/card';
import { Logo } from '@/components/Logo';

export function NotConfigured() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <Card className="max-w-md space-y-3 p-6 text-sm">
        <h1 className="text-lg font-semibold">Supabase não configurado</h1>
        <p className="text-muted-foreground">
          Defina <code className="money">SUPABASE_URL</code> e{' '}
          <code className="money">SUPABASE_PUBLISHABLE_KEY</code> nas variáveis de ambiente do
          container (ou as versões <code className="money">VITE_*</code> no{' '}
          <code className="money">.env.local</code> em desenvolvimento).
        </p>
      </Card>
    </div>
  );
}
