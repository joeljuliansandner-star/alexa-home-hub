import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Listenkarte mit Trennlinien – für Protokolle, Verläufe, einfache Tabellen. */
export function EntryList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("panel divide-y divide-border p-1", className)}>{children}</ul>;
}

/** Zeile innerhalb einer EntryList: Text links, Meta-Angabe rechts. */
export function EntryRow({
  children,
  meta,
  className,
}: {
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("flex items-center justify-between gap-4 px-3 py-2.5 text-sm", className)}>
      <span className="min-w-0 truncate">{children}</span>
      {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
    </li>
  );
}
