import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await sql`select now() as now`;
    return res.json({ ok: true, now: r.rows[0].now });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
