import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "./_db";

export async function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  endpoint: string
) {
  if (process.env.RATE_LIMIT_DISABLED === "1") {
    return true;
  }

  const limit = parseInt(process.env.RATE_LIMIT_PER_MIN || "60", 10);

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    "unknown";

  try {
    const { rows } = await sql<{ count: number }>`
      insert into public.api_rate_limits (ip, endpoint, window_start, count)
      values (${ip}, ${endpoint}, date_trunc('minute', now()), 1)
      on conflict (ip, endpoint, window_start)
      do update set count = public.api_rate_limits.count + 1
      returning count
    `;

    const c = rows?.[0]?.count ?? 1;

    if (c > limit) {
      res.status(429).json({ ok: false, error: "rate_limited" });
      return false;
    }

    return true;
  } catch (err) {
    console.error("RATE_LIMIT_DB_ERROR", err);
    res.status(429).json({ ok: false, error: "rate_limit_unavailable" });
    return false;
  }
}
