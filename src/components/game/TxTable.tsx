import { useI18n } from "@/lib/i18n";

export function TxTable({ rows }: { rows: string[][] }) {
  const { t } = useI18n();
  return (
    <section className="panel overflow-hidden">
      <div className="grid grid-cols-4 gap-1 bg-secondary/70 px-3 py-2 text-xs font-semibold">
        <span>{t("date")}</span>
        <span>{t("method")}</span>
        <span>{t("sum")}</span>
        <span>{t("status")}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("noOps")}</p>
      ) : (
        rows.map((r, i) => (
          <div key={i} className="grid grid-cols-4 gap-1 border-t border-border px-3 py-2 text-xs">
            {r.map((c, j) => (
              <span key={j} className="truncate">
                {c}
              </span>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
