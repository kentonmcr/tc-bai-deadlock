/**
 * Only allow same-origin relative paths for post-auth redirects. Rejects
 * absolute URLs and protocol-relative paths ("//evil.example") to close
 * an open-redirect: e.g. /login?redirectTo=https://evil.example.
 */
export function safeRedirectPath(
  path: string | null | undefined,
  fallback: string,
): string {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}
