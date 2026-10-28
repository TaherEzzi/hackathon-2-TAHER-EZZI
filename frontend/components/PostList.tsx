"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { PostRow } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { EmptyState, StatusChip } from "@/components/ui";

/**
 * The pipeline panel — `post` rows as the atelier's ledger of pieces. Renders
 * on Connect (stage V) and on the dashboard. Pure supabase-js reads; rows are
 * created by the backend agent (bot → generator → scheduler), so the client
 * only watches.
 */
export function PostList({ compact = false }: { compact?: boolean }) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("post")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(compact ? 5 : 25);
    if (error) {
      setProblem(`The ledger wouldn't open: ${error.message}. If it persists, the backend agent hasn't been granted the read policy yet.`);
    } else {
      setPosts((data ?? []) as PostRow[]);
      setProblem(null);
    }
    setLoading(false);
  }, [compact]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-label="Post pipeline">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="h3">{compact ? "On the easel" : "The pipeline ledger"}</h2>
        <button type="button" className="btn btn-quiet text-[0.8rem]" onClick={() => void load()} disabled={loading}>
          {loading ? "Reading…" : "Re-read"}
        </button>
      </div>

      {loading && posts.length === 0 ? (
        <p className="mono-label py-10 text-center">Skimming the ledger…</p>
      ) : posts.length === 0 ? (
        <EmptyState
          title="Nothing on the easel yet."
          body={
            compact
              ? "The first compositions land here once your pipeline wakes — link Telegram, then let the scheduler do the rest."
              : "Compositions appear after the scheduler wakes: a product, a preset, your DNA, one image and caption each. Link Telegram in stage V to train the courier."
          }
        />
      ) : (
        <ol className="grid gap-2.5">
          {posts.map((p, i) => (
            <motion.li
              key={p.id}
              className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2) }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <StatusChip status={p.status} label={STATUS_LABEL[p.status] ?? p.status} />
                <span className="truncate text-[0.88rem]" style={{ color: "var(--accent2)" }}>
                  {p.caption ? p.caption.slice(0, 90) : "Composition being prepared"}
                </span>
              </div>
              <span className="mono-label flex-none">
                {p.scheduled_for
                  ? new Date(p.scheduled_for).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })
                  : "unscheduled"}
                {p.revision_count ? ` · ${p.revision_count} alteration${p.revision_count > 1 ? "s" : ""}` : ""}
              </span>
            </motion.li>
          ))}
        </ol>
      )}
      {problem && (
        <p role="alert" className="mt-3 text-[0.84rem]" style={{ color: "var(--accent)" }}>
          {problem}
        </p>
      )}
    </section>
  );
}
