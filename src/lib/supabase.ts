import { createClient } from "@supabase/supabase-js";

// Publishable values — safe to ship in the browser. All data access is
// protected by row level security and server functions in the database.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://dmynmniiapfrpzfxgqwn.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_3wszEFLCya9n0bCSpArFvg_A0DI2e7n";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: { params: { eventsPerSecond: 20 } },
});

/** Public URL of the app (used for auth email links). */
export const APP_URL = window.location.origin + import.meta.env.BASE_URL;
