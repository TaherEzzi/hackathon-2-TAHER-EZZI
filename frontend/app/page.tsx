"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtelierNavbar } from "@/components/AtelierNavbar";
import { AtelierFooter } from "@/components/AtelierFooter";
import { AuthCard } from "@/components/AuthCard";
import { StepNav } from "@/components/StepNav";
import { useAuth } from "@/lib/useProfile";

/** Resume where onboarding left off (steps are set by each stage's save). */
function nextStepRoute(step?: number): string {
  const s = step ?? 0;
  if (s >= 5) return "/dashboard";
  if (s >= 4) return "/onboarding/assets";
  if (s >= 3) return "/onboarding/themes";
  if (s >= 2) return "/onboarding/identity";
  return "/onboarding/plan";
}

export default function LandingPage() {
  const router = useRouter();
  const { session, profile, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const enterAtelier = () => {
    if (session) {
      router.push(nextStepRoute(profile?.onboarding_step));
      return;
    }
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative z-10">
      <AtelierNavbar
        userEmail={profile?.email}
        signOut={session ? () => void signOut() : undefined}
      />

      {/* Main Monumental Hero Content matching Atelier — Landing */}
      <main className="w-full pt-20 flex-1 relative flex flex-col justify-between">
        <div className="w-full px-6 lg:px-12 py-12 lg:py-20 flex flex-col justify-between min-h-[calc(100dvh-10rem)] max-w-7xl mx-auto">
          {/* Top Registry Indicator */}
          <div className="flex items-center justify-between w-full pt-4">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-[#d4af37] shadow-[0_0_10px_#d4af37]" />
              <span className="text-[11px] text-[#d4af37] tracking-[0.3em] font-bold uppercase font-code">
                PORTFOLIO EDITION MMXXIV
              </span>
            </div>
            <span className="text-[11px] text-neutral-400 tracking-[0.28em] font-bold uppercase font-code">
              AUTONOMOUS CURATION
            </span>
          </div>

          {/* Center Monumental Proclamation */}
          <div className="my-auto py-10 lg:py-16 flex flex-col items-center text-center max-w-5xl mx-auto">
            <img
              src="/logo-mark.png"
              alt="BreezePost monogram"
              className="h-20 sm:h-24 lg:h-28 w-auto mb-8 drop-shadow-[0_0_35px_rgba(212,175,55,0.45)]"
            />
            <h1 className="text-5xl sm:text-7xl lg:text-[96px] text-white font-[900] tracking-[-0.02em] leading-[0.98] uppercase font-display mb-6">
              YOUR BRAND,{" "}
              <span className="text-[#d4af37] drop-shadow-[0_0_35px_rgba(212,175,55,0.45)]">
                ENSHRINED
              </span>{" "}
              DAILY.
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-neutral-300 font-medium tracking-wide max-w-2xl leading-relaxed mb-10">
              Autonomous AI Instagram storytelling crafted at dawn, approved via Telegram, published with one tap.
            </p>

            {/* Bold Punchy CTA */}
            <button
              type="button"
              onClick={enterAtelier}
              className="group relative inline-flex items-center justify-center px-12 py-5 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-code font-[800] text-sm tracking-[0.3em] uppercase transition-all duration-300 shadow-[0_0_35px_rgba(212,175,55,0.4)] hover:shadow-[0_0_50px_rgba(242,202,80,0.65)] hover:-translate-y-0.5 cursor-pointer"
            >
              <span className="relative z-10 flex items-center gap-3">
                ENTER THE ATELIER
                <span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:translate-x-1.5">
                  arrow_forward
                </span>
              </span>
            </button>

            {/* Section index — lives in the hero, not the navbar */}
            <div className="w-full mt-12">
              <StepNav />
            </div>
          </div>

          {/* 4 Minimal Bold Status Badges */}
          <div className="w-full pb-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 max-w-5xl mx-auto">
              <div className="bg-[#0e0e11]/85 backdrop-blur-md p-4 lg:p-5 border border-[#d4af37]/30 hover:border-[#d4af37] transition-colors text-center group">
                <span className="text-xs lg:text-[13px] text-white font-bold tracking-[0.25em] uppercase block font-code group-hover:text-[#d4af37] transition-colors">
                  <span className="text-[#d4af37] mr-1.5">I.</span> COUTURE POSTS
                </span>
              </div>
              <div className="bg-[#0e0e11]/85 backdrop-blur-md p-4 lg:p-5 border border-[#d4af37]/30 hover:border-[#d4af37] transition-colors text-center group">
                <span className="text-xs lg:text-[13px] text-white font-bold tracking-[0.25em] uppercase block font-code group-hover:text-[#d4af37] transition-colors">
                  <span className="text-[#d4af37] mr-1.5">II.</span> TELEGRAM TAP
                </span>
              </div>
              <div className="bg-[#0e0e11]/85 backdrop-blur-md p-4 lg:p-5 border border-[#d4af37]/30 hover:border-[#d4af37] transition-colors text-center group">
                <span className="text-xs lg:text-[13px] text-white font-bold tracking-[0.25em] uppercase block font-code group-hover:text-[#d4af37] transition-colors">
                  <span className="text-[#d4af37] mr-1.5">III.</span> BRAND LEDGER
                </span>
              </div>
              <div className="bg-[#0e0e11]/85 backdrop-blur-md p-4 lg:p-5 border border-[#d4af37]/30 hover:border-[#d4af37] transition-colors text-center group">
                <span className="text-xs lg:text-[13px] text-white font-bold tracking-[0.25em] uppercase block font-code group-hover:text-[#d4af37] transition-colors">
                  <span className="text-[#d4af37] mr-1.5">IV.</span> ZERO OVERHEAD
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AtelierFooter />

      {/* Floating Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md">
            <AuthCard
              onClose={() => setShowAuthModal(false)}
              onAuthenticated={() => {
                setShowAuthModal(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
