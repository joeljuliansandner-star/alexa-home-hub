import { useMemo } from "react";
import { AlertTriangle, Info, ShieldAlert, Sparkles, Wrench, Zap } from "lucide-react";

import { Panel } from "@/components/kit";
import { cn } from "@/lib/utils";
import { assistantHints, type Hint } from "@/lib/os/insights";
import type { HaEntity, HaStatus } from "@/services/homeAssistant";
import { severityBg } from "./severity";

const categoryIcon = {
  sicherheit: ShieldAlert,
  energie: Zap,
  komfort: Sparkles,
  wartung: Wrench,
  geraete: Info,
} as const;

/** Automatische Hinweise des Assistenten – rein aus Live-Daten abgeleitet. */
export function AssistantPanel({
  entities,
  status,
  rainChance = null,
  limit = 5,
}: {
  entities: HaEntity[];
  status: HaStatus;
  rainChance?: number | null;
  limit?: number;
}) {
  const hints = useMemo(
    () => assistantHints({ entities, status, rainChance }),
    [entities, status, rainChance],
  );

  if (!hints.length) {
    return (
      <Panel className="flex items-center gap-3 p-5">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-success/15 text-success">
          <Sparkles className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Nichts zu tun</p>
          <p className="text-xs text-muted-foreground">
            Der Assistent hat aktuell keine Auffälligkeiten gefunden.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {hints.slice(0, limit).map((hint, index) => (
        <HintCard key={hint.id} hint={hint} index={index} />
      ))}
    </div>
  );
}

function HintCard({ hint, index }: { hint: Hint; index: number }) {
  const Icon = hint.severity === "warn" ? AlertTriangle : categoryIcon[hint.category];
  return (
    <Panel
      className="rise-in flex items-start gap-3 p-4"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          severityBg[hint.severity],
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{hint.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint.detail}</p>
      </div>
    </Panel>
  );
}
