import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadSettings, type GameSettings } from "./game.functions";

async function admin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

async function assertAdmin(playerKey: string) {
  const { isAdminKey } = await import("./paykassa.server");
  if (!isAdminKey(playerKey)) throw new Error("FORBIDDEN");
}

export type AdminTx = {
  id: string;
  kind: string;
  method: string;
  amount: number;
  status: string;
  address: string | null;
  txid: string | null;
  adminNote: string | null;
  createdAt: string;
  playerKey: string;
  playerName: string;
};

export type AdminPlayer = {
  id: string;
  playerKey: string;
  name: string;
  balance: number;
  collected: number;
  referralBalance: number;
  referredBy: string | null;
  dragons: number;
  firstDragonAt: string | null;
  createdAt: string;
};

export type AdminStats = {
  players: number;
  dragons: number;
  depositsPending: number;
  withdrawsPending: number;
  depositsDone: number;
  withdrawsDone: number;
  balanceTotal: number;
};

export type AdminData = {
  stats: AdminStats;
  transactions: AdminTx[];
  players: AdminPlayer[];
  settings: GameSettings;
};

const keySchema = z.object({ playerKey: z.string().min(3).max(64) });

function num(v: unknown) {
  return Number(v ?? 0);
}

async function buildAdminData(filter: {
  status?: string | undefined;
  search?: string | undefined;
}): Promise<AdminData> {
  const db = await admin();

  let txQuery = db
    .from("transactions")
    .select("*, players(player_key, name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.status && filter.status !== "all") txQuery = txQuery.eq("status", filter.status);

  let playerQuery = db
    .from("players")
    .select("*, player_dragons(id)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.search) {
    const q = `%${filter.search}%`;
    playerQuery = playerQuery.or(`player_key.ilike.${q},name.ilike.${q}`);
  }

  const [{ data: txs }, { data: players }, settings] = await Promise.all([
    txQuery,
    playerQuery,
    loadSettings(),
  ]);

  const rows = (txs ?? []) as unknown as Record<string, any>[];
  const playerRows = (players ?? []) as unknown as Record<string, any>[];

  const stats: AdminStats = {
    players: playerRows.length,
    dragons: playerRows.reduce((a, p) => a + (p["player_dragons"]?.length ?? 0), 0),
    depositsPending: rows.filter((t) => t["kind"] === "deposit" && t["status"] === "pending").length,
    withdrawsPending: rows.filter((t) => t["kind"] === "withdraw" && t["status"] === "pending")
      .length,
    depositsDone: rows
      .filter((t) => t["kind"] === "deposit" && t["status"] === "done")
      .reduce((a, t) => a + num(t["amount"]), 0),
    withdrawsDone: rows
      .filter((t) => t["kind"] === "withdraw" && t["status"] === "done")
      .reduce((a, t) => a + num(t["amount"]), 0),
    balanceTotal: playerRows.reduce((a, p) => a + num(p["balance"]), 0),
  };

  return {
    stats,
    settings,
    transactions: rows.map((t) => ({
      id: t["id"],
      kind: t["kind"],
      method: t["method"],
      amount: num(t["amount"]),
      status: t["status"],
      address: t["address"] ?? null,
      txid: t["txid"] ?? null,
      adminNote: t["admin_note"] ?? null,
      createdAt: t["created_at"],
      playerKey: t["players"]?.player_key ?? "",
      playerName: t["players"]?.name ?? "",
    })),
    players: playerRows.map((p) => ({
      id: p["id"],
      playerKey: p["player_key"],
      name: p["name"],
      balance: num(p["balance"]),
      collected: num(p["collected"]),
      referralBalance: num(p["referral_balance"]),
      referredBy: p["referred_by"] ?? null,
      dragons: p["player_dragons"]?.length ?? 0,
      firstDragonAt: p["first_dragon_at"] ?? null,
      createdAt: p["created_at"],
    })),
  };
}

export const adminLoad = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema
      .extend({ status: z.string().optional(), search: z.string().max(64).optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.playerKey);
    return buildAdminData({ status: data.status, search: data.search });
  });

export const adminReviewTransaction = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema
      .extend({
        transactionId: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        note: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.playerKey);
    const db = await admin();

    const { data: tx } = await db
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("TX_NOT_FOUND");
    if (tx["status"] !== "pending") throw new Error("TX_ALREADY_REVIEWED");

    const { data: player } = await db
      .from("players")
      .select("id, balance, referred_by")
      .eq("id", tx["player_id"] as string)
      .maybeSingle();
    if (!player) throw new Error("Player not found");

    const amount = num(tx["amount"]);
    const balance = num(player["balance"]);

    if (data.action === "approve") {
      if (tx["kind"] === "deposit") {
        await db
          .from("players")
          .update({ balance: +(balance + amount).toFixed(6) })
          .eq("id", player["id"] as string);

        // Referral percent from every confirmed deposit.
        if (player["referred_by"]) {
          const settings = await loadSettings();
          const { data: inviter } = await db
            .from("players")
            .select("id, referral_balance")
            .eq("player_key", player["referred_by"] as string)
            .maybeSingle();
          if (inviter) {
            const income = +((amount * settings.referralPercent) / 100).toFixed(6);
            await db
              .from("players")
              .update({ referral_balance: +(num(inviter["referral_balance"]) + income).toFixed(6) })
              .eq("id", inviter["id"] as string);
            const { data: refRow } = await db
              .from("referrals")
              .select("id, deposit, income")
              .eq("inviter_id", inviter["id"] as string)
              .eq("invited_key", tx["player_id"] as string)
              .maybeSingle();
            if (refRow) {
              await db
                .from("referrals")
                .update({
                  deposit: +(num(refRow["deposit"]) + amount).toFixed(6),
                  income: +(num(refRow["income"]) + income).toFixed(6),
                })
                .eq("id", refRow["id"] as string);
            }
          }
        }
      }
    } else if (tx["kind"] === "withdraw") {
      // Refund the reserved amount.
      await db
        .from("players")
        .update({ balance: +(balance + amount).toFixed(6) })
        .eq("id", player["id"] as string);
    }

    await db
      .from("transactions")
      .update({
        status: data.action === "approve" ? "done" : "rejected",
        admin_note: data.note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.transactionId);

    return buildAdminData({});
  });

export const adminUpdatePlayer = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema
      .extend({
        targetId: z.string().uuid(),
        balance: z.number().min(0).max(1000000).optional(),
        referralBalance: z.number().min(0).max(1000000).optional(),
        name: z.string().min(1).max(64).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.playerKey);
    const db = await admin();
    const patch: { balance?: number; referral_balance?: number; name?: string } = {};
    if (data.balance !== undefined) patch.balance = data.balance;
    if (data.referralBalance !== undefined) patch.referral_balance = data.referralBalance;
    if (data.name !== undefined) patch.name = data.name;
    if (Object.keys(patch).length > 0) {
      await db.from("players").update(patch).eq("id", data.targetId);
    }
    return buildAdminData({});
  });

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema
      .extend({
        minDeposit: z.number().min(0).max(10000),
        minWithdraw: z.number().min(0).max(10000),
        minCollect: z.number().min(0).max(10000),
        referralPercent: z.number().min(0).max(100),
        referralBonus: z.number().min(0).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await assertAdmin(data.playerKey);
    const db = await admin();
    await db
      .from("game_settings")
      .update({
        min_deposit: data.minDeposit,
        min_withdraw: data.minWithdraw,
        min_collect: data.minCollect,
        referral_percent: data.referralPercent,
        referral_bonus: data.referralBonus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    return buildAdminData({});
  });
