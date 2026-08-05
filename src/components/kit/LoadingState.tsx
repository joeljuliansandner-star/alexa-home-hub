import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton, SkeletonCard } from "./Skeleton";

/**
 * Einheitlicher Ladezustand.
 * Statt eines Spinners zeigen ganze Seiten/Abschnitte ruhige Skeletons,
 * damit keine sichtbaren "Ladepausen" entstehen.
 */
export function LoadingState({
  size = "page",
  className,
}: {
  size?: "page" | "section" | "inline";
  className?: string;
}) {
  if (size === "inline") {
    return (
      <div className={cn("flex h-24 items-center justify-center", className)}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Inhalte werden geladen"
      className={cn("space-y-6", className)}
    >
      {size === "page" ? (
        <div className="panel space-y-4 p-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-3 w-48" />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: size === "page" ? 6 : 3 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  );
}
