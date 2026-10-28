"use client";

import { motion } from "framer-motion";
import type { UserCategory } from "@/lib/types";
import { CATEGORIES } from "@/lib/theme-data";

/** Six craft headings, one card each — large targets, working titles. */
export function CategoryGrid({
  value,
  onChange,
}: {
  value: UserCategory | null;
  onChange: (c: UserCategory) => void;
}) {
  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      role="radiogroup"
      aria-label="Craft heading"
      initial="hidden"
      animate="shown"
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.05 } } }}
    >
      {CATEGORIES.map((c) => {
        const sel = value === c.value;
        return (
          <motion.button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={sel}
            variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35 }}
            className="card group flex flex-col items-start gap-2 p-5 text-left transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-1"
            style={sel ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" } : undefined}
            onClick={() => onChange(c.value)}
          >
            <span className="text-2xl" aria-hidden>
              {c.glyph}
            </span>
            <span
              className="font-[family-name:var(--font-display)] text-[1.05rem]"
              style={{ fontVariationSettings: '"opsz" 30', color: sel ? "var(--accent)" : "var(--ink)" }}
            >
              {c.label}
            </span>
            <span className="mono-label" style={{ letterSpacing: "0.06em" }}>
              {c.blurb}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
