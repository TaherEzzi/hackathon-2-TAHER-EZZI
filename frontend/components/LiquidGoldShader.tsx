"use client";

import { useEffect, useRef } from "react";

/**
 * Liquid Gold Wave WebGL Shader
 * Renders smooth undulating gold ribbons with soft halo glow on obsidian background.
 * Tracks mouse position and adapts dynamically to window size.
 */
export function LiquidGoldShader() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let observer: ResizeObserver | null = null;

    const syncSize = () => {
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(syncSize);
      observer.observe(canvas);
    }
    syncSize();

    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) return;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (st - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
    
    // Deep obsidian black background (#0b0b0d)
    vec3 bg = vec3(0.043, 0.043, 0.051);
    
    // Luxurious metallic gold tones: antique champagne (#d4af37) to warm liquid amber (#e5c158)
    vec3 goldCore = vec3(0.92, 0.76, 0.32);
    vec3 goldGlow = vec3(0.78, 0.60, 0.22);
    vec3 goldDim  = vec3(0.45, 0.35, 0.12);

    float intensity = 0.0;

    // Layered flowing wave ribbons across the viewport
    for(float i = 1.0; i <= 7.0; i += 1.0) {
        float speed = u_time * 0.28 * (0.65 + i * 0.12);
        // Sinusoidal undulating flow
        float wave = sin(p.x * (1.2 + i * 0.45) + speed + i * 1.57) * (0.16 + i * 0.022);
        wave += cos(p.x * 2.4 - speed * 0.6 + i * 0.8) * 0.05;
        
        // Ribbon offset across vertical center
        float dist = abs(p.y - wave + (i - 4.0) * 0.11);
        
        // Crisp luxury filament lines with soft radiant glow
        float filament = 0.0016 / (dist + 0.0032);
        float softHalo = 0.008 / (dist * dist * 35.0 + 0.08);
        intensity += (filament * 0.7 + softHalo * 0.3) * (0.95 / sqrt(i));
    }

    vec3 goldColor = mix(goldDim, goldCore, clamp(intensity * 0.8, 0.0, 1.0));
    goldColor = mix(goldColor, goldGlow, sin(p.x * 3.0 + u_time * 0.5) * 0.3 + 0.3);

    // Subtle edge vignette
    float vignette = smoothstep(1.3, 0.35, length(p));
    vec3 finalColor = mix(bg, bg + goldColor * 1.1, clamp(intensity * vignette, 0.0, 0.85));

    gl_FragColor = vec4(finalColor, 1.0);
}`;

    function createShader(type: number, src: string) {
      if (!gl) return null;
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    const vShader = createShader(gl.VERTEX_SHADER, vs);
    const fShader = createShader(gl.FRAGMENT_SHADER, fs);
    if (!vShader || !fShader) return;

    const prog = gl.createProgram();
    if (!prog) return;

    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        mouse.x = nx * canvas.width;
        mouse.y = ny * canvas.height;
      }
    };
    window.addEventListener("mousemove", onMouseMove);

    const render = (t: number) => {
      if (!observer) syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      if (observer) observer.disconnect();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-[#0b0b0d]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(212, 175, 55, 0.08), transparent 75%)",
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        id="shader-canvas-ANIMATION_27"
        className="block w-full h-full"
      />
    </div>
  );
}
