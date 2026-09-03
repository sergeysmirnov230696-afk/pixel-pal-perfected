import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/game/Shell";
import { Coin } from "@/components/game/Coin";
import { fmt, fmtDate, useCommunity } from "@/lib/player";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Сообщество и новости — DragonVault" },
      {
        name: "description",
        content: "Топ игроков DragonVault по собранному доходу и последние новости проекта.",
      },
      { property: "og:title", content: "Сообщество и новости — DragonVault" },
      {
        property: "og:description",
        content: "Смотрите таблицу лидеров и следите за обновлениями DragonVault.",
      },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { data } = useCommunity();
  const { t, lang } = useI18n();

  return (
    <Shell>
      <h1 className="rounded-full bg-secondary py-2 text-center text-base font-semibold">
        {t("communityTitle")}
      </h1>

      <section className="panel px-4 py-4">
        <h2 className="mb-3 font-semibold">{t("leaderboard")}</h2>
        <ol className="flex flex-col gap-1.5">
          {(data?.leaders ?? []).map((row, i) => (
            <li
              key={`${row.name}-${i}`}
              className="flex items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
            >
              <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="flex-1 truncate">{row.name}</span>
              <span className="text-xs text-muted-foreground">🐉 {row.dragons}</span>
              <span className="flex items-center gap-1 tabular-nums">
                <Coin className="h-4 w-4" /> {fmt(row.collected, 2, lang)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel px-4 py-4">
        <h2 className="mb-3 font-semibold">{t("newsTitle")}</h2>
        {(data?.news ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noNews")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(data?.news ?? []).map((n) => (
              <article key={n.id} className="rounded-lg bg-secondary/60 px-3 py-2.5">
                <h3 className="text-sm font-semibold">{n.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{fmtDate(n.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
