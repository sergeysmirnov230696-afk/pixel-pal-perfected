import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/game/Shell";
import { Coin } from "@/components/game/Coin";
import { BOOSTS } from "@/lib/achievements";
import { fmt, fmtDate, usePlayer, useRewardActions } from "@/lib/player";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/telegram";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Награды и бонусы — DragonVault" },
      {
        name: "description",
        content:
          "Ежедневный бонус, ускорители дохода, достижения и промокоды DragonVault в одном разделе.",
      },
      { property: "og:title", content: "Награды и бонусы — DragonVault" },
      {
        property: "og:description",
        content: "Забирайте ежедневный бонус, покупайте бусты и активируйте промокоды.",
      },
    ],
  }),
  component: RewardsPage,
});

const ACH_TITLES: Record<string, { en: string; ru: string }> = {
  first_dragon: { en: "First dragon", ru: "Первый дракон" },
  small_lair: { en: "Small lair", ru: "Небольшое логово" },
  big_lair: { en: "Big lair", ru: "Большое логово" },
  first_deposit: { en: "First deposit", ru: "Первое пополнение" },
  whale: { en: "Whale", ru: "Кит" },
  friend: { en: "First friend", ru: "Первый друг" },
  clan: { en: "Clan", ru: "Клан" },
  week_streak: { en: "Week streak", ru: "Неделя подряд" },
  collector: { en: "Collector", ru: "Коллекционер" },
  hoarder: { en: "Hoarder", ru: "Хранитель сокровищ" },
};

function RewardsPage() {
  const { data: player } = usePlayer();
  const actions = useRewardActions(player?.playerKey);
  const { t, lang } = useI18n();
  const [code, setCode] = useState("");

  const daily = player?.daily;
  const boost = player?.boost;

  return (
    <Shell>
      <h1 className="rounded-full bg-secondary py-2 text-center text-base font-semibold">
        {t("rewardsTitle")}
      </h1>

      <section className="panel space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("dailyTitle")}</h2>
          <span className="text-sm text-muted-foreground">
            {t("dailyStreak", { n: daily?.streak ?? 0 })}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {daily?.canClaim
            ? t("dailyReady")
            : t("dailyWait", { v: daily?.nextAt ? fmtDate(daily.nextAt) : "—" })}
        </p>
        <button
          className="btn-gold w-full py-3 disabled:opacity-50"
          disabled={!daily?.canClaim || actions.claimDaily.isPending}
          onClick={() =>
            actions.claimDaily.mutate(undefined, {
              onSuccess: () => {
                haptic();
                toast.success(t("dailyClaimed"));
              },
            })
          }
        >
          {t("dailyClaim", { v: fmt(daily?.reward ?? 0, 3, lang) })}
        </button>
      </section>

      <section className="panel space-y-3 px-4 py-4">
        <h2 className="font-semibold">{t("boostsTitle")}</h2>
        {boost?.active && (
          <p className="text-sm text-muted-foreground">
            {t("boostActive", {
              m: boost.multiplier,
              v: boost.until ? fmtDate(boost.until) : "—",
            })}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {BOOSTS.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2.5">
              <span className="text-sm font-medium">
                {t("boostHours", { m: b.multiplier, h: b.hours })}
              </span>
              <span className="flex items-center gap-1.5 text-sm">
                <Coin className="h-4 w-4" /> {fmt(b.price, 2, lang)}
              </span>
              <button
                className="btn-gold px-4 py-1.5 text-sm disabled:opacity-50"
                disabled={boost?.active || actions.buyBoost.isPending}
                onClick={() =>
                  actions.buyBoost.mutate(b.id, {
                    onSuccess: () => {
                      haptic();
                      toast.success(t("boostBought"));
                    },
                  })
                }
              >
                {t("boostBuy")}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel space-y-3 px-4 py-4">
        <h2 className="font-semibold">{t("achievementsTitle")}</h2>
        <div className="flex flex-col gap-2">
          {(player?.achievements ?? []).map((a) => (
            <div key={a.key} className="rounded-lg bg-secondary/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {ACH_TITLES[a.key]?.[lang] ?? a.key}
                </span>
                {a.claimed ? (
                  <span className="text-xs text-muted-foreground uppercase">{t("achClaimed")}</span>
                ) : (
                  <button
                    className="btn-gold px-4 py-1.5 text-sm disabled:opacity-50"
                    disabled={!a.ready || actions.claimAchievement.isPending}
                    onClick={() =>
                      actions.claimAchievement.mutate(a.key, {
                        onSuccess: () => {
                          haptic();
                          toast.success(t("achClaimedToast"));
                        },
                      })
                    }
                  >
                    {t("achClaim")}
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t("achProgress", {
                    p: fmt(Math.min(a.progress, a.goal), a.progress % 1 ? 2 : 0, lang),
                    g: a.goal,
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Coin className="h-3.5 w-3.5" /> {fmt(a.reward, 2, lang)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (a.progress / a.goal) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel space-y-3 px-4 py-4">
        <h2 className="font-semibold">{t("promoTitle")}</h2>
        <div className="flex gap-2">
          <input
            className="field flex-1"
            value={code}
            placeholder={t("promoPlaceholder")}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            className="btn-gold px-4 py-2 text-sm disabled:opacity-50"
            disabled={!code.trim() || actions.redeemPromo.isPending}
            onClick={() =>
              actions.redeemPromo.mutate(code.trim(), {
                onSuccess: () => {
                  haptic();
                  setCode("");
                  toast.success(t("promoOk"));
                },
              })
            }
          >
            {t("promoApply")}
          </button>
        </div>
      </section>
    </Shell>
  );
}
