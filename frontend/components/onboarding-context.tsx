"use client";

import { createContext, useContext } from "react";
import type { ProfileRow } from "@/lib/types";
import type { UseAuthState } from "@/lib/useProfile";

/**
 * Shared onboarding context so the rail and every stage read one profile
 * without refetching. The shell withholds children until both the session and
 * the profile row exist, so `profile` is non-null here. (This file lives
 * outside the layout file — Next.js layouts may only export default/metadata.)
 */
export interface OnboardingCtx extends Omit<UseAuthState, "profile"> {
  profile: ProfileRow;
  railStep: number; // 0..4
}

export const OnboardingContext = createContext<OnboardingCtx | null>(null);

export function useOnboarding(): OnboardingCtx {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must sit inside the onboarding shell");
  return ctx;
}
