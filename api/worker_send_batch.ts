import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { handleOptions, rateLimit, requireAppToken, setCors } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const auth = requireAppToken(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
  if (!(await rateLimit(req, res, '/api/worker_send_batch'))) return;

  const { phones, message } = req.body || {};
  if (!Array.isArray(phones) || phones.length === 0 || !message) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  // Placeholder: integra Evolution/WhatsApp depois. Aqui apenas retorna payload aceito.
  try {
    await sql`select 1;`;
  } catch {}

  return res.json({ ok: true, accepted: true, batch_size: phones.length });
}
