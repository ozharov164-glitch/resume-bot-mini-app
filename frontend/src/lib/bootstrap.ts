import { authWithTelegram, fetchMe } from "../api";
import { clearCachedAuthToken, readCachedAuthToken, writeCachedAuthToken } from "./authSession";
import { isFounderTelegramId } from "./founder";
import { HttpTimeoutError } from "./http";
import { isFounderJwt } from "./jwtClient";
import { getTelegramUserId, waitForInitData, waitForTelegramSdk } from "../telegram";

export type BootstrapResult =
  | {
      ok: true;
      accessToken: string;
      isFounder: boolean;
    }
  | {
      ok: false;
      code: "OPEN_VIA_BOT" | "TIMEOUT" | "NETWORK" | "AUTH";
      message: string;
    };

function mapBootstrapError(error: unknown): BootstrapResult {
  if (error instanceof Error) {
    if (error.message === "OPEN_VIA_BOT") {
      return {
        ok: false,
        code: "OPEN_VIA_BOT",
        message: "Откройте приложение через кнопку в боте @resumeez_bot — так работает авторизация Telegram.",
      };
    }
    if (error instanceof HttpTimeoutError || error.message === "TIMEOUT") {
      return {
        ok: false,
        code: "TIMEOUT",
        message: "Сервер не отвечает. Проверьте интернет и нажмите «Повторить».",
      };
    }
    if (/401|подпись|авториза|токен/i.test(error.message)) {
      clearCachedAuthToken();
      return {
        ok: false,
        code: "AUTH",
        message: error.message || "Не удалось войти. Закройте Mini App и откройте снова через бота.",
      };
    }
    if (error.message) {
      return {
        ok: false,
        code: "NETWORK",
        message: error.message,
      };
    }
  }
  return {
    ok: false,
    code: "NETWORK",
    message: "Не удалось подключиться к серверу. Проверьте интернет и попробуйте снова.",
  };
}

function founderFromToken(token: string): boolean {
  return isFounderJwt(token) || isFounderTelegramId(getTelegramUserId());
}

/** Validate cached JWT with server — non-blocking after fast path. */
export async function refreshCachedSession(token: string): Promise<BootstrapResult | null> {
  try {
    const me = await fetchMe(token, 6_000);
    const founder = Boolean(me.is_founder || me.unlimited || isFounderTelegramId(me.telegram_id));
    return { ok: true, accessToken: token, isFounder: founder };
  } catch {
    clearCachedAuthToken();
    return null;
  }
}

export async function runAppBootstrap(): Promise<BootstrapResult> {
  const cached = readCachedAuthToken();
  if (cached) {
    void waitForTelegramSdk(1_200).then((webApp) => {
      webApp?.ready();
      webApp?.expand();
    });
    void refreshCachedSession(cached);
    return { ok: true, accessToken: cached, isFounder: founderFromToken(cached) };
  }

  const sdkReady = waitForTelegramSdk(2_000);
  const initDataReady = (async () => {
    await waitForTelegramSdk(800);
    return waitForInitData(6_000);
  })();

  await sdkReady;

  const initData = await initDataReady;
  if (!initData) {
    return {
      ok: false,
      code: "OPEN_VIA_BOT",
      message: "Откройте приложение через кнопку в боте @resumeez_bot — так работает авторизация Telegram.",
    };
  }

  try {
    const auth = await authWithTelegram(initData);
    writeCachedAuthToken(auth.access_token);
    const founder = Boolean(auth.is_founder || auth.unlimited || isFounderTelegramId(getTelegramUserId()));
    return { ok: true, accessToken: auth.access_token, isFounder: founder };
  } catch (error) {
    return mapBootstrapError(error);
  }
}
