import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, DoorOpen, Gauge, Lightbulb, PlayCircle, Search, Timer, User } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { domainOf } from "@/services/homeAssistant";
import { useHaEntities } from "@/services/homeAssistant.hooks";
import { friendlyName } from "@/lib/os/insights";
import { useDevices, useRooms } from "@/lib/smarthome";
import { cn } from "@/lib/utils";

const domainIcon: Record<string, typeof Lightbulb> = {
  light: Lightbulb,
  camera: Camera,
  person: User,
  scene: PlayCircle,
  automation: Timer,
  sensor: Gauge,
  binary_sensor: Gauge,
};

/**
 * Globale Suche über Geräte, Räume, Szenen, Automationen, Sensoren,
 * Kameras und Personen – vollständig aus dem Live-Cache (keine API-Aufrufe).
 */
export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const entities = useHaEntities();
  const devices = useDevices();
  const rooms = useRooms();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const byExternalId = useMemo(() => {
    const map = new Map<string, string>();
    for (const device of devices.data ?? []) {
      if (device.external_id) map.set(device.external_id, device.id);
    }
    return map;
  }, [devices.data]);

  const needle = term.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!needle) return [];
    return entities
      .filter((entity) => {
        const name = friendlyName(entity).toLowerCase();
        return name.includes(needle) || entity.entity_id.toLowerCase().includes(needle);
      })
      .slice(0, 40);
  }, [entities, needle]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof matches>();
    for (const entity of matches) {
      const domain = domainOf(entity.entity_id);
      const bucket = groups.get(domain) ?? [];
      bucket.push(entity);
      groups.set(domain, bucket);
    }
    return [...groups.entries()];
  }, [matches]);

  const roomMatches = useMemo(
    () =>
      needle
        ? (rooms.data ?? []).filter((room) => room.name.toLowerCase().includes(needle)).slice(0, 6)
        : [],
    [rooms.data, needle],
  );

  function close() {
    onOpenChange(false);
    setTerm("");
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={term}
        onValueChange={setTerm}
        placeholder="Geräte, Räume, Szenen, Sensoren suchen…"
      />
      <CommandList>
        {needle ? <CommandEmpty>Nichts gefunden.</CommandEmpty> : null}

        {roomMatches.length ? (
          <CommandGroup heading="Räume">
            {roomMatches.map((room) => (
              <CommandItem
                key={room.id}
                value={`${room.name} raum`}
                onSelect={() => {
                  close();
                  navigate({ to: "/room/$roomId", params: { roomId: room.id } });
                }}
              >
                <DoorOpen className="mr-2 size-4 text-accent" />
                {room.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {grouped.map(([domain, list]) => {
          const Icon = domainIcon[domain] ?? Gauge;
          return (
            <CommandGroup key={domain} heading={domainLabel(domain)}>
              {list.slice(0, 8).map((entity) => {
                const deviceId = byExternalId.get(entity.entity_id);
                return (
                  <CommandItem
                    key={entity.entity_id}
                    value={`${friendlyName(entity)} ${entity.entity_id}`}
                    onSelect={() => {
                      close();
                      if (deviceId) {
                        navigate({ to: "/device/$deviceId", params: { deviceId } });
                      } else if (domain === "camera") {
                        navigate({ to: "/cameras" });
                      } else if (domain === "scene") {
                        navigate({ to: "/scenes" });
                      } else if (domain === "automation") {
                        navigate({ to: "/automations" });
                      } else {
                        navigate({ to: "/status" });
                      }
                    }}
                  >
                    <Icon className="mr-2 size-4 text-muted-foreground" />
                    <span className="truncate">{friendlyName(entity)}</span>
                    <span
                      className={cn(
                        "ml-auto shrink-0 text-xs",
                        entity.state === "on" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {entity.state}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}

        {!needle ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Tipp: Suche mit <kbd className="rounded bg-secondary px-1.5 py-0.5">⌘</kbd> +{" "}
            <kbd className="rounded bg-secondary px-1.5 py-0.5">K</kbd> öffnen.
          </div>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

function domainLabel(domain: string) {
  const labels: Record<string, string> = {
    light: "Lichter",
    switch: "Schalter",
    sensor: "Sensoren",
    binary_sensor: "Melder",
    camera: "Kameras",
    scene: "Szenen",
    automation: "Automationen",
    climate: "Heizung",
    cover: "Rollläden",
    media_player: "Medien",
    vacuum: "Staubsauger",
    person: "Personen",
  };
  return labels[domain] ?? domain;
}

/** Auslöser-Schaltfläche für die globale Suche. */
export function GlobalSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="panel-glass flex min-h-11 w-full items-center gap-2 px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <Search className="size-4" />
      <span>Alles durchsuchen…</span>
      <kbd className="ml-auto hidden rounded bg-secondary px-1.5 py-0.5 text-[11px] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
