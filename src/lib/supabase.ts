import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// When env vars are missing, App renders a setup screen instead of querying.
// Don't throw here: a module-level throw would blank the whole page.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(
  url || 'http://localhost:54321',
  anonKey || 'missing-anon-key',
);
