import { createStarsInvoice, waitUntilPaid } from "../api";
import { getTg, waitForTelegramSdk } from "../telegram";

export type StarsPayResult = "paid" | "cancelled" | "failed" | "timeout" | "unavailable";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchInvoiceLink(
  token: string,
  resumeId: string,
  useBonus: boolean,
): Promise<string> {
  const res = await createStarsInvoice(token, resumeId, useBonus);
  if (res.status === "founder_unlimited") {
    throw new Error("founder_unlimited");
  }
  const link = res.invoice_link?.trim();
  if (!link) {
    throw new Error("Сервер не вернул ссылку на оплату Stars.");
  }
  return link;
}

/** Open Telegram Stars invoice and poll backend until PDF is fulfilled. */
export async function openStarsPayment(
  token: string,
  resumeId: string,
  useBonus: boolean,
): Promise<StarsPayResult> {
  const tg = (await waitForTelegramSdk(4000)) ?? getTg();
  if (!tg?.openInvoice) {
    throw new Error("OPEN_IN_TELEGRAM");
  }

  let invoiceLink = "";
  let lastError = "Не удалось создать счёт Stars.";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      invoiceLink = await fetchInvoiceLink(token, resumeId, useBonus);
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : lastError;
      if (message === "founder_unlimited") throw err;
      lastError = message;
      if (attempt === 0) await sleep(500);
    }
  }
  if (!invoiceLink) {
    throw new Error(lastError);
  }

  return new Promise<StarsPayResult>((resolve) => {
    let settled = false;
    const finish = (result: StarsPayResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = window.setTimeout(() => finish("timeout"), 120_000);

    try {
      tg.openInvoice(invoiceLink, (status) => {
        if (status === "pending") return;
        if (status === "cancelled") {
          finish("cancelled");
          return;
        }
        if (status === "failed") {
          finish("failed");
          return;
        }
        if (status === "paid") {
          void (async () => {
            const confirmed = await waitUntilPaid(token, resumeId, 25, 1000);
            finish(confirmed ? "paid" : "timeout");
          })();
        }
      });
    } catch {
      finish("failed");
    }
  });
}
