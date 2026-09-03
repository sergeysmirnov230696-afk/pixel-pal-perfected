import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Coin } from "./Coin";
import { fmt, usePlayer } from "@/lib/player";
import { useI18n, type Lang } from "@/lib/i18n";
import { initTelegram } from "@/lib/telegram";

const TABS = [
  { to: "/", key: "tabGame" },
  { to: "/deposit", key: "tabDeposit" },
  { to: "/withdraw", key: "tabWithdraw" },
  { to: "/referrals", key: "tabReferrals" },
  { to: "/rewards", key: "tabRewards" },
  { to: "/community", key: "tabCommunity" },
] as const;

const LANGS: Lang[] = ["en", "ru"];

export function Shell({ children }: { children: ReactNode }) {
  const { data: player } = usePlayer();
  const { t, lang, setLang } = useI18n();

  useEffect(() => {
    initTelegram();
  }, []);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 px-3 pt-4 pb-10">
      <header className="panel flex items-stretch overflow-hidden">
        <div className="flex-1 px-4 py-3">
          <p className="text-xs tracking-wide text-muted-foreground">{t("balance")}</p>
          <p className="flex items-center gap-2 text-2xl font-bold">
            <Coin className="h-6 w-6" />
            <span className="tabular-nums">{fmt(player?.balance ?? 0, 2, lang)}</span>
          </p>
        </div>
        <div className="flex w-2/5 flex-col items-center justify-center gap-1.5 bg-accent/60 px-3 py-3 text-center">
          <span className="text-sm leading-tight font-medium">{player?.name ?? t("guest")}</span>
          <span className="flex gap-1">
            {LANGS.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase transition-colors ${
                  lang === l
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/70 text-muted-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </span>
        </div>
      </header>

      <nav className="grid grid-cols-3 gap-2">
        {[...TABS, ...(player?.isAdmin ? ([{ to: "/admin", key: "tabAdmin" }] as const) : [])].map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="rune-tab px-1 py-2.5 text-center text-[13px]"
            activeOptions={{ exact: tab.to === "/" }}
            activeProps={{ className: "rune-tab-active" }}
          >
            {t(tab.key)}
          </Link>
        ))}
      </nav>

      {children}

      <a
        href="https://t.me/dragonvault_support"
        target="_blank"
        rel="noreferrer"
        className="panel mt-auto py-3 text-center text-sm tracking-[0.2em] text-muted-foreground uppercase"
      >
        {t("support")}
      </a>
    </div>
  );
}
