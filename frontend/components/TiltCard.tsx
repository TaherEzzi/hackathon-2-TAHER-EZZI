"use client";

import { useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * CSS-only cursor tilt card. Layers inside (`.tilt-layer-l1/l2`) pop forward on
 * translateZ while the scene rotates under the pointer. Pair with .card and
 * .tilt-scene classes; MotionConfig + the media query strip the transform for
 * reduced-motion users automatically.
 */
export function TiltCard({
  children,
  className = "",
  style,
  maxTilt = 6,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tilt-y", `${(nx * maxTilt).toFixed(2)}deg`);
      el.style.setProperty("--tilt-x", `${(ny * -maxTilt).toFixed(2)}deg`);
    },
    [maxTilt],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-y", "0deg");
    el.style.setProperty("--tilt-x", "0deg");
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`tilt-scene card ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
