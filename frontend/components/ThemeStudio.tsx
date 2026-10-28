"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ThemePresetRow, ThemeSelectionRow, UserCategory } from "@/lib/types";
import { FALLBACK_PRESETS } from "@/lib/theme-data";
import { supabase } from "@/lib/supabase";
import { useOnboarding } from "@/components/onboarding-context";

const MAX_PICKS = 5;

/** Public CDN URL for a stored `generated-posts` object (preview_path form:
 *  `theme-previews/JW-01.png`). These are the 90 real generated previews. */
function previewUrl(previewPath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/generated-posts/${previewPath}`;
}

export function ThemeStudio() {
  const { profile, patchProfile } = useOnboarding();
  const router = useRouter();
  const [presets, setPresets] = useState<ThemePresetRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const category: UserCategory = profile.category ?? "jewelry";

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("theme_preset")
        .select("id,category,name,description,preview_path")
        .eq("category", category)
        .order("id");

      if (active) {
        let list: ThemePresetRow[] = [];
        if (error || !data || data.length === 0) {
          list = FALLBACK_PRESETS.filter((p) => p.category === category);
        } else {
          list = data as ThemePresetRow[];
        }
        setPresets(list);

        // Fetch user's existing selections
        const { data: sel } = await supabase
          .from("theme_selection")
          .select("preset_id")
          .eq("profile_id", profile.id)
          .order("sort");

        if (sel && sel.length > 0) {
          // Keep only selections that belong to THIS category's presets —
          // rows saved under a different category would otherwise show as
          // phantom "selected" counts with no matching tile.
          const catIds = new Set(list.map((p) => p.id));
          const mine = sel.map((s) => s.preset_id).filter((id) => catIds.has(id));
          setSelectedIds(mine.length > 0 ? mine : list.slice(0, 3).map((p) => p.id));
        } else if (list.length > 0) {
          // Default select top 3
          setSelectedIds(list.slice(0, 3).map((p) => p.id));
        }
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [category, profile.id]);

  const togglePreset = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      if (selectedIds.length >= MAX_PICKS) return;
      setSelectedIds([...selectedIds, id]);
    }
  };

  const confirmSelection = async () => {
    if (selectedIds.length === 0) {
      setProblem("Select at least 1 aesthetic direction to establish the maison rotation.");
      return;
    }
    setBusy(true);
    setProblem(null);

    try {
      // Replace only this category's selections — selections saved under
      // other categories must survive.
      await supabase
        .from("theme_selection")
        .delete()
        .eq("profile_id", profile.id)
        .in("preset_id", presets.map((p) => p.id));

      const rows = selectedIds.map((preset_id, idx) => ({
        profile_id: profile.id,
        preset_id,
        sort: idx + 1,
      }));
      await supabase.from("theme_selection").insert(rows);

      await patchProfile({
        onboarding_step: Math.max(profile.onboarding_step ?? 0, 4),
      });

      router.push("/onboarding/assets");
    } catch (err: any) {
      setProblem(err?.message || "Failed to persist themes");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center font-code text-xs text-[#d4af37] tracking-[0.25em] uppercase">
        <span className="inline-block w-2.5 h-2.5 bg-[#d4af37] shadow-[0_0_12px_#d4af37] mr-3 animate-ping" />
        CURATING VAULT...
      </div>
    );
  }

  return (
    <div className="w-full px-6 lg:px-12 py-10 max-w-7xl mx-auto flex flex-col justify-between flex-1">
      {/* Monumental Typography Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <span className="text-xs text-[#d4af37] tracking-[0.3em] font-bold uppercase block mb-1 font-code">
            III. THE THEMES
          </span>
          <h1 className="text-3xl sm:text-5xl text-white font-[900] tracking-[-0.01em] uppercase font-display">
            POST STYLES
          </h1>
        </div>
        <p className="text-xs text-neutral-400 tracking-[0.25em] uppercase font-bold font-code">
          Choose up to 5 styles for your post rotation.
        </p>
      </div>

      {problem && (
        <div className="mb-6 font-code text-xs text-red-300 bg-red-950/40 border border-red-500/30 p-3">
          {problem}
        </div>
      )}

      {/* Luxury Visual Tiles Grid with Gold Hairline Borders */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8 mb-10">
        {presets.map((preset, idx) => {
          const isSelected = selectedIds.includes(preset.id);
          const num = String(idx + 1).padStart(2, "0");
          const imgSrc = preset.preview_path ? previewUrl(preset.preview_path) : null;

          return (
            <div
              key={preset.id}
              onClick={() => togglePreset(preset.id)}
              className={`group relative aspect-square bg-[#08080a] cursor-pointer overflow-hidden transition-all duration-300 ${
                isSelected
                  ? "border-2 border-[#d4af37] shadow-[0_0_25px_rgba(212,175,55,0.25)] -translate-y-1"
                  : "border border-[#d4af37]/30 hover:border-[#d4af37]/70"
              }`}
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={preset.name}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isSelected ? "opacity-85 group-hover:opacity-100" : "opacity-50 group-hover:opacity-85"
                  }`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-code text-[10px] text-[#d4af37]/40 tracking-widest uppercase">
                  NO PREVIEW
                </div>
              )}

              <div
                className={`absolute top-3 left-3 text-xs font-bold tracking-widest font-code ${
                  isSelected ? "text-[#d4af37]" : "text-[#d4af37]/70"
                }`}
              >
                {num}
              </div>

              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <span className="block font-heading font-extrabold text-white text-sm sm:text-base tracking-wide truncate">
                  {preset.name}
                </span>
                <span className="block font-code text-[10px] text-neutral-400 tracking-wider truncate mt-0.5">
                  {preset.description}
                </span>
              </div>

              {isSelected && (
                <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-[#d4af37] text-[#0b0b0d] shadow-[0_0_10px_#d4af37]">
                  <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Docked Bottom Tray */}
      <div className="w-full bg-[#08080a]/90 backdrop-blur-md border border-[#d4af37]/25 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 font-code">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-[#d4af37] shadow-[0_0_8px_#d4af37]" />
          <span className="text-xs font-bold tracking-[0.25em] text-white">
            {selectedIds.length} / {MAX_PICKS} SELECTED
          </span>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={confirmSelection}
          className="w-full sm:w-auto px-8 py-3.5 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-bold text-xs tracking-[0.25em] uppercase flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all cursor-pointer disabled:opacity-50"
        >
          <span>{busy ? "PERSISTING..." : "CONFIRM SELECTION"}</span>
          <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
