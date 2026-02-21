import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from './config';

/**
 * Supabase client initialized with the Service Role Key from config.ts.
 * This client bypasses Row Level Security and must ONLY be used
 * inside the Engine (server-side). Never expose it to the browser.
 */
export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      // Disable session persistence — the engine is a server process, not a browser
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
