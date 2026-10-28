// Row types mirroring the live Supabase schema (verified 2026-10-28 against the
// PostgREST OpenAPI spec). Enums mirror public types exactly.

export type PlanTier = "streak" | "boost" | "surge";

export type UserCategory =
  | "jewelry"
  | "handbags"
  | "beverages"
  | "wallets"
  | "watches"
  | "tshirts";

export type PostFrequency =
  | "weekly"
  | "thrice_weekly"
  | "daily"
  | "twice_daily"
  | "five_daily";

export type PostStatus =
  | "awaiting_review"
  | "approved"
  | "published"
  | "skipped"
  | "failed";

export interface ProfileRow {
  id: string;
  email: string | null;
  brand_name: string | null;
  category: UserCategory | null;
  design_dna_md: string | null;
  onboarding_step: number;
  tier: PlanTier | null;
  timezone: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleRow {
  profile_id: string;
  frequency: PostFrequency;
  delivery_times: string[];
  active: boolean;
  updated_at?: string;
}

export interface ThemePresetRow {
  id: number;
  category: UserCategory;
  name: string;
  description: string;
  prompt_template?: string;
  preview_path: string | null;
}

export interface ThemeSelectionRow {
  profile_id: string;
  preset_id: number;
  sort: number;
}

export interface ProductRow {
  id: string;
  profile_id: string;
  title: string;
  highlight: string | null;
  price: number | null;
  image_path: string | null;
  sort: number | null;
  created_at?: string;
}

export interface TgLinkRow {
  profile_id: string;
  pairing_code: string | null;
  chat_id: number | null;
  telegram_user_id: number | null;
  linked_at: string | null;
  created_at?: string;
}

export interface PostRow {
  id: string;
  profile_id: string;
  status: PostStatus;
  scheduled_for: string | null;
  caption: string | null;
  image_path: string | null;
  published_at: string | null;
  revision_count: number | null;
  preset_id: number | null;
  product_id: string | null;
  created_at: string;
  updated_at?: string;
}
