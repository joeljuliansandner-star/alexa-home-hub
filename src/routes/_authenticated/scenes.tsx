import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Play, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  useCreateScene,
  useDeleteRow,
  useDevices,
  useRunScene,
  useSceneActions,
  useScenes,
} from "@/lib/smarthome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { LoadingState, PageHeader, stacks } from "@/components/kit";
import { HaScenesSection } from "@/components/homeassistant/HaAutomationSections";


export const Route = createFileRoute("/_authenticated/scenes")({
  head: () => ({
    meta: [
      { title: "Szenen – Smarthome Control" },
      {
        name: "description",
        content: "Mehrere Geräte mit einem Klick schalten: Szenen anlegen und ausführen.",
      },
      { property: "og:title", content: "Szenen – Smarthome Control" },
      {
        property: "og:description",
        content: "Filmabend, Guten Morgen, Alles aus – Szenen für dein Zuhause.",
      },
    ],
  }),
  component: ScenesPage,
});

function ScenesPage() {
  const scenes = useScenes();
  const actions = useSceneActions();
  const devices = useDevices();
  const runScene = useRunScene();
  const deleteScene = useDeleteRow("scenes");

  const deviceName = (id: string) => devices.data?.find((d) => d.id === id)?.name ?? "Gerät";

  return (
    <div className={stacks.pageTight}>
      <PageHeader
        title="Szenen"
        description="Eine Szene schaltet mehrere Geräte gleichzeitig."
        actions={<NewSceneDialog />}
      />

      <HaScenesSection />


      {scenes.isLoading ? (
        <LoadingState size="section" />
      ) : scenes.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenes.data.map((scene) => {
            const sceneActions = (actions.data ?? []).filter((a) => a.scene_id === scene.id);
            return (
              <div key={scene.id} className="panel flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Sparkles className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold">{scene.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {scene.description ?? `${sceneActions.length} Geräte`}
                      </p>
                    </div>
                  </div>
                  <button
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`${scene.name} löschen`}
                    onClick={() => deleteScene.mutate(scene.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <ul className="flex flex-wrap gap-1.5">
                  {sceneActions.slice(0, 6).map((action) => (
                    <li
                      key={action.id}
                      className="rounded-lg bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                    >
                      {deviceName(action.device_id)} {action.set_on ? "an" : "aus"}
                    </li>
                  ))}
                  {sceneActions.length === 0 ? (
                    <li className="text-xs text-muted-foreground">Keine Geräte zugeordnet</li>
                  ) : null}
                </ul>

                <Button
                  className="mt-auto gap-2"
                  disabled={runScene.isPending || sceneActions.length === 0}
                  onClick={() =>
                    runScene.mutate(scene, {
                      onSuccess: (count) => toast.success(`${count} Geräte geschaltet`),
                    })
                  }
                >
                  <Play className="size-4" /> Ausführen
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          Noch keine Szenen angelegt.
        </div>
      )}
    </div>
  );
}

function NewSceneDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [setOn, setSetOn] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const devices = useDevices();
  const createScene = useCreateScene();

  const switchable = (devices.data ?? []).filter(
    (d) => d.kind !== "sensor" && d.kind !== "thermostat",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Szene
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Szene</DialogTitle>
          <DialogDescription>Wähle die Geräte und den Zielzustand.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scene-name">Name</Label>
            <Input
              id="scene-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Filmabend"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Zielzustand</p>
              <p className="text-xs text-muted-foreground">
                Geräte werden {setOn ? "eingeschaltet" : "ausgeschaltet"}
              </p>
            </div>
            <Switch checked={setOn} onCheckedChange={setSetOn} />
          </div>

          <div className="space-y-2">
            <Label>Geräte</Label>
            <div className="space-y-1.5 rounded-xl border border-border p-3">
              {switchable.map((device) => (
                <label key={device.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={selected.includes(device.id)}
                    onCheckedChange={(checked) =>
                      setSelected((prev) =>
                        checked ? [...prev, device.id] : prev.filter((id) => id !== device.id),
                      )
                    }
                  />
                  {device.name}
                </label>
              ))}
              {switchable.length === 0 ? (
                <p className="text-xs text-muted-foreground">Erst Geräte anlegen.</p>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={!name.trim() || createScene.isPending}
            onClick={() =>
              createScene.mutate(
                {
                  name: name.trim(),
                  icon: "sparkles",
                  description: null,
                  deviceIds: selected,
                  setOn,
                },
                {
                  onSuccess: () => {
                    setName("");
                    setSelected([]);
                    setOpen(false);
                    toast.success("Szene erstellt");
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
