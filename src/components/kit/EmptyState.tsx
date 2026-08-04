import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Einheitlicher Leerzustand – kompakt (Glas) oder groß (Karte mit Aktionen). */
export function EmptyState({
  title,
  description,
  actions,
  variant = "compact",
  className,
}: {
  title?: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  variant?: "compact" | "card";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <div className={cn("panel-glass p-8 text-center text-sm text-muted-foreground", className)}>
        {description}
      </div>
    );
  }

  return (
    <div className={cn("panel flex flex-col items-center gap-4 p-10 text-center", className)}>
      {title ? <h2 className="text-2xl font-semibold">{title}</h2> : null}
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {actions ? <div className="flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
