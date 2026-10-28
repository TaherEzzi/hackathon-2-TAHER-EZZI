"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface AtelierNavbarProps {
  userEmail?: string | null;
  signOut?: () => void;
  onEnterAtelier?: () => void;
}

export function AtelierNavbar({ userEmail, signOut, onEnterAtelier }: AtelierNavbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Close menus whenever the route changes or a link is tapped.
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

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

  const enterAtelierButton = (extraClass: string) =>
    onEnterAtelier ? (
      <button
        type="button"
        onClick={onEnterAtelier}
        className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-display font-[800] text-xs tracking-[0.18em] whitespace-nowrap uppercase transition-all duration-200 shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:shadow-[0_0_28px_rgba(242,202,80,0.6)] cursor-pointer ${extraClass}`}
      >
        <span>
          ENTER <span className="hidden min-[420px]:inline">ATELIER</span>
        </span>
        <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
      </button>
    ) : (
      <Link
        href="/onboarding/identity"
        className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-display font-[800] text-xs tracking-[0.18em] whitespace-nowrap uppercase transition-all duration-200 shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:shadow-[0_0_28px_rgba(242,202,80,0.6)] ${extraClass}`}
      >
        <span>
          ENTER <span className="hidden min-[420px]:inline">ATELIER</span>
        </span>
        <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
      </Link>
    );

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-[#08080a]/85 backdrop-blur-xl border-b border-[#d4af37]/25">
      <div className="h-16 md:h-20 w-full px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-3 sm:gap-6">
        {/* Brand Mark & Badge */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
          <span className="text-lg md:text-xl xl:text-2xl font-[900] tracking-[0.18em] md:tracking-[0.25em] text-white uppercase font-display whitespace-nowrap">
            BREEZEPOST
          </span>
          <span className="hidden md:inline-block px-2.5 py-0.5 bg-[#d4af37] text-[#0b0b0d] text-[10px] font-[800] tracking-[0.2em] uppercase font-display shadow-[0_0_12px_rgba(212,175,55,0.4)]">
            THE ATELIER
          </span>
        </Link>

        {/* Center Architectural Navigation (desktop) */}
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
        <div className="flex items-center gap-2 sm:gap-4">
          {enterAtelierButton("")}

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

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="xl:hidden p-2 -mr-2 text-[#d4af37] hover:text-[#f2ca50] cursor-pointer"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="material-symbols-outlined text-[24px]">
              {menuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile / tablet navigation panel */}
      <nav
        className={`xl:hidden overflow-hidden border-t border-[#d4af37]/15 bg-[#08080a]/95 backdrop-blur-xl font-display transition-[max-height,opacity] duration-300 ${
          menuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0 border-t-0"
        }`}
        aria-label="Section navigation"
      >
        <ul className="px-4 py-3 flex flex-col">
          {navItems.map((item) => {
            const active = isCurrent(item.href);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={
                    active
                      ? "flex items-center justify-between px-3 py-3 font-[800] text-[13px] tracking-[0.15em] whitespace-nowrap text-[#d4af37] border-l-2 border-[#d4af37] bg-[#d4af37]/[0.07]"
                      : "flex items-center justify-between px-3 py-3 font-[800] text-[13px] tracking-[0.15em] whitespace-nowrap text-neutral-300 hover:text-white border-l-2 border-transparent transition-colors"
                  }
                >
                  {item.label}
                  {active && (
                    <span className="material-symbols-outlined text-[16px]">arrow_right</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
