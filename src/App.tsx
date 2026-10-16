import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { isConfigured } from '@/lib/env';
import { AppLayout } from '@/components/AppLayout';
import { Accounts } from '@/pages/Accounts';
import { Categories } from '@/pages/Categories';
import { Dashboard } from '@/pages/Dashboard';
import { Invoices } from '@/pages/Invoices';
import { Login } from '@/pages/Login';
import { NotConfigured } from '@/pages/NotConfigured';
import { Tags } from '@/pages/Tags';
import { Transactions } from '@/pages/Transactions';

// Relatórios carregam a biblioteca de gráficos: só baixa quando a tela é aberta
const Reports = lazy(() => import('@/pages/Reports'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

export default function App() {
  if (!isConfigured) return <NotConfigured />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route index element={<Dashboard />} />
              <Route path="transacoes" element={<Transactions />} />
              <Route path="faturas" element={<Invoices />} />
              <Route path="contas" element={<Accounts />} />
              <Route path="categorias" element={<Categories />} />
              <Route path="tags" element={<Tags />} />
              <Route
                path="relatorios"
                element={
                  <Suspense fallback={<div className="bg-muted/50 h-96 animate-pulse rounded-lg border" />}>
                    <Reports />
                  </Suspense>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
