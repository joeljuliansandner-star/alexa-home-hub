import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import {
  EmptyState,
  LoadingState,
  PageHeader,
  Section,
  StatTile,
  grids,
  stacks,
} from "@/components/kit";
import { RoomCard } from "@/components/rooms/RoomCard";
import { Input } from "@/components/ui/input";
import { useDevices, useRooms } from "@/lib/smarthome";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: "Räume – Smarthome Control" },
      {
        name: "description",
        content:
          "Alle Räume deines Zuhauses mit Geräteanzahl, aktiven Geräten, Temperatur und Verbindungsstatus.",
      },
      { property: "og:title", content: "Räume – Smarthome Control" },
      {
        property: "og:description",
        content: "Raumübersicht mit Geräten, Sensorwerten und Online-Status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const rooms = useRooms();
  const devices = useDevices();
  const [search, setSearch] = useState("");

  const list = useMemo(() => devices.data ?? [], [devices.data]);
  const roomList = useMemo(() => rooms.data ?? [], [rooms.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roomList;
    return roomList.filter((room) => room.name.toLowerCase().includes(term));
  }, [roomList, search]);

  if (rooms.isLoading || devices.isLoading) return <LoadingState />;

  const activeTotal = list.filter((d) => d.is_on && d.kind !== "sensor").length;
  const offlineTotal = list.filter((d) => !d.is_online).length;
  const withoutRoom = list.filter((d) => !d.room_id).length;

  return (
    <div className={stacks.page}>
      <PageHeader
        title="Räume"
        description={`${roomList.length} Räume · ${list.length} Geräte · ${activeTotal} aktiv`}
      />

      <div className={grids.stats}>
        <StatTile label="Räume" value={String(roomList.length)} tone="primary" />
        <StatTile label="Geräte" value={String(list.length)} />
        <StatTile label="Aktiv" value={String(activeTotal)} tone="accent" />
        <StatTile
          label="Offline"
          value={String(offlineTotal)}
          tone={offlineTotal > 0 ? "destructive" : "muted"}
        />
      </div>

      <section className="panel-glass p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Raum suchen…"
            aria-label="Raum suchen"
            className="h-11 pl-9"
          />
        </div>
      </section>

      <Section title="Alle Räume">
        {filtered.length === 0 ? (
          <EmptyState
            description={
              roomList.length === 0
                ? "Noch keine Räume angelegt. Räume kommen beim Smart-Life-Abgleich automatisch dazu."
                : "Kein Raum passt zur Suche."
            }
          />
        ) : (
          <div className={grids.cards}>
            {filtered.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                devices={list.filter((d) => d.room_id === room.id)}
              />
            ))}
          </div>
        )}
      </Section>

      {withoutRoom > 0 ? (
        <Section title="Ohne Raum">
          <EmptyState
            description={`${withoutRoom} Geräte sind keinem Raum zugeordnet. Du kannst den Raum auf der Geräte-Detailseite ändern.`}
          />
        </Section>
      ) : null}
    </div>
  );
}
