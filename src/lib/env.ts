declare global {
  interface Window {
    __POCKET_CONFIG__?: {
      SUPABASE_URL?: string;
      SUPABASE_PUBLISHABLE_KEY?: string;
    };
  }
}

// Em produção a config vem de /config.js (gerado pelo container a partir das
// variáveis de ambiente), assim a mesma imagem Docker serve pra qualquer instalação.
// Em dev cai no .env.local.
const runtime = window.__POCKET_CONFIG__ ?? {};

export const env = {
  supabaseUrl: runtime.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '',
  supabaseKey: runtime.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseKey);
