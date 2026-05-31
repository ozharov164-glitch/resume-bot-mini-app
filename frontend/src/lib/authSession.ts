import { isJwtExpired } from "./jwtClient";

const TOKEN_KEY = "resumebot_jwt";
const LEGACY_TOKEN_KEY = "resumebot_jwt";

export function readCachedAuthToken(): string | null {
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = sessionStorage.getItem(LEGACY_TOKEN_KEY);
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        sessionStorage.removeItem(LEGACY_TOKEN_KEY);
      }
    }
    if (!token || token.length < 20) return null;
    if (isJwtExpired(token)) {
      clearCachedAuthToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function writeCachedAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    try {
      sessionStorage.setItem(LEGACY_TOKEN_KEY, token);
    } catch {
      /* private mode / quota */
    }
  }
}

export function clearCachedAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
