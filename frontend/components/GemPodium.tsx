"use client";

import { Component, useEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import type { AtelierColors } from "@/components/providers";

/**
 * Failsafe shell for the Gem Podium.
 * 1. Feature-detect WebGL2/WebGL before React mounts the r3f tree.
 * 2. An ErrorBoundary catches any runtime canvas failure.
 * Both paths land on the static CSS gradient fallback (`.podium-fallback`).
 */

function hasWebGL(): boolean {
  try {
    const probe = window.document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

class PodiumBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Gem podium fell back to the static stage:", error, info.componentStack);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function GemPodium({ colors }: { colors: AtelierColors }) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(hasWebGL());
  }, []);

  const fallback = (
    <div className="podium-fallback" aria-label="Gem podium (static stage)" role="img" />
  );

  if (webglOk === false) return fallback;

  return (
    <PodiumBoundary fallback={fallback}>
      {webglOk ? <GemPodiumRuntime colors={colors} /> : <div className="podium-fallback" />}
    </PodiumBoundary>
  );
}

function GemPodiumRuntime({ colors }: { colors: AtelierColors }) {
  const [Comp, setComp] = useState<React.ComponentType<{ colors: AtelierColors }> | null>(null);

  useEffect(() => {
    let mounted = true;
    import("@/components/GemPodiumCanvas").then((mod) => {
      if (mounted) {
        setComp(() => mod.default);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!Comp) return <div className="podium-fallback" />;
  return <Comp colors={colors} />;
}
