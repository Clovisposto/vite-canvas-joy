import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// ==========================
// CONTRATO GOLD (BACKEND)
// - token obrigatorio (APP_TOKEN)
// - CORS restrito (ALLOWED_ORIGINS)
// - rate limit por IP/minuto (api_rate_limits)
// - fail-open do limiter (se DB falhar, nao derruba producao)
// ==========================

function getRequestIp(req: VercelRequest): string {
  const xff = String(req.headers['x-forwarded-for'] || '');
  const xrip = String(req.headers['x-real-ip'] || '');
  const ip =
    (xff ? xff.split(',')[0].trim() : '') ||
    (xrip ? xrip.trim() : '') ||
    'unknown';
  return ip;
}

export function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');

  // allowlist: "https://site1.com,https://site2.com"
  // se vazio, permite (para nao travar dev), mas recomendado preencher em prod
  const allowed = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (origin && (allowed.length === 0 || allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-app-token,x-token,authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function requireToken(req: VercelRequest, res: VercelResponse): boolean {
  const token = String(req.headers['x-app-token'] || req.headers['x-token'] || (req.query.token as any) || '');
  const expected = String(process.env.APP_TOKEN || '');

  if (!expected) {
    // sem APP_TOKEN configurado -> falha hard (protege producao)
    res.status(500).json({ ok: false, error: 'APP_TOKEN_not_configured' });
    return false;
  }
  if (!token || token !== expected) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

// Compat: endpoints antigos usam este formato
export function requireAppToken(req: VercelRequest): { ok: boolean; status: number; error?: string } {
  const token = String(req.headers['x-app-token'] || req.headers['x-token'] || (req.query.token as any) || '');
  const expected = String(process.env.APP_TOKEN || '');

  if (!expected) return { ok: false, status: 500, error: 'APP_TOKEN_not_configured' };
  if (!token || token !== expected) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true, status: 200 };
}

export async function rateLimit(req: VercelRequest, res: VercelResponse, endpoint: string): Promise<boolean> {
  // RATE_LIMIT_DISABLED=1 -> desliga (apenas para debug controlado)
  const disabled = String(process.env.RATE_LIMIT_DISABLED || '') === '1';
  if (disabled) return true;

  const limit = parseInt(String(process.env.RATE_LIMIT_PER_MIN || '60'), 10);
  const ip = getRequestIp(req);

  try {
    const { rows } = await sql<{ count: number }>`
      insert into public.api_rate_limits (ip, endpoint, window_start, count)
      values (${ip}, ${endpoint}, date_trunc('minute', now()), 1)
      on conflict (ip, endpoint, window_start)
      do update set count = public.api_rate_limits.count + 1
      returning count;
    `;

    const c = rows?.[0]?.count ?? 1;
    if (c > limit) {
      res.status(429).json({ ok: false, error: 'rate_limited' });
      return false;
    }
    return true;
  } catch (err: any) {
    // fail-open controlado: nao derruba producao por indisponibilidade do DB
    console.error('RATE_LIMIT_DB_ERROR', err);
    return true;
  }
}
