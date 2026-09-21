/**
 * Only allow same-origin relative paths for post-auth redirects. Rejects
 * absolute URLs and protocol-relative paths ("//evil.example") to close
 * an open-redirect: e.g. /login?redirectTo=https://evil.example.
 *
 * Also rejects any backslash: browsers' URL parser treats a leading
 * backslash the same as a forward slash for scheme-relative resolution,
 * so "/\evil.example" would otherwise bypass the "//" check above while
 * still sending the browser off-site.
 */
export function safeRedirectPath(
  path: string | null | undefined,
  fallback: string,
): string {
  if (!path) return fallback;
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    return fallback;
  }
  return path;
}
