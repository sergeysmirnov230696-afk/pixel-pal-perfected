/** Shared deposit crediting used by the Paykassa IPN handler and the admin panel. */
import { loadSettings } from "./game.functions";

function num(v: unknown) {
  return Number(v ?? 0);
}

async function db() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

export type CreditResult = { ok: boolean; reason?: string };

/**
 * Marks a pending deposit as done, credits the player balance, tracks lifetime
 * deposits and pays the inviter their referral percent. Idempotent: a
 * transaction that is not `pending` is ignored.
 */
export async function creditDeposit(params: {
  transactionId: string;
  txid?: string | undefined;
  amount?: number | undefined;
  note?: string | undefined;
}): Promise<CreditResult> {
  const sb = await db();
  const { data: tx } = await sb
    .from("transactions")
    .select("*")
    .eq("id", params.transactionId)
    .maybeSingle();
  if (!tx) return { ok: false, reason: "TX_NOT_FOUND" };
  if (tx["kind"] !== "deposit") return { ok: false, reason: "NOT_A_DEPOSIT" };
  if (tx["status"] !== "pending") return { ok: true, reason: "ALREADY_PROCESSED" };

  const amount = params.amount && params.amount > 0 ? params.amount : num(tx["amount"]);

  const { data: player } = await sb
    .from("players")
    .select("id, balance, referred_by, total_deposited")
    .eq("id", tx["player_id"] as string)
    .maybeSingle();
  if (!player) return { ok: false, reason: "PLAYER_NOT_FOUND" };

  await sb
    .from("transactions")
    .update({
      status: "done",
      amount,
      txid: params.txid ?? tx["txid"] ?? null,
      admin_note: params.note ?? tx["admin_note"] ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.transactionId)
    .eq("status", "pending");

  await sb
    .from("players")
    .update({
      balance: +(num(player["balance"]) + amount).toFixed(6),
      total_deposited: +(num(player["total_deposited"]) + amount).toFixed(6),
    })
    .eq("id", player["id"] as string);

  if (player["referred_by"]) {
    const settings = await loadSettings();
    const { data: inviter } = await sb
      .from("players")
      .select("id, referral_balance")
      .eq("player_key", player["referred_by"] as string)
      .maybeSingle();
    if (inviter) {
      const income = +((amount * settings.referralPercent) / 100).toFixed(6);
      await sb
        .from("players")
        .update({ referral_balance: +(num(inviter["referral_balance"]) + income).toFixed(6) })
        .eq("id", inviter["id"] as string);

      const { data: refRow } = await sb
        .from("referrals")
        .select("id, deposit, income")
        .eq("inviter_id", inviter["id"] as string)
        .eq("invited_key", tx["player_id"] as string)
        .maybeSingle();
      if (refRow) {
        await sb
          .from("referrals")
          .update({
            deposit: +(num(refRow["deposit"]) + amount).toFixed(6),
            income: +(num(refRow["income"]) + income).toFixed(6),
          })
          .eq("id", refRow["id"] as string);
      }
    }
  }

  return { ok: true };
}
