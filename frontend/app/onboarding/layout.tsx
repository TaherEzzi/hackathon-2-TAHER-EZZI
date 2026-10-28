"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AtelierNavbar } from "@/components/AtelierNavbar";
import { AtelierFooter } from "@/components/AtelierFooter";
import { OnboardingContext } from "@/components/onboarding-context";
import { useAuth } from "@/lib/useProfile";

const PATH_TO_STEP: Array<[string, number]> = [
  ["/onboarding/identity", 1],
  ["/onboarding/themes", 2],
  ["/onboarding/assets", 3],
  ["/onboarding/connect", 4],
];

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();

  const railStep = useMemo(() => {
    const hit = PATH_TO_STEP.find(([p]) => pathname.startsWith(p));
    return hit ? hit[1] : 1;
  }, [pathname]);

  useEffect(() => {
    if (!auth.loading && !auth.session) router.replace("/");
  }, [auth.loading, auth.session, router]);

  if (auth.loading || !auth.session || !auth.profile) {
    return (
      <main className="flex min-h-screen items-center justify-center font-code text-xs text-[#d4af37] tracking-[0.25em] uppercase">
        <span className="inline-block w-2.5 h-2.5 bg-[#d4af37] shadow-[0_0_12px_#d4af37] mr-3 animate-ping" />
        LOADING MAISON...
      </main>
    );
  }

  return (
    <OnboardingContext.Provider value={{ ...auth, profile: auth.profile, railStep }}>
      <div className="min-h-screen flex flex-col justify-between relative z-10">
        <AtelierNavbar
          userEmail={auth.profile?.email}
          signOut={() => void auth.signOut()}
        />
        <main className="w-full pt-20 flex-1 relative flex flex-col justify-between">
          {children}
        </main>
        <AtelierFooter />
      </div>
    </OnboardingContext.Provider>
  );
}
