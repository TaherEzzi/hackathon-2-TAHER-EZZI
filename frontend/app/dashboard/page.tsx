"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PostFrequency, PostRow, TgLinkRow } from "@/lib/types";
import { useAuth } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const { loading, session, profile, signOut } = useAuth();
  const [schedule, setSchedule] = useState<{ frequency: PostFrequency; delivery_times: string[] } | null>(null);
  const [tg, setTg] = useState<TgLinkRow | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);

  useEffect(() => {
    if (loading || !session) return;
    if (!profile) return;
  }, [loading, session, profile]);

  useEffect(() => {
    if (!profile) return;
    void (async () => {
      const [{ data: sched }, { data: link }, { data: postData }] = await Promise.all([
        supabase
          .from("schedule")
          .select("frequency,delivery_times,active")
          .eq("profile_id", profile.id)
          .maybeSingle<{ frequency: PostFrequency; delivery_times: string[]; active: boolean }>(),
        supabase.from("tg_link").select("*").eq("profile_id", profile.id).maybeSingle<TgLinkRow>(),
        supabase.from("post").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(10),
      ]);
      if (sched) setSchedule(sched);
      if (link) setTg(link as TgLinkRow);
      if (postData) setPosts(postData as PostRow[]);
    })();
  }, [profile]);

  if (loading || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center font-code text-xs text-[#d4af37] tracking-[0.25em] uppercase">
        <span className="inline-block w-2.5 h-2.5 bg-[#d4af37] shadow-[0_0_12px_#d4af37] mr-3 animate-ping" />
        LOADING BENCH...
      </main>
    );
  }

  const tierLabel = (profile?.tier ?? "boost").toUpperCase();
  const nextHour = schedule?.delivery_times?.[0] ?? "08:00";

  // Demo fallback rows matching Stitch if no posts generated yet
  const displayRows =
    posts.length > 0
      ? posts.map((p, idx) => ({
          id: p.id,
          day: `DAY ${String(42 - idx).padStart(2, "0")} · ${nextHour}`,
          title: p.caption?.slice(0, 32) || `Atelier Piece ${idx + 1}`,
          status: p.status === "published" ? "PUBLISHED" : p.status === "approved" ? "APPROVED" : "AWAITING TAP",
          ig: `IG #${String(9920 + idx)}`,
        }))
      : [
          {
            id: "1",
            day: `DAY 42 · ${nextHour}`,
            title: "Chiaroscuro Watchcase",
            status: "APPROVED",
            ig: "IG #9921",
          },
          {
            id: "2",
            day: `DAY 41 · ${nextHour}`,
            title: "Silk Texture Study",
            status: "PUBLISHED",
            ig: "IG #9920",
          },
          {
            id: "3",
            day: `DAY 40 · ${nextHour}`,
            title: "Flacon Nocturne",
            status: "AWAITING TAP",
            ig: "Pending",
          },
        ];

  return (
    <div className="bg-[#0b0b0d] font-body text-white antialiased min-h-screen flex flex-col justify-between overflow-x-hidden relative z-10">
      {/* Persistent Left Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#08080a]/90 backdrop-blur-xl border-r border-[#d4af37]/20 z-50 flex flex-col justify-between pt-6 pb-6">
        <div className="flex flex-col gap-8">
          <div className="px-6 flex items-center gap-3">
            <span className="font-display font-[900] text-lg tracking-[0.2em] text-white">
              BREEZEPOST
            </span>
            <span className="px-1.5 py-0.5 bg-[#d4af37] text-[#0b0b0d] text-[9px] font-extrabold tracking-[0.15em] font-code">
              THE ATELIER
            </span>
          </div>
          <nav className="flex flex-col gap-1 px-3 font-code">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 bg-[#d4af37] text-[#0b0b0d] font-bold text-xs tracking-[0.18em] uppercase shadow-[0_0_15px_rgba(212,175,55,0.35)]"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              VI. THE BENCH
            </Link>
            <Link
              href="/onboarding/themes"
              className="flex items-center gap-3 px-3 py-2.5 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors font-bold text-xs tracking-[0.18em] uppercase"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              CURATION MATRIX
            </Link>
            <Link
              href="/onboarding/identity"
              className="flex items-center gap-3 px-3 py-2.5 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors font-bold text-xs tracking-[0.18em] uppercase"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              CHRONICLE
            </Link>
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2.5 text-neutral-400 hover:text-white hover:bg-white/5 transition-colors font-bold text-xs tracking-[0.18em] uppercase"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              BACK TO ATELIER
            </Link>
          </nav>
        </div>
        <div className="px-6 font-code text-[11px] text-neutral-500 border-t border-[#d4af37]/20 pt-4 flex flex-col gap-1">
          <span className="text-[#d4af37] font-bold tracking-widest uppercase">
            BENCH v2.4
          </span>
          <span className="tracking-widest">
            {tg?.linked_at ? "TELEGRAM LINKED" : "SYNCHRONIZED"}
          </span>
        </div>
      </aside>

      {/* Content Container with pl-64 layout */}
      <div className="pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="fixed top-0 left-64 right-0 h-20 bg-[#08080a]/85 backdrop-blur-xl border-b border-[#d4af37]/25 z-40 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <span className="font-display font-[900] text-sm tracking-[0.25em] text-white uppercase">
              VI. THE BENCH
            </span>
          </div>
          <div className="flex items-center gap-6 font-code">
            <span className="text-[11px] text-[#d4af37] tracking-[0.25em] font-bold uppercase hidden md:inline">
              {tierLabel} TIER · NEXT DISPATCH {nextHour} CET
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-bold text-xs tracking-[0.2em] uppercase transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)]"
            >
              <span>ATELIER</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </Link>
          </div>
        </header>

        {/* Main Section */}
        <main className="relative pt-20 flex-1 w-full px-8 lg:px-12 flex flex-col justify-between">
          <div className="w-full max-w-6xl mx-auto py-12 flex flex-col justify-between flex-1">
            {/* Monumental Luxury Title */}
            <div className="pt-6 pb-12">
              <span className="font-code text-[11px] text-[#d4af37] tracking-[0.3em] font-bold uppercase block mb-3">
                AUTONOMOUS DISPATCH
              </span>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-[900] tracking-[-0.02em] text-white uppercase leading-none">
                VI. THE BENCH <span className="text-[#d4af37]">/</span> EDITORIAL PIPELINE
              </h1>
            </div>

            {/* Ledger Queue Rows */}
            <div className="w-full flex flex-col divide-y divide-[#d4af37]/20 border-y border-[#d4af37]/25">
              {displayRows.map((row) => (
                <div
                  key={row.id}
                  className="group py-6 flex items-center justify-between hover:bg-white/[0.02] px-4 transition-colors"
                >
                  <div className="flex items-baseline gap-10 min-w-0">
                    <span className="font-code text-xs text-neutral-400 tracking-widest shrink-0 uppercase">
                      {row.day}
                    </span>
                    <span className="font-heading font-extrabold text-2xl text-white tracking-wide truncate">
                      {row.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-8 shrink-0 font-code">
                    {row.status === "APPROVED" && (
                      <span className="px-3.5 py-1 font-bold text-xs bg-[#d4af37] text-[#0b0b0d] tracking-[0.2em] shadow-[0_0_12px_rgba(212,175,55,0.4)] uppercase">
                        APPROVED
                      </span>
                    )}
                    {row.status === "PUBLISHED" && (
                      <span className="px-3.5 py-1 font-bold text-xs bg-white text-black tracking-[0.2em] uppercase">
                        PUBLISHED
                      </span>
                    )}
                    {row.status === "AWAITING TAP" && (
                      <span className="px-3.5 py-1 font-bold text-xs border border-[#d4af37] text-[#d4af37] tracking-[0.2em] uppercase">
                        AWAITING TAP
                      </span>
                    )}
                    <span className="text-xs text-neutral-400 tracking-wider w-20 text-right">
                      {row.ig}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Ledger Footer Indicator */}
            <div className="pt-8 pb-4 flex justify-between items-center font-code text-xs text-neutral-500 uppercase tracking-widest">
              <span>PORTFOLIO ARCHIVE // {String(displayRows.length).padStart(2, "0")} ENTRIES</span>
              <span className="text-[#d4af37]">LIVE DISPATCH READY</span>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full bg-[#08080a]/90 backdrop-blur-md border-t border-[#d4af37]/20 py-4 px-8 flex items-center justify-between font-code text-xs tracking-wider text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="text-white">BREEZEPOST ATELIER © MMXXIV</span>
            <span className="text-[#d4af37]">/</span>
            <span>HAUTE AUTOMATION</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d4af37] shadow-[0_0_8px_#d4af37]" />
            <span className="text-[#d4af37]">CURATION RUNNING · 08:00 CET</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
