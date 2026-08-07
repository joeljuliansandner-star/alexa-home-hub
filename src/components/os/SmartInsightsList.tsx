import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Info, Plug, ShieldAlert, Sparkles, Timer, Wrench, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Panel } from "@/components/kit";
import { cn } from "@/lib/utils";
import { severityBg } from "./severity";
import type { Insight, InsightCategory } from "@/lib/os/intelligence";

const insightIcon: Record<InsightCategory, LucideIcon> = {
  sicherheit: ShieldAlert,
  energie: Zap,
  komfort: Sparkles,
  wartung: Wrench,
  geraete: Plug,
  automationen: Timer,
};

const insightLabel: Record<InsightCategory, string> = {
  sicherheit: "Sicherheit",
  energie: "Energie",
  komfort: "Komfort",
  wartung: "Wartung",
  geraete: "Geräte",
  automationen: "Automationen",
};

/** Liste priorisierter Smart Insights. */
export function SmartInsightsList({
  insights,
  limit,
  className,
}: {
  insights: Insight[];
  limit?: number;
  className?: string;
}) {
  const list = limit ? insights.slice(0, limit) : insights;

  if (!list.length) {
    return (
      <Panel className="flex items-center gap-3 p-5">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-success/15 text-success">
          <Sparkles className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Keine Auffälligkeiten</p>
          <p className="text-xs text-muted-foreground">
            Die Analyse findet aktuell nichts, worum du dich kümmern müsstest.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {list.map((insight, index) => (
        <InsightCard key={insight.id} insight={insight} index={index} />
      ))}
    </div>
  );
}

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const Icon =
    insight.severity === "critical" ? AlertTriangle : (insightIcon[insight.category] ?? Info);
  return (
    <Panel
      className="rise-in flex items-start gap-3 p-4"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          severityBg[insight.severity],
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{insight.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{insight.detail}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
            {insightLabel[insight.category]}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            Priorität {insight.priority}
          </span>
          {insight.action ? (
            <Link
              to={insight.action.to}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              {insight.action.label}
            </Link>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
