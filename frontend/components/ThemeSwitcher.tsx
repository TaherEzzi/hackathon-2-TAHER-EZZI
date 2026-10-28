"use client";

import { useAtelierTheme } from "@/components/providers";
import { THEMES } from "@/components/providers";

export function ThemeSwitcher() {
  const { theme, setTheme } = useAtelierTheme();
  return (
    <label className="relative inline-flex items-center gap-2">
      <span className="eyebrow hidden sm:inline" id="theme-switcher-label">
        Setting
      </span>
      <select
        aria-labelledby="theme-switcher-label"
        aria-label="Atelier setting (color theme)"
        className="field cursor-pointer appearance-none pr-8 py-2 text-[0.82rem] font-medium"
        style={{ width: "auto", minWidth: "10.5rem" }}
        value={theme}
        onChange={(e) => setTheme(e.target.value as typeof theme)}
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id} style={{ background: "var(--surface)", color: "var(--ink)" }}>
            {t.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointerr-events-none pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.6rem]"
        style={{ color: "var(--accent2)" }}
      >
        ▾
      </span>
    </label>
  );
}
