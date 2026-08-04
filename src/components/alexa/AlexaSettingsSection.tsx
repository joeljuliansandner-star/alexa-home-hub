import { Link } from "@tanstack/react-router";
import { Mic } from "lucide-react";

import { EntryList, EntryRow, IconTile, Panel, Section } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { alexaValue } from "@/lib/alexa/model";
import { useAlexaSettings, useAlexaStatus, useSaveAlexaSettings } from "@/lib/alexa/hooks";

/** Alexa-Abschnitt für die Einstellungsseite. */
export function AlexaSettingsSection() {
  const status = useAlexaStatus();
  const settings = useAlexaSettings();
  const save = useSaveAlexaSettings();

  const current = settings.data ?? {
    autoSync: true,
    syncIntervalMinutes: 15,
    debugMode: false,
  };

  return (
    <Section title="Amazon Alexa">
      <Panel className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <IconTile icon={Mic} tone={status.data?.connected ? "primary" : "muted"} />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {status.data?.connected
                ? `Verbunden – ${alexaValue(status.data.accountName)}`
                : "Kein Amazon-Konto verbunden"}
            </p>
            <p className="text-xs text-muted-foreground">
              {status.data?.deviceCount ?? 0} Echo-Geräte übernommen
            </p>
          </div>
          <Button asChild variant="secondary" className="ml-auto">
            <Link to="/integration/$integrationId" params={{ integrationId: "alexa" }}>
              Verwalten
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Automatischer Abgleich</p>
            <p className="text-xs text-muted-foreground">
              Geräte regelmäßig mit Amazon abgleichen.
            </p>
          </div>
          <Switch
            checked={current.autoSync}
            onCheckedChange={(next) => save.mutate({ ...current, autoSync: next })}
            aria-label="Automatischer Abgleich"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Abgleich-Intervall</span>
            <span className="text-muted-foreground">{current.syncIntervalMinutes} Minuten</span>
          </div>
          <Slider
            value={[current.syncIntervalMinutes]}
            min={5}
            max={120}
            step={5}
            onValueCommit={(value) =>
              save.mutate({
                ...current,
                syncIntervalMinutes: value[0] ?? current.syncIntervalMinutes,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Debugmodus</p>
            <p className="text-xs text-muted-foreground">
              Alle Amazon-Antworten im Entwicklerbereich protokollieren.
            </p>
          </div>
          <Switch
            checked={current.debugMode}
            onCheckedChange={(next) => save.mutate({ ...current, debugMode: next })}
            aria-label="Debugmodus"
          />
        </div>

        <EntryList>
          <EntryRow meta={alexaValue(status.data?.accountEmail)}>Amazon-Konto</EntryRow>
          <EntryRow
            meta={
              status.data?.lastSyncAt
                ? new Date(status.data.lastSyncAt).toLocaleString("de-DE")
                : "Noch nie"
            }
          >
            Letzter Abgleich
          </EntryRow>
        </EntryList>
      </Panel>
    </Section>
  );
}
