import type { NextRequest } from "next/server";

/**
 * In-process, best-effort. It resets on deploy and does not span instances —
 * enough to stop one browser looping the panel, not a substitute for a real
 * limiter in front of a public deployment.
 */

const WINDOW_MS = 60 * 60 * 1000;
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, weight = 1): boolean {
  const cap = Number(process.env.MHDEBATE_RATE_LIMIT ?? 12);
  if (!Number.isFinite(cap) || cap <= 0) return true;

  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length + weight > cap) {
    buckets.set(key, recent);
    return false;
  }
  for (let i = 0; i < weight; i += 1) recent.push(now);
  buckets.set(key, recent);

  // Keep the map from growing without bound on a long-lived server.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
    }
  }
  return true;
}

export function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
