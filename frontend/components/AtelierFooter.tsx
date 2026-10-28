"use client";

export function AtelierFooter() {
  return (
    <footer className="w-full bg-[#08080a]/90 backdrop-blur-md border-t border-[#d4af37]/20 py-5 z-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 font-code text-xs font-bold tracking-[0.18em] text-neutral-400">
        <div className="flex items-center gap-3">
          <span className="text-white">BREEZEPOST © 2026</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37]">Instagram posts, on your brand's clock</span>
        </div>
      </div>
    </footer>
  );
}
