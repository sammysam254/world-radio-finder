import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Hardcoded fallback so the app never crashes due to missing build-time env vars.
// These are the public anon credentials — safe to include in client-side code.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://uwbjvhrqqknukfzzzsii.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3Ymp2aHJxcWtudWtmenp6c2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjEyODYsImV4cCI6MjA5NDA5NzI4Nn0.z0Ad3sRnDiXPsXnJEvyE94ZtlrBDJ8QGTOmesJVAXmo";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});