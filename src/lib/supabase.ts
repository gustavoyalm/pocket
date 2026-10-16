import { createClient } from '@supabase/supabase-js';
import { env, isConfigured } from './env';

// Placeholder evita crash quando ainda não há config; o app mostra uma tela de aviso.
export const supabase = createClient(
  isConfigured ? env.supabaseUrl : 'http://localhost',
  isConfigured ? env.supabaseKey : 'missing',
);
