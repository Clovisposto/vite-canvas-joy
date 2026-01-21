import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { handleOptions, rateLimit, requireAppToken, setCors } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const auth = requireAppToken(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
  if (!(await rateLimit(req, res, '/api/campaign_status'))) return;

  const { rows } = await sql`
    select *
    from public.campaigns
    where active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at   is null or ends_at   >= now())
    order by created_at desc
    limit 1;
  `;

  return res.json({ ok: true, campaign: rows[0] || null });
}
