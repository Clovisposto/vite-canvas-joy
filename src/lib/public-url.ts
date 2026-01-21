/**
 * Retorna a URL base pública para links que serão usados externamente
 * (QR Codes, compartilhamentos, etc.)
 * 
 * Sempre usa a URL oficial de produção para garantir consistência,
 * independente do ambiente onde o admin está sendo acessado.
 */
export function getPublicBaseUrl(): string {
  const PRODUCTION_URL = 'https://posto-7-digital.lovable.app';
  
  // Em produção, usa o próprio origin
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Se estamos em preview/sandbox, usar URL de produção
    if (
      hostname.includes('lovableproject.com') ||
      hostname.includes('localhost') ||
      hostname.includes('127.0.0.1')
    ) {
      return PRODUCTION_URL;
    }
    
    // Se já estamos no domínio de produção, usar origin
    return window.location.origin;
  }
  
  return PRODUCTION_URL;
}

/**
 * Gera a URL pública para um prêmio
 */
export function getPremioPublicUrl(codigo: string): string {
  return `${getPublicBaseUrl()}/premio/${codigo}`;
}
