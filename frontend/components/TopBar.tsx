"use client";

import Link from "next/link";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

/** Slim top bar — brandmark, nav, and the atelier "setting" (theme) switcher. */
export function TopBar({
  nav,
  userEmail,
  signOut,
}: {
  nav?: Array<{ href: string; label: string; current?: boolean }>;
  userEmail?: string | null;
  signOut?: () => void;
}) {
  return (
    <header className="hairline-b relative z-20 flex h-13 items-center justify-between px-5 sm:px-8" style={{ minHeight: "3.25rem" }}>
      <div className="flex items-center gap-6">
        <Link href="/" className="group flex items-baseline gap-2.5" aria-label="BreezePost — home">
          <span
            className="font-[family-name:var(--font-display)] text-[1.06rem] font-medium tracking-tight"
            style={{ fontVariationSettings: '"opsz" 40' }}
          >
            BreezePost
          </span>
          <span className="eyebrow hidden sm:inline">The Atelier</span>
        </Link>
        {nav && (
          <nav className="hidden items-center gap-5 md:flex" aria-label="Sections">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="navlink" aria-current={item.current ? "true" : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-4">
        {userEmail && (
          <span className="mono-label hidden max-w-44 truncate lg:inline" title={userEmail}>
            {userEmail}
          </span>
        )}
        <ThemeSwitcher />
        {signOut && (
          <button type="button" className="btn-quiet text-[0.82rem]" onClick={signOut}>
            Leave
          </button>
        )}
      </div>
    </header>
  );
}
