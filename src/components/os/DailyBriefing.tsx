import { Link } from "@tanstack/react-router";
import { Brain, ChevronRight } from "lucide-react";

import { PanelGlass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { severityBg } from "./severity";
import { useDailyBriefing } from "@/lib/os/intelligence.hooks";
import { getAiProvider } from "@/lib/ai/service";

/** Tägliche Zusammenfassung in ganzen Sätzen – lokal berechnet. */
export function DailyBriefing({ className }: { className?: string }) {
  const briefing = useDailyBriefing();
  const provider = getAiProvider();

  return (
    <PanelGlass className={cn("rise-in space-y-3", className)}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            severityBg[briefing.severity],
          )}
        >
          <Brain className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{briefing.greeting}.</p>
          <ul className="mt-1 space-y-1">
            {briefing.lines.map((line) => (
              <li key={line} className="text-sm leading-snug text-muted-foreground">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          {provider.local ? "Lokal berechnet – keine externen Dienste" : provider.label}
        </span>
        <Link
          to="/insights"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Smart Insights <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </PanelGlass>
  );
}
