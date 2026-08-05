import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Radar, ShieldCheck, Wifi } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Section, stacks } from "@/components/kit";
import { homeAssistant, normalizeUrl } from "@/services/homeAssistant";

type TestResult = { ok: boolean; message: string; version?: string | null; websocket?: boolean };

/**
 * Einrichtungsassistent für Home Assistant.
 * Sucht automatisch im Heimnetz, prüft Token, REST- und WebSocket-API und
 * startet nach erfolgreicher Verbindung den ersten Abgleich.
 */
export function HomeAssistantWizard({ onConnected }: { onConnected?: () => void }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [found, setFound] = useState<{ url: string; version: string | null } | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void handleScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan() {
    setScanning(true);
    const extra = typeof window !== "undefined" ? [window.location.origin.replace(/:\d+$/, ":8123")] : [];
    const discovery = await homeAssistant.discover(extra);
    setScanning(false);
    setScanned(true);
    if (discovery.found && discovery.url) {
      setFound({ url: discovery.url, version: discovery.version });
      setUrl((current) => current || discovery.url);
    }
  }

  async function handleTest() {
    if (!url || !token) {
      toast.error("Adresse und Token werden benötigt");
      return;
    }
    setBusy(true);
    const test = await homeAssistant.testConnection(url, token);
    setBusy(false);
    setResult(test);
    if (test.ok) toast.success("Verbindung erfolgreich");
    else toast.error(test.message);
  }

  async function handleConnect() {
    if (!url || !token) {
      toast.error("Adresse und Token werden benötigt");
      return;
    }
    setBusy(true);
    try {
      await homeAssistant.saveConnection(url, token);
      const sync = await homeAssistant.sync();
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      await queryClient.invalidateQueries({ queryKey: ["ha", "connection"] });
      toast.success(
        `Verbunden – ${sync.created + sync.updated} Geräte und ${sync.rooms} Räume übernommen`,
      );
      onConnected?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verbindung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={stacks.pageTight}>
      <Panel className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            {scanning ? <Loader2 className="size-5 animate-spin" /> : <Radar className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {scanning
                ? "Suche Home Assistant im Heimnetz …"
                : found
                  ? `Home Assistant gefunden: ${found.url}`
                  : scanned
                    ? "Automatisch nichts gefunden – bitte Adresse eintragen"
                    : "Automatische Suche"}
            </p>
            <p className="text-xs text-muted-foreground">
              {found?.version
                ? `Version ${found.version}`
                : "Gesucht wird unter homeassistant.local und typischen Heimnetz-Adressen."}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto gap-2"
            disabled={scanning}
            onClick={() => void handleScan()}
          >
            <Wifi className="size-4" /> Erneut suchen
          </Button>
        </div>
      </Panel>

      <Section title="Verbindung einrichten">
        <Panel className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ha-url">Home Assistant Adresse</Label>
            <Input
              id="ha-url"
              value={url}
              placeholder="http://homeassistant.local:8123"
              onChange={(event) => setUrl(event.target.value)}
              onBlur={() => url && setUrl(normalizeUrl(url))}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ha-token">Long Lived Access Token</Label>
            <Input
              id="ha-token"
              type="password"
              value={token}
              placeholder="eyJhbGciOi…"
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              In Home Assistant unter Profil → Sicherheit → „Langlebige Zugriffstoken“ erstellen.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="gap-2" disabled={busy} onClick={() => void handleTest()}>
              <ShieldCheck className="size-4" /> Verbindung testen
            </Button>
            <Button className="gap-2" disabled={busy} onClick={() => void handleConnect()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Verbinden
            </Button>
          </div>

          {result ? (
            <div
              className={`rounded-xl border p-3 text-xs ${
                result.ok ? "border-primary/40 text-foreground" : "border-destructive/40 text-muted-foreground"
              }`}
            >
              <p className="font-medium">{result.ok ? "Test erfolgreich" : "Test fehlgeschlagen"}</p>
              <p>{result.message}</p>
              {result.ok ? (
                <p>
                  REST API: in Ordnung · WebSocket: {result.websocket ? "in Ordnung" : "nicht erreichbar"} ·
                  Version: {result.version ?? "unbekannt"}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Hinweis: Der Test nutzt ausschließlich <code>GET /api/</code> mit deinem Long-Lived
            Access Token – kein OAuth-Login. Öffentliche Adressen (z. B. Nabu Casa) werden bei
            Browser-Blockaden automatisch über den Server der App geprüft; lokale Adressen direkt
            aus dem Heimnetz.
          </p>
        </Panel>
      </Section>
    </div>
  );
}
