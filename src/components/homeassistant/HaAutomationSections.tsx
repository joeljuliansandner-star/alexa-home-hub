/**
 * Szenen und Automationen direkt aus Home Assistant.
 * Es wird nichts hart codiert – alles kommt live aus dem WebSocket-Cache.
 */
import { Play, Sparkles, Timer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useHaAutomationActions,
  useHaAutomations,
  useHaScenes,
  useHaStatus,
  useRunHaScene,
} from "@/services/homeAssistant.hooks";
import type { HaEntity } from "@/services/homeAssistant";

function entityName(entity: HaEntity) {
  return (
    (entity.attributes?.["friendly_name"] as string | undefined) ??
    entity.entity_id.split(".")[1] ??
    entity.entity_id
  );
}

function SectionShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export function HaScenesSection() {
  const scenes = useHaScenes();
  const status = useHaStatus();
  const run = useRunHaScene();

  if (!scenes.length) return null;

  return (
    <SectionShell
      title="Home-Assistant-Szenen"
      hint={`${scenes.length} Szenen · Live über Home Assistant${status.websocket === "open" ? "" : " (offline)"}`}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {scenes.map((scene) => (
          <div key={scene.entity_id} className="panel flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{entityName(scene)}</p>
                <p className="truncate text-xs text-muted-foreground">{scene.entity_id}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              disabled={run.isPending}
              onClick={() =>
                run.mutate(scene.entity_id, {
                  onSuccess: () => toast.success(`${entityName(scene)} gestartet`),
                  onError: (error) => toast.error((error as Error).message),
                })
              }
            >
              <Play className="size-4" /> Start
            </Button>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export function HaAutomationsSection() {
  const automations = useHaAutomations();
  const { trigger, setEnabled } = useHaAutomationActions();

  if (!automations.length) return null;

  return (
    <SectionShell
      title="Home-Assistant-Automationen"
      hint={`${automations.length} Automationen · Status und Steuerung live`}
    >
      <div className="space-y-3">
        {automations.map((automation) => {
          const active = automation.state === "on";
          const lastTriggered = automation.attributes?.["last_triggered"] as string | undefined;
          return (
            <div
              key={automation.entity_id}
              className="panel flex flex-wrap items-center justify-between gap-4 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Timer className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{entityName(automation)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {active ? "Aktiv" : "Deaktiviert"}
                    {lastTriggered
                      ? ` · zuletzt ${new Date(lastTriggered).toLocaleString("de-DE")}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={trigger.isPending}
                  onClick={() =>
                    trigger.mutate(automation.entity_id, {
                      onSuccess: () => toast.success("Automation ausgelöst"),
                      onError: (error) => toast.error((error as Error).message),
                    })
                  }
                >
                  Jetzt auslösen
                </Button>
                <Switch
                  checked={active}
                  aria-label={`${entityName(automation)} aktivieren`}
                  onCheckedChange={(value) =>
                    setEnabled.mutate(
                      { entityId: automation.entity_id, enabled: value },
                      { onError: (error) => toast.error((error as Error).message) },
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
