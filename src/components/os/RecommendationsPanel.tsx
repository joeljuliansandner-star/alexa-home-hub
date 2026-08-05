import { Link } from "@tanstack/react-router";
import { Lightbulb, Timer, Wrench, Zap } from "lucide-react";

import { EmptyState, Panel } from "@/components/kit";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/os/intelligence";

const kindIcon = {
  automation: Timer,
  quickaction: Zap,
  hinweis: Lightbulb,
  wartung: Wrench,
} as const;

const kindLabel = {
  automation: "Automation vorschlagen",
  quickaction: "Schnellaktion",
  hinweis: "Hinweis",
  wartung: "Wartung",
} as const;

/**
 * Erkannte Muster als Vorschläge. Es wird ausschließlich vorgeschlagen –
 * nichts wird automatisch geändert.
 */
export function RecommendationsPanel({
  recommendations,
  limit,
}: {
  recommendations: Recommendation[];
  limit?: number;
}) {
  const list = limit ? recommendations.slice(0, limit) : recommendations;

  if (!list.length) {
    return (
      <EmptyState description="Noch keine Muster erkannt. Die App lernt im Hintergrund weiter – nach einigen Tagen erscheinen hier Vorschläge." />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.map((item, index) => {
        const Icon = kindIcon[item.kind];
        return (
          <Panel
            key={item.id}
            className="rise-in flex items-start gap-3 p-4"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  {kindLabel[item.kind]}
                </span>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    item.confidence >= 75 ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {item.confidence}% Sicherheit
                </span>
                {item.action ? (
                  <Link
                    to={item.action.to}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    {item.action.label}
                  </Link>
                ) : null}
              </div>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
