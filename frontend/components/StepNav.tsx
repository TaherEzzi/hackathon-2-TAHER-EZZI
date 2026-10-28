"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = [
  { numeral: "I.", label: "PLAN", href: "/" },
  { numeral: "II.", label: "IDENTITY", href: "/onboarding/identity" },
  { numeral: "III.", label: "THEMES", href: "/onboarding/themes" },
  { numeral: "IV.", label: "ASSETS", href: "/onboarding/assets" },
  { numeral: "V.", label: "CONNECT", href: "/onboarding/connect" },
  { numeral: "VI.", label: "THE BENCH", href: "/dashboard" },
];

/**
 * The six-part atelier journey as an in-page presentation strip.
 * Rendered inside the hero/header of each screen — never in the navbar.
 */
export function StepNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Section navigation"
      className="w-full max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-7 gap-y-3 font-display"
    >
      {STEPS.map((step) => {
        const active =
          step.href === "/" ? pathname === "/" : pathname.startsWith(step.href);
        return (
          <Link
            key={step.label}
            href={step.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-[12px] sm:text-[13px] font-[800] tracking-[0.18em] whitespace-nowrap text-[#d4af37] border-b border-[#d4af37]/70 pb-1"
                : "text-[12px] sm:text-[13px] font-[800] tracking-[0.18em] whitespace-nowrap text-neutral-400 hover:text-white pb-1 border-b border-transparent transition-colors"
            }
          >
            <span className={active ? "mr-1.5" : "mr-1.5 text-[#d4af37]/70"}>
              {step.numeral}
            </span>
            {step.label}
          </Link>
        );
      })}
    </nav>
  );
}
