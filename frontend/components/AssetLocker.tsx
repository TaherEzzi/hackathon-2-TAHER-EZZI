"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductRow } from "@/lib/types";
import { PRODUCT_IMAGES_BUCKET, supabase } from "@/lib/supabase";
import { useOnboarding } from "@/components/onboarding-context";

/**
 * Stage IV — Products (simple table). Each row = name, description, image.
 * "Add new product" appends an editable row with an upload icon; commit
 * uploads the photo to `{uid}/{uuid}.jpg` in `product-images` and inserts the
 * `products` row (`image_path` = full public URL). Rows can be removed.
 */

interface DraftRow {
  title: string;
  highlight: string;
  file: File | null;
  previewUrl: string | null;
}

const EMPTY_DRAFT: DraftRow = { title: "", highlight: "", file: null, previewUrl: null };

/** Rows seeded before the URL convention may hold a bare storage path. */
function normalizeImagePath(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${path}`;
}

export function AssetLocker() {
  const { profile, patchProfile } = useOnboarding();
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const draftFileInput = useRef<HTMLInputElement>(null);

  const list = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true });
    if (error) {
      setProblem(error.message);
    } else {
      setProducts((data ?? []) as ProductRow[]);
      setProblem(null);
    }
    setLoading(false);
  }, [profile.id]);

  useEffect(() => {
    void list();
  }, [list]);

  const addDraftRow = () => {
    if (draft) {
      setProblem("A new product is open — save it (✓) or discard (✕) before adding another.");
      return;
    }
    setDraft({ ...EMPTY_DRAFT });
    setProblem(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return setProblem("Give the product a name.");
    if (!draft.file) return setProblem("Upload the product image (the upload icon).");

    setBusy(true);
    setProblem(null);
    try {
      const ext = (draft.file.name.split(".").pop() ?? "jpg").toLowerCase();
      const name = /jpe?g/.test(ext) ? "jpg" : ext === "png" || ext === "webp" ? ext : "jpg";
      const path = `${profile.id}/${crypto.randomUUID()}.${name}`;
      const { error: upErr } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(path, draft.file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
      const { error: insErr } = await supabase.from("products").insert({
        profile_id: profile.id,
        title: draft.title.trim(),
        highlight: draft.highlight.trim() || null,
        price: null,
        image_path: pub.publicUrl,
        sort: products.length,
      });
      if (insErr) throw insErr;

      setDraft(null);
      await list();
      if ((profile.onboarding_step ?? 0) < 4) await patchProfile({ onboarding_step: 4 });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (p: ProductRow) => {
    setProblem(null);
    setBusy(true);
    // post.product_id is a plain FK (NO ACTION); detach history rows first or
    // Postgres rejects the delete. Posts keep their image and caption.
    const { error: detachError } = await supabase
      .from("post")
      .update({ product_id: null })
      .eq("product_id", p.id);
    if (detachError) {
      setBusy(false);
      return setProblem(detachError.message);
    }
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      setBusy(false);
      return setProblem(error.message);
    }
    // Only clear the file after the row is gone, so a failed delete never
    // leaves a row pointing at a missing image.
    try {
      const marker = `/object/public/${PRODUCT_IMAGES_BUCKET}/`;
      const idx = p.image_path?.indexOf(marker) ?? -1;
      if (idx >= 0) {
        await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([p.image_path!.slice(idx + marker.length)]);
      }
    } catch {
      /* the row is already gone; an orphaned file is harmless */
    }
    setBusy(false);
    await list();
  };

  const continueToConnect = async () => {
    const row = await patchProfile({
      onboarding_step: Math.max((profile.onboarding_step ?? 0) as number, 4),
    });
    if (row) router.push("/onboarding/connect");
  };

  const th = "px-4 py-3 text-left font-code text-[10px] font-bold tracking-[0.2em] uppercase text-[#d4af37] border-b border-[#d4af37]/30";
  const td = "px-4 py-3 align-middle border-b border-[#d4af37]/10";

  return (
    <div className="w-full px-6 lg:px-12 py-10 max-w-5xl mx-auto flex flex-col min-h-[calc(100dvh-9rem)]">
      {/* Header */}
      <div className="mb-8">
        <span className="font-code text-xs font-bold text-[#d4af37] tracking-[0.35em] uppercase block mb-2">
          IV. THE ASSETS
        </span>
        <h1 className="text-4xl sm:text-5xl text-white font-[900] tracking-[-0.01em] uppercase font-display">
          YOUR <span className="text-[#d4af37]">PRODUCTS</span>
        </h1>
        <p className="mt-2 font-code text-xs text-neutral-400 tracking-[0.2em] uppercase">
          Every post is composed from a product here.
        </p>
        <p className="mt-2 font-code text-[10px] text-neutral-500 tracking-[0.15em] uppercase leading-relaxed">
          One product per photo, centred on a plain background, at least 800px on the long edge, no
          faces, text overlays or watermarks. Famous trademarks are blocked by the image provider.
        </p>
      </div>

      {problem && (
        <div className="mb-4 font-code text-xs text-red-300 bg-red-950/40 border border-red-500/30 p-3">
          {problem}
        </div>
      )}

      {/* Hidden file input — shared by desktop table row and mobile card upload */}
      <input
        ref={draftFileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Product image file"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setDraft((d) => (d ? { ...d, file: f, previewUrl: f ? URL.createObjectURL(f) : null } : d));
        }}
      />

      {/* Product table (desktop) */}
      <div className="hidden md:block w-full bg-[#08080a]/80 border border-[#d4af37]/25 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} w-20`}>Image</th>
              <th className={th}>Name</th>
              <th className={th}>Description</th>
              <th className={`${th} w-12`} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {/* Editable draft row (created by "Add new product") */}
            {draft && (
              <tr className="bg-[#d4af37]/[0.06]">
                <td className={td}>
                  <button
                    type="button"
                    onClick={() => draftFileInput.current?.click()}
                    className={`w-14 h-14 flex items-center justify-center overflow-hidden text-[#d4af37] cursor-pointer transition-colors ${
                      draft.previewUrl
                        ? "border border-[#d4af37] hover:bg-[#d4af37]/10"
                        : "border border-dashed border-[#d4af37]/60 hover:bg-[#d4af37]/10"
                    }`}
                    aria-label={draft.previewUrl ? "Change product image" : "Upload product image"}
                    title={draft.previewUrl ? "Click to change the image" : "Click to choose an image"}
                  >
                    {draft.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.previewUrl} alt="Selected product preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex flex-col items-center">
                        <span className="material-symbols-outlined text-[18px]">upload</span>
                        <span className="font-code text-[7px] tracking-widest mt-0.5">UPLOAD</span>
                      </span>
                    )}
                  </button>
                </td>
                <td className={td}>
                  <input
                    autoFocus
                    className="w-full bg-transparent border-b border-[#d4af37]/40 pb-1 text-sm text-white focus:outline-none focus:border-[#f2ca50]"
                    placeholder="Product name"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                  />
                </td>
                <td className={td}>
                  <input
                    className="w-full bg-transparent border-b border-[#d4af37]/40 pb-1 text-sm text-neutral-200 focus:outline-none focus:border-[#f2ca50]"
                    placeholder="Short description"
                    value={draft.highlight}
                    onChange={(e) => setDraft((d) => (d ? { ...d, highlight: e.target.value } : d))}
                  />
                </td>
                <td className={td}>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveDraft()}
                      className="p-1.5 text-[#d4af37] hover:bg-[#d4af37]/10 cursor-pointer disabled:opacity-40"
                      aria-label={busy ? "Saving product" : "Save product"}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {busy ? "progress_activity" : "check"}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDraft(null)}
                      className="p-1.5 text-neutral-400 hover:bg-white/5 cursor-pointer disabled:opacity-40"
                      aria-label="Discard new product"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-14 text-center font-code text-xs text-[#d4af37] tracking-[0.25em] uppercase">
                  Loading products...
                </td>
              </tr>
            ) : products.length === 0 && !draft ? (
              <tr>
                <td colSpan={4} className="px-4 py-14 text-center font-code text-xs text-neutral-400 tracking-[0.2em] uppercase">
                  No products yet — add your first one.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className={td}>
                    <div className="w-14 h-14 overflow-hidden border border-[#d4af37]/25 bg-[#0b0b0d]">
                      {p.image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={normalizeImagePath(p.image_path) ?? undefined} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-[16px] text-[#d4af37]/40">image</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={`${td} text-sm text-white font-semibold`}>{p.title}</td>
                  <td className={`${td} text-sm text-neutral-300`}>{p.highlight ?? "—"}</td>
                  <td className={td}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeProduct(p)}
                      className="p-1.5 text-neutral-400 hover:text-red-300 hover:bg-red-950/30 cursor-pointer disabled:opacity-40"
                      aria-label={`Remove ${p.title}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Product cards (mobile) */}
      <div className="md:hidden flex flex-col gap-3">
        {draft && (
          <div className="bg-[#d4af37]/[0.06] border border-[#d4af37]/40 p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {draft.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.previewUrl} alt="New product preview" className="w-16 h-16 object-cover border border-[#d4af37]/40" />
              ) : (
                <button
                  type="button"
                  onClick={() => draftFileInput.current?.click()}
                  className="w-16 h-16 border border-dashed border-[#d4af37]/60 flex flex-col items-center justify-center text-[#d4af37] hover:bg-[#d4af37]/10 cursor-pointer transition-colors shrink-0"
                  aria-label="Upload product image"
                >
                  <span className="material-symbols-outlined text-[20px]">upload</span>
                  <span className="font-code text-[7px] tracking-widest mt-0.5">UPLOAD</span>
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveDraft()}
                className="flex-1 px-4 py-2.5 bg-[#d4af37] text-[#0b0b0d] font-bold text-[11px] tracking-[0.2em] uppercase cursor-pointer disabled:opacity-40"
              >
                SAVE
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDraft(null)}
                className="px-3 py-2.5 border border-[#d4af37]/40 text-neutral-300 text-[11px] font-bold tracking-[0.2em] uppercase cursor-pointer disabled:opacity-40"
                aria-label="Discard new product"
              >
                ✕
              </button>
            </div>
            <input
              autoFocus
              className="field font-body"
              placeholder="Product name"
              value={draft.title}
              onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
            />
            <input
              className="field font-body"
              placeholder="Short description"
              value={draft.highlight}
              onChange={(e) => setDraft((d) => (d ? { ...d, highlight: e.target.value } : d))}
            />
          </div>
        )}

        {loading ? (
          <div className="bg-[#08080a]/80 border border-[#d4af37]/25 px-4 py-12 text-center font-code text-xs text-[#d4af37] tracking-[0.25em] uppercase">
            Loading products...
          </div>
        ) : products.length === 0 && !draft ? (
          <div className="bg-[#08080a]/80 border border-[#d4af37]/25 px-4 py-12 text-center font-code text-xs text-neutral-400 tracking-[0.2em] uppercase">
            No products yet — add your first one.
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bg-[#08080a]/80 border border-[#d4af37]/25 p-3 flex items-center gap-3">
              <div className="w-14 h-14 shrink-0 overflow-hidden border border-[#d4af37]/25 bg-[#0b0b0d]">
                {p.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={normalizeImagePath(p.image_path) ?? undefined} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-[#d4af37]/40">image</span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white font-semibold truncate">{p.title}</div>
                <div className="text-xs text-neutral-300 truncate mt-0.5">{p.highlight ?? "—"}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeProduct(p)}
                className="p-2 -mr-1 text-neutral-400 hover:text-red-300 hover:bg-red-950/30 cursor-pointer disabled:opacity-40"
                aria-label={`Remove ${p.title}`}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          type="button"
          onClick={addDraftRow}
          disabled={busy}
          className="w-full sm:w-auto px-6 py-3 border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#0b0b0d] font-code font-bold text-xs tracking-[0.25em] uppercase transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[16px] font-bold">add</span>
          <span>ADD NEW PRODUCT</span>
        </button>
        <button
          type="button"
          onClick={() => void continueToConnect()}
          disabled={busy}
          className="w-full sm:w-auto px-8 py-3.5 bg-[#d4af37] hover:bg-[#f2ca50] text-[#0b0b0d] font-bold text-xs tracking-[0.25em] uppercase flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all cursor-pointer disabled:opacity-50"
        >
          <span>CONTINUE TO CONNECT</span>
          <span className="material-symbols-outlined text-[16px] font-bold">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
