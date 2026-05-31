import { authWithTelegram, fetchMe } from "../api";
import { clearCachedAuthToken, readCachedAuthToken, writeCachedAuthToken } from "./authSession";
import { HttpTimeoutError } from "./http";
import { waitForInitData, waitForTelegramSdk } from "../telegram";

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

async function tryCachedSession(): Promise<BootstrapResult | null> {
  const cached = readCachedAuthToken();
  if (!cached) return null;
  try {
    const me = await fetchMe(cached);
    const founder = Boolean(me.is_founder || me.unlimited);
    return { ok: true, accessToken: cached, isFounder: founder };
  } catch {
    clearCachedAuthToken();
    return null;
  }
}

export async function runAppBootstrap(): Promise<BootstrapResult> {
  await waitForTelegramSdk(3500);

  const cached = await tryCachedSession();
  if (cached) return cached;

  const initData = await waitForInitData(10_000);
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
    const founder = Boolean(auth.is_founder || auth.unlimited);
    return { ok: true, accessToken: auth.access_token, isFounder: founder };
  } catch (error) {
    return mapBootstrapError(error);
  }
}
