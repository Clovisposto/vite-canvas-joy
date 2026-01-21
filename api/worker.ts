import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { handleOptions, rateLimit, requireAppToken, setCors } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (handleOptions(req, res)) return;

  const auth = requireAppToken(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
  if (!(await rateLimit(req, res, '/api/worker'))) return;

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  // Placeholder: worker orchestration (mantem compat)
  const { job } = req.body || {};
  if (!job) return res.status(400).json({ ok: false, error: 'missing_job' });

  // Exemplo: registra job no banco (se existir a tabela). Se nao existir, apenas responde ok.
  try {
    await sql`select 1;`;
  } catch {}

  return res.json({ ok: true, accepted: true, job });
}
