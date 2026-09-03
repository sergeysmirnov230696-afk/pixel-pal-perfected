import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/game/Shell";
import { Coin } from "@/components/game/Coin";
import { CurrencyIcon } from "@/components/game/CurrencyIcon";
import { TxTable } from "@/components/game/TxTable";
import { CURRENCIES, MIN_AMOUNT } from "@/lib/dragons";
import { fmt, fmtDate, usePlayer, useGameActions } from "@/lib/player";
import { useI18n } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { haptic } from "@/lib/telegram";

export const Route = createFileRoute("/deposit")({
  head: () => ({
    meta: [
      { title: "Пополнение баланса — DragonVault" },
      {
        name: "description",
        content: "Пополните игровой баланс DragonVault криптовалютой: TRX, TON, BNB, USDT и другие.",
      },
      { property: "og:title", content: "Пополнение баланса — DragonVault" },
      {
        property: "og:description",
        content: "Выберите монету и пополните баланс, чтобы купить новых драконов.",
      },
    ],
  }),
  component: DepositPage,
});

function DepositPage() {
  const { data: player } = usePlayer();
  const actions = useGameActions(player?.playerKey);
  const { t, lang } = useI18n();
  const [selected, setSelected] = useState<(typeof CURRENCIES)[number] | null>(null);
  const [amount, setAmount] = useState("1.00");

  const usd = Number(amount.replace(",", ".")) || 0;
  const deposits = (player?.transactions ?? []).filter((tx) => tx.kind === "deposit");

  if (!selected) {
    return (
      <Shell>
        <h1 className="rounded-full bg-secondary py-2 text-center text-base font-semibold">
          {t("depositTitle")}
        </h1>
        <div className="flex flex-col gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setSelected(c)}
              className="panel flex items-center gap-3 px-3 py-3 text-left"
            >
              <CurrencyIcon label={c.label} color={c.color} />
              <span>
                <span className="block font-semibold">{c.label}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  {t("minimum")}: <Coin className="h-4 w-4" /> {fmt(MIN_AMOUNT, 2, lang)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <button
        onClick={() => setSelected(null)}
        className="self-start text-sm text-muted-foreground"
      >
        ← {t("allCoins")}
      </button>

      <section className="panel space-y-4 px-4 py-5">
        <div>
          <label className="mb-1.5 block text-sm text-muted-foreground">{t("amountUsd")}</label>
          <div className="flex items-center gap-3">
            <Coin className="h-8 w-8" />
            <input
              className="field text-lg"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted-foreground">
            {t("youGet", { c: selected.label })}
          </label>
          <div className="flex items-center gap-3">
            <CurrencyIcon label={selected.label} color={selected.color} size={32} />
            <input className="field text-lg" readOnly value={(usd * selected.rate).toFixed(6)} />
          </div>
        </div>
        <button
          className="btn-gold ml-auto block w-1/2 py-3"
          disabled={actions.deposit.isPending}
          onClick={() => {
            if (usd < MIN_AMOUNT) {
              toast.error(t("minAmount", { v: fmt(MIN_AMOUNT, 2, lang) }));
              return;
            }
            actions.deposit.mutate(
              { method: selected.code, amount: usd },
              {
                onSuccess: () => {
                  haptic();
                  toast.success(t("depositCreated"));
                },
              },
            );
          }}
        >
          {t("topUp")}
        </button>
      </section>

      <TxTable
        rows={deposits.map((tx) => [
          fmtDate(tx.createdAt),
          tx.method,
          fmt(tx.amount, 2, lang),
          statusLabel(tx.status, t),
        ])}
      />
    </Shell>
  );
}
