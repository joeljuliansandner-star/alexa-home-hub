import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Loader2, Plus, Thermometer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  useAutomations,
  useCreateAutomation,
  useDeleteRow,
  useRunScene,
  useScenes,
  useToggleAutomation,
} from "@/lib/smarthome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automationen – Smarthome Control" },
      {
        name: "description",
        content: "Zeit- und sensorbasierte Regeln, die deine Szenen automatisch auslösen.",
      },
      { property: "og:title", content: "Automationen – Smarthome Control" },
      {
        property: "og:description",
        content: "Wecker-Routine, Nachtabschaltung und mehr automatisch schalten.",
      },
    ],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const automations = useAutomations();
  const scenes = useScenes();
  const toggle = useToggleAutomation();
  const remove = useDeleteRow("automations");
  const runScene = useRunScene();

  const sceneName = (id: string | null) =>
    scenes.data?.find((s) => s.id === id)?.name ?? "Keine Szene";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold sm:text-3xl">Automationen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Regeln lösen Szenen aus – zeitgesteuert oder über Sensorwerte.
          </p>
        </div>
        <NewAutomationDialog />
      </header>

      {automations.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : automations.data?.length ? (
        <div className="space-y-3">
          {automations.data.map((automation) => {
            const scene = scenes.data?.find((s) => s.id === automation.scene_id);
            return (
              <div
                key={automation.id}
                className="panel flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                    {automation.trigger_type === "time" ? (
                      <Clock className="size-5" />
                    ) : (
                      <Thermometer className="size-5" />
                    )}
                  </span>
                  <div>
                    <p className="font-semibold">{automation.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {automation.trigger_type === "time" ? "Täglich um " : "Sensor: "}
                      {automation.trigger_value ?? "–"} → {sceneName(automation.scene_id)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {scene ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={runScene.isPending}
                      onClick={() =>
                        runScene.mutate(scene, {
                          onSuccess: () => toast.success("Szene jetzt ausgeführt"),
                        })
                      }
                    >
                      Jetzt testen
                    </Button>
                  ) : null}
                  <Switch
                    checked={automation.is_active}
                    onCheckedChange={() => toggle.mutate(automation)}
                    aria-label={`${automation.name} aktivieren`}
                  />
                  <button
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`${automation.name} löschen`}
                    onClick={() => remove.mutate(automation.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          Noch keine Automationen angelegt.
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Hinweis: Automationen werden hier verwaltet und ausgelöst, sobald das Panel mit einer
        Steuerzentrale verbunden ist. Ohne Bridge kannst du sie manuell testen.
      </p>
    </div>
  );
}

function NewAutomationDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("time");
  const [triggerValue, setTriggerValue] = useState("07:00");
  const [sceneId, setSceneId] = useState("none");
  const scenes = useScenes();
  const create = useCreateAutomation();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Automation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Automation</DialogTitle>
          <DialogDescription>Wähle Auslöser und Szene.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="automation-name">Name</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wecker-Routine"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Auslöser</Label>
              <Select
                value={triggerType}
                onValueChange={(v) => {
                  setTriggerType(v);
                  setTriggerValue(v === "time" ? "07:00" : "Temperatur < 19");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Uhrzeit</SelectItem>
                  <SelectItem value="sensor">Sensorwert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trigger-value">
                {triggerType === "time" ? "Uhrzeit" : "Bedingung"}
              </Label>
              <Input
                id="trigger-value"
                type={triggerType === "time" ? "time" : "text"}
                value={triggerValue}
                onChange={(e) => setTriggerValue(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Szene</Label>
            <Select value={sceneId} onValueChange={setSceneId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Szene</SelectItem>
                {(scenes.data ?? []).map((scene) => (
                  <SelectItem key={scene.id} value={scene.id}>
                    {scene.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() =>
              create.mutate(
                {
                  name: name.trim(),
                  trigger_type: triggerType,
                  trigger_value: triggerValue,
                  scene_id: sceneId === "none" ? null : sceneId,
                },
                {
                  onSuccess: () => {
                    setName("");
                    setOpen(false);
                    toast.success("Automation erstellt");
                  },
                },
              )
            }
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
