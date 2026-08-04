import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Kleine Abschnittsüberschrift (Großbuchstaben, gesperrt, gedämpft). */
export function SectionTitle({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Abschnitt mit Überschrift und einheitlichem Innenabstand. */
export function Section({
  title,
  action,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("space-y-3", className)}>
      {title ? <SectionTitle action={action}>{title}</SectionTitle> : null}
      {children}
    </section>
  );
}
