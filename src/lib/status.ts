type Translate = (key: "statusPending" | "statusDone" | "statusRejected") => string;

export function statusLabel(status: string, t: Translate) {
  if (status === "done") return t("statusDone");
  if (status === "rejected") return t("statusRejected");
  return t("statusPending");
}
