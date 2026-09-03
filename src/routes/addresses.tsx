import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/game/Shell";
import { CurrencyIcon } from "@/components/game/CurrencyIcon";
import { CURRENCIES } from "@/lib/dragons";
import { usePlayer, useGameActions } from "@/lib/player";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/telegram";

export const Route = createFileRoute("/addresses")({
  head: () => ({
    meta: [
      { title: "Адреса выплат — DragonVault" },
      {
        name: "description",
        content: "Укажите адреса криптокошельков для вывода наград из игры DragonVault.",
      },
      { property: "og:title", content: "Адреса выплат — DragonVault" },
      {
        property: "og:description",
        content: "Сохраните адреса TRX, TON, USDT и других монет для быстрых выплат.",
      },
    ],
  }),
  component: AddressesPage,
});

function AddressesPage() {
  const { data: player } = usePlayer();
  const actions = useGameActions(player?.playerKey);
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Shell>
      <h1 className="rounded-full bg-secondary py-2 text-center text-base font-semibold">
        {t("addressesTitle")}
      </h1>

      <div className="flex flex-col gap-2">
        {CURRENCIES.map((c) => {
          const value = drafts[c.code] ?? player?.addresses?.[c.code] ?? "";
          return (
            <section key={c.code} className="panel space-y-2 px-3 py-3">
              <div className="flex items-center gap-2">
                <CurrencyIcon label={c.label} color={c.color} size={28} />
                <span className="text-sm font-semibold">{c.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="field text-sm"
                  value={value}
                  placeholder={c.label}
                  onChange={(e) => setDrafts((d) => ({ ...d, [c.code]: e.target.value }))}
                />
                <button
                  className="btn-gold shrink-0 px-4 py-2 text-sm"
                  disabled={actions.saveAddress.isPending}
                  onClick={() => {
                    const address = value.trim();
                    if (address.length < 6) {
                      toast.error(t("enterAddress"));
                      return;
                    }
                    actions.saveAddress.mutate(
                      { method: c.code, address },
                      {
                        onSuccess: () => {
                          haptic();
                          toast.success(t("addressSaved", { c: c.label }));
                        },
                      },
                    );
                  }}
                >
                  {t("save")}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
