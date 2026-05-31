const TOKEN_KEY = "resumebot_jwt";

export function readCachedAuthToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return token && token.length > 20 ? token : null;
  } catch {
    return null;
  }
}

export function writeCachedAuthToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode / quota */
  }
}

export function clearCachedAuthToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
