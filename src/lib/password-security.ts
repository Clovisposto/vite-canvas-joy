/**
 * Password Security Module
 * Implements leaked password checking using k-Anonymity with HIBP API
 * Fail-open design: if API fails, allow operation and log event
 */

// SHA-1 hash function using Web Crypto API
async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Check if a password has been exposed in known data breaches
 * Uses k-Anonymity: only sends first 5 chars of hash to API
 * 
 * @param password - The password to check
 * @returns Object with isLeaked boolean and count of breaches (0 if not found or error)
 */
export async function checkLeakedPassword(password: string): Promise<{
  isLeaked: boolean;
  count: number;
  error?: string;
}> {
  try {
    // Generate SHA-1 hash of password
    const hash = await sha1(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    // Query HIBP API with k-Anonymity (only send prefix)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: {
        'Add-Padding': 'true', // Prevents response size-based attacks
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Fail-open: API error, allow operation
      console.warn('[Password Security] HIBP API returned non-OK status:', response.status);
      return { isLeaked: false, count: 0, error: 'API unavailable' };
    }

    const text = await response.text();
    const hashes = text.split('\n');

    // Search for our hash suffix in the response
    for (const line of hashes) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix?.trim() === suffix) {
        const count = parseInt(countStr?.trim() || '0', 10);
        return { isLeaked: true, count };
      }
    }

    return { isLeaked: false, count: 0 };
  } catch (error) {
    // Fail-open: network error, allow operation
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[Password Security] Check failed (fail-open):', errorMessage);
    return { isLeaked: false, count: 0, error: errorMessage };
  }
}

/**
 * Get user-friendly message for leaked password
 */
export function getLeakedPasswordMessage(count: number): string {
  if (count >= 1000000) {
    return `Esta senha foi encontrada em mais de ${Math.floor(count / 1000000)} milhão de vazamentos de dados. Por favor, escolha uma senha diferente.`;
  }
  if (count >= 1000) {
    return `Esta senha foi encontrada em mais de ${Math.floor(count / 1000)} mil vazamentos de dados. Por favor, escolha uma senha diferente.`;
  }
  return `Esta senha foi encontrada em ${count} vazamentos de dados. Por favor, escolha uma senha mais segura.`;
}
