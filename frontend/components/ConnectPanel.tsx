"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TgLinkRow } from "@/lib/types";
import { useOnboarding } from "@/components/onboarding-context";
import { supabase } from "@/lib/supabase";

export function ConnectPanel() {
  const { profile, patchProfile } = useOnboarding();
  const router = useRouter();
  const [link, setLink] = useState<TgLinkRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    const ensureLink = async () => {
      const { data: existing } = await supabase
        .from("tg_link")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle<TgLinkRow>();

      if (existing) {
        if (active) setLink(existing);
        return;
      }

      // Generate 6-char pairing code
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      const rnd = new Uint32Array(6);
      crypto.getRandomValues(rnd);
      for (const n of rnd) code += alphabet[n % alphabet.length];

      const { data: created } = await supabase
        .from("tg_link")
        .upsert({ profile_id: profile.id, pairing_code: code, linked_at: null })
        .select("*")
        .single<TgLinkRow>();

      if (active && created) setLink(created);
    };

    void ensureLink();

    // Mark step 5 complete
    void patchProfile({ onboarding_step: 5 });

    // Poll for telegram link authorization
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("tg_link")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle<TgLinkRow>();
      if (active && data) setLink(data);
    }, 3000);

    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [profile.id, patchProfile]);

  const copyCode = () => {
    if (!link?.pairing_code) return;
    navigator.clipboard.writeText(`/link ${link.pairing_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openAtelier = () => {
    setBusy(true);
    router.push("/dashboard");
  };

  const displayCode = link?.pairing_code
    ? `BP - ${link.pairing_code}`
    : "BP - 8849";

  const isLinked = Boolean(link?.linked_at);

  return (
    <div className="w-full px-6 lg:px-12 py-10 lg:py-16 flex flex-col justify-between min-h-[calc(100vh-10rem)] max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <span className="text-xs text-[#d4af37] tracking-[0.3em] font-bold uppercase font-code mb-3">
          V. THE CONNECT
        </span>
        <h1 className="text-3xl sm:text-5xl text-white font-[900] tracking-[-0.01em] uppercase font-display">
          CONNECT TELEGRAM
        </h1>
      </div>

      {/* Two Hallmarked Seal Cards with Gold Hairline Borders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-auto py-8 w-full max-w-4xl mx-auto">
        {/* Card 01: Telegram Dispatch */}
        <div
          onClick={copyCode}
          className="bg-[#0e0e11]/85 backdrop-blur-md border border-[#d4af37]/35 p-8 flex flex-col justify-between h-[280px] shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:border-[#d4af37] transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs text-[#d4af37] tracking-[0.25em] font-bold uppercase font-code">
              TELEGRAM
            </span>
            <span className="material-symbols-outlined text-[#d4af37] text-[20px]">send</span>
          </div>

          <div className="text-center my-auto">
            <span className="text-[10px] text-neutral-400 tracking-[0.3em] font-bold uppercase font-code block mb-1">
              PAIRING CODE
            </span>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-[900] text-white tracking-[0.2em] font-display group-hover:text-[#f2ca50] transition-colors">
              {displayCode}
            </div>
            <span className="text-[10px] text-neutral-500 font-code tracking-widest mt-1 block">
              {copied ? "COPIED!" : "CLICK TO COPY CODE"}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-[#d4af37]/20 font-code text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isLinked
                  ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                  : "bg-[#d4af37] shadow-[0_0_8px_#d4af37] animate-pulse"
              }`}
            />
            <span
              className={`tracking-wider uppercase font-semibold ${
                isLinked ? "text-emerald-400" : "text-[#d4af37]"
              }`}
            >
              {isLinked ? "Linked ✓" : "Awaiting @Breezepostbot authorization"}
            </span>
          </div>
        </div>

        {/* Card 02: Instagram Feed */}
        <div className="bg-[#0e0e11]/85 backdrop-blur-md border border-[#d4af37]/35 p-8 flex flex-col justify-between h-[280px] shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:border-[#d4af37] transition-all">
          <div className="flex items-start justify-between">
            <span className="text-xs text-[#d4af37] tracking-[0.25em] font-bold uppercase font-code">
              INSTAGRAM
            </span>
            <span className="material-symbols-outlined text-[#d4af37] text-[20px]">photo_camera</span>
          </div>

          <div className="text-center my-auto">
            <span className="text-[10px] text-neutral-400 tracking-[0.3em] font-bold uppercase font-code block mb-1">
              ACCOUNT
            </span>
            <div className="text-2xl lg:text-3xl font-[800] text-[#d4af37] tracking-wider font-display">
              @breezepost.atelier
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#d4af37]/20 font-code text-xs">
            <span className="text-neutral-400 tracking-wider">Synchronized</span>
            <span className="material-symbols-outlined text-[#d4af37] text-[18px]">verified</span>
          </div>
        </div>
      </div>

      {/* Monumental Gold CTA */}
      <div className="flex flex-col items-center text-center pb-2">
        <button
          type="button"
          disabled={busy}
          onClick={openAtelier}
          className="inline-flex items-center gap-3 px-12 py-4 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-code font-[800] text-sm tracking-[0.3em] uppercase transition-all duration-300 shadow-[0_0_35px_rgba(212,175,55,0.4)] hover:shadow-[0_0_50px_rgba(242,202,80,0.65)] hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
        >
          <span>{busy ? "OPENING..." : "GO TO DASHBOARD"}</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
