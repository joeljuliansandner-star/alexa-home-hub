import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Quadratische Icon-Kachel – einheitliche Größe und Farbvarianten. */
export function IconTile({
  icon: Icon,
  tone = "muted",
  className,
}: {
  icon: LucideIcon;
  tone?: "primary" | "accent" | "muted" | "destructive";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
        tone === "primary" &&
          "bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_var(--primary)]",
        tone === "accent" && "bg-accent/15 text-accent",
        tone === "destructive" && "bg-destructive/15 text-destructive",
        tone === "muted" && "bg-secondary text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}
