/** Paykassa SCI integration (server only). */

const SCI_URL = "https://api.paykassa.pro/sci/0.6/index.php";

/** Maps in-game currency codes to Paykassa system/currency pairs. */
export const PAYKASSA_MAP: Record<string, { system: string; currency: string }> = {
  TRX: { system: "tron", currency: "TRX" },
  TON: { system: "ton", currency: "TON" },
  BNB: { system: "bnb", currency: "BNB" },
  DOGE: { system: "dogecoin", currency: "DOGE" },
  LTC: { system: "litecoin", currency: "LTC" },
  SOL: { system: "solana", currency: "SOL" },
  POL: { system: "polygon", currency: "POL" },
  USDT_BEP20: { system: "bnb", currency: "USDT" },
  USDT_POLYGON: { system: "polygon", currency: "USDT" },
  USDT_SOL: { system: "solana", currency: "USDT" },
  USDT_TON: { system: "ton", currency: "USDT" },
};

export type PaykassaInvoice = {
  address: string;
  amount: string;
  currency: string;
  system: string;
  tag?: string | undefined;
};

type SciResponse = {
  error: boolean;
  message: string;
  data?: Record<string, unknown>;
};

export async function createPaykassaInvoice(params: {
  orderId: string;
  amount: number;
  method: string;
  comment: string;
}): Promise<PaykassaInvoice> {
  const sciId = process.env["PAYKASSA_MERCHANT_ID"];
  const sciKey = process.env["PAYKASSA_MERCHANT_PASSWORD"];
  if (!sciId || !sciKey) throw new Error("PAYKASSA_NOT_CONFIGURED");

  const mapped = PAYKASSA_MAP[params.method];
  if (!mapped) throw new Error("PAYKASSA_UNSUPPORTED_METHOD");

  const body = new URLSearchParams({
    func: "sci_create_order_get_data",
    sci_id: sciId,
    sci_key: sciKey,
    order_id: params.orderId,
    amount: params.amount.toFixed(8),
    currency: mapped.currency,
    system: mapped.system,
    comment: params.comment,
    phone: "",
  });

  const res = await fetch(SCI_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();
  let json: SciResponse;
  try {
    json = JSON.parse(text) as SciResponse;
  } catch {
    console.error("Paykassa non-JSON response", res.status, text.slice(0, 500));
    throw new Error("PAYKASSA_BAD_RESPONSE");
  }

  if (!res.ok || json.error || !json.data) {
    console.error("Paykassa error", res.status, json.message);
    throw new Error("PAYKASSA_ERROR");
  }

  const data = json.data;
  const address = String(data["wallet"] ?? data["invoice"] ?? "");
  if (!address) throw new Error("PAYKASSA_NO_ADDRESS");

  return {
    address,
    amount: String(data["amount"] ?? params.amount),
    currency: String(data["currency"] ?? mapped.currency),
    system: String(data["system"] ?? mapped.system),
    tag: data["tag"] ? String(data["tag"]) : undefined,
  };
}

export function adminTelegramIds(): string[] {
  return (process.env["ADMIN_TELEGRAM_IDS"] ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminKey(playerKey: string) {
  const ids = adminTelegramIds();
  if (ids.length === 0) return false;
  const id = playerKey.replace(/^tg_/, "");
  return ids.includes(id) || ids.includes(playerKey);
}

/**
 * Confirms an IPN notification with Paykassa. The notification only carries a
 * `private_hash`; the payment details are fetched from Paykassa itself, so a
 * forged callback cannot credit anything.
 */
export async function confirmPaykassaOrder(privateHash: string): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  system: string;
  hash: string;
  partial: string;
}> {
  const sciId = process.env["PAYKASSA_MERCHANT_ID"];
  const sciKey = process.env["PAYKASSA_MERCHANT_PASSWORD"];
  if (!sciId || !sciKey) throw new Error("PAYKASSA_NOT_CONFIGURED");

  const res = await fetch(SCI_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      func: "sci_confirm_order",
      sci_id: sciId,
      sci_key: sciKey,
      private_hash: privateHash,
    }),
  });

  const text = await res.text();
  let json: SciResponse;
  try {
    json = JSON.parse(text) as SciResponse;
  } catch {
    console.error("Paykassa IPN non-JSON response", res.status, text.slice(0, 500));
    throw new Error("PAYKASSA_BAD_RESPONSE");
  }
  if (!res.ok || json.error || !json.data) {
    console.error("Paykassa IPN rejected", json.message);
    throw new Error("PAYKASSA_IPN_REJECTED");
  }

  const d = json.data;
  return {
    orderId: String(d["order_id"] ?? ""),
    amount: Number(d["amount"] ?? 0),
    currency: String(d["currency"] ?? ""),
    system: String(d["system"] ?? ""),
    hash: String(d["hash"] ?? ""),
    partial: String(d["partial"] ?? "no"),
  };
}
