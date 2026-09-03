import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CURRENCY_CODES, DRAGONS, dragonById } from "./dragons";
import { ACHIEVEMENTS, BOOSTS, dailyReward, DAILY_MAX_STREAK } from "./achievements";

export type PlayerSnapshot = {
  playerKey: string;
  name: string;
  balance: number;
  collected: number;
  referralBalance: number;
  pending: number;
  perSecond: number;
  language: "en" | "ru";
  isAdmin: boolean;
  settings: GameSettings;
  addresses: Record<string, string>;
  dragons: { id: string; dragonId: number; boughtAt: string; expired: boolean }[];
  transactions: {
    id: string;
    kind: "deposit" | "withdraw";
    method: string;
    amount: number;
    status: string;
    address: string | null;
    createdAt: string;
  }[];
  referrals: { invitedName: string; deposit: number; income: number; createdAt: string }[];
  totalDeposited: number;
  banned: boolean;
  daily: { streak: number; canClaim: boolean; nextAt: string | null; reward: number };
  boost: { until: string | null; multiplier: number; active: boolean };
  achievements: {
    key: string;
    goal: number;
    reward: number;
    progress: number;
    claimed: boolean;
    ready: boolean;
  }[];
};

export type GameSettings = {
  minDeposit: number;
  minWithdraw: number;
  minCollect: number;
  referralPercent: number;
  referralBonus: number;
};

const DEFAULT_SETTINGS: GameSettings = {
  minDeposit: 1,
  minWithdraw: 1,
  minCollect: 0.01,
  referralPercent: 15,
  referralBonus: 0.02,
};

export async function loadSettings(): Promise<GameSettings> {
  const db = await admin();
  const { data } = await db.from("game_settings").select("*").eq("id", true).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    minDeposit: Number(data.min_deposit ?? DEFAULT_SETTINGS.minDeposit),
    minWithdraw: Number(data.min_withdraw ?? DEFAULT_SETTINGS.minWithdraw),
    minCollect: Number(data.min_collect ?? DEFAULT_SETTINGS.minCollect),
    referralPercent: Number(data.referral_percent ?? DEFAULT_SETTINGS.referralPercent),
    referralBonus: Number(data.referral_bonus ?? DEFAULT_SETTINGS.referralBonus),
  };
}

/** Server-only module: loaded lazily so it never enters the client bundle. */
async function pk() {
  return import("./paykassa.server");
}

async function admin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

type PlayerRow = {
  id: string;
  player_key: string;
  name: string;
  balance: number | string;
  collected: number | string;
  referral_balance: number | string;
  last_accrual: string;
  addresses: unknown;
  language: string;
};

type DragonRow = { id: string; dragon_id: number; bought_at: string };

function num(v: number | string | null) {
  return Number(v ?? 0);
}

function accrual(
  rows: DragonRow[],
  lastAccrual: string,
  now: number,
  boost?: { until: number; multiplier: number },
) {
  let pending = 0;
  let perSecond = 0;
  const last = new Date(lastAccrual).getTime();
  for (const row of rows) {
    const spec = dragonById(row.dragon_id);
    if (!spec) continue;
    const bought = new Date(row.bought_at).getTime();
    const end = bought + spec.lifespanDays * 86400000;
    const perDay = (spec.price * spec.ratePerDay) / 100;
    if (now < end) perSecond += perDay / 86400;
    const from = Math.max(bought, last);
    const to = Math.min(now, end);
    if (to > from) {
      pending += ((to - from) / 86400000) * perDay;
      // Boost pays the extra multiplier only for the part of the window it covers.
      if (boost && boost.multiplier > 1) {
        const bTo = Math.min(to, boost.until);
        if (bTo > from) pending += ((bTo - from) / 86400000) * perDay * (boost.multiplier - 1);
      }
    }
  }
  if (boost && boost.multiplier > 1 && boost.until > now) perSecond *= boost.multiplier;
  return { pending, perSecond };
}

function boostOf(player: { boost_until?: string | null; boost_multiplier?: number | string | null }) {
  const until = player.boost_until ? new Date(player.boost_until).getTime() : 0;
  const multiplier = Number(player.boost_multiplier ?? 1) || 1;
  if (!until || until <= Date.now() || multiplier <= 1) return undefined;
  return { until, multiplier };
}

async function snapshot(playerKey: string): Promise<PlayerSnapshot> {
  const db = await admin();
  const { data: player, error } = await db
    .from("players")
    .select("*")
    .eq("player_key", playerKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!player) throw new Error("Player not found");
  const p = player as unknown as PlayerRow;

  const [{ data: dragons }, { data: txs }, { data: refs }] = await Promise.all([
    db.from("player_dragons").select("*").eq("player_id", p.id).order("bought_at"),
    db
      .from("transactions")
      .select("*")
      .eq("player_id", p.id)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("referrals")
      .select("*")
      .eq("inviter_id", p.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const dragonRows = (dragons ?? []) as unknown as DragonRow[];
  const [settings, { isAdminKey }] = await Promise.all([loadSettings(), pk()]);
  const now = Date.now();
  const boost = boostOf(player as unknown as { boost_until?: string | null; boost_multiplier?: number });
  const { pending, perSecond } = accrual(dragonRows, p.last_accrual, now, boost);

  const { data: claimedRows } = await db
    .from("player_achievements")
    .select("key")
    .eq("player_id", p.id);
  const claimedKeys = new Set((claimedRows ?? []).map((r) => r["key"] as string));

  const row = player as unknown as Record<string, unknown>;
  const streak = Number(row["daily_streak"] ?? 0);
  const lastDaily = row["last_daily_at"] ? new Date(row["last_daily_at"] as string).getTime() : 0;
  const canClaim = now - lastDaily >= 86400000;
  const nextStreak = now - lastDaily <= 172800000 ? streak + 1 : 1;
  const totalDeposited = num(row["total_deposited"] as number);
  const refCount = (refs ?? []).length;

  const metrics: Record<string, number> = {
    dragons: dragonRows.length,
    deposited: totalDeposited,
    referrals: refCount,
    streak,
    collected: num(p.collected),
  };

  return {
    playerKey: p.player_key,
    name: p.name,
    balance: num(p.balance),
    collected: num(p.collected),
    referralBalance: num(p.referral_balance),
    pending,
    perSecond,
    language: p.language === "ru" ? "ru" : "en",
    isAdmin: isAdminKey(p.player_key),
    settings,
    addresses: (p.addresses as Record<string, string>) ?? {},
    dragons: dragonRows.map((d) => {
      const spec = dragonById(d.dragon_id);
      const end = new Date(d.bought_at).getTime() + (spec?.lifespanDays ?? 30) * 86400000;
      return { id: d.id, dragonId: d.dragon_id, boughtAt: d.bought_at, expired: now >= end };
    }),
    transactions: (txs ?? []).map((t) => ({
      id: t.id as string,
      address: (t.address as string | null) ?? null,
      kind: t.kind as "deposit" | "withdraw",
      method: t.method as string,
      amount: num(t.amount as number),
      status: t.status as string,
      createdAt: t.created_at as string,
    })),
    referrals: (refs ?? []).map((r) => ({
      invitedName: r.invited_name as string,
      deposit: num(r.deposit as number),
      income: num(r.income as number),
      createdAt: r.created_at as string,
    })),
    totalDeposited,
    banned: Boolean(row["banned"]),
    daily: {
      streak,
      canClaim,
      nextAt: lastDaily ? new Date(lastDaily + 86400000).toISOString() : null,
      reward: dailyReward(nextStreak),
    },
    boost: {
      until: boost ? new Date(boost.until).toISOString() : null,
      multiplier: boost?.multiplier ?? 1,
      active: Boolean(boost),
    },
    achievements: ACHIEVEMENTS.map((a) => {
      const progress = metrics[a.metric] ?? 0;
      const claimed = claimedKeys.has(a.key);
      return {
        key: a.key,
        goal: a.goal,
        reward: a.reward,
        progress,
        claimed,
        ready: !claimed && progress >= a.goal,
      };
    }),
  };
}

/** Credits the inviter once the invited player buys their first dragon. */
async function payReferralBonus(inviterKey: string, invitedKey: string) {
  const db = await admin();
  const settings = await loadSettings();
  const { data: inviter } = await db
    .from("players")
    .select("id, referral_balance")
    .eq("player_key", inviterKey)
    .maybeSingle();
  if (!inviter) return;

  const { data: row } = await db
    .from("referrals")
    .select("id, bonus_paid")
    .eq("inviter_id", inviter.id as string)
    .eq("invited_key", invitedKey)
    .maybeSingle();
  if (row?.bonus_paid) return;

  await db
    .from("players")
    .update({
      referral_balance: +(num(inviter.referral_balance as number) + settings.referralBonus).toFixed(
        6,
      ),
    })
    .eq("id", inviter.id as string);

  if (row) {
    await db.from("referrals").update({ bonus_paid: true }).eq("id", row.id as string);
  } else {
    await db.from("referrals").insert({
      inviter_id: inviter.id as string,
      invited_name: invitedKey,
      invited_key: invitedKey,
      bonus_paid: true,
    });
  }
}

const keySchema = z.object({ playerKey: z.string().min(3).max(64) });

export const loadPlayer = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        playerKey: z.string().min(3).max(64),
        name: z.string().min(1).max(64).optional(),
        referredBy: z.string().max(64).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: existing } = await db
      .from("players")
      .select("id")
      .eq("player_key", data.playerKey)
      .maybeSingle();

    if (!existing) {
      const referredBy =
        data.referredBy && data.referredBy !== data.playerKey ? data.referredBy : null;
      const { error } = await db.from("players").insert({
        player_key: data.playerKey,
        name: data.name ?? "Player",
        referred_by: referredBy,
      });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);

      if (referredBy) {
        const { data: inviter } = await db
          .from("players")
          .select("id")
          .eq("player_key", referredBy)
          .maybeSingle();
        if (inviter) {
          // Bonus is credited only after the invited player buys their first dragon.
          await db.from("referrals").insert({
            inviter_id: inviter.id as string,
            invited_name: data.name ?? "Player",
            invited_key: data.playerKey,
            bonus_paid: false,
          });
        }
      }
    } else if (data.name) {
      await db.from("players").update({ name: data.name }).eq("id", existing.id as string);
    }

    return snapshot(data.playerKey);
  });

export const setLanguage = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema.extend({ language: z.enum(["en", "ru"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("players").update({ language: data.language }).eq("player_key", data.playerKey);
    return snapshot(data.playerKey);
  });

export const buyDragon = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema
      .extend({ dragonId: z.number().int().refine((id) => DRAGONS.some((d) => d.id === id)) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const spec = dragonById(data.dragonId)!;
    const { data: player } = await db
      .from("players")
      .select("id, balance, first_dragon_at, referred_by")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");
    const balance = num(player.balance as number);
    if (balance < spec.price) throw new Error("INSUFFICIENT_FUNDS");

    const isFirstDragon = !player.first_dragon_at;

    await db
      .from("players")
      .update({
        balance: +(balance - spec.price).toFixed(6),
        ...(isFirstDragon ? { first_dragon_at: new Date().toISOString() } : {}),
      })
      .eq("id", player.id as string);
    await db
      .from("player_dragons")
      .insert({ player_id: player.id as string, dragon_id: spec.id });

    if (isFirstDragon && player.referred_by) {
      await payReferralBonus(player.referred_by as string, data.playerKey);
    }

    return snapshot(data.playerKey);
  });

export const collectIncome = createServerFn({ method: "POST" })
  .validator((data: unknown) => keySchema.parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: player } = await db
      .from("players")
      .select("id, balance, collected, last_accrual, boost_until, boost_multiplier")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");

    const { data: dragons } = await db
      .from("player_dragons")
      .select("*")
      .eq("player_id", player.id as string);
    const now = Date.now();
    const { pending } = accrual(
      (dragons ?? []) as unknown as DragonRow[],
      player.last_accrual as string,
      now,
      boostOf(player as unknown as { boost_until?: string | null; boost_multiplier?: number }),
    );
    const settings = await loadSettings();
    if (pending < settings.minCollect) throw new Error("MIN_COLLECT");

    await db
      .from("players")
      .update({
        balance: +(num(player.balance as number) + pending).toFixed(6),
        collected: +(num(player.collected as number) + pending).toFixed(6),
        last_accrual: new Date(now).toISOString(),
      })
      .eq("id", player.id as string);

    return snapshot(data.playerKey);
  });

export const collectReferral = createServerFn({ method: "POST" })
  .validator((data: unknown) => keySchema.parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: player } = await db
      .from("players")
      .select("id, balance, referral_balance")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");
    const bonus = num(player.referral_balance as number);
    if (bonus <= 0) throw new Error("NOTHING_TO_COLLECT");

    await db
      .from("players")
      .update({
        balance: +(num(player.balance as number) + bonus).toFixed(6),
        referral_balance: 0,
      })
      .eq("id", player.id as string);

    return snapshot(data.playerKey);
  });

export const createDeposit = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema
      .extend({ method: z.enum(CURRENCY_CODES), amount: z.number().positive().max(100000) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const settings = await loadSettings();
    if (data.amount < settings.minDeposit) throw new Error("MIN_DEPOSIT");

    const { data: player } = await db
      .from("players")
      .select("id")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");

    const { data: tx, error } = await db
      .from("transactions")
      .insert({
        player_id: player.id as string,
        kind: "deposit",
        method: data.method,
        amount: data.amount,
      })
      .select("id")
      .single();
    if (error || !tx) throw new Error(error?.message ?? "DEPOSIT_FAILED");

    const { createPaykassaInvoice } = await pk();
    try {
      const invoice = await createPaykassaInvoice({
        orderId: tx.id as string,
        amount: data.amount,
        method: data.method,
        comment: `DragonVault ${data.playerKey}`,
      });
      await db
        .from("transactions")
        .update({
          address: invoice.tag ? `${invoice.address} (memo: ${invoice.tag})` : invoice.address,
          invoice_id: tx.id as string,
        })
        .eq("id", tx.id as string);
    } catch (e) {
      await db
        .from("transactions")
        .update({ status: "rejected", admin_note: (e as Error).message })
        .eq("id", tx.id as string);
      throw e;
    }

    return snapshot(data.playerKey);
  });

export const createWithdraw = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema
      .extend({ method: z.enum(CURRENCY_CODES), amount: z.number().positive().max(100000) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const settings = await loadSettings();
    if (data.amount < settings.minWithdraw) throw new Error("MIN_WITHDRAW");
    const { data: player } = await db
      .from("players")
      .select("id, balance, addresses")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");

    const addresses = (player.addresses as Record<string, string>) ?? {};
    if (!addresses[data.method]) throw new Error("NO_ADDRESS");
    const balance = num(player.balance as number);
    if (data.amount > balance) throw new Error("INSUFFICIENT_FUNDS");

    await db
      .from("players")
      .update({ balance: +(balance - data.amount).toFixed(6) })
      .eq("id", player.id as string);
    await db.from("transactions").insert({
      player_id: player.id as string,
      kind: "withdraw",
      method: data.method,
      amount: data.amount,
    });
    return snapshot(data.playerKey);
  });

export const savePayoutAddress = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema
      .extend({ method: z.enum(CURRENCY_CODES), address: z.string().min(6).max(120) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: player } = await db
      .from("players")
      .select("id, addresses")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");
    const addresses = { ...((player.addresses as Record<string, string>) ?? {}) };
    addresses[data.method] = data.address.trim();
    await db.from("players").update({ addresses }).eq("id", player.id as string);
    return snapshot(data.playerKey);
  });


/* ---------------------------------------------------------------- features */

export const claimDailyBonus = createServerFn({ method: "POST" })
  .validator((data: unknown) => keySchema.parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: player } = await db
      .from("players")
      .select("id, balance, last_daily_at, daily_streak, banned")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");
    if (player["banned"]) throw new Error("BANNED");

    const now = Date.now();
    const last = player["last_daily_at"] ? new Date(player["last_daily_at"] as string).getTime() : 0;
    if (now - last < 86400000) throw new Error("DAILY_NOT_READY");

    const streak = now - last <= 172800000 ? Math.min(num(player["daily_streak"]) + 1, DAILY_MAX_STREAK) : 1;
    const reward = dailyReward(streak);

    await db
      .from("players")
      .update({
        balance: +(num(player["balance"]) + reward).toFixed(6),
        last_daily_at: new Date(now).toISOString(),
        daily_streak: streak,
      })
      .eq("id", player["id"] as string);

    return snapshot(data.playerKey);
  });

export const buyBoost = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema.extend({ boostId: z.string().max(24) }).parse(data),
  )
  .handler(async ({ data }) => {
    const spec = BOOSTS.find((b) => b.id === data.boostId);
    if (!spec) throw new Error("BOOST_UNKNOWN");
    const db = await admin();
    const { data: player } = await db
      .from("players")
      .select("id, balance, boost_until, boost_multiplier")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");
    const balance = num(player["balance"]);
    if (balance < spec.price) throw new Error("INSUFFICIENT_FUNDS");
    if (boostOf(player as unknown as { boost_until?: string | null; boost_multiplier?: number })) {
      throw new Error("BOOST_ACTIVE");
    }

    await db
      .from("players")
      .update({
        balance: +(balance - spec.price).toFixed(6),
        boost_until: new Date(Date.now() + spec.hours * 3600000).toISOString(),
        boost_multiplier: spec.multiplier,
      })
      .eq("id", player["id"] as string);

    return snapshot(data.playerKey);
  });

export const claimAchievement = createServerFn({ method: "POST" })
  .validator((data: unknown) => keySchema.extend({ key: z.string().max(32) }).parse(data))
  .handler(async ({ data }) => {
    const spec = ACHIEVEMENTS.find((a) => a.key === data.key);
    if (!spec) throw new Error("ACHIEVEMENT_UNKNOWN");
    const snap = await snapshot(data.playerKey);
    const item = snap.achievements.find((a) => a.key === data.key);
    if (!item || item.claimed) throw new Error("ALREADY_CLAIMED");
    if (!item.ready) throw new Error("NOT_READY");

    const db = await admin();
    const { data: player } = await db
      .from("players")
      .select("id, balance")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");

    const { error } = await db
      .from("player_achievements")
      .insert({ player_id: player["id"] as string, key: spec.key, reward: spec.reward });
    if (error) throw new Error("ALREADY_CLAIMED");

    await db
      .from("players")
      .update({ balance: +(num(player["balance"]) + spec.reward).toFixed(6) })
      .eq("id", player["id"] as string);

    return snapshot(data.playerKey);
  });

export const redeemPromo = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    keySchema.extend({ code: z.string().min(2).max(32) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const code = data.code.trim().toUpperCase();
    const { data: promo } = await db
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (!promo || !promo["active"]) throw new Error("PROMO_INVALID");
    if (promo["expires_at"] && new Date(promo["expires_at"] as string).getTime() < Date.now()) {
      throw new Error("PROMO_EXPIRED");
    }
    if (num(promo["used_count"]) >= num(promo["max_uses"])) throw new Error("PROMO_USED_UP");

    const { data: player } = await db
      .from("players")
      .select("id, balance")
      .eq("player_key", data.playerKey)
      .maybeSingle();
    if (!player) throw new Error("Player not found");

    const { error } = await db.from("promo_redemptions").insert({
      player_id: player["id"] as string,
      code,
      amount: num(promo["amount"]),
    });
    if (error) throw new Error("PROMO_ALREADY_USED");

    await db
      .from("players")
      .update({ balance: +(num(player["balance"]) + num(promo["amount"])).toFixed(6) })
      .eq("id", player["id"] as string);
    await db
      .from("promo_codes")
      .update({ used_count: num(promo["used_count"]) + 1 })
      .eq("id", promo["id"] as string);

    return snapshot(data.playerKey);
  });

export type LeaderRow = { name: string; collected: number; dragons: number };
export type NewsRow = { id: string; title: string; body: string; createdAt: string };

export const loadCommunity = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const [{ data: players }, { data: news }] = await Promise.all([
    db
      .from("players")
      .select("name, collected, player_dragons(id)")
      .order("collected", { ascending: false })
      .limit(20),
    db
      .from("news")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const leaders: LeaderRow[] = ((players ?? []) as unknown as Record<string, any>[]).map((p) => ({
    name: (p["name"] as string) ?? "Player",
    collected: num(p["collected"]),
    dragons: p["player_dragons"]?.length ?? 0,
  }));

  const items: NewsRow[] = ((news ?? []) as unknown as Record<string, any>[]).map((n) => ({
    id: n["id"] as string,
    title: n["title"] as string,
    body: n["body"] as string,
    createdAt: n["created_at"] as string,
  }));

  return { leaders, news: items };
});
