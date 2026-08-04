import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Lightbulb, Plug, Search, Star, Zap, Gauge } from "lucide-react";
import { toast } from "sonner";

import {
  EmptyState,
  EntryList,
  EntryRow,
  IconTile,
  LoadingState,
  Panel,
  PageHeader,
  Section,
  StatTile,
  grids,
  stacks,
} from "@/components/kit";
import { DeviceCard } from "@/components/DeviceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useBulkToggleKind,
  useDevices,
  useRooms,
  useToggleFavorite,
  useUpdateDevice,
} from "@/lib/smarthome";
import {
  categoryLabel,
  categoryOrder,
  deviceCategory,
  roomIcon,
  roomStats,
} from "@/components/rooms/roomStats";

export const Route = createFileRoute("/_authenticated/room/$roomId")({
  head: () => ({
    meta: [
      { title: "Raumdetails – Smarthome Control" },
      {
        name: "description",
        content: "Alle Geräte eines Raumes nach Kategorien, mit Suche, Favoriten und Schnellaktionen.",
      },
      { property: "og:title", content: "Raumdetails – Smarthome Control" },
      {
        property: "og:description",
        content: "Geräte eines Raumes steuern, filtern und Rauminformationen einsehen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomDetail,
});

function RoomDetail() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const rooms = useRooms();
  const devices = useDevices();
  const updateDevice = useUpdateDevice();
  const toggleFavorite = useToggleFavorite();
  const bulkToggle = useBulkToggleKind();

  const [search, setSearch] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const room = (rooms.data ?? []).find((r) => r.id === roomId);
  const roomDevices = useMemo(
    () => (devices.data ?? []).filter((d) => d.room_id === roomId),
    [devices.data, roomId],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roomDevices.filter((d) => {
      if (term && !d.name.toLowerCase().includes(term)) return false;
      if (onlyFavorites && !d.is_favorite) return false;
      return true;
    });
  }, [roomDevices, search, onlyFavorites]);

  const grouped = useMemo(
    () =>
      categoryOrder
        .map((id) => ({ id, devices: filtered.filter((d) => deviceCategory(d) === id) }))
        .filter((group) => group.devices.length > 0),
    [filtered],
  );

  if (rooms.isLoading || devices.isLoading) return <LoadingState />;

  if (!room) {
    return (
      <EmptyState
        variant="card"
        title="Raum nicht gefunden"
        description="Dieser Raum existiert nicht mehr."
        actions={
          <Button onClick={() => navigate({ to: "/rooms" })}>
            <ArrowLeft className="size-4" /> Zur Raumübersicht
          </Button>
        }
      />
    );
  }

  const stats = roomStats(roomDevices);
  const Icon = roomIcon(room.icon);
  const lights = roomDevices.filter((d) => d.kind === "light");
  const plugs = roomDevices.filter((d) => d.kind === "plug");
  const favorites = roomDevices.filter((d) => d.is_favorite);

  const bulk = (list: typeof roomDevices, on: boolean, label: string) =>
    bulkToggle.mutate(
      { devices: list, on },
      { onSuccess: (count) => toast.success(`${label}: ${count} Geräte ${on ? "an" : "aus"}`) },
    );

  return (
    <div className={stacks.pageTight}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-2 text-muted-foreground"
        onClick={() => navigate({ to: "/rooms" })}
      >
        <ArrowLeft className="size-4" /> Räume
      </Button>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <IconTile icon={Icon} tone={stats.active > 0 ? "primary" : "muted"} />
            <span className="truncate">{room.name}</span>
          </span>
        }
        description={`${stats.total} Geräte · ${stats.active} aktiv · ${
          stats.offline > 0 ? `${stats.offline} offline` : "alle online"
        }`}
      />

      <div className={grids.stats}>
        <StatTile label="Geräte" value={String(stats.total)} tone="primary" />
        <StatTile label="Aktiv" value={String(stats.active)} tone="accent" />
        <StatTile
          label="Temperatur"
          value={stats.temperature != null ? `${stats.temperature} °C` : "–"}
        />
        <StatTile label="Luftfeuchte" value={stats.humidity != null ? `${stats.humidity} %` : "–"} />
      </div>

      <Section title="Schnellaktionen">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            variant="secondary"
            className="h-11 justify-start gap-2"
            disabled={!lights.length || bulkToggle.isPending}
            onClick={() => bulk(lights, true, "Alle Lichter")}
          >
            <Lightbulb className="size-4 text-primary" /> Alle Lichter an
          </Button>
          <Button
            variant="secondary"
            className="h-11 justify-start gap-2"
            disabled={!lights.length || bulkToggle.isPending}
            onClick={() => bulk(lights, false, "Alle Lichter")}
          >
            <Lightbulb className="size-4" /> Alle Lichter aus
          </Button>
          <Button
            variant="secondary"
            className="h-11 justify-start gap-2"
            disabled={!plugs.length || bulkToggle.isPending}
            onClick={() => bulk(plugs, true, "Alle Steckdosen")}
          >
            <Plug className="size-4 text-primary" /> Alle Steckdosen an
          </Button>
          <Button
            variant="secondary"
            className="h-11 justify-start gap-2"
            disabled={!plugs.length || bulkToggle.isPending}
            onClick={() => bulk(plugs, false, "Alle Steckdosen")}
          >
            <Plug className="size-4" /> Alle Steckdosen aus
          </Button>
        </div>
      </Section>

      <section className="panel-glass space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Gerät im Raum suchen…"
            aria-label="Gerät im Raum suchen"
            className="h-11 pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyFavorites((v) => !v)}
          className={cn(
            "flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all duration-200",
            onlyFavorites
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          <Star className={cn("size-4", onlyFavorites && "fill-current")} />
          Nur Favoriten ({favorites.length})
        </button>
      </section>

      {grouped.length === 0 ? (
        <EmptyState
          description={
            roomDevices.length === 0
              ? "In diesem Raum ist noch kein Gerät zugeordnet."
              : "Kein Gerät passt zur Suche."
          }
        />
      ) : (
        grouped.map((group) => (
          <Section
            key={group.id}
            title={categoryLabel[group.id]}
            action={
              <span className="text-xs text-muted-foreground">
                {group.devices.filter((d) => d.is_on && d.kind !== "sensor").length} aktiv
              </span>
            }
          >
            <div className={grids.cards}>
              {group.devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onToggle={(next) =>
                    updateDevice.mutate({
                      device,
                      patch: { is_on: next },
                      log: `${device.name} ${next ? "eingeschaltet" : "ausgeschaltet"}`,
                    })
                  }
                  onBrightness={(value) =>
                    updateDevice.mutate({
                      device,
                      patch: { brightness: value },
                      log: `${device.name} auf ${value}% gedimmt`,
                    })
                  }
                  onFavorite={(next) => toggleFavorite.mutate({ device, value: next })}
                  onOpen={() =>
                    navigate({ to: "/device/$deviceId", params: { deviceId: device.id } })
                  }
                />
              ))}
            </div>
          </Section>
        ))
      )}

      <Section title="Rauminformationen">
        <EntryList>
          <EntryRow meta={room.name}>Raumname</EntryRow>
          <EntryRow meta={String(stats.total)}>Geräte im Raum</EntryRow>
          <EntryRow meta={String(stats.active)}>Aktive Geräte</EntryRow>
          <EntryRow meta={stats.offline > 0 ? `${stats.offline} offline` : "alle online"}>
            Verbindung
          </EntryRow>
          <EntryRow meta={new Date(room.created_at).toLocaleDateString("de-DE")}>
            Angelegt am
          </EntryRow>
        </EntryList>
      </Section>

      <Section title="Bald verfügbar">
        <div className={grids.pairs}>
          <Panel className="flex items-center gap-3 p-4">
            <IconTile icon={Gauge} tone="accent" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Weitere Sensorwerte</p>
              <p className="text-xs text-muted-foreground">
                Luftqualität, CO₂ und Helligkeit – sobald passende Sensoren verbunden sind.
              </p>
            </div>
          </Panel>
          <Panel className="flex items-center gap-3 p-4">
            <IconTile icon={Zap} tone="accent" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Energieverbrauch</p>
              <p className="text-xs text-muted-foreground">
                Verbrauch pro Raum und Tag – Platzhalter für kommende Messdaten.
              </p>
            </div>
          </Panel>
        </div>
      </Section>
    </div>
  );
}
