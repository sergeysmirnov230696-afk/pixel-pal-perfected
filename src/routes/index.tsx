import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/game/Shell";
import { Coin } from "@/components/game/Coin";
import { DRAGONS } from "@/lib/dragons";
import { DRAGON_IMAGES } from "@/lib/dragon-images";
import { fmt, usePlayer, useGameActions } from "@/lib/player";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/telegram";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DragonVault — логово кристальных драконов" },
      {
        name: "description",
        content:
          "Покупайте кристальных драконов, копите ежедневный доход и собирайте награду в Telegram-игре DragonVault.",
      },
      { property: "og:title", content: "DragonVault — логово кристальных драконов" },
      {
        property: "og:description",
        content: "Telegram-игра: разводите драконов, получайте пассивный доход и выводите награды.",
      },
    ],
  }),
  component: GamePage,
});

function GamePage() {
  const { data: player, isLoading, dataUpdatedAt } = usePlayer();
  const actions = useGameActions(player?.playerKey);
  const { t, lang } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading || !player) {
    return (
      <Shell>
        <p className="panel px-4 py-10 text-center text-sm text-muted-foreground">{t("loading")}</p>
      </Shell>
    );
  }

  const elapsed = Math.max(0, (now - dataUpdatedAt) / 1000);
  const perSecond = player.perSecond;
  const pending = player.pending + perSecond * elapsed;

  return (
    <Shell>
      <section className="panel px-4 py-5 text-center">
        <h1 className="text-base tracking-widest text-muted-foreground uppercase">
          {t("accrued")}
        </h1>
        <p className="mt-1 flex items-center justify-center gap-2 text-3xl font-bold">
          <Coin className="h-7 w-7" />
          <span className="tabular-nums">{fmt(pending, 6, lang)}</span>
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: t("hour"), value: perSecond * 3600 },
            { label: t("day"), value: perSecond * 86400 },
            { label: t("month"), value: perSecond * 86400 * 30 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-secondary/60 py-2">
              <p className="text-[11px] tracking-widest text-muted-foreground">{s.label}</p>
              <p className="flex items-center justify-center gap-1 text-sm font-semibold">
                <Coin className="h-4 w-4" />
                {fmt(s.value, 2, lang)}
              </p>
            </div>
          ))}
        </div>

        <button
          className="btn-gold mt-5 w-2/3 py-3 text-base"
          disabled={pending <= 0 || actions.collect.isPending}
          onClick={() => {
            const before = player.balance;
            actions.collect.mutate(undefined, {
              onSuccess: (snap) => {
                haptic();
                toast.success(t("collected", { v: fmt(snap.balance - before, 6, lang) }));
              },
            });
          }}
        >
          {t("collect")}
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {DRAGONS.map((d) => {
          const mine = player.dragons.filter((o) => o.dragonId === d.id);
          const alive = mine.filter((o) => !o.expired).length;
          const name = t(`d_${d.key}` as "d_frostling");
          const canBuy = player.balance >= d.price && !actions.buy.isPending;
          return (
            <article key={d.id} className="panel flex flex-col items-center px-3 py-4">
              <p className="text-xs text-muted-foreground">{t("income")}</p>
              <p className="flex items-center gap-1.5 text-xl font-bold text-[var(--success)]">
                <Coin className="h-5 w-5" />
                {fmt((d.price * d.ratePerDay * 30) / 100, 2, lang)}
              </p>
              <p className="mb-1 text-xs text-muted-foreground">{t("perMonth")}</p>

              <div className="relative my-1">
                <img
                  src={DRAGON_IMAGES[d.id]}
                  alt={name}
                  loading="lazy"
                  width={512}
                  height={512}
                  className={`h-28 w-28 object-contain ${
                    alive === 0 && mine.length > 0 ? "opacity-40 grayscale" : ""
                  }`}
                />
                {alive > 0 && (
                  <span
                    className="absolute -top-1 -right-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-primary-foreground"
                    style={{ backgroundImage: "var(--gradient-crystal)" }}
                  >
                    ×{alive}
                  </span>
                )}
              </div>

              <p className="text-center text-sm font-semibold">{name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("level", { n: d.level })} ·{" "}
                <span className="font-bold text-primary">{d.ratePerDay}%</span> {t("perDay")}
              </p>
              <p className="flex items-center gap-1.5 text-lg font-bold">
                <Coin className="h-4 w-4" />
                {fmt((d.price * d.ratePerDay) / 100, 2, lang)}
              </p>

              <button
                className="btn-gold mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-sm"
                disabled={!canBuy}
                onClick={() =>
                  actions.buy.mutate(d.id, {
                    onSuccess: () => {
                      haptic();
                      toast.success(t("bought", { name }));
                    },
                  })
                }
              >
                {t("buy")} <Coin className="h-4 w-4" /> {fmt(d.price, 0, lang)}
              </button>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {t("lives", { n: d.lifespanDays })}
              </p>
            </article>
          );
        })}
      </section>
    </Shell>
  );
}
