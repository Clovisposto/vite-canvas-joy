import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

function setCors(req: VercelRequest, res: VercelResponse) {
  const allow = process.env.ALLOWED_ORIGINS || '';
  const origin = String(req.headers.origin || '');
  const allowed = allow.split(',').map(s => s.trim()).filter(Boolean);

  if (origin && (allowed.length === 0 || allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-token');
}

function requireToken(req: VercelRequest, res: VercelResponse): boolean {
  const token = String(req.headers['x-app-token'] || '');
  const expected = String(process.env.APP_TOKEN || '');
  if (!expected || token !== expected) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

async function rateLimit(req: VercelRequest, res: VercelResponse, endpoint: string): Promise<boolean> {
  if (String(process.env.RATE_LIMIT_DISABLED || '0') === '1') return true;

  const limit = parseInt(String(process.env.RATE_LIMIT_PER_MIN || '60'), 10);
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    'unknown';

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
      res.status(429).json({ ok: false, error: 'rate_limited' });
      return false;
    }
    return true;
  } catch (e) {
    console.error('RATE_LIMIT_ERROR', e);
    return true; // fail-open
  }
}

function normalizePhoneE164(input: string): string {
  const digits = String(input).replace(/\D/g, '');
  if (digits.length < 10) throw new Error('phone_too_short');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!requireToken(req, res)) return;
  if (!(await rateLimit(req, res, '/api/leads'))) return;

  if (req.method === 'GET') {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

    const { rows } = await sql<any>`
      select id, phone, name, source, tag, attendant_code,
             lgpd_consent, accepts_promo, accepts_raffle,
             blocked, created_at, updated_at
      from public.qr_leads
      where (${q} = '' or phone like '%' || ${q} || '%' or coalesce(name,'') ilike '%' || ${q} || '%')
      order by created_at desc
      limit ${limit} offset ${offset}
    `;
    return res.json({ ok: true, rows, limit, offset });
  }

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = (req.body || {}) as any;
    const phoneE164 = normalizePhoneE164(body.phone);

    const acceptsPromoFinal =
      typeof body.acceptsPromo === 'boolean' ? body.acceptsPromo :
      typeof body.accepts_promo === 'boolean' ? body.accepts_promo :
      true;

    const acceptsRaffleFinal =
      typeof body.acceptsRaffle === 'boolean' ? body.acceptsRaffle :
      typeof body.accepts_raffle === 'boolean' ? body.accepts_raffle :
      true;

    const lgpdConsentFinal =
      typeof body.lgpd_consent === 'boolean' ? body.lgpd_consent :
      typeof body.consent === 'boolean' ? body.consent :
      true;

    const attendantFinal =
      typeof body.attendantCode === 'string' ? body.attendantCode :
      typeof body.attendant_code === 'string' ? body.attendant_code :
      null;

    await sql`
      insert into public.qr_leads
        (phone, name, accepts_promo, accepts_raffle, lgpd_consent, tag, attendant_code, source, updated_at)
      values
        (${phoneE164}, ${body.name ?? null}, ${acceptsPromoFinal}, ${acceptsRaffleFinal}, ${lgpdConsentFinal},
         ${body.tag ?? null}, ${attendantFinal ?? null}, ${body.source ?? 'pwa'}, now())
      on conflict (phone) do update set
        name = coalesce(excluded.name, public.qr_leads.name),
        accepts_promo = excluded.accepts_promo,
        accepts_raffle = excluded.accepts_raffle,
        lgpd_consent = excluded.lgpd_consent,
        tag = coalesce(excluded.tag, public.qr_leads.tag),
        attendant_code = coalesce(excluded.attendant_code, public.qr_leads.attendant_code),
        source = coalesce(excluded.source, public.qr_leads.source),
        updated_at = now()
    `;

    return res.json({ ok: true, phone: phoneE164 });
  } catch (e: any) {
    return res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
}
