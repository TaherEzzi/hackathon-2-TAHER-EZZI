"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PostFrequency, ProfileRow } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import {
  DELIVERY_TIMES,
  HIGHLIGHTED_TIER,
  TIERS,
} from "@/lib/schedule";

interface PlanStageProps {
  profile: ProfileRow;
  patchProfile: (patch: Partial<ProfileRow>) => Promise<ProfileRow | null>;
}

export function PlanStage({ profile, patchProfile }: PlanStageProps) {
  const router = useRouter();
  const [tierLocally, setTierLocally] = useState<"streak" | "boost" | "surge">(
    (profile.tier as "streak" | "boost" | "surge") || "boost"
  );
  const [schedule, setSchedule] = useState<{
    frequency: PostFrequency | null;
    delivery_times: string[];
    active: boolean;
  }>({
    frequency: "daily",
    delivery_times: ["09:00"],
    active: true,
  });
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile.tier) setTierLocally(profile.tier as "streak" | "boost" | "surge");
  }, [profile.tier]);

  useEffect(() => {
    let active = true;
    supabase
      .from("schedule")
      .select("frequency,delivery_times,active")
      .eq("profile_id", profile.id)
      .maybeSingle<{ frequency: PostFrequency; delivery_times: string[]; active: boolean }>()
      .then(({ data }) => {
        if (active && data) {
          setSchedule({
            frequency: data.frequency,
            delivery_times: data.delivery_times.length ? data.delivery_times : ["09:00"],
            active: data.active,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [profile.id]);

  const chooseTier = (t: "streak" | "boost" | "surge") => {
    setTierLocally(t);
  };

  const toggleDeliveryTime = (time: string) => {
    setSchedule((prev) => {
      const exists = prev.delivery_times.includes(time);
      const next = exists
        ? prev.delivery_times.filter((t) => t !== time)
        : [...prev.delivery_times, time].sort();
      return { ...prev, delivery_times: next.length ? next : [time] };
    });
  };

  const confirmTier = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const frequency: PostFrequency =
        tierLocally === "streak" ? "weekly" : "daily";
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await supabase.from("schedule").upsert({
        profile_id: profile.id,
        frequency,
        delivery_times: schedule.delivery_times,
        active: true,
      });

      await patchProfile({
        tier: tierLocally,
        timezone,
        onboarding_step: Math.max(profile.onboarding_step ?? 0, 2),
      });

      router.push("/onboarding/identity");
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to confirm tier");
    } finally {
      setBusy(false);
    }
  };

  const tierCards = [
    {
      id: "streak" as const,
      num: "01",
      name: "STREAK",
      price: "$490",
      cadence: "1 post/week",
      revisions: "2 revisions",
      tierLabel: "TIER I",
    },
    {
      id: "boost" as const,
      num: "02",
      name: "BOOST",
      price: "$890",
      cadence: "3 posts/week",
      revisions: "4 revisions",
      badge: "CURATOR'S CHOICE",
      tierLabel: "TIER II",
    },
    {
      id: "surge" as const,
      num: "03",
      name: "SURGE",
      price: "$1,490",
      cadence: "Daily post",
      revisions: "Unlimited revisions",
      tierLabel: "TIER III",
    },
  ];

  return (
    <div className="w-full flex flex-col items-center">
      {/* Monumental Headline */}
      <div className="text-center mb-10">
        <span className="text-[11px] text-[#d4af37] tracking-[0.3em] font-bold uppercase font-code block mb-2">
          I. THE PLAN
        </span>
        <h1 className="text-4xl sm:text-6xl lg:text-[72px] text-white font-[900] tracking-tight uppercase font-display">
          CHOOSE YOUR{" "}
          <span className="text-[#d4af37] drop-shadow-[0_0_35px_rgba(212,175,55,0.45)]">
            PLAN
          </span>
        </h1>
      </div>

      {/* Luxury Vertical Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-10">
        {tierCards.map((card) => {
          const isSelected = tierLocally === card.id;
          return (
            <div
              key={card.id}
              onClick={() => chooseTier(card.id)}
              className={`backdrop-blur-md p-8 transition-all duration-300 flex flex-col justify-between cursor-pointer relative ${
                isSelected
                  ? "bg-[#121216]/95 border-2 border-[#d4af37] shadow-[0_0_30px_rgba(212,175,55,0.25)] -translate-y-1"
                  : "bg-[#0e0e11]/85 border border-[#d4af37]/25 hover:border-[#d4af37]/60"
              }`}
            >
              {card.badge && (
                <div className="absolute -top-3 right-6 bg-[#d4af37] text-[#0b0b0d] px-3 py-0.5 text-[9px] font-extrabold uppercase font-code tracking-[0.2em] shadow-[0_0_12px_rgba(212,175,55,0.5)]">
                  {card.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between font-code mb-6">
                  <span
                    className={`text-xs tracking-[0.25em] font-bold uppercase ${
                      isSelected ? "text-[#d4af37]" : "text-neutral-400"
                    }`}
                  >
                    {card.name}
                  </span>
                  <span
                    className={`text-[11px] font-bold ${
                      isSelected ? "text-[#d4af37]" : "text-neutral-500"
                    }`}
                  >
                    {card.num}
                  </span>
                </div>

                <div
                  className={`text-4xl lg:text-5xl font-[900] font-display mb-6 tracking-tight ${
                    isSelected
                      ? "text-[#d4af37] drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                      : "text-white"
                  }`}
                >
                  {card.price}
                  <span
                    className={`text-xs font-code font-normal ml-1 ${
                      isSelected ? "text-[#d4af37]/70" : "text-neutral-400"
                    }`}
                  >
                    /MO
                  </span>
                </div>

                <div className="space-y-2 font-code text-xs tracking-wider uppercase">
                  <div className={isSelected ? "font-bold text-[#d4af37]" : "text-white"}>
                    {card.cadence}
                  </div>
                  <div className="text-neutral-400">{card.revisions}</div>
                </div>
              </div>

              <div
                className={`pt-8 border-t mt-8 flex justify-between items-center font-code text-[11px] ${
                  isSelected
                    ? "border-[#d4af37]/30 text-[#d4af37] font-bold"
                    : "border-white/5 text-neutral-500"
                }`}
              >
                <span>{isSelected ? "ACTIVE SELECTION" : card.tierLabel}</span>
                <span
                  className={
                    isSelected
                      ? "w-2 h-2 bg-[#d4af37] shadow-[0_0_8px_#d4af37]"
                      : "w-1.5 h-1.5 bg-neutral-600"
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery Hour Selection */}
      <div className="w-full max-w-xl bg-[#0e0e11]/85 border border-[#d4af37]/20 p-6 mb-10">
        <span className="block font-code text-[11px] font-bold text-neutral-400 tracking-[0.25em] uppercase mb-4 text-center">
          DELIVERY DISPATCH TIME (CET)
        </span>
        <div className="grid grid-cols-4 gap-2 font-code text-xs">
          {["07:00", "08:00", "09:00", "18:00"].map((t) => {
            const active = schedule.delivery_times.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleDeliveryTime(t)}
                className={`py-2 px-3 border transition-colors ${
                  active
                    ? "border-[#d4af37] bg-[#d4af37]/15 text-[#d4af37] font-bold shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                    : "border-[#d4af37]/20 text-neutral-400 hover:border-[#d4af37]/50"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 font-code text-xs text-red-300 bg-red-950/40 border border-red-500/30 p-3">
          {errorMsg}
        </div>
      )}

      {/* Action Confirmation Button */}
      <button
        type="button"
        disabled={busy}
        onClick={confirmTier}
        className="px-14 py-4 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-code font-[800] text-xs tracking-[0.3em] uppercase transition-all duration-300 shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:shadow-[0_0_45px_rgba(242,202,80,0.65)] inline-flex items-center gap-3 cursor-pointer disabled:opacity-50"
      >
        <span>{busy ? "ENGRAVING..." : "CONFIRM TIER"}</span>
        <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
      </button>
    </div>
  );
}
