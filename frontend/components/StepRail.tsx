"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

/**
 * The vertical archive-tab rail — a REAL sequence of the five commissioning
 * steps (I Plan → V Connect) that persists across the onboarding screens.
 * Completed steps carry a small accent tick; the active step wears the accent
 * left rule and a Fraunces numeral. On ≤900px it collapses to a top progress
 * line instead.
 */

export interface RailStep {
  numeral: string;
  label: string;
  hint: string;
  href: string;
}

export const RAIL_STEPS: RailStep[] = [
  { numeral: "I", label: "Plan", hint: "Tier & schedule", href: "/onboarding/plan" },
  { numeral: "II", label: "Identity", hint: "Brand & DNA", href: "/onboarding/identity" },
  { numeral: "III", label: "Themes", hint: "Style presets", href: "/onboarding/themes" },
  { numeral: "IV", label: "Assets", hint: "Product locker", href: "/onboarding/assets" },
  { numeral: "V", label: "Connect", hint: "Telegram & pipeline", href: "/onboarding/connect" },
];

export function StepRail({
  step,
  completedThrough,
}: {
  step: number; // active step index, 0..4
  completedThrough: number;
}) {
  const pathname = usePathname();
  void pathname; // active step passed in explicitly for "/" (plan) sharing

  return (
    <>
      {/* Desktop: the archive-tab column */}
      <nav aria-label="Commissioning steps" className="hairline-r hidden w-[16.5rem] flex-col py-6 md:flex">
        <p className="eyebrow mb-4 px-6">Commission</p>
        {RAIL_STEPS.map((s, i) => {
          const active = i === step;
          const done = i < completedThrough;
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`rail-step ${active ? "" : "opacity-80"}`}
              data-active={active}
              aria-current={active ? "step" : undefined}
              scroll
            >
              <span className="rail-numeral">{s.numeral}</span>
              <span className="flex flex-col">
                <span className="flex items-center gap-2 text-[0.93rem] font-medium" style={{ color: active || done ? "var(--ink)" : "var(--accent2)" }}>
                  {s.label}
                  {done && (
                    <span className="tick" aria-label="Step complete">
                      ✓
                    </span>
                  )}
                </span>
                <span className="mono-label" style={{ letterSpacing: "0.08em" }}>
                  {s.hint}
                </span>
              </span>
            </Link>
          );
        })}
        <div className="divider-h mx-6 mt-6 mb-4" />
        <p className="px-6 text-[0.8rem] leading-relaxed" style={{ color: "var(--accent2)" }}>
          Five stages, one commission. Finish them, and the pipelined pieces flow to Telegram daily.
        </p>
      </nav>

      {/* Mobile: progress line */}
      <div className="px-5 pt-4 md:hidden" aria-hidden>
        <div className="h-px w-full" style={{ background: "var(--line)" }}>
          <motion.div
            className="h-px"
            style={{ background: "var(--accent)", transformOrigin: "left" }}
            initial={{ scaleX: step / 5 }}
            animate={{ scaleX: (step + 1) / 5 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <div className="mono-label mt-2 flex justify-between" style={{ letterSpacing: "0.08em" }}>
          <span>
            {RAIL_STEPS[step]?.numeral} · {RAIL_STEPS[step]?.label}
          </span>
          <span>
            Step {step + 1} / 5
          </span>
        </div>
      </div>
    </>
  );
}
