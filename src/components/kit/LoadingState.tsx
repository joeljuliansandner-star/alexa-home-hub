import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Einheitlicher Ladezustand. */
export function LoadingState({
  size = "page",
  className,
}: {
  size?: "page" | "section" | "inline";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        size === "page" && "h-64",
        size === "section" && "h-40",
        size === "inline" && "h-24",
        className,
      )}
    >
      <Loader2
        className={cn(
          "animate-spin text-muted-foreground",
          size === "inline" ? "size-5" : "size-6",
        )}
      />
    </div>
  );
}
