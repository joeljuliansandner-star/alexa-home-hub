import type { LucideIcon } from "lucide-react";
import { Activity, Lightbulb, Camera, DoorOpen, WashingMachine, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/smarthome";

function iconFor(message: string): { icon: LucideIcon; tone: string } {
  const text = message.toLowerCase();
  if (text.includes("licht")) return { icon: Lightbulb, tone: "bg-primary/15 text-primary" };
  if (text.includes("kamera") || text.includes("bewegung"))
    return { icon: Camera, tone: "bg-accent/12 text-accent" };
  if (text.includes("fenster") || text.includes("tür"))
    return { icon: DoorOpen, tone: "bg-destructive/12 text-destructive" };
  if (text.includes("wasch") || text.includes("trockner"))
    return { icon: WashingMachine, tone: "bg-accent/12 text-accent" };
  if (text.includes("steckdose") || text.includes("strom"))
    return { icon: Zap, tone: "bg-primary/15 text-primary" };
  return { icon: Activity, tone: "bg-secondary text-muted-foreground" };
}

/** Ruhige Aktivitätsliste mit sanftem Zeitstrahl. */
export function ActivityFeed({
  entries,
  limit = 6,
}: {
  entries: ActivityEntry[];
  limit?: number;
}) {
  return (
    <ol className="panel-glass divide-y divide-border/70 overflow-hidden">
      {entries.slice(0, limit).map((entry, index) => {
        const { icon: Icon, tone } = iconFor(entry.message);
        return (
          <li
            key={entry.id}
            className="rise-in flex items-center gap-3 px-4 py-3.5"
            style={{ animationDelay: `${index * 35}ms` }}
          >
            <span
              className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone)}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{entry.message}</span>
            <time
              dateTime={entry.created_at}
              className="shrink-0 text-xs tabular-nums text-muted-foreground"
            >
              {new Date(entry.created_at).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
