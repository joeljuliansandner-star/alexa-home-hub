import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  EmptyState,
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
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { getAlexaDevice } from "@/lib/alexa.functions";
import { ALEXA_NO_DEVICE_API, alexaValue } from "@/lib/alexa/model";
import { useAlexaControl } from "@/lib/alexa/hooks";

export const Route = createFileRoute("/_authenticated/alexa/$deviceId")({
  head: () => ({
    meta: [
      { title: "Echo-Gerät – Smarthome Control" },
      {
        name: "description",
        content: "Details, Status und Steuerung eines Amazon-Echo-Geräts.",
      },
      { property: "og:title", content: "Echo-Gerät – Smarthome Control" },
      { property: "og:description", content: "Status und Steuerung eines Alexa-Geräts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlexaDevicePage,
});

function AlexaDevicePage() {
  const { deviceId } = useParams({ from: "/_authenticated/alexa/$deviceId" });
  const fetchDevice = useServerFn(getAlexaDevice);
  const device = useQuery({
    queryKey: ["alexa", "device", deviceId],
    queryFn: () => fetchDevice({ data: { deviceId } }),
  });
  const control = useAlexaControl();
  const [volume, setVolume] = useState(40);

  if (device.isLoading) return <LoadingState />;

  const item = device.data;
  if (!item) {
    return (
      <div className={stacks.page}>
        <PageHeader title="Echo-Gerät" description="Dieses Gerät ist nicht bekannt." />
        <EmptyState
          variant="card"
          description="Das Gerät wurde nicht gefunden. Starte einen Abgleich mit Amazon."
          actions={
            <Button asChild variant="secondary">
              <Link to="/integration/$integrationId" params={{ integrationId: "alexa" }}>
                Zur Alexa-Integration
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Amazon bietet über Login with Amazon keine dokumentierte Steuer-API.
  const canControl = false;

  return (
    <div className={stacks.pageTight}>
      <PageHeader
        title={item.name}
        description={`${item.typeLabel} · ${alexaValue(item.room)}`}
        actions={
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/integration/$integrationId" params={{ integrationId: "alexa" }}>
              <ArrowLeft className="size-4" /> Alexa
            </Link>
          </Button>
        }
      />

      <div className={grids.stats}>
        <StatTile
          label="Verbindung"
          value={item.isOnline ? "Online" : "Offline"}
          tone={item.isOnline ? "primary" : "destructive"}
        />
        <StatTile label="Gerätetyp" value={item.typeLabel} tone="accent" />
        <StatTile label="Firmware" value={alexaValue(item.firmwareVersion)} />
        <StatTile label="WLAN" value={alexaValue(item.wifiStatus)} />
      </div>

      <Section title="Steuerung">
        <Panel className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Volume2 className="size-4 text-primary" /> Lautstärke
              </span>
              <span className="text-muted-foreground">{volume}%</span>
            </div>
            <Slider
              value={[volume]}
              min={0}
              max={100}
              step={1}
              disabled={!canControl || control.isPending}
              onValueChange={(value) => setVolume(value[0] ?? volume)}
              onValueCommit={(value) =>
                control.mutate({ deviceId: item.deviceId, volume: value[0] ?? volume })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <VolumeX className="size-4 text-primary" /> Stummschaltung
            </span>
            <Switch
              disabled={!canControl || control.isPending}
              onCheckedChange={(next) => control.mutate({ deviceId: item.deviceId, muted: next })}
              aria-label="Stummschaltung"
            />
          </div>

          <p className="text-xs text-muted-foreground">{ALEXA_NO_DEVICE_API}</p>
        </Panel>
      </Section>

      <Section title="Geräteinformationen">
        <EntryList>
          <EntryRow meta={alexaValue(item.serialNumber)}>Seriennummer</EntryRow>
          <EntryRow meta={alexaValue(item.deviceType)}>Gerätekennung</EntryRow>
          <EntryRow meta={alexaValue(item.deviceFamily)}>Gerätefamilie</EntryRow>
          <EntryRow meta={alexaValue(item.softwareVersion)}>Softwarestand</EntryRow>
          <EntryRow meta={new Date(item.lastSyncedAt).toLocaleString("de-DE")}>
            Letzter Abgleich
          </EntryRow>
        </EntryList>
      </Section>

      <Section title="Funktionen">
        {item.capabilities.length ? (
          <EntryList>
            {item.capabilities.map((capability) => (
              <EntryRow key={capability} meta="verfügbar">
                {capability}
              </EntryRow>
            ))}
          </EntryList>
        ) : (
          <EmptyState description="Amazon liefert für dieses Gerät keine Funktionsliste." />
        )}
        {item.unsupportedProperties.length ? (
          <Panel className="mt-3 space-y-1">
            <p className="text-xs font-medium">Von Amazon nicht bereitgestellt</p>
            <p className="text-xs text-muted-foreground">{item.unsupportedProperties.join(", ")}</p>
          </Panel>
        ) : null}
      </Section>

      <Panel className="flex items-center gap-3">
        <IconTile icon={item.isOnline ? Wifi : WifiOff} tone={item.isOnline ? "accent" : "muted"} />
        <p className="text-xs text-muted-foreground">
          Status stammt direkt aus dem Amazon-Konto und wird bei jedem Abgleich aktualisiert.
        </p>
      </Panel>
    </div>
  );
}
