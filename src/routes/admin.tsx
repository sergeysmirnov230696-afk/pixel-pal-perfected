import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/game/Shell";
import {
  adminLoad,
  adminReviewTransaction,
  adminUpdatePlayer,
  adminUpdateSettings,
  type AdminData,
} from "@/lib/admin.functions";
import { fmt, fmtDate, usePlayer } from "@/lib/player";
import { useI18n } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Панель администратора — DragonVault" },
      {
        name: "description",
        content: "Управление заявками, игроками и настройками игры DragonVault.",
      },
      { property: "og:title", content: "Панель администратора — DragonVault" },
      {
        property: "og:description",
        content: "Статистика проекта, модерация заявок и редактирование параметров игры.",
      },
    ],
  }),
  component: AdminPage,
});

const STATUSES = ["all", "pending", "done", "rejected"] as const;

function AdminPage() {
  const { data: player } = usePlayer();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const load = useServerFn(adminLoad);
  const review = useServerFn(adminReviewTransaction);
  const updatePlayer = useServerFn(adminUpdatePlayer);
  const updateSettings = useServerFn(adminUpdateSettings);

  const [status, setStatus] = useState<(typeof STATUSES)[number]>("pending");
  const [search, setSearch] = useState("");
  const key = player?.playerKey ?? "";

  const query = useQuery({
    queryKey: ["admin", key, status, search],
    enabled: Boolean(player?.isAdmin),
    queryFn: () =>
      load({
        data: {
          playerKey: key,
          ...(status !== "all" && { status }),
          ...(search.trim() && { search: search.trim() }),
        },
      }) as Promise<AdminData>,
  });

  const onData = (data: AdminData) => {
    qc.setQueryData(["admin", key, status, search], data);
    toast.success(t("adminSaved"));
  };
  const onError = () => toast.error(t("error"));

  const reviewMut = useMutation({
    mutationFn: (v: { transactionId: string; action: "approve" | "reject" }) =>
      review({ data: { playerKey: key, ...v } }) as Promise<AdminData>,
    onSuccess: onData,
    onError,
  });
  const playerMut = useMutation({
    mutationFn: (v: { targetId: string; balance: number }) =>
      updatePlayer({ data: { playerKey: key, ...v } }) as Promise<AdminData>,
    onSuccess: onData,
    onError,
  });
  const settingsMut = useMutation({
    mutationFn: (v: AdminData["settings"]) =>
      updateSettings({ data: { playerKey: key, ...v } }) as Promise<AdminData>,
    onSuccess: onData,
    onError,
  });

  if (player && !player.isAdmin) {
    return (
      <Shell>
        <p className="panel px-4 py-6 text-center text-sm text-muted-foreground">
          {t("adminNoAccess")}
        </p>
      </Shell>
    );
  }

  const data = query.data;
  const stats = data?.stats;

  return (
    <Shell>
      <h1 className="rounded-full bg-secondary py-2 text-center text-base font-semibold">
        {t("adminTitle")}
      </h1>

      <section className="panel grid grid-cols-2 gap-2 px-4 py-4 text-sm">
        <Stat label={t("adminPlayers")} value={String(stats?.players ?? 0)} />
        <Stat label="🐉" value={String(stats?.dragons ?? 0)} />
        <Stat label={`${t("deposit")} (pending)`} value={String(stats?.depositsPending ?? 0)} />
        <Stat label={`${t("payOut")} (pending)`} value={String(stats?.withdrawsPending ?? 0)} />
        <Stat label={`${t("deposit")} $`} value={fmt(stats?.depositsDone ?? 0, 2, lang)} />
        <Stat label={`${t("payOut")} $`} value={fmt(stats?.withdrawsDone ?? 0, 2, lang)} />
        <Stat label={t("balance")} value={fmt(stats?.balanceTotal ?? 0, 2, lang)} />
      </section>

      <section className="panel space-y-3 px-4 py-4">
        <h2 className="font-semibold">{t("adminTx")}</h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs ${
                status === s ? "bg-primary text-primary-foreground" : "bg-secondary/70"
              }`}
            >
              {s === "all" ? t("adminAll") : statusLabel(s, t)}
            </button>
          ))}
        </div>
        <input
          className="field"
          placeholder={t("adminSearch")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          {(data?.transactions ?? []).map((tx) => (
            <div key={tx.id} className="rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  {tx.kind === "deposit" ? t("deposit") : t("payOut")} · {tx.method}
                </span>
                <span className="tabular-nums">{fmt(tx.amount, 2, lang)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {tx.playerName} · {tx.playerKey} · {fmtDate(tx.createdAt)}
              </p>
              {tx.address && <p className="text-xs break-all text-muted-foreground">{tx.address}</p>}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{statusLabel(tx.status, t)}</span>
                {tx.status === "pending" && (
                  <>
                    <button
                      className="btn-gold ml-auto px-3 py-1 text-xs"
                      disabled={reviewMut.isPending}
                      onClick={() =>
                        reviewMut.mutate({ transactionId: tx.id, action: "approve" })
                      }
                    >
                      {t("adminApprove")}
                    </button>
                    <button
                      className="rounded-md border border-input px-3 py-1 text-xs"
                      disabled={reviewMut.isPending}
                      onClick={() => reviewMut.mutate({ transactionId: tx.id, action: "reject" })}
                    >
                      {t("adminReject")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel space-y-3 px-4 py-4">
        <h2 className="font-semibold">{t("adminPlayers")}</h2>
        <div className="flex flex-col gap-2">
          {(data?.players ?? []).map((p) => (
            <PlayerRow
              key={p.id}
              name={p.name}
              playerKey={p.playerKey}
              dragons={p.dragons}
              balance={p.balance}
              lang={lang}
              saving={playerMut.isPending}
              onSave={(balance) => playerMut.mutate({ targetId: p.id, balance })}
              saveLabel={t("save")}
            />
          ))}
        </div>
      </section>

      {data?.settings && (
        <SettingsForm
          initial={data.settings}
          saving={settingsMut.isPending}
          onSave={(v) => settingsMut.mutate(v)}
          title={t("adminSettings")}
          saveLabel={t("save")}
        />
      )}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PlayerRow({
  name,
  playerKey,
  dragons,
  balance,
  lang,
  saving,
  onSave,
  saveLabel,
}: {
  name: string;
  playerKey: string;
  dragons: number;
  balance: number;
  lang: string;
  saving: boolean;
  onSave: (balance: number) => void;
  saveLabel: string;
}) {
  const [value, setValue] = useState(fmt(balance, 2, "en").replace(/,/g, ""));
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
      <div className="flex justify-between gap-2">
        <span className="truncate font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">🐉 {dragons}</span>
      </div>
      <p className="text-xs break-all text-muted-foreground">{playerKey}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          className="field flex-1"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="btn-gold px-3 py-1.5 text-xs"
          disabled={saving}
          onClick={() => {
            const parsed = Number(value.replace(",", "."));
            if (!Number.isFinite(parsed) || parsed < 0) return;
            onSave(parsed);
          }}
        >
          {saveLabel}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{fmt(balance, 2, lang)}</p>
    </div>
  );
}

function SettingsForm({
  initial,
  saving,
  onSave,
  title,
  saveLabel,
}: {
  initial: AdminData["settings"];
  saving: boolean;
  onSave: (v: AdminData["settings"]) => void;
  title: string;
  saveLabel: string;
}) {
  const [form, setForm] = useState(initial);
  const fields: { key: keyof AdminData["settings"]; label: string }[] = [
    { key: "minDeposit", label: "min deposit" },
    { key: "minWithdraw", label: "min withdraw" },
    { key: "minCollect", label: "min collect" },
    { key: "referralPercent", label: "referral %" },
    { key: "referralBonus", label: "referral bonus" },
  ];

  return (
    <section className="panel space-y-3 px-4 py-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <label key={f.key} className="text-xs text-muted-foreground">
            {f.label}
            <input
              className="field mt-1"
              inputMode="decimal"
              value={String(form[f.key])}
              onChange={(e) =>
                setForm({ ...form, [f.key]: Number(e.target.value.replace(",", ".")) || 0 })
              }
            />
          </label>
        ))}
      </div>
      <button className="btn-gold w-full py-2.5" disabled={saving} onClick={() => onSave(form)}>
        {saveLabel}
      </button>
    </section>
  );
}
