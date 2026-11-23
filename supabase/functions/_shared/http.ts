// Shared helpers for the edge functions (Deno in production, Node in local tests).
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function env(key: string): string | undefined {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  return g.Deno?.env?.get(key) ?? g.process?.env?.[key];
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

let client: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  client ??= createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** The signed-in, non-anonymous caller, or null. */
export async function caller(req: Request): Promise<User | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user || data.user.is_anonymous) return null;
  return data.user;
}

export async function entitlements(userId: string): Promise<Record<string, unknown>> {
  const { data } = await admin().rpc("entitlements", { u: userId });
  return (data as Record<string, unknown>) ?? {};
}
