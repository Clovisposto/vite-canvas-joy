import type { VercelRequest } from '@vercel/node';

export function getClientIp(req: VercelRequest): string {
  const xf = (req.headers['x-forwarded-for'] || '') as string;
  if (xf) return xf.split(',')[0].trim();
  const xr = (req.headers['x-real-ip'] || '') as string;
  return xr || 'unknown';
}

export function normalizePhoneToE164BR(input: string): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length < 10) throw new Error('phone_invalid');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function requireAppToken(req: VercelRequest): void {
  const got = (req.headers['x-app-token'] || req.query['token'] || '') as string;
  const expected = process.env.APP_TOKEN || '';
  if (!expected) throw new Error('server_missing_app_token');
  if (!got || got !== expected) throw new Error('unauthorized');
}
