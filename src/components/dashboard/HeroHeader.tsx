import { useEffect, useState } from "react";
import { DoorOpen, Home, Moon, Sunrise, Sunset } from "lucide-react";

import { cn } from "@/lib/utils";

function greetingFor(hour: number) {
  if (hour < 5) return { text: "Gute Nacht", icon: Moon };
  if (hour < 11) return { text: "Guten Morgen", icon: Sunrise };
  if (hour < 18) return { text: "Guten Tag", icon: Sunrise };
  return { text: "Guten Abend", icon: Sunset };
}

/**
 * Hero-Kopf des Dashboards: Begrüßung, Uhrzeit und Hausstatus.
 * Rein visuell – der Status wird vom Aufrufer verwaltet.
 */
export function HeroHeader({
  name,
  subtitle,
  away,
  onAwayChange,
}: {
  name: string;
  subtitle: string;
  away: boolean;
  onAwayChange: (next: boolean) => void;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const { text, icon: GreetIcon } = greetingFor(now?.getHours() ?? 9);

  return (
    <header className="hero-glow rise-in panel relative overflow-hidden p-6 sm:p-8">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <GreetIcon className="size-4 text-primary" />
            {now
              ? now.toLocaleDateString("de-DE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Europe/Berlin",
                })
              : "\u00a0"}
          </p>
          <h1 className="mt-2 truncate text-3xl font-semibold sm:text-4xl">
            {text}, {name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex flex-col items-start gap-4 sm:items-end">
          <p className="stat-value text-5xl tabular-nums sm:text-6xl">
            {now
              ? now.toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Berlin",
                })
              : "--:--"}
          </p>

          <div
            role="group"
            aria-label="Hausstatus"
            className="flex w-full gap-1 rounded-full border border-border bg-secondary/60 p-1 sm:w-auto"
          >
            {[
              { label: "Zuhause", value: false, icon: Home },
              { label: "Niemand da", value: true, icon: DoorOpen },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={away === option.value}
                onClick={() => onAwayChange(option.value)}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all duration-300 sm:flex-none",
                  away === option.value
                    ? "bg-primary text-primary-foreground shadow-[0_10px_28px_-14px_var(--primary)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <option.icon className="size-4" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
