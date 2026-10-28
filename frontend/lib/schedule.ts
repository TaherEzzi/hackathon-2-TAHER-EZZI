import type { PlanTier, PostFrequency } from "@/lib/types";

/* ── Tier gates (D6/D7 demo pricing — no Stripe, tiers flip a DB flag) ── */

export interface TierDef {
  value: PlanTier;
  name: string;
  cadence: string;
  alterations: string;
  note: string;
  frequencies: PostFrequency[];
}

export const TIERS: TierDef[] = [
  {
    value: "streak",
    name: "Streak",
    cadence: "1 post a week",
    alterations: "2 alterations per post",
    note: "A steady hand. One composition each week, held to a rhythm.",
    frequencies: ["weekly"],
  },
  {
    value: "boost",
    name: "Boost",
    cadence: "1 post a day",
    alterations: "4 alterations per post",
    note: "The house favorite — a daily piece, composed while you sleep.",
    frequencies: ["weekly", "thrice_weekly", "daily"],
  },
  {
    value: "surge",
    name: "Surge",
    cadence: "5 posts a day",
    alterations: "6 alterations per post",
    note: "Full bench capacity. A feed that never sits still.",
    frequencies: ["weekly", "thrice_weekly", "daily", "twice_daily", "five_daily"],
  },
];

export const TIER_BY_VALUE = Object.fromEntries(TIERS.map((t) => [t.value, t])) as Record<
  PlanTier,
  TierDef
>;

/** Zig-zag "Most chosen" highlight lands on Boost, per the pricing pick. */
export const HIGHLIGHTED_TIER: PlanTier = "boost";

export interface FrequencyDef {
  value: PostFrequency;
  label: string;
  note: string;
}

export const FREQUENCIES: FrequencyDef[] = [
  { value: "weekly", label: "Weekly", note: "One piece, every week" },
  { value: "thrice_weekly", label: "3 × week", note: "Monday · Wednesday · Saturday rhythm" },
  { value: "daily", label: "Daily", note: "A fresh composition each day" },
  { value: "twice_daily", label: "2 × day", note: "Morning and evening deliveries" },
  { value: "five_daily", label: "5 × day", note: "The full bench, sunrise to evening" },
];

export const DELIVERY_TIMES = ["09:00", "12:00", "15:00", "18:00", "21:00"] as const;

export function tierAllowsFrequency(tier: PlanTier | null, frequency: PostFrequency): boolean {
  if (!tier) return frequency === "weekly";
  const def = TIER_BY_VALUE[tier];
  return def ? def.frequencies.includes(frequency) : false;
}

/** Posts per day represented by a cadence, for copy like "≈ 2/week". */
export function frequencyRate(frequency: PostFrequency): string {
  switch (frequency) {
    case "weekly":
      return "1 / week";
    case "thrice_weekly":
      return "3 / week";
    case "daily":
      return "1 / day";
    case "twice_daily":
      return "2 / day";
    case "five_daily":
      return "5 / day";
  }
}

/**
 * Next slot, estimated on the client from cadence + delivery times.
 * Honest note rendered next to it: the backend scheduler holds the exact hour;
 * thin cadences are approximated from the profile's creation weekday.
 */
export function nextSlotEstimate(
  frequency: PostFrequency,
  deliveryTimes: string[],
  from: Date = new Date(),
  anchorWeekday: number = from.getDay(),
): Date | null {
  if (deliveryTimes.length === 0) return null;
  const [hour, minute] = deliveryTimes[0].split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const candidate = new Date(from);
  candidate.setSeconds(0, 0);

  const jumpDaysFor = (f: PostFrequency): number => {
    switch (f) {
      case "weekly":
        return ((anchorWeekday + 7 - from.getDay()) % 7) || 7;
      case "thrice_weekly":
        return 3; // every-other-day rhythm is close enough for a preview
      case "daily":
      case "twice_daily":
      case "five_daily":
        return from.getHours() * 60 + from.getMinutes() >= hour * 60 + minute ? 1 : 0;
    }
  };

  candidate.setDate(candidate.getDate() + jumpDaysFor(frequency));
  candidate.setHours(hour, minute, 0, 0);
  return candidate;
}

/** "Wed 28 · 12:00 — engraved locally, the scheduler holds the exact hour." */
export function formatSlot(date: Date): string {
  const day = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${day} · ${time}`;
}

export const STATUS_LABEL: Record<string, string> = {
  awaiting_review: "Awaiting review",
  approved: "Approved",
  published: "Published",
  skipped: "Skipped",
  failed: "Failed",
};
