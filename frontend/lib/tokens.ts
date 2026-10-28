import type { ThemeId } from "@/components/providers";

/**
 * The five accent tokens, mirrored from the [data-theme] blocks in globals.css.
 * This lives in lib (data), never hardcoded in a component — the Gem Podium
 * uses it to tint one ring-gem per setting, while the *live* theme's gem is
 * always tinted from the real-time CSS var so the podium visibly re-tints on
 * every setting switch.
 */
export const THEME_ACCENTS: Map<ThemeId, string> = new Map([
  ["aubergine", "#E8A33D"],
  ["gilded-oak", "#C9A227"],
  ["stone-crimson", "#C22D35"],
  ["teal-verse", "#2BD9C8"],
  ["moonlit", "#E5342E"],
]);

export const ALL_THEME_IDS = Array.from(THEME_ACCENTS.keys()) as ThemeId[];
