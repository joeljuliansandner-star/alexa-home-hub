import { cn } from "@/lib/utils";

export type StatTone = "primary" | "accent" | "destructive" | "muted";

/** Statuskachel für Kennzahlen (Startseite, Detailseiten). */
export function StatTile({
  label,
  value,
  tone = "muted",
  className,
}: {
  label: string;
  value: string;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div className={cn("panel-glass flex h-full flex-col justify-between p-4", className)}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "stat-value mt-2 text-2xl",
          tone === "primary" && "text-primary",
          tone === "accent" && "text-accent",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
