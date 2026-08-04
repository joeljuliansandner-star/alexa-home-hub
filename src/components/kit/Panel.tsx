import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Standardkarte des Design-Systems. */
export function Panel({
  className,
  children,
  hover = false,
  as: Tag = "div",
}: {
  className?: string;
  children?: ReactNode;
  hover?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag className={cn("panel p-5", hover && "panel-hover hover:-translate-y-0.5", className)}>
      {children}
    </Tag>
  );
}

/** Karte mit dezentem Glas-Effekt – für Kopfbereiche und Statuskacheln. */
export function PanelGlass({
  className,
  children,
  hover = false,
  as: Tag = "div",
}: {
  className?: string;
  children?: ReactNode;
  hover?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={cn("panel-glass p-5", hover && "panel-hover hover:-translate-y-0.5", className)}
    >
      {children}
    </Tag>
  );
}
