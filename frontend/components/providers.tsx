"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

export type ThemeId = "aubergine" | "gilded-oak" | "stone-crimson" | "teal-verse" | "moonlit";

export interface ThemeDef {
  id: ThemeId;
  label: string;
}

export const THEMES: ThemeDef[] = [
  { id: "aubergine", label: "Aubergine Court" },
  { id: "gilded-oak", label: "Gilded Oak" },
  { id: "stone-crimson", label: "Stone & Crimson" },
  { id: "teal-verse", label: "Teal Verse" },
  { id: "moonlit", label: "Moonlit Signal" },
];

const STORAGE_KEY = "breezepost-theme";
const VALID: ThemeId[] = THEMES.map((t) => t.id);

/** Theme colors resolved live from the CSS custom properties — nothing
 * hardcoded at runtime. The hex literals below are ONLY the first-paint
 * fallback mirrors of the Aubergine Court tokens in globals.css (SSR
 * safety); useAtelierTheme() always serves the live computed values, so the
 * 3D podium re-tints the instant a theme flips. */
export interface AtelierColors {
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  accent2: string;
  line: string;
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  colors: AtelierColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readTheme = (): ThemeId => {
  if (typeof document === "undefined") return "aubergine";
  const attr = document.documentElement.dataset.theme as ThemeId | undefined;
  return attr && VALID.includes(attr) ? attr : "aubergine";
};

function resolveColors(): AtelierColors {
  const css = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: pick("--bg", "#241431"),
    surface: pick("--surface", "#2E1A3E"),
    ink: pick("--ink", "#F3EEE4"),
    accent: pick("--accent", "#E8A33D"),
    accent2: pick("--accent2", "#C9C9D1"),
    line: pick("--line", "rgba(232,163,61,.25)"),
  };
}

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("aubergine");
  const [colors, setColors] = useState<AtelierColors>({
    bg: "#241431",
    surface: "#2E1A3E",
    ink: "#F3EEE4",
    accent: "#E8A33D",
    accent2: "#C9C9D1",
    line: "rgba(232,163,61,.25)",
  });

  useEffect(() => {
    const initial = readTheme();
    setThemeState(initial);
    setColors(resolveColors());
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode — theme simply won't persist */
    }
    document.documentElement.dataset.theme = t; // re-apply before measure
    requestAnimationFrame(() => setColors(resolveColors()));
  }, []);

  const value = useMemo(() => ({ theme, setTheme, colors }), [theme, setTheme, colors]);

  return (
    <ThemeContext.Provider value={value}>
      {/* reducedMotion="user": transforms/parallax auto-off, opacity kept */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeContext.Provider>
  );
}

export function useAtelierTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAtelierTheme must be used inside <Providers>");
  return ctx;
}
