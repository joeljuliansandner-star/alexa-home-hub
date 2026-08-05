import type { Severity } from "@/lib/os/insights";

export const severityText: Record<Severity, string> = {
  ok: "text-success",
  info: "text-accent",
  warn: "text-primary",
  critical: "text-destructive",
};

export const severityBg: Record<Severity, string> = {
  ok: "bg-success/15 text-success",
  info: "bg-accent/15 text-accent",
  warn: "bg-primary/15 text-primary",
  critical: "bg-destructive/15 text-destructive",
};

export const severityLabel: Record<Severity, string> = {
  ok: "In Ordnung",
  info: "Hinweis",
  warn: "Achtung",
  critical: "Kritisch",
};
