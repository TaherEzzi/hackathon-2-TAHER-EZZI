"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AtelierNavbarProps {
  userEmail?: string | null;
  signOut?: () => void;
  onEnterAtelier?: () => void;
}

export function AtelierNavbar({ userEmail, signOut, onEnterAtelier }: AtelierNavbarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "I. PLAN", href: "/" },
    { label: "II. IDENTITY", href: "/onboarding/identity" },
    { label: "III. THEMES", href: "/onboarding/themes" },
    { label: "IV. ASSETS", href: "/onboarding/assets" },
    { label: "V. CONNECT", href: "/onboarding/connect" },
    { label: "VI. THE BENCH", href: "/dashboard" },
  ];

  const isCurrent = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#08080a]/85 backdrop-blur-xl border-b border-[#d4af37]/25">
      <div className="h-20 w-full px-6 lg:px-12 flex items-center justify-between gap-6">
        {/* Brand Mark & Badge */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="text-xl sm:text-2xl font-[900] tracking-[0.25em] text-white uppercase font-display">
            BREEZEPOST
          </span>
          <span className="px-2.5 py-0.5 bg-[#d4af37] text-[#0b0b0d] text-[10px] font-[800] tracking-[0.2em] uppercase font-display shadow-[0_0_12px_rgba(212,175,55,0.4)]">
            THE ATELIER
          </span>
        </Link>

        {/* Center Architectural Navigation */}
        <nav className="hidden xl:flex items-center gap-1 font-display">
          {navItems.map((item) => {
            const active = isCurrent(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={
                  active
                    ? "relative px-4 py-2 font-[800] text-[13px] tracking-[0.15em] whitespace-nowrap text-[#d4af37] border-b-2 border-[#d4af37]"
                    : "px-4 py-2 font-[800] text-[13px] tracking-[0.15em] whitespace-nowrap text-neutral-300 hover:text-white transition-colors"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Bold Action Button */}
        <div className="flex items-center gap-4">
          {onEnterAtelier ? (
            <button
              type="button"
              onClick={onEnterAtelier}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-display font-[800] text-xs tracking-[0.18em] whitespace-nowrap uppercase transition-all duration-200 shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:shadow-[0_0_28px_rgba(242,202,80,0.6)] cursor-pointer"
            >
              <span>ENTER ATELIER</span>
              <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
            </button>
          ) : (
            <Link
              href="/onboarding/identity"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-display font-[800] text-xs tracking-[0.18em] whitespace-nowrap uppercase transition-all duration-200 shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:shadow-[0_0_28px_rgba(242,202,80,0.6)]"
            >
              <span>ENTER ATELIER</span>
              <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
            </Link>
          )}

          {userEmail && (
            <div
              className="w-9 h-9 border border-[#d4af37]/40 bg-[#141417] flex items-center justify-center cursor-pointer group relative"
              title={userEmail}
              onClick={signOut}
            >
              <span className="material-symbols-outlined text-[#d4af37] text-[18px]">person</span>
              {signOut && (
                <div className="absolute right-0 top-11 hidden group-hover:block bg-[#0e0e11] border border-[#d4af37]/30 px-3 py-1.5 font-code text-[10px] tracking-wider text-neutral-300 uppercase shadow-lg whitespace-nowrap">
                  Leave ({userEmail.split("@")[0]})
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
