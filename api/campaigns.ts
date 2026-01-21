import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { handleOptions, rateLimit, requireAppToken, setCors } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method === 'POST') {
    const auth = requireAppToken(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    if (!(await rateLimit(req, res, '/api/campaigns'))) return;

    const { title, message, active, starts_at, ends_at } = req.body || {};
    if (!title || !message) return res.status(400).json({ ok: false, error: 'missing_fields' });

    const { rows } = await sql`
      insert into public.campaigns (title, message, active, starts_at, ends_at)
      values (${title}, ${message}, ${active ?? true}, ${starts_at ?? null}, ${ends_at ?? null})
      returning *;
    `;
    return res.json({ ok: true, campaign: rows[0] });
  }

  if (req.method === 'GET') {
    const auth = requireAppToken(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
    if (!(await rateLimit(req, res, '/api/campaigns'))) return;

    const { rows } = await sql`select * from public.campaigns order by created_at desc limit 50;`;
    return res.json({ ok: true, rows });
  }

  return res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
