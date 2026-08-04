import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Pencil, Star, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import {
  deviceKindLabel,
  deviceSourceLabel,
  useDeviceHistory,
  useDevices,
  useRooms,
  useToggleFavorite,
  useUpdateDevice,
} from "@/lib/smarthome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EmptyState, EntryList, EntryRow, LoadingState, grids, stacks } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/device/$deviceId")({
  head: () => ({
    meta: [
      { title: "Gerätedetails – Smarthome Control" },
      {
        name: "description",
        content: "Details, Status und Einstellungen eines einzelnen Geräts.",
      },
      { property: "og:title", content: "Gerätedetails – Smarthome Control" },
      {
        property: "og:description",
        content: "Details, Status und Einstellungen eines einzelnen Geräts.",
      },
    ],
  }),
  component: DeviceDetail,
});

function DeviceDetail() {
  const { deviceId } = Route.useParams();
  const navigate = useNavigate();
  const devices = useDevices();
  const rooms = useRooms();
  const updateDevice = useUpdateDevice();
  const toggleFavorite = useToggleFavorite();

  const device = (devices.data ?? []).find((d) => d.id === deviceId);
  const history = useDeviceHistory(device?.name);

  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("none");

  useEffect(() => {
    if (device) {
      setName(device.name);
      setRoomId(device.room_id ?? "none");
    }
  }, [device?.id, device?.name, device?.room_id]);

  if (devices.isLoading) {
    return <LoadingState />;
  }

  if (!device) {
    return (
      <EmptyState
        variant="card"
        title="Gerät nicht gefunden"
        description="Dieses Gerät existiert nicht mehr oder wurde entfernt."
        actions={
          <Button asChild variant="secondary" className="min-h-11">
            <Link to="/dashboard">Zurück zur Übersicht</Link>
          </Button>
        }
      />
    );
  }

  const room = (rooms.data ?? []).find((r) => r.id === device.room_id);
  const isSensor = device.kind === "sensor" || device.kind === "thermostat";

  const facts: { label: string; value: string }[] = [
    { label: "Typ", value: deviceKindLabel[device.kind] ?? device.kind },
    { label: "Raum", value: room?.name ?? "Ohne Raum" },
    { label: "Hersteller", value: device.manufacturer ?? "—" },
    { label: "Modell", value: device.model ?? "—" },
    {
      label: "Verbindung",
      value: device.external_source
        ? (deviceSourceLabel[device.external_source] ?? device.external_source)
        : "manuell",
    },
    { label: "Alexa-Name", value: device.alexa_name ?? "—" },
    {
      label: "Zuletzt aktualisiert",
      value: new Date(device.updated_at).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
    {
      label: "Status",
      value: isSensor
        ? `${device.sensor_value ?? "–"} ${device.sensor_unit ?? ""}`.trim()
        : device.is_on
          ? "eingeschaltet"
          : "ausgeschaltet",
    },
  ];

  return (
    <div className={stacks.pageTight}>
      <button
        onClick={() => navigate({ to: "/dashboard" })}
        className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Zurück
      </button>

      <header className="panel-glass flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold sm:text-3xl">{device.name}</h1>
          <p
            className={cn(
              "mt-1.5 flex items-center gap-1.5 text-sm",
              device.is_online ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {device.is_online ? (
              <>
                <Wifi className="size-4 text-success" /> online
              </>
            ) : (
              <>
                <WifiOff className="size-4" /> offline
              </>
            )}
            <span className="text-muted-foreground">· {room?.name ?? "Ohne Raum"}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            className="min-h-11 gap-2"
            onClick={() =>
              toggleFavorite.mutate(
                { device, value: !device.is_favorite },
                {
                  onSuccess: () =>
                    toast.success(
                      device.is_favorite ? "Favorit entfernt" : "Zu Favoriten hinzugefügt",
                    ),
                },
              )
            }
          >
            <Star className={cn("size-4", device.is_favorite && "fill-current text-primary")} />
            Favorit
          </Button>
          {!isSensor ? (
            <Switch
              checked={device.is_on}
              aria-label={device.name}
              onCheckedChange={(next) =>
                updateDevice.mutate({
                  device,
                  patch: { is_on: next },
                  log: `${device.name} ${next ? "eingeschaltet" : "ausgeschaltet"}`,
                })
              }
            />
          ) : (
            <span className="stat-value text-3xl text-accent">
              {device.sensor_value ?? "–"}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {device.sensor_unit}
              </span>
            </span>
          )}
        </div>
      </header>

      {device.kind === "light" && device.is_on ? (
        <section className="panel space-y-3 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Helligkeit</span>
            <span className="stat-value">{device.brightness}%</span>
          </div>
          <Slider
            value={[device.brightness]}
            min={1}
            max={100}
            step={1}
            onValueCommit={(v) =>
              updateDevice.mutate({ device, patch: { brightness: v[0] ?? device.brightness } })
            }
          />
        </section>
      ) : null}

      <section className="panel space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Gerät bearbeiten
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="device-name">Name</Label>
            <Input
              id="device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="device-room">Raum</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger id="device-room" className="h-11">
                <SelectValue placeholder="Raum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ohne Raum</SelectItem>
                {(rooms.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          className="min-h-11 w-full gap-2 sm:w-auto"
          disabled={
            updateDevice.isPending ||
            !name.trim() ||
            (name.trim() === device.name && roomId === (device.room_id ?? "none"))
          }
          onClick={() =>
            updateDevice.mutate(
              {
                device,
                patch: { name: name.trim(), room_id: roomId === "none" ? null : roomId },
                log: `${device.name} bearbeitet`,
              },
              { onSuccess: () => toast.success("Gerät gespeichert") },
            )
          }
        >
          <Pencil className="size-4" /> Speichern
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Letzte Schaltvorgänge
        </h2>
        {history.isLoading ? (
          <div className="panel flex h-24 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.data?.length ? (
          <EntryList>
            {history.data.map((entry) => (
              <EntryRow
                key={entry.id}
                meta={new Date(entry.created_at).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              >
                {entry.message}
              </EntryRow>
            ))}
          </EntryList>
        ) : (
          <EmptyState description="Noch keine Schaltvorgänge protokolliert." />
        )}
      </section>

      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Geräteinformationen
      </h2>
      <section className={grids.pairs}>
        {facts.map((fact) => (
          <div key={fact.label} className="panel h-full p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{fact.label}</p>
            <p className="mt-1 truncate text-sm font-medium">{fact.value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
