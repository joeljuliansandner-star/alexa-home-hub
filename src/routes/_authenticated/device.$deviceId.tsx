import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Star, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import {
  deviceKindLabel,
  useDevices,
  useRooms,
  useToggleFavorite,
  useUpdateDevice,
} from "@/lib/smarthome";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

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

  if (devices.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="panel flex flex-col items-center gap-4 p-10 text-center">
        <h1 className="text-xl font-semibold">Gerät nicht gefunden</h1>
        <Button asChild variant="secondary">
          <Link to="/dashboard">Zurück zur Übersicht</Link>
        </Button>
      </div>
    );
  }

  const room = (rooms.data ?? []).find((r) => r.id === device.room_id);
  const isSensor = device.kind === "sensor" || device.kind === "thermostat";

  const facts: { label: string; value: string }[] = [
    { label: "Typ", value: deviceKindLabel[device.kind] ?? device.kind },
    { label: "Raum", value: room?.name ?? "Ohne Raum" },
    { label: "Hersteller", value: device.manufacturer ?? "—" },
    { label: "Modell", value: device.model ?? "—" },
    { label: "Quelle", value: device.external_source ?? "manuell" },
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
    <div className="space-y-6">
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

      <section className="grid gap-3 sm:grid-cols-2">
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
