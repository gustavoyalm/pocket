import { createClient } from '@supabase/supabase-js';
import { env, isConfigured } from './env';
import type { Database } from './database.types';

// Placeholder evita crash quando ainda não há config; o app mostra uma tela de aviso.
export const supabase = createClient<Database>(
  isConfigured ? env.supabaseUrl : 'http://localhost',
  isConfigured ? env.supabaseKey : 'missing',
);
