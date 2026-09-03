import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Shell } from "@/components/game/Shell";
import { Coin } from "@/components/game/Coin";
import { REFERRAL_PERCENT } from "@/lib/dragons";
import { fmt, fmtDate, referralLink, usePlayer, useGameActions } from "@/lib/player";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/telegram";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Друзья и бонусы — DragonVault" },
      {
        name: "description",
        content:
          "Приглашайте друзей в DragonVault и получайте 15% от их пополнений плюс бонус за каждого партнёра.",
      },
      { property: "og:title", content: "Друзья и бонусы — DragonVault" },
      {
        property: "og:description",
        content: "15% от пополнений приглашённых игроков — ваша реферальная награда.",
      },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { data: player } = usePlayer();
  const actions = useGameActions(player?.playerKey);
  const { t, lang } = useI18n();
  const link = player ? referralLink(player.playerKey) : "";

  return (
    <Shell>
      <section className="panel space-y-3 px-4 py-5">
        <div className="flex items-center gap-3">
          <Coin className="h-8 w-8" />
          <span className="field text-lg">{fmt(player?.referralBalance ?? 0, 2, lang)}</span>
          <button
            className="btn-gold w-2/5 shrink-0 py-2.5"
            disabled={actions.collectReferral.isPending}
            onClick={() => {
              const before = player?.referralBalance ?? 0;
              actions.collectReferral.mutate(undefined, {
                onSuccess: () => {
                  haptic();
                  toast.success(t("collected", { v: fmt(before, 2, lang) }));
                },
              });
            }}
          >
            {t("collect")}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
            style={{ backgroundImage: "var(--gradient-crystal)" }}
          >
            🔗
          </span>
          <span className="field truncate text-sm">{link}</span>
          <button
            className="btn-gold w-2/5 shrink-0 py-2.5"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                toast.success(t("copied"));
              } catch {
                toast.error(t("copyFailed"));
              }
            }}
          >
            {t("copy")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-lg border border-border bg-secondary/60 px-3 py-3 text-center">
            <p className="text-xl font-bold text-primary">{REFERRAL_PERCENT}%</p>
            <p className="text-xs text-muted-foreground">{t("refPercent")}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/60 px-3 py-3 text-center">
            <p className="flex items-center justify-center gap-1 text-xl font-bold">
              <Coin className="h-5 w-5" />
              0.02
            </p>
            <p className="text-xs text-muted-foreground">{t("refBonus")}</p>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="grid grid-cols-4 gap-1 bg-secondary/70 px-3 py-2 text-xs font-semibold">
          <span>{t("date")}</span>
          <span>{t("player")}</span>
          <span>{t("deposit")}</span>
          <span>{t("income")}</span>
        </div>
        {(player?.referrals ?? []).length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("noRefs")}</p>
        ) : (
          player!.referrals.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-1 border-t border-border px-3 py-2 text-xs"
            >
              <span className="truncate">{fmtDate(r.createdAt)}</span>
              <span className="truncate">{r.invitedName}</span>
              <span className="truncate">{fmt(r.deposit, 2, lang)}</span>
              <span className="truncate">{fmt(r.income, 2, lang)}</span>
            </div>
          ))
        )}
      </section>
    </Shell>
  );
}
