import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase access.
 *
 * - The anon client is safe for the browser and is restricted by Row Level
 *   Security: it can read verified Safe Havens and insert pending applications.
 * - The service-role client bypasses RLS and is created ONLY on the server.
 *   Its key must never be exposed to the client bundle, so it is read from
 *   `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix).
 */

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  if (!anonClient) {
    anonClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return anonClient;
}

/** Server-only. Returns null when the service role key is not configured. */
export function getSupabaseServiceClient(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("The Supabase service-role client must not be used in the browser");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
