import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PlugZap } from "lucide-react";

import { useDevices } from "@/lib/smarthome";
import {
  formatSync,
  integrations,
  isConnected,
  lastSync,
  devicesFor,
} from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Section, IconTile, LoadingState, grids, stacks } from "@/components/kit";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrationen – Smarthome Control" },
      {
        name: "description",
        content:
          "Alle Smart-Home-Dienste wie Tuya, Tapo, Alexa, Home Assistant, MQTT, Hue, Shelly und Zigbee zentral verwalten.",
      },
      { property: "og:title", content: "Integrationen – Smarthome Control" },
      {
        property: "og:description",
        content: "Verbindungsstatus, Abgleich und importierte Geräte deiner Dienste.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const devices = useDevices();

  if (devices.isLoading) return <LoadingState />;

  const all = devices.data ?? [];
  const connected = integrations.filter((entry) => isConnected(entry, all));

  return (
    <div className={stacks.page}>
      <PageHeader
        title="Integrationen"
        description="Dienste verbinden, abgleichen und Geräte importieren."
        actions={
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/settings">
              <ArrowLeft className="size-4" /> Einstellungen
            </Link>
          </Button>
        }
      />

      <Section title={`Verbunden (${connected.length} von ${integrations.length})`}>
        <div className={grids.cards}>
          {integrations.map((entry) => {
            const online = isConnected(entry, all);
            const count = devicesFor(entry, all).length;
            return (
              <Panel key={entry.id} className="flex h-full flex-col gap-3" hover as="article">
                <div className="flex items-start gap-3">
                  <IconTile icon={entry.icon} tone={online ? entry.tone : "muted"} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      online
                        ? "inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-1 text-success"
                        : "inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-1 text-muted-foreground"
                    }
                  >
                    <span
                      className={`size-1.5 rounded-full ${online ? "bg-success" : "bg-muted-foreground"}`}
                    />
                    {online ? "Verbunden" : "Nicht verbunden"}
                  </span>
                  {online ? (
                    <span className="text-muted-foreground">{count} Geräte</span>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground">
                  Letzter Abgleich: {formatSync(lastSync(entry, all))}
                </p>

                <Button asChild variant={online ? "secondary" : "default"} className="mt-auto w-full gap-2">
                  <Link to="/integration/$integrationId" params={{ integrationId: entry.id }}>
                    <PlugZap className="size-4" />
                    {online ? "Verwalten" : "Verbinden"}
                  </Link>
                </Button>
              </Panel>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
