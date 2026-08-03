import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Loader2, Sparkles, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { syncTuyaDevices } from "@/lib/tuya.functions";


import {
  useActivity,
  useCreateDevice,
  useCreateRoom,
  useDeleteRow,
  useDevices,
  useRooms,
  useScenes,
  useRunScene,
  useSeedDemo,
  useUpdateDevice,
  type DeviceKind,
  deviceKindLabel,
} from "@/lib/smarthome";
import { DeviceCard } from "@/components/DeviceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Übersicht – Smarthome Control" },
      {
        name: "description",
        content: "Alle Räume, Geräte und Sensorwerte deines Zuhauses auf einen Blick steuern.",
      },
      { property: "og:title", content: "Übersicht – Smarthome Control" },
      {
        property: "og:description",
        content: "Licht, Steckdosen und Sensoren zentral schalten und überwachen.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const rooms = useRooms();
  const devices = useDevices();
  const scenes = useScenes();
  const activity = useActivity();
  const updateDevice = useUpdateDevice();
  const runScene = useRunScene();
  const seed = useSeedDemo();
  const deleteDevice = useDeleteRow("devices");
  const queryClient = useQueryClient();
  const syncTuya = useMutation({
    mutationFn: () => syncTuyaDevices(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });


  const list = devices.data ?? [];
  const activeCount = list.filter((d) => d.is_on && d.kind !== "sensor").length;
  const sensors = list.filter((d) => d.kind === "sensor" || d.kind === "thermostat");

  const grouped = useMemo(() => {
    const roomList = rooms.data ?? [];
    return [
      ...roomList.map((room) => ({
        id: room.id,
        name: room.name,
        devices: list.filter((d) => d.room_id === room.id),
      })),
      { id: "none", name: "Ohne Raum", devices: list.filter((d) => !d.room_id) },
    ].filter((group) => group.devices.length > 0);
  }, [rooms.data, list]);

  const loading = rooms.isLoading || devices.isLoading;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold">Dein Zuhause ist noch leer</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Hol dir zuerst deine Smart-Life-Geräte aus der Tuya-Cloud – oder lege Räume und Geräte
          manuell an.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() =>
              syncTuya.mutate(undefined, {
                onSuccess: (res) =>
                  toast.success(`${res.imported} Geräte und ${res.rooms} Räume übernommen`),
                onError: (error) =>
                  toast.error(error instanceof Error ? error.message : "Abgleich fehlgeschlagen"),
              })
            }
            disabled={syncTuya.isPending}
          >
            {syncTuya.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Smart Life abgleichen
          </Button>
          <Button
            variant="outline"
            onClick={() => seed.mutate(undefined, { onSuccess: () => toast.success("Beispiel-Setup angelegt") })}
            disabled={seed.isPending}
          >
            {seed.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Beispiel-Setup laden
          </Button>
          <AddRoomDialog />
          <AddDeviceDialog rooms={rooms.data ?? []} />
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Übersicht</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} von {list.filter((d) => d.kind !== "sensor").length} Geräten aktiv ·{" "}
            {(rooms.data ?? []).length} Räume
          </p>
        </div>
        <div className="flex gap-2">
          <AddRoomDialog />
          <AddDeviceDialog rooms={rooms.data ?? []} />
        </div>
      </header>

      {scenes.data?.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Schnellzugriff
          </h2>
          <div className="flex flex-wrap gap-2">
            {scenes.data.map((scene) => (
              <Button
                key={scene.id}
                variant="secondary"
                className="gap-2"
                disabled={runScene.isPending}
                onClick={() =>
                  runScene.mutate(scene, {
                    onSuccess: (count) => toast.success(`„${scene.name}" – ${count} Geräte geschaltet`),
                  })
                }
              >
                <Sparkles className="size-4 text-primary" />
                {scene.name}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {sensors.length ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sensors.map((sensor) => (
            <div key={sensor.id} className="panel p-4">
              <p className="text-xs text-muted-foreground">{sensor.name}</p>
              <p className="mt-1 font-display text-2xl font-semibold text-accent">
                {sensor.sensor_value ?? "–"}
                <span className="ml-1 text-sm text-muted-foreground">{sensor.sensor_unit}</span>
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {grouped.map((group) => (
        <section key={group.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{group.name}</h2>
            <span className="text-xs text-muted-foreground">
              {group.devices.filter((d) => d.is_on && d.kind !== "sensor").length} aktiv
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.devices.map((device) => (
              <div key={device.id} className="group relative">
                <DeviceCard
                  device={device}
                  onToggle={(next) =>
                    updateDevice.mutate({
                      device,
                      patch: { is_on: next },
                      log: `${device.name} ${next ? "eingeschaltet" : "ausgeschaltet"}`,
                    })
                  }
                  onBrightness={(value) =>
                    updateDevice.mutate({ device, patch: { brightness: value } })
                  }
                />
                <button
                  className="absolute right-2 top-14 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label={`${device.name} löschen`}
                  onClick={() => deleteDevice.mutate(device.id)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      {activity.data?.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Letzte Aktivität
          </h2>
          <ul className="panel divide-y divide-border p-1">
            {activity.data.slice(0, 8).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"
              >
                <span className="truncate">{entry.message}</span>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function AddRoomDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createRoom = useCreateRoom();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <Plus className="size-4" /> Raum
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuer Raum</DialogTitle>
          <DialogDescription>Räume gruppieren deine Geräte.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="room-name">Name</Label>
          <Input
            id="room-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Badezimmer"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim() || createRoom.isPending}
            onClick={() =>
              createRoom.mutate(
                { name: name.trim(), icon: "sofa" },
                {
                  onSuccess: () => {
                    setName("");
                    setOpen(false);
                    toast.success("Raum angelegt");
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

function AddDeviceDialog({ rooms }: { rooms: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DeviceKind>("light");
  const [roomId, setRoomId] = useState<string>("none");
  const [alexaName, setAlexaName] = useState("");
  const createDevice = useCreateDevice();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Gerät
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Gerät</DialogTitle>
          <DialogDescription>
            Der Alexa-Name hilft später beim Zuordnen zur Sprachsteuerung.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="device-name">Name</Label>
            <Input
              id="device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stehlampe"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as DeviceKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(deviceKindLabel).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Raum</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ohne Raum</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alexa-name">Alexa-Name (optional)</Label>
            <Input
              id="alexa-name"
              value={alexaName}
              onChange={(e) => setAlexaName(e.target.value)}
              placeholder="Wohnzimmerlicht"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim() || createDevice.isPending}
            onClick={() =>
              createDevice.mutate(
                {
                  name: name.trim(),
                  kind,
                  room_id: roomId === "none" ? null : roomId,
                  manufacturer: null,
                  alexa_name: alexaName.trim() || null,
                },
                {
                  onSuccess: () => {
                    setName("");
                    setAlexaName("");
                    setOpen(false);
                    toast.success("Gerät hinzugefügt");
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
