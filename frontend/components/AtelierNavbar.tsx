"use client";

import Link from "next/link";
import { useState } from "react";

interface AtelierNavbarProps {
  userEmail?: string | null;
  signOut?: () => void;
}

/** Minimal brand bar: wordmark + signed-in user's account control. */
export function AtelierNavbar({ userEmail, signOut }: AtelierNavbarProps) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#08080a]/85 backdrop-blur-xl border-b border-[#d4af37]/25">
      <div className="h-16 md:h-20 w-full px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-3 sm:gap-6">
        {/* Brand Mark */}
        <Link href="/" className="min-w-0">
          <span className="text-lg md:text-xl xl:text-2xl font-[900] tracking-[0.18em] md:tracking-[0.25em] text-white uppercase font-display whitespace-nowrap">
            BREEZEPOST
          </span>
        </Link>

        {/* Account control (signed-in only) */}
        {userEmail && (
          <div className="relative">
            <button
              type="button"
              className="w-9 h-9 border border-[#d4af37]/40 bg-[#141417] flex items-center justify-center cursor-pointer hover:border-[#d4af37] transition-colors"
              title={userEmail}
              aria-label={`Account — ${userEmail}`}
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((o) => !o)}
            >
              <span className="material-symbols-outlined text-[#d4af37] text-[18px]">person</span>
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-11 bg-[#0e0e11] border border-[#d4af37]/30 px-3 py-1.5 font-code text-[10px] tracking-wider text-neutral-300 uppercase shadow-lg whitespace-nowrap z-20">
                <div className="hidden min-[420px]:block text-neutral-500 normal-case tracking-normal">
                  {userEmail}
                </div>
                {signOut && (
                  <button
                    type="button"
                    onClick={signOut}
                    className="text-[#d4af37] hover:text-[#f2ca50] uppercase cursor-pointer tracking-wider"
                  >
                    Leave ({userEmail.split("@")[0]})
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
