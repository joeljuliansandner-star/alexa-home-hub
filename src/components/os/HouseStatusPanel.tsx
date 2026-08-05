import { AlertTriangle, CheckCircle2, Info, ShieldAlert, ShieldCheck } from "lucide-react";

import { IconTile, Panel } from "@/components/kit";
import { cn } from "@/lib/utils";
import { houseChecks, overallSeverity, statusHeadline, type Check } from "@/lib/os/insights";
import type { HaEntity, HaStatus } from "@/services/homeAssistant";
import { severityBg, severityText } from "./severity";

const icons = {
  ok: CheckCircle2,
  info: Info,
  warn: AlertTriangle,
  critical: ShieldAlert,
} as const;

/** Automatische Gesamtbewertung des Zuhauses aus den Home-Assistant-Daten. */
export function HouseStatusPanel({
  entities,
  status,
  compact = false,
}: {
  entities: HaEntity[];
  status: HaStatus;
  compact?: boolean;
}) {
  const checks = houseChecks(entities, status);
  const severity = overallSeverity(checks);
  const problems = checks.filter((check) => check.severity !== "ok");
  const visible = compact ? (problems.length ? problems : checks.slice(0, 4)) : checks;

  return (
    <Panel className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <IconTile
          icon={severity === "ok" ? ShieldCheck : icons[severity]}
          tone={severity === "ok" ? "primary" : severity === "critical" ? "destructive" : "accent"}
          className="size-12"
        />
        <div className="min-w-0">
          <p className={cn("text-lg font-semibold", severityText[severity])}>
            {statusHeadline(severity)}
          </p>
          <p className="text-sm text-muted-foreground">
            {problems.length
              ? `${problems.length} von ${checks.length} Prüfungen benötigen Aufmerksamkeit`
              : `Alle ${checks.length} Prüfungen bestanden`}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {visible.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </ul>
    </Panel>
  );
}

function CheckRow({ check }: { check: Check }) {
  const Icon = icons[check.severity];
  return (
    <li className="flex items-start gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg",
          severityBg[check.severity],
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{check.label}</span>
        <span className="block text-xs text-muted-foreground">{check.detail}</span>
      </span>
    </li>
  );
}
