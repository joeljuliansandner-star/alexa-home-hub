import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PlugZap, RefreshCw, Settings2, Unplug } from "lucide-react";
import { toast } from "sonner";

import { useDevices } from "@/lib/smarthome";
import { syncTuyaDevices } from "@/lib/tuya.functions";
import { syncTapoDevices } from "@/lib/tapo.functions";
import {
  devicesFor,
  formatSync,
  getIntegration,
  isConnected,
  lastSync,
} from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  PageHeader,
  Panel,
  Section,
  IconTile,
  EntryList,
  EntryRow,
  EmptyState,
  StatTile,
  LoadingState,
  grids,
  stacks,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/integration/$integrationId")({
  head: () => ({
    meta: [
      { title: "Integration – Smarthome Control" },
      {
        name: "description",
        content:
          "Verbindungsstatus, Konto-Informationen, Abgleich, importierte Geräte und Fehlerprotokoll einer Integration.",
      },
      { property: "og:title", content: "Integration – Smarthome Control" },
      {
        property: "og:description",
        content: "Details und Abgleich eines verbundenen Smart-Home-Dienstes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationDetailPage,
});

type DebugLog = {
  lines: string[];
  errors: string[];
  unsupported: string[];
};

function IntegrationDetailPage() {
  const { integrationId } = useParams({ from: "/_authenticated/integration/$integrationId" });
  const devices = useDevices();
  const qc = useQueryClient();
  const [debug, setDebug] = useState<DebugLog | null>(null);

  const integration = getIntegration(integrationId);

  const sync = useMutation({
    mutationFn: async () => {
      const stamp = new Date().toLocaleTimeString("de-DE");
      if (integrationId === "tuya") {
        const result = await syncTuyaDevices();
        return {
          message: `${result.imported} Geräte und ${result.rooms} Räume übernommen`,
          log: {
            lines: [`${stamp} – ${result.imported} Geräte, ${result.rooms} Räume`],
            errors: [],
            unsupported: [],
          } satisfies DebugLog,
        };
      }
      if (integrationId === "tapo") {
        const result = await syncTapoDevices();
        return {
          message: `${result.imported} Geräte übernommen (${result.children} über Steuerzentralen)`,
          log: {
            lines: [
              `${stamp} – Abgleich abgeschlossen`,
              `Steuerzentralen gefunden: ${result.hubs}`,
              `Direkte Geräte: ${result.imported - result.children}`,
              `Untergeräte an Hubs: ${result.children}`,
              `Online: ${result.online} von ${result.imported}`,
              ...result.devices.map(
                (d) =>
                  `• ${d.name} – ${d.label} (${d.model})${d.viaHub ? ` über ${d.viaHub}` : ""} – ${
                    d.online ? "online" : "offline"
                  }`,
              ),
            ],
            errors: result.errors,
            unsupported: result.unsupported,
          } satisfies DebugLog,
        };
      }
      throw new Error("Für diesen Dienst ist noch keine Verbindung hinterlegt.");
    },
    onSuccess: (result) => {
      qc.invalidateQueries();
      setDebug(result.log);
      toast.success(result.message);
      for (const problem of result.log.errors) toast.warning(problem);
    },
    onError: (error: Error) => {
      setDebug({
        lines: [`${new Date().toLocaleTimeString("de-DE")} – Abgleich fehlgeschlagen`],
        errors: [error.message],
        unsupported: [],
      });
      toast.error(error.message);
    },
  });

  if (!integration) {
    return (
      <div className={stacks.page}>
        <PageHeader title="Integration" description="Dieser Dienst ist nicht bekannt." />
        <EmptyState
          variant="card"
          description="Die gesuchte Integration gibt es nicht."
          actions={
            <Button asChild variant="secondary">
              <Link to="/integrations">Zur Übersicht</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (devices.isLoading) return <LoadingState />;

  const all = devices.data ?? [];
  const own = devicesFor(integration, all);
  const online = isConnected(integration, all);
  const onlineCount = own.filter((device) => device.is_online).length;

  return (
    <div className={stacks.pageTight}>
      <PageHeader
        title={integration.name}
        description={integration.description}
        actions={
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/integrations">
              <ArrowLeft className="size-4" /> Integrationen
            </Link>
          </Button>
        }
      />

      <Panel className="flex flex-wrap items-center gap-3">
        <IconTile icon={integration.icon} tone={online ? integration.tone : "muted"} />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {online ? "Verbunden" : "Nicht verbunden"}
          </p>
          <p className="text-xs text-muted-foreground">
            Letzter Abgleich: {formatSync(lastSync(integration, all))}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            className="gap-2"
            disabled={sync.isPending}
            onClick={() => sync.mutate()}
          >
            <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} />
            Abgleich starten
          </Button>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() =>
              toast.info("Platzhalter – Trennen folgt, sobald der Dienst echt verbunden ist.")
            }
          >
            <Unplug className="size-4" /> Trennen
          </Button>
        </div>
      </Panel>

      <div className={grids.stats}>
        <StatTile label="Status" value={online ? "Aktiv" : "Inaktiv"} tone={online ? "primary" : "muted"} />
        <StatTile label="Geräte" value={String(own.length)} tone="accent" />
        <StatTile label="Online" value={String(onlineCount)} tone="primary" />
        <StatTile
          label="Abgleich"
          value={integration.live ? "Echt" : "Platzhalter"}
          tone={integration.live ? "accent" : "muted"}
        />
      </div>

      <Section title="Konto & Server">
        <EntryList>
          {integration.account.map((row) => (
            <EntryRow key={row.label} meta={row.value}>
              {row.label}
            </EntryRow>
          ))}
        </EntryList>
      </Section>

      <Section title={`Importierte Geräte (${own.length})`}>
        {own.length ? (
          <EntryList>
            {own.map((device) => (
              <EntryRow key={device.id} meta={device.is_online ? "online" : "offline"}>
                {device.name}
              </EntryRow>
            ))}
          </EntryList>
        ) : (
          <EmptyState description="Noch keine Geräte übernommen. Starte einen Abgleich." />
        )}
      </Section>

      <Section title="Fehlerprotokoll">
        <EmptyState description="Keine Fehler protokolliert (Platzhalter)." />
      </Section>

      <Section title="Erweiterte Einstellungen">
        <Panel className="divide-y divide-border py-0">
          {integration.advanced.map((option) => (
            <div
              key={option.label}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{option.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{option.hint}</p>
              </div>
              <Switch
                defaultChecked={integration.live}
                onCheckedChange={() => toast.info("Platzhalter – Einstellung folgt später.")}
              />
            </div>
          ))}
          <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
            <Settings2 className="size-4" />
            Optionen sind Platzhalter und lassen sich später an echte APIs binden.
          </div>
        </Panel>
      </Section>

      <Panel className="flex items-center gap-3">
        <IconTile icon={PlugZap} tone="muted" />
        <p className="text-xs text-muted-foreground">
          Sobald ein Dienst echte Zugangsdaten bekommt, genügt ein Eintrag in
          <code className="mx-1">src/lib/integrations.ts</code> plus die Sync-Function.
        </p>
      </Panel>
    </div>
  );
}
