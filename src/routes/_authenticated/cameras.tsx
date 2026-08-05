import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Camera, Maximize2, RefreshCw, WifiOff } from "lucide-react";

import { EmptyState, PageHeader, Panel, Section, StatTile, grids, stacks } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { friendlyName, isAvailable, minutesSince } from "@/lib/os/insights";
import { homeAssistant, type HaEntity } from "@/services/homeAssistant";
import { useHaCameras, useHaEntities } from "@/services/homeAssistant.hooks";

export const Route = createFileRoute("/_authenticated/cameras")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kameras – Smarthome Control" },
      {
        name: "description",
        content:
          "Kamerazentrale mit Livebildern, Snapshots, Vollbild, Onlinestatus und letzter erkannter Bewegung.",
      },
      { property: "og:title", content: "Kameras – Smarthome Control" },
      {
        property: "og:description",
        content: "Alle Kameras aus Home Assistant an einem Ort – live und im Vollbild.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CamerasPage,
});

function CamerasPage() {
  const cameras = useHaCameras();
  const entities = useHaEntities();
  const [fullscreen, setFullscreen] = useState<HaEntity | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Snapshots regelmäßig erneuern (Bild-URL, kein zusätzlicher API-Aufruf).
  useEffect(() => {
    const timer = setInterval(() => setRefreshKey((value) => value + 1), 15_000);
    return () => clearInterval(timer);
  }, []);

  const motion = useMemo(
    () =>
      entities.filter(
        (entity) =>
          entity.entity_id.startsWith("binary_sensor.") &&
          String(entity.attributes?.["device_class"] ?? "") === "motion",
      ),
    [entities],
  );

  const online = cameras.filter(isAvailable).length;

  return (
    <div className={stacks.page}>
      <PageHeader
        title="Kameras"
        description={`${cameras.length} Kameras · ${online} online`}
        actions={
          <Button
            variant="secondary"
            className="min-h-11 gap-2"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            <RefreshCw className="size-4" /> Aktualisieren
          </Button>
        }
      />

      {cameras.length ? (
        <>
          <div className={grids.stats}>
            <StatTile label="Kameras" value={String(cameras.length)} tone="primary" />
            <StatTile label="Online" value={String(online)} tone="accent" />
            <StatTile
              label="Offline"
              value={String(cameras.length - online)}
              tone={cameras.length - online ? "destructive" : "muted"}
            />
            <StatTile label="Bewegungsmelder" value={String(motion.length)} />
          </div>

          <Section title="Livebilder">
            <div className={grids.cards}>
              {cameras.map((camera) => (
                <CameraTile
                  key={camera.entity_id}
                  camera={camera}
                  refreshKey={refreshKey}
                  lastMotion={findMotion(motion, camera)}
                  onFullscreen={() => setFullscreen(camera)}
                />
              ))}
            </div>
          </Section>
        </>
      ) : (
        <EmptyState
          variant="card"
          title="Keine Kameras gefunden"
          description="Sobald Home Assistant Entitäten der Domäne „camera“ bereitstellt, erscheinen sie hier automatisch."
        />
      )}

      <Dialog open={Boolean(fullscreen)} onOpenChange={(open) => !open && setFullscreen(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{fullscreen ? friendlyName(fullscreen) : "Kamera"}</DialogTitle>
          </DialogHeader>
          {fullscreen ? (
            <img
              src={`${homeAssistant.cameraStreamUrl(fullscreen) ?? ""}&_=${refreshKey}`}
              alt={`Livebild ${friendlyName(fullscreen)}`}
              className="w-full rounded-xl bg-secondary object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function findMotion(motion: HaEntity[], camera: HaEntity) {
  const base = camera.entity_id.split(".")[1]?.split("_")[0] ?? "";
  if (!base) return null;
  return motion.find((entity) => entity.entity_id.includes(base)) ?? null;
}

function CameraTile({
  camera,
  refreshKey,
  lastMotion,
  onFullscreen,
}: {
  camera: HaEntity;
  refreshKey: number;
  lastMotion: HaEntity | null;
  onFullscreen: () => void;
}) {
  const online = isAvailable(camera);
  const url = homeAssistant.cameraStreamUrl(camera);
  const motionMinutes = lastMotion ? minutesSince(lastMotion) : null;

  return (
    <Panel className="overflow-hidden p-0">
      <div className="relative aspect-video bg-secondary">
        {online && url ? (
          <img
            src={`${url}&_=${refreshKey}`}
            alt={`Livebild ${friendlyName(camera)}`}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            {online ? <Camera className="size-8" /> : <WifiOff className="size-8" />}
          </div>
        )}
        <Button
          variant="secondary"
          size="icon"
          aria-label="Vollbild öffnen"
          onClick={onFullscreen}
          className="absolute bottom-2 right-2 min-h-11 min-w-11"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
      <div className="space-y-1 p-4">
        <p className="truncate text-sm font-semibold">{friendlyName(camera)}</p>
        <p className={cn("text-xs", online ? "text-muted-foreground" : "text-destructive")}>
          {online ? "online" : "nicht erreichbar"}
          {motionMinutes != null ? ` · letzte Bewegung vor ${motionMinutes} Min.` : ""}
        </p>
      </div>
    </Panel>
  );
}
