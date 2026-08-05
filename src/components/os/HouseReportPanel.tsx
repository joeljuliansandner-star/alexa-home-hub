import { Panel, PanelGlass } from "@/components/kit";
import { cn } from "@/lib/utils";
import type { HouseReport } from "@/lib/os/intelligence";

function scoreTone(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-accent";
  if (score >= 50) return "text-primary";
  return "text-destructive";
}

function scoreBar(score: number) {
  if (score >= 85) return "bg-success";
  if (score >= 70) return "bg-accent";
  if (score >= 50) return "bg-primary";
  return "bg-destructive";
}

/** Täglicher Gesundheitsbericht des Hauses mit Gesamtscore und Teilbereichen. */
export function HouseReportPanel({
  report,
  compact = false,
}: {
  report: HouseReport;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      <PanelGlass className="flex flex-wrap items-center gap-5">
        <div className="relative flex size-24 shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="size-24 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              strokeWidth="3"
              className="stroke-secondary"
            />
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${report.score} 100`}
              className={cn("transition-all duration-700", scoreTone(report.score))}
              stroke="currentColor"
            />
          </svg>
          <span className="absolute flex flex-col items-center">
            <span className={cn("font-display text-2xl font-semibold tabular-nums", scoreTone(report.score))}>
              {report.score}
            </span>
            <span className="text-[10px] text-muted-foreground">von 100</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{report.grade}</p>
          <p className="text-xs text-muted-foreground">{report.headline}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Bericht erstellt am{" "}
            {new Date(report.generatedAt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </PanelGlass>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {report.categories.map((category, index) => (
          <Panel
            key={category.id}
            className="rise-in space-y-2 p-4"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">{category.label}</p>
              <span className={cn("text-sm font-semibold tabular-nums", scoreTone(category.score))}>
                {category.score}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all duration-700", scoreBar(category.score))}
                style={{ width: `${category.score}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{category.detail}</p>
            {!compact && category.improvements.length ? (
              <ul className="space-y-1 pt-1">
                {category.improvements.map((item) => (
                  <li key={item} className="text-[11px] text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        ))}
      </div>
    </div>
  );
}
