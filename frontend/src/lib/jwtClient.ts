export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function jwtExpiresAtMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === "number" ? exp * 1000 : null;
}

export function isJwtExpired(token: string, skewMs = 60_000): boolean {
  const exp = jwtExpiresAtMs(token);
  if (!exp) return false;
  return Date.now() >= exp - skewMs;
}

export function isFounderJwt(token: string): boolean {
  const payload = decodeJwtPayload(token);
  return payload?.founder === true;
}
