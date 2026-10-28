"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

function atelierAuthError(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err);
  if (/invalid login credentials/i.test(msg)) {
    return "The hallmark does not match our registry. Check the cipher and retry.";
  }
  if (/user already registered/i.test(msg)) {
    return "This maison is already inscribed. Sign in with your key instead.";
  }
  return msg;
}

export function AuthCard({
  onAuthenticated,
  onClose,
}: {
  onAuthenticated: (isNew: boolean) => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    setBusy(true);
    try {
      if (tab === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onAuthenticated(false);
      } else {
        const res = await supabase.auth.signUp({ email, password });
        if (res.error) throw res.error;
        if (res.data.session) onAuthenticated(true);
        else {
          setProblem(
            "An entrance token was dispatched to your inbox — confirm the address to enter the atelier."
          );
          return;
        }
      }
    } catch (err) {
      setProblem(atelierAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.section
      className="w-full max-w-md bg-[#0e0e11]/95 backdrop-blur-xl border border-[#d4af37]/35 p-8 shadow-[0_12px_40px_rgba(0,0,0,0.8)] relative"
      aria-label="Sign in or register your maison"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white font-code text-xs"
        >
          ✕
        </button>
      )}

      <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-4 mb-6 font-code text-xs tracking-[0.2em] uppercase">
        <button
          type="button"
          className={`pb-2 transition-colors ${
            tab === "signin"
              ? "text-[#d4af37] font-bold border-b-2 border-[#d4af37]"
              : "text-neutral-400 hover:text-white"
          }`}
          onClick={() => {
            setTab("signin");
            setProblem(null);
          }}
        >
          I. Sign In
        </button>
        <button
          type="button"
          className={`pb-2 transition-colors ${
            tab === "create"
              ? "text-[#d4af37] font-bold border-b-2 border-[#d4af37]"
              : "text-neutral-400 hover:text-white"
          }`}
          onClick={() => {
            setTab("create");
            setProblem(null);
          }}
        >
          II. Inscribe Maison
        </button>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label
            htmlFor="auth-email"
            className="block font-code text-[11px] font-bold text-neutral-400 tracking-[0.25em] uppercase mb-2"
          >
            MAISON EMAIL
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maison@atelier.com"
            className="w-full bg-transparent border-0 border-b border-[#d4af37]/40 pb-2 text-base text-white font-body tracking-wider focus:outline-none focus:border-[#f2ca50] transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="block font-code text-[11px] font-bold text-neutral-400 tracking-[0.25em] uppercase mb-2"
          >
            CIPHER KEY
          </label>
          <input
            id="auth-password"
            type="password"
            required
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-transparent border-0 border-b border-[#d4af37]/40 pb-2 text-base text-white font-body tracking-wider focus:outline-none focus:border-[#f2ca50] transition-colors"
          />
        </div>

        {problem && (
          <div className="bg-[#181216] border border-red-500/40 p-3 font-code text-xs text-red-300">
            {problem}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-4 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-code font-[800] text-xs tracking-[0.3em] uppercase transition-all duration-200 shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:shadow-[0_0_30px_rgba(242,202,80,0.6)] cursor-pointer disabled:opacity-50"
        >
          {busy ? "AUTHENTICATING..." : tab === "signin" ? "ENTER THE ATELIER" : "INSCRIBE MAISON"}
        </button>
      </form>
    </motion.section>
  );
}
