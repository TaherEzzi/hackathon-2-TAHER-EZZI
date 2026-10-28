import { createClient } from "@supabase/supabase-js";

// Publishable ("anon") key only — safe for the browser. RLS enforces every
// write: profiles.id == auth.uid(), so the client may only touch its own rows.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

if (!supabaseUrl || !supabaseKey) {
  // Fail loudly in dev; the app still renders (auth actions surface the error).
  console.warn(
    "BreezePost: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Create frontend/.env.local from the workspace .env (NEXT_PUBLIC_ vars only).",
  );
}

export const supabase = createClient(supabaseUrl || "http://localhost:54321", supabaseKey || "public-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "breezepost-atelier-auth",
  },
});

export const PRODUCT_IMAGES_BUCKET = "product-images";
