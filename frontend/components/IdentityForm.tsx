"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserCategory } from "@/lib/types";
import { useOnboarding } from "@/components/onboarding-context";

interface CraftOption {
  id: UserCategory;
  name: string;
  /** Representative generated preview stored in `generated-posts`. */
  preview: string;
}

const CRAFTS: CraftOption[] = [
  { id: "watches", name: "WATCHES", preview: "theme-previews/WT-02.jpg" },
  { id: "tshirts", name: "COUTURE", preview: "theme-previews/TS-02.jpg" },
  { id: "beverages", name: "SPIRITS", preview: "theme-previews/BV-02.jpg" },
  { id: "jewelry", name: "JEWELRY", preview: "theme-previews/JW-01.png" },
  { id: "handbags", name: "LEATHER", preview: "theme-previews/HB-02.jpg" },
  { id: "wallets", name: "WALLETS", preview: "theme-previews/WA-02.jpg" },
];

/** Public CDN URL for a `generated-posts` storage object. */
function previewUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/generated-posts/${path}`;
}

export function IdentityForm() {
  const { profile, patchProfile } = useOnboarding();
  const router = useRouter();

  const [brandName, setBrandName] = useState(profile.brand_name ?? "");
  const [category, setCategory] = useState<UserCategory>(profile.category ?? "jewelry");
  const [dna, setDna] = useState(profile.design_dna_md ?? "Old-world quiet luxury, chiaroscuro lighting, deep shadow play");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const saveIdentity = async () => {
    setProblem(null);
    if (!brandName.trim()) {
      return setProblem("The atelier signs every piece — enter a maison name.");
    }
    if (!category) {
      return setProblem("Select a craft domain to seed the aesthetics archive.");
    }
    setBusy(true);

    try {
      const row = await patchProfile({
        brand_name: brandName.trim(),
        category,
        design_dna_md: dna.trim(),
        onboarding_step: Math.max(profile.onboarding_step ?? 0, 3),
      });

      if (!row) {
        setProblem("The ledger did not save. Check authentication and retry.");
        return;
      }

      router.push("/onboarding/themes");
    } catch (err: any) {
      setProblem(err?.message || "Failed to save identity");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full px-6 lg:px-12 py-10 lg:py-14 flex flex-col justify-between min-h-[calc(100vh-10rem)] max-w-5xl mx-auto">
      {/* Title Header */}
      <div className="text-center pt-2 pb-6">
        <span className="font-code text-xs font-bold text-[#d4af37] tracking-[0.35em] uppercase block mb-2">
          II. THE IDENTITY
        </span>
        <h1 className="text-lg sm:text-xl text-white font-[800] tracking-[0.08em] uppercase font-display">
          BRAND IDENTITY
        </h1>
      </div>

      {/* Form elements — full width so the category medallions get big */}
      <div className="w-full space-y-9 my-auto">
        {/* Brand name input */}
        <div className="max-w-2xl mx-auto w-full">
          <label
            htmlFor="maison-input"
            className="block font-code text-[11px] font-bold text-neutral-400 tracking-[0.25em] uppercase mb-2"
          >
            BRAND NAME
          </label>
          <input
            id="maison-input"
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. Velvet Ember — your brand as it appears on Instagram"
            className="w-full bg-transparent border-0 border-b border-[#d4af37]/50 pb-2 text-2xl sm:text-3xl text-white font-display uppercase tracking-wider placeholder:text-neutral-600 placeholder:font-body placeholder:text-base placeholder:normal-case focus:outline-none focus:border-[#f2ca50] focus:ring-0 transition-colors"
          />
          <p className="mt-2 font-code text-[10px] text-neutral-500 tracking-[0.15em] uppercase">
            This name is used in your post captions and your brand profile.
          </p>
        </div>

        {/* PRODUCT CATEGORY — photo medallions */}
        <div className="max-w-2xl mx-auto w-full">
          <span className="block font-code text-[11px] font-bold text-neutral-400 tracking-[0.25em] uppercase mb-4">
            PRODUCT CATEGORY
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {CRAFTS.map((craft) => {
              const isSelected = category === craft.id;
              return (
                <button
                  key={craft.id}
                  type="button"
                  onClick={() => setCategory(craft.id)}
                  className="group flex flex-col items-center gap-3 cursor-pointer"
                  aria-pressed={isSelected}
                >
                  <span className="relative block w-full">
                    <span
                      className={`block aspect-square w-full rounded-full overflow-hidden transition-all duration-300 ${
                        isSelected
                          ? "border-2 border-[#d4af37] shadow-[0_0_28px_rgba(212,175,55,0.5)] scale-[1.02]"
                          : "border border-[#d4af37]/40 group-hover:border-[#d4af37] group-hover:scale-[1.03]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl(craft.preview)}
                        alt={craft.name}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${
                          isSelected ? "opacity-100" : "opacity-60 group-hover:opacity-90"
                        }`}
                      />
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 z-10 w-9 h-9 flex items-center justify-center bg-[#d4af37] text-[#0b0b0d] rounded-full shadow-[0_0_12px_rgba(212,175,55,0.6)]">
                        <span className="material-symbols-outlined text-[20px] font-bold">check</span>
                      </span>
                    )}
                  </span>
                  <span
                    className={`font-code text-xs font-extrabold tracking-[0.2em] transition-colors ${
                      isSelected ? "text-[#d4af37]" : "text-neutral-300 group-hover:text-white"
                    }`}
                  >
                    {craft.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* DESIGN KEYWORDS input */}
        <div className="max-w-2xl mx-auto w-full">
          <label
            htmlFor="keywords-input"
            className="block font-code text-[11px] font-bold text-neutral-400 tracking-[0.25em] uppercase mb-2"
          >
            DESIGN KEYWORDS
          </label>
          <input
            id="keywords-input"
            type="text"
            value={dna}
            onChange={(e) => setDna(e.target.value)}
            placeholder="e.g. warm minimal, soft daylight"
            className="w-full bg-transparent border-0 border-b border-[#d4af37]/50 pb-2 text-base sm:text-lg text-neutral-200 font-body tracking-wider placeholder:text-neutral-600 focus:outline-none focus:border-[#f2ca50] focus:ring-0"
          />
        </div>

        {problem && (
          <div className="bg-[#181216] border border-red-500/40 p-3 font-code text-xs text-red-300">
            {problem}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="pt-8 flex flex-col sm:flex-row items-center justify-end gap-4 border-t border-[#d4af37]/20">
        <button
          type="button"
          disabled={busy}
          onClick={saveIdentity}
          className="w-full sm:w-auto px-10 py-4 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-code font-[800] text-xs tracking-[0.25em] uppercase transition-all shadow-[0_0_25px_rgba(212,175,55,0.4)] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
        >
          <span>{busy ? "SAVING..." : "SAVE & CONTINUE"}</span>
          <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
