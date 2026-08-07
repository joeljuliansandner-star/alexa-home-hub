import { useMemo } from "react";
import {
  Bell,
  Info,
  Plug,
  ShieldAlert,
  Timer,
  Trash2,
  TriangleAlert,
  WashingMachine,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/kit";
import { cn } from "@/lib/utils";
import { assistantHints, friendlyName, type Hint } from "@/lib/os/insights";
import { homeAssistant } from "@/services/homeAssistant";
import { useHaEntities, useHaNotifications, useHaStatus } from "@/services/homeAssistant.hooks";
import { useActivity } from "@/lib/smarthome";
import { severityBg } from "./severity";

type Item = {
  id: string;
  title: string;
  detail: string;
  time?: string | undefined;
  tone: keyof typeof severityBg;
  category: Category;
  dismissId?: string;
};

type Category = "warnungen" | "informationen" | "sicherheit" | "automationen" | "geraete" | "wasch";

const tabs: { value: Category | "alle"; label: string }[] = [
  { value: "alle", label: "Alle" },
  { value: "warnungen", label: "Warnungen" },
  { value: "sicherheit", label: "Sicherheit" },
  { value: "geraete", label: "Geräte" },
  { value: "automationen", label: "Automationen" },
  { value: "wasch", label: "Waschen" },
];

const icons: Record<Category, typeof Bell> = {
  warnungen: TriangleAlert,
  informationen: Info,
  sicherheit: ShieldAlert,
  automationen: Timer,
  geraete: Plug,
  wasch: WashingMachine,
};

function categoryOf(hint: Hint): Category {
  if (hint.severity === "warn" || hint.severity === "critical") return "warnungen";
  if (hint.category === "sicherheit") return "sicherheit";
  if (hint.category === "geraete" || hint.category === "wartung") return "geraete";
  return "informationen";
}

/** Benachrichtigungszentrale: HA-Meldungen, Assistenz-Hinweise und Ereignisse. */
export function NotificationCenter({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const entities = useHaEntities();
  const status = useHaStatus();
  const notifications = useHaNotifications();
  const activity = useActivity();

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];

    for (const notification of notifications.data ?? []) {
      list.push({
        id: `ha-${notification.notification_id}`,
        title: notification.title ?? "Home Assistant",
        detail: notification.message,
        time: notification.created_at,
        tone: "info",
        category: "informationen",
        dismissId: notification.notification_id,
      });
    }

    for (const hint of assistantHints({ entities, status })) {
      list.push({
        id: hint.id,
        title: hint.title,
        detail: hint.detail,
        tone: hint.severity,
        category: categoryOf(hint),
      });
    }

    for (const entry of (activity.data ?? []).slice(0, 25)) {
      const text = entry.message.toLowerCase();
      const category: Category = /wasch|trockn|spül/.test(text)
        ? "wasch"
        : /automation|szene|regel/.test(text)
          ? "automationen"
          : "geraete";
      list.push({
        id: `log-${entry.id}`,
        title: entry.message,
        detail: "Ereignisprotokoll",
        time: entry.created_at,
        tone: "ok",
        category,
      });
    }

    const laundry = entities.filter((entity) =>
      /wasch|trockn|dryer|washer|spülmaschine/.test(friendlyName(entity).toLowerCase()),
    );
    for (const entity of laundry.slice(0, 5)) {
      list.push({
        id: `laundry-state-${entity.entity_id}`,
        title: `${friendlyName(entity)}: ${entity.state}`,
        detail: "Aktueller Zustand aus Home Assistant",
        time: entity.last_changed,
        tone: "info",
        category: "wasch",
      });
    }

    return list;
  }, [notifications.data, entities, status, activity.data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle>Benachrichtigungen</SheetTitle>
          <SheetDescription>
            {items.length} Meldungen aus Home Assistant, Assistent und Protokoll.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="alle" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => {
            const filtered =
              tab.value === "alle" ? items : items.filter((item) => item.category === tab.value);
            return (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
              >
                {filtered.length ? (
                  filtered.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onDismiss={
                        item.dismissId
                          ? async () => {
                              await homeAssistant.dismissNotification(item.dismissId as string);
                              await notifications.refetch();
                            }
                          : undefined
                      }
                    />
                  ))
                ) : (
                  <EmptyState description="Keine Meldungen in dieser Kategorie." />
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function NotificationRow({
  item,
  onDismiss,
}: {
  item: Item;
  onDismiss?: (() => void) | undefined;
}) {
  const Icon = icons[item.category];
  return (
    <div className="panel-glass flex items-start gap-3 p-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          severityBg[item.tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.detail}</p>
        {item.time ? (
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            {new Date(item.time).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : null}
      </div>
      {onDismiss ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Meldung entfernen"
          className="min-h-11 min-w-11 shrink-0"
          onClick={onDismiss}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
