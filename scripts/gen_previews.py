#!/usr/bin/env python3
"""BreezePost — batch-render the 90 theme preset previews.

Pulls all 90 presets from the live theme_preset table and renders each one as
previews/<PREFIX>-NN.png, resuming automatically (existing files are skipped).

Providers:
  --provider gemini      Google Gemini image API (free-tier RPD quota; auto-sleeps
                         through 429 reset windows). Needs GEMINI_API_KEY in .env.
  --provider cloudflare  Cloudflare Workers AI FLUX.1-schnell. Free daily neuron
                         quota (~17 imgs/day); pays ~$0.006/img past the free cap.

Usage (from the workspace root):
    python3 scripts/gen_previews.py --provider gemini
    python3 scripts/gen_previews.py --provider gemini --model gemini-3.1-flash-image
    python3 scripts/gen_previews.py --provider cloudflare --limit 20
    python3 scripts/gen_previews.py --single WT-05

No third-party dependencies (stdlib only). Secrets are read from the root .env,
never printed.
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "previews"
ENV_FILE = ROOT / ".env"

CATEGORY_PREFIX = {
    "jewelry": "JW",
    "handbags": "HB",
    "beverages": "BV",
    "wallets": "WA",
    "watches": "WT",
    "tshirts": "TS",
}
CATEGORY_OFFSET = {  # global id -> per-category sequence number
    "jewelry": 0,
    "handbags": 15,
    "beverages": 30,
    "wallets": 45,
    "watches": 60,
    "tshirts": 75,
}


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for raw in ENV_FILE.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def fetch_presets(env: dict[str, str]) -> list[dict]:
    """Auth admin: pull all presets from the live DB (90 seeded rows)."""
    data = json.dumps({"query":
                       "select id, category, name, description, prompt_template "
                       "from public.theme_preset order by id;"}).encode()
    req = urllib.request.Request(
        "https://api.supabase.com/v1/projects/culmpmgyplcuromnewrt/database/query",
        data=data, method="POST",
        headers={
            "Authorization": f"Bearer {env['SUPABASE_ACCESS_TOKEN']}",
            "Content-Type": "application/json",
        })
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def target_path(cat: str, preset_id: int) -> Path:
    prefix = CATEGORY_PREFIX[cat]
    seq = preset_id - CATEGORY_OFFSET[cat]
    return OUT_DIR / f"{prefix}-{seq:02d}.png"


def http_post_json(url: str, headers: dict[str, str], body: dict) -> tuple[int, dict | str]:
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, raw


# ── provider: gemini ────────────────────────────────────────────────────────
def render_gemini(env: dict[str, str], prompt: str, model: str) -> tuple[bytes | None, str]:
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
           f"?key={env['GEMINI_API_KEY']}")
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    status, resp = http_post_json(url, {"Content-Type": "application/json"}, body)
    if status == 429:
        msg = ""
        if isinstance(resp, dict):
            msg = str(resp.get("error", {}).get("message", ""))
        return None, f"rate-limited: {msg[:160]}"
    if status != 200:
        detail = resp if isinstance(resp, str) else str(resp)[:200]
        return None, f"http {status}: {detail[:160]}"
    for part in (resp.get("candidates") or [{}])[0].get("content", {}).get("parts", []):
        inline = part.get("inlineData")
        if inline and inline.get("data"):
            return base64.b64decode(inline["data"]), "ok"
    return None, "no inlineData in response"


def parse_reset_seconds(msg: str) -> int:
    """Gemini 429 messages often state 'resets in 3h 18m' — extract seconds."""
    total = 0
    days = re.search(r"(\d+)\s*day", msg)
    hours = re.search(r"(\d+)\s*h(?:our|r)?", msg, re.I)
    mins = re.search(r"(\d+)\s*m(?:in)?", msg, re.I)
    secs = re.search(r"(\d+)\s*s(?:ec)?", msg, re.I)
    if days:
        total += int(days.group(1)) * 86400
    if hours:
        total += int(hours.group(1)) * 3600
    if mins:
        total += int(mins.group(1)) * 60
    if secs:
        total += int(secs.group(1))
    return total or 600  # fallback: poll again in 10 min


# ── provider: cloudflare ───────────────────────────────────────────────────
FLUX_PROMPT_VARIANTS = [
    "{p}",
    "premium commercial photograph of {p}",
    "elegant still life, catalog presentation: {p}",
]


def render_cloudflare(env: dict[str, str], prompt: str) -> tuple[bytes | None, str]:
    url = ("https://api.cloudflare.com/client/v4/accounts/"
           f"{env['CLOUDFLARE_ACCOUNT_ID']}/ai/run/@cf/black-forest-labs/flux-1-schnell")
    headers = {"Authorization": f"Bearer {env['CLOUDFLARE_API_TOKEN']}",
               "Content-Type": "application/json"}
    for variant in FLUX_PROMPT_VARIANTS:
        status, resp = http_post_json(url, headers, {"prompt": variant.format(p=prompt), "steps": 4})
        if status == 200 and isinstance(resp, dict):
            image = (resp.get("result") or {}).get("image")
            if image:
                return base64.b64decode(image), "ok"
        if status in (429, 402):  # free neuron cap / payment required
            return None, f"neuron quota exhausted (http {status}); rerun later or top up"
        if status == 400 and isinstance(resp, dict) and "8007" in json.dumps(resp):
            continue  # NSFW false positive — next prompt variant
        detail = resp if isinstance(resp, str) else json.dumps(resp)[:200]
        return None, f"http {status}: {detail[:160]}"
    return None, "all prompt variants rejected"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", choices=["gemini", "cloudflare"], default="gemini")
    ap.add_argument("--model", default="gemini-3.1-flash-image",
                    help="gemini image model id (gemini provider only)")
    ap.add_argument("--limit", type=int, default=0, help="stop after N new images")
    ap.add_argument("--single", help="render exactly one preset by label, e.g. WT-05")
    ap.add_argument("--wait", action="store_true",
                    help="sleep through 429 reset windows instead of exiting")
    ap.add_argument("--max-wait-mins", type=int, default=720,
                    help="cap total sleeping time in --wait mode")
    args = ap.parse_args()

    env = load_env()
    OUT_DIR.mkdir(exist_ok=True)
    presets = fetch_presets(env)
    print(f"[info] {len(presets)} presets fetched from theme_preset")

    pending: list[tuple[Path, str]] = []
    for p in presets:
        path = target_path(p["category"], p["id"])
        label = f"{CATEGORY_PREFIX[p['category']]}-{p['id'] - CATEGORY_OFFSET[p['category']]:02d}"
        if path.exists():
            continue
        if args.single and label != args.single:
            continue
        style = p.get("prompt_template") or p.get("description") or ""
        prompt = (f"Ultra-realistic high-end commercial product photograph, square 1:1. "
                  f"{style} Single hero product, premium luxury advertising quality, "
                  f"crisp studio lighting. No text, no watermark, no logos, no people.")
        pending.append((label, prompt) if False else (path, prompt))  # keep simple

    if args.single and not pending:
        path_exists = target_path(*next(
            ((p["category"], p["id"]) for p in presets if args.single.split("-")[0] == CATEGORY_PREFIX[p["category"]]
             and p["id"] - CATEGORY_OFFSET[p["category"]] == int(args.single.split("-")[1])), (None, None))).exists()
        print(f"[info] {args.single} already exists" if path_exists
              else f"[error] unknown label {args.single}")
        return 0

    if not pending:
        print("[done] all previews present")
        return 0

    made, skipped = 0, 0
    wait_total = 0
    for path, prompt in pending:
        if args.limit and made >= args.limit:
            break
        if args.provider == "gemini":
            if not env.get("GEMINI_API_KEY"):
                print("[error] add GEMINI_API_KEY=... to the root .env "
                      "(aistudio.google.com -> Get API key)");
                return 2
            image, note = render_gemini(env, prompt, args.model)
            if image is None and "rate-limited" in note:
                if args.wait and wait_total < args.max_wait_minutes * 60:
                    mins = parse_reset_seconds(note) // 60
                    print(f"[wait] {note} -> sleeping up to {mins} min")
                    time.sleep(min(mins, args.max_wait_minutes * 60 - wait_total) * 60)
                    wait_total += mins
                    image, note = render_gemini(env, prompt, args.model)
                else:
                    print(f"[pause] {note}; rerun later — progress is resume-safe")
                    break
        else:
            image, note = render_cloudflare(env, prompt)
        if image:
            path.write_bytes(image)
            made += 1
            print(f"[made] {path.name} ({made} this run)")
        else:
            skipped += 1
            print(f"[skip] {path.name}: {note}")
        time.sleep(2)  # gentle pacing for both providers

    print("-" * 50)
    print(f"[done] rendered {made}, skipped {skipped}, "
          f"remaining {len(pending) - made - skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
