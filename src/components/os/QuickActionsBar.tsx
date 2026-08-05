import { useState } from "react";
import {
  Blinds,
  Lightbulb,
  Moon,
  PlayCircle,
  Plug,
  Plus,
  Power,
  Sparkles,
  Timer,
  Trash2,
  Tv,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pressable } from "@/components/kit";
import { cn } from "@/lib/utils";
import { actionDomains, runQuickAction } from "@/lib/os/actions";
import { useQuickActions, type QuickAction, type QuickActionKind } from "@/lib/os/prefs";
import { friendlyName } from "@/lib/os/insights";
import { useHaAutomations, useHaEntities, useHaScenes } from "@/services/homeAssistant.hooks";

const iconMap: Record<string, typeof Lightbulb> = {
  lightbulb: Lightbulb,
  blinds: Blinds,
  plug: Plug,
  moon: Moon,
  scene: PlayCircle,
  automation: Timer,
  tv: Tv,
  cook: UtensilsCrossed,
  power: Power,
  sparkles: Sparkles,
};

const iconChoices = Object.keys(iconMap);

/** Eigene Schnellaktionen: ausführen, anlegen und entfernen. */
export function QuickActionsBar() {
  const { actions, add, remove } = useQuickActions();
  const entities = useHaEntities();
  const scenes = useHaScenes();
  const automations = useHaAutomations();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<QuickActionKind>("domain-off");
  const [target, setTarget] = useState("light");
  const [icon, setIcon] = useState("sparkles");
  const [busy, setBusy] = useState<string | null>(null);

  async function execute(action: QuickAction) {
    setBusy(action.id);
    try {
      const count = await runQuickAction(action, entities);
      toast.success(
        count ? `${action.label}: ${count} Ziele geschaltet` : `${action.label}: nichts zu tun`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  const targetOptions =
    kind === "scene"
      ? scenes.map((entity) => ({ value: entity.entity_id, label: friendlyName(entity) }))
      : kind === "automation"
        ? automations.map((entity) => ({ value: entity.entity_id, label: friendlyName(entity) }))
        : actionDomains.map((domain) => ({ value: domain.value, label: domain.label }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = iconMap[action.icon] ?? Sparkles;
          return (
            <div key={action.id} className="relative">
              <Pressable
                onPress={() => void execute(action)}
                disabled={busy === action.id}
                className="panel panel-hover flex h-full min-h-28 w-full flex-col items-start justify-between gap-3 p-4 hover:-translate-y-0.5"
              >
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground transition-colors",
                    busy === action.id && "bg-primary text-primary-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate pr-8 text-sm font-semibold">{action.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {kindLabel(action)}
                  </span>
                </span>
              </Pressable>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${action.label} entfernen`}
                onClick={() => remove(action.id)}
                className="absolute right-1.5 top-1.5 size-9 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="panel flex min-h-28 flex-col items-center justify-center gap-2 border-dashed text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="size-5" />
          Neue Schnellaktion
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schnellaktion erstellen</DialogTitle>
            <DialogDescription>
              Wähle, was passieren soll – die Aktion erscheint sofort auf der Startseite.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Name, z. B. Gute Nacht"
              aria-label="Name der Schnellaktion"
              className="h-11"
            />

            <Select
              value={kind}
              onValueChange={(value) => {
                const next = value as QuickActionKind;
                setKind(next);
                setTarget(next === "domain-off" || next === "domain-on" ? "light" : "");
              }}
            >
              <SelectTrigger className="h-11" aria-label="Art der Aktion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="domain-off">Alles ausschalten</SelectItem>
                <SelectItem value="domain-on">Alles einschalten</SelectItem>
                <SelectItem value="scene">Szene starten</SelectItem>
                <SelectItem value="automation">Automation auslösen</SelectItem>
              </SelectContent>
            </Select>

            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="h-11" aria-label="Ziel">
                <SelectValue placeholder="Ziel wählen" />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2">
              {iconChoices.map((key) => {
                const Icon = iconMap[key] ?? Sparkles;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={`Symbol ${key}`}
                    onClick={() => setIcon(key)}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl border transition-colors",
                      icon === key
                        ? "border-primary/50 bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={!label.trim() || !target}
              onClick={() => {
                add({ label: label.trim(), kind, target, icon });
                setLabel("");
                setOpen(false);
                toast.success("Schnellaktion gespeichert");
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function kindLabel(action: QuickAction) {
  if (action.kind === "scene") return "Szene";
  if (action.kind === "automation") return "Automation";
  if (action.kind === "script") return "Skript";
  const domain = actionDomains.find((entry) => entry.value === action.target);
  return `${domain?.label ?? action.target} ${action.kind === "domain-on" ? "an" : "aus"}`;
}
