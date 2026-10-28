"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ProfileRow } from "@/lib/types";

export interface UseAuthState {
  loading: boolean;
  session: Session | null;
  profile: ProfileRow | null;
  error: string | null;
  /** Refreshes the profile row from the DB and returns it. */
  reload: () => Promise<ProfileRow | null>;
  /** Merges a local optimistic patch into the held profile. */
  setProfile: (patch: Partial<ProfileRow> | null) => void;
  patchProfile: (patch: Partial<ProfileRow>) => Promise<ProfileRow | null>;
  signOut: () => Promise<void>;
}

/**
 * One source of auth truth for the whole atelier: live session via
 * onAuthStateChange, plus the RLS-owned `profiles` row (id == auth.uid()).
 */
export function useAuth(): UseAuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfileState] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadProfile = useCallback(async (uid: string): Promise<ProfileRow | null> => {
    const { data, error: dbError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single<ProfileRow>();
    if (dbError) {
      // PGRST116 = no row yet; the auth trigger normally creates it.
      console.warn("Profile read:", dbError.message);
      if (mounted.current) setError(null);
      return null;
    }
    return data;
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data: { session: s }, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        setSession(s);
        if (s?.user) {
          const row = await loadProfile(s.user.id);
          if (active) setProfileState(row);
        }
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      setSession(s);
      if (event === "SIGNED_OUT") {
        setProfileState(null);
        setLoading(false);
      } else if (s?.user) {
        setLoading(true);
        loadProfile(s.user.id).then((row) => {
          if (!active) return;
          setProfileState(row);
          setLoading(false);
        });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const reload = useCallback(async (): Promise<ProfileRow | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const row = await loadProfile(user.id);
    if (mounted.current && row) setProfileState((prev) => ({ ...prev, ...row }));
    setSession((await supabase.auth.getSession()).data.session);
    return row;
  }, [loadProfile]);

  const setProfile = useCallback((patch: Partial<ProfileRow> | null) => {
    if (patch === null) {
      setProfileState(null);
      return;
    }
    setProfileState((prev) => (prev ? { ...prev, ...patch } : (patch as ProfileRow)));
  }, []);

  const patchProfile = useCallback(
    async (patch: Partial<ProfileRow>): Promise<ProfileRow | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("patchProfile: no live session");
        return null;
      }
      const { data, error: dbError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("*")
        .single<ProfileRow>();
      if (dbError) {
        console.warn("Profile update:", dbError.message);
        return null;
      }
      if (mounted.current) setProfileState((prev) => (prev ? { ...prev, ...data } : data));
      return data;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfileState(null);
  }, []);

  return { loading, session, profile, error, reload, setProfile, patchProfile, signOut };
}
