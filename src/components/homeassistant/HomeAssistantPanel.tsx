import { Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, Server, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  EntryList,
  EntryRow,
  IconTile,
  LoadingState,
  PageHeader,
  Panel,
  Section,
  StatTile,
  grids,
  stacks,
} from "@/components/kit";
import { HomeAssistantWizard } from "./HomeAssistantWizard";
import { homeAssistant } from "@/services/homeAssistant";
import { useHaConnection, useHaStatus, useHaSync } from "@/services/homeAssistant.hooks";
import { useDevices } from "@/lib/smarthome";

const websocketLabel: Record<string, string> = {
  open: "Verbunden",
  connecting: "Verbindet …",
  closed: "Getrennt",
  error: "Fehler",
};

const restLabel: Record<string, string> = {
  ok: "Erreichbar",
  error: "Fehler",
  unknown: "Noch nicht geprüft",
};

/** Integrationsseite für Home Assistant inklusive Entwicklerbereich. */
export function HomeAssistantPanel() {
  const connection = useHaConnection();
  const status = useHaStatus();
  const sync = useHaSync();
  const devices = useDevices();

  if (connection.isLoading) return <LoadingState />;

  const haDevices = (devices.data ?? []).filter((device) => device.external_source === "homeassistant");
  const online = haDevices.filter((device) => device.is_online).length;

  return (
    <div className={stacks.pageTight}>
      <PageHeader
        title="Home Assistant"
        description="Zentrale Plattform für alle Geräte, Räume und Live-Zustände."
        actions={
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/integrations">
              <ArrowLeft className="size-4" /> Integrationen
            </Link>
          </Button>
        }
      />

      {!connection.data ? (
        <HomeAssistantWizard onConnected={() => connection.refetch()} />
      ) : (
        <>
          <Panel className="flex flex-wrap items-center gap-3">
            <IconTile icon={Server} tone={status.websocket === "open" ? "primary" : "muted"} />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {status.websocket === "open" ? "Live verbunden" : "Verbindung hinterlegt"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {connection.data.baseUrl}
                {connection.data.version ? ` · Version ${connection.data.version}` : ""}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                className="gap-2"
                disabled={sync.isPending}
                onClick={() =>
                  sync.mutate(undefined, {
                    onSuccess: (result) =>
                      toast.success(
                        `${result.created} neu, ${result.updated} aktualisiert, ${result.rooms} Räume`,
                      ),
                    onError: (error) => toast.error(error.message),
                  })
                }
              >
                <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} />
                Abgleich starten
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={async () => {
                  await homeAssistant.forgetConnection();
                  await connection.refetch();
                  toast.success("Verbindung entfernt");
                }}
              >
                <Unplug className="size-4" /> Trennen
              </Button>
            </div>
          </Panel>

          <Section title="Status">
            <div className={grids.stats}>
              <StatTile label="Geräte" value={String(haDevices.length)} tone="primary" />
              <StatTile label="Online" value={String(online)} tone="accent" />
              <StatTile label="Entitäten" value={String(status.entityCount)} tone="muted" />
              <StatTile
                label="Letzter Abgleich"
                value={
                  status.lastSyncAt
                    ? new Date(status.lastSyncAt).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Noch nie"
                }
                tone="muted"
              />
            </div>
          </Section>

          <Section title="Entwicklerbereich (Debug)">
            <Panel>
              <EntryList>
                <EntryRow title="REST API" meta={restLabel[status.rest] ?? status.rest} />
                <EntryRow
                  title="WebSocket API"
                  meta={websocketLabel[status.websocket] ?? status.websocket}
                />
                <EntryRow
                  title="Antwortzeit"
                  meta={status.latencyMs != null ? `${status.latencyMs} ms` : "—"}
                />
                <EntryRow title="Home Assistant Version" meta={status.version ?? "unbekannt"} />
                <EntryRow title="Standort" meta={status.locationName ?? "—"} />
                <EntryRow title="Entitäten" meta={String(status.entityCount)} />
                <EntryRow title="Geräte (Registry)" meta={String(status.deviceCount)} />
                <EntryRow
                  title="Letzte Synchronisierung"
                  meta={status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString("de-DE") : "Noch nie"}
                />
                <EntryRow title="Letzter Fehler" meta={status.lastError ?? "Keiner"} />
              </EntryList>
            </Panel>
          </Section>
        </>
      )}
    </div>
  );
}
