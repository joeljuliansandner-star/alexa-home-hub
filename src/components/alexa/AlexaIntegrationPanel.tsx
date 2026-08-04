import { Link } from "@tanstack/react-router";
import { ArrowLeft, Mic, RefreshCw, Trash2, Unplug, Wifi, WifiOff } from "lucide-react";

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
import { formatSync } from "@/lib/integrations";
import { ALEXA_NO_DEVICE_API, alexaValue } from "@/lib/alexa/model";
import {
  useAlexaDevices,
  useAlexaDisconnect,
  useAlexaLog,
  useAlexaLogin,
  useAlexaStatus,
  useAlexaSync,
  useClearAlexaLog,
} from "@/lib/alexa/hooks";

/** Vollständige Verwaltung der Amazon-Alexa-Integration. */
export function AlexaIntegrationPanel() {
  const status = useAlexaStatus();
  const devices = useAlexaDevices();
  const log = useAlexaLog();
  const login = useAlexaLogin();
  const disconnect = useAlexaDisconnect();
  const sync = useAlexaSync();
  const clearLog = useClearAlexaLog();

  if (status.isLoading) return <LoadingState />;

  const info = status.data;
  const list = devices.data ?? [];
  const online = list.filter((device) => device.isOnline).length;
  const connected = Boolean(info?.connected);

  return (
    <div className={stacks.pageTight}>
      <PageHeader
        title="Amazon Alexa"
        description="Echo-Geräte über das eigene Amazon-Konto anbinden, abgleichen und steuern."
        actions={
          <Button asChild variant="secondary" className="gap-2">
            <Link to="/integrations">
              <ArrowLeft className="size-4" /> Integrationen
            </Link>
          </Button>
        }
      />

      <Panel className="flex flex-wrap items-center gap-3">
        <IconTile icon={Mic} tone={connected ? "primary" : "muted"} />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {connected ? `Verbunden – ${alexaValue(info?.accountName)}` : "Nicht verbunden"}
          </p>
          <p className="text-xs text-muted-foreground">
            Letzter Abgleich:{" "}
            {formatSync(info?.lastSyncAt ? new Date(info.lastSyncAt) : null)}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {connected ? (
            <>
              <Button
                variant="secondary"
                className="gap-2"
                disabled={sync.isPending}
                onClick={() => sync.mutate()}
              >
                <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} />
                Verbindung prüfen
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate()}
              >
                <Unplug className="size-4" /> Trennen
              </Button>
            </>
          ) : (
            <Button
              className="gap-2"
              disabled={login.isPending || !info?.configured}
              onClick={() => login.mutate()}
            >
              <Mic className="size-4" /> Mit Amazon anmelden
            </Button>
          )}
        </div>
      </Panel>

      {!info?.configured ? (
        <Panel className="space-y-2 border-destructive/40">
          <p className="text-sm font-medium text-destructive">Amazon-Zugangsdaten fehlen</p>
          <p className="text-xs text-muted-foreground">
            Für die Anmeldung werden eine Amazon-Client-ID und ein Client-Geheimnis benötigt
            (Login with Amazon). Hinterlege sie im Backend, danach ist die Anmeldung sofort
            möglich. Als erlaubte Rückkehr-Adresse trage bei Amazon ein:{" "}
            <code className="break-all">
              {typeof window === "undefined" ? "" : `${window.location.origin}/alexa/callback`}
            </code>
          </p>
        </Panel>
      ) : null}

      {info?.needsReauth ? (
        <Panel className="border-destructive/40">
          <p className="text-sm text-destructive">
            Die Amazon-Sitzung ist abgelaufen. Bitte erneut anmelden.
          </p>
        </Panel>
      ) : null}

      <Panel className="space-y-2 border-amber-500/40">
        <p className="text-sm font-medium">Keine Echo-Geräteliste über Amazon verfügbar</p>
        <p className="text-xs text-muted-foreground">{ALEXA_NO_DEVICE_API}</p>
        <p className="text-xs text-muted-foreground">
          Die früher genutzten Adressen unter <code>api.amazonalexa.com</code> gehören zu den
          Skill-gebundenen Schnittstellen (Alexa Smart Home / Skill Messaging) und antworten für
          Login-with-Amazon-Tokens mit <strong>HTTP 404</strong>. Sie wurden entfernt. Die
          Anmeldung bleibt bestehen und liefert ausschließlich die Kontodaten (Name, E-Mail).
          Für echte Gerätesteuerung wäre ein eigener, bei Amazon zertifizierter Alexa-Skill mit
          Account-Linking nötig.
        </p>
      </Panel>


      <div className={grids.stats}>
        <StatTile
          label="Status"
          value={connected ? "Aktiv" : "Inaktiv"}
          tone={connected ? "primary" : "muted"}
        />
        <StatTile label="Echo-Geräte" value={String(list.length)} tone="accent" />
        <StatTile label="Online" value={String(online)} tone="primary" />
        <StatTile
          label="Konto"
          value={info?.accountEmail ? info.accountEmail : "—"}
          tone="muted"
        />
      </div>

      <Section title={`Echo-Geräte (${list.length})`}>
        {list.length ? (
          <div className={grids.cards}>
            {list.map((device) => (
              <Link
                key={device.id}
                to="/alexa/$deviceId"
                params={{ deviceId: device.deviceId }}
                className="block"
              >
                <Panel hover className="flex h-full items-center gap-3">
                  <IconTile icon={device.isOnline ? Wifi : WifiOff} tone={device.isOnline ? "accent" : "muted"} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{device.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {device.typeLabel} · {device.isOnline ? "online" : "offline"}
                    </p>
                  </div>
                </Panel>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            description={
              info?.lastError ?? ALEXA_NO_DEVICE_API
            }
          />
        )}
      </Section>

      <Section
        title="Entwicklerbereich (Debug)"
        action={
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => clearLog.mutate()}
          >
            <Trash2 className="size-4" /> Protokoll leeren
          </Button>
        }
      >
        <Panel className="space-y-3">
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>Anmeldung: Login with Amazon (OAuth 2.0, api.amazon.com)</li>
            <li>Geräte: keine öffentliche Amazon-API vorhanden – Aufrufe entfernt</li>
            <li>Tokens werden serverseitig gespeichert und nie im Browser abgelegt.</li>
          </ul>
          {log.data?.length ? (
            <EntryList>
              {log.data.map((entry) => (
                <EntryRow
                  key={entry.id}
                  meta={`${entry.statusCode ?? "–"} · ${entry.durationMs ?? 0} ms`}
                >
                  <span className={entry.ok ? "" : "text-destructive"}>
                    {entry.method} {entry.endpoint.replace("https://", "")} – {entry.message}
                  </span>
                </EntryRow>
              ))}
            </EntryList>
          ) : (
            <EmptyState description="Noch keine API-Aufrufe protokolliert." />
          )}
        </Panel>
      </Section>
    </div>
  );
}
