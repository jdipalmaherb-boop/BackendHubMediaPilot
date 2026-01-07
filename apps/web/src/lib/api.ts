export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * Centralized API fetch helper that automatically attaches Firebase auth tokens
 * @param path - API endpoint path (e.g., '/api/videos/123')
 * @param init - Fetch init options (method, body, etc.)
 * @param tokenCallback - Optional async function that returns a Firebase ID token
 * @returns Promise resolving to JSON response
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  tokenCallback?: () => Promise<string | null>
): Promise<any> {
  const token = tokenCallback ? await tokenCallback() : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API ${res.status}: ${errorText}`);
  }
  return res.json();
}
