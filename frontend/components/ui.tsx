"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { ReactNode } from "react";

/* ── Atelier UI primitives ──
   Small, shared, opinionated. Copy lives at the call site. */

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/** Page-load orchestration: eyebrow → headline → body in 60ms steps. */
export function PageHeader({
  eyebrow,
  title,
  body,
  right,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-10">
      <motion.p
        className="eyebrow"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0 }}
      >
        {eyebrow}
      </motion.p>
      <motion.h1
        className="headline h2 mt-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.06 }}
      >
        {title}
      </motion.h1>
      {body && (
        <motion.p
          className="mt-3 max-w-xl text-[0.95rem] leading-relaxed"
          style={{ color: "var(--accent2)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12 }}
        >
          {body}
        </motion.p>
      )}
      {right && <div className="mt-5">{right}</div>}
    </header>
  );
}

export function Notice({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "success";
  children: ReactNode;
}) {
  const edge =
    kind === "error" ? "var(--accent)" : kind === "success" ? "var(--accent)" : "var(--line)";
  return (
    <motion.div
      role={kind === "error" ? "alert" : "status"}
      className="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-[0.86rem] leading-relaxed"
      style={{ borderLeft: `2px solid ${edge}`, background: "hsl(var(--accent-h) var(--accent-s) var(--accent-l) / 0.05)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-inset flex flex-col items-center gap-2 px-8 py-14 text-center">
      <span className="numeral text-3xl" style={{ color: "var(--accent)", opacity: 0.7 }}>
        ✧
      </span>
      <p className="h3">{title}</p>
      <p className="max-w-sm text-[0.9rem]" style={{ color: "var(--accent2)" }}>
        {body}
      </p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Status chip with a token-only accent dot — no hexes anywhere. */
export function StatusChip({ status, label }: { status: string; label: string }) {
  const dotCls =
    status === "awaiting_review"
      ? "dot dot-accent dot-ring"
      : status === "approved"
        ? "dot dot-accent"
        : status === "published"
          ? "dot dot-accent2"
          : status === "failed"
            ? "dot dot-hollow dot-accent2"
            : "dot dot-hollow";
  return (
    <span className="chip" data-status={status}>
      <span className={dotCls} aria-hidden />
      {label}
    </span>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      aria-label={`${label} to clipboard`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard blocked (permissions) — fall back to a manual select.
          console.warn("Clipboard unavailable; copy the code by selecting it.");
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? "Engraved ✓" : label}
    </button>
  );
}

/** The bench-is-warming loader, in the atelier's own idiom. */
export function AtelierLoader({ children = "The bench is being prepared…", error }: { children?: ReactNode; error?: string | null }) {
  if (error) {
    return (
      <div className="flex min-h-40 items-center justify-center px-6">
        <Notice kind="error">{error}</Notice>
      </div>
    );
  }
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3" role="status">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1 w-6 rounded-full"
            style={{ background: "var(--accent)" }}
            animate={{ opacity: [0.15, 0.9, 0.15] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
      <p className="mono-label">{children}</p>
    </div>
  );
}
