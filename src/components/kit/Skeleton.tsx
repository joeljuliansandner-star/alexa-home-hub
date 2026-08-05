import { cn } from "@/lib/utils";

/** Basis-Skeleton – ruhiger Shimmer statt Spinner. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden="true" />;
}

/** Platzhalter für eine Gerätekarte. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("panel space-y-4 p-5", className)} aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-7 w-12 rounded-full" />
      </div>
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/** Raster aus Skeleton-Karten – ersetzt sichtbare Ladezeiten. */
export function SkeletonGrid({
  count = 6,
  className,
  label = "Inhalte werden geladen",
}: {
  count?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
