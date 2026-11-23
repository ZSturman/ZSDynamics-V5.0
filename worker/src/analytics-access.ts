// Owner login for private reports. The browser's credential is independent of
// both the emailed URL and the automation bearer token.
export async function hasAnalyticsAccess(request: Request, password: string | undefined): Promise<boolean> {
  const authorization = request.headers.get("Authorization");
  if (!password || !authorization || !/^Basic [A-Za-z0-9+/=]{1,256}$/i.test(authorization)) return false;
  const encoder = new TextEncoder();
  try {
    const actual = await crypto.subtle.digest("SHA-256", encoder.encode(atob(authorization.slice(6))));
    const expected = await crypto.subtle.digest("SHA-256", encoder.encode(`portfolio-admin:${password}`));
    return crypto.subtle.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
