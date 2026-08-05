import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Camera,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Moon,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { DeviceCard } from "@/components/DeviceCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { HeroHeader } from "@/components/dashboard/HeroHeader";
import { StatusCards } from "@/components/dashboard/StatusCards";
import { WeatherPanel } from "@/components/dashboard/WeatherPanel";
import { RoomCard } from "@/components/rooms/RoomCard";
import { HouseStatusPanel } from "@/components/os/HouseStatusPanel";
import { DailyBriefing } from "@/components/os/DailyBriefing";
import { SmartInsightsList } from "@/components/os/SmartInsightsList";
import { useSmartInsights } from "@/lib/os/intelligence.hooks";
import { QuickActionsBar } from "@/components/os/QuickActionsBar";
import { usePins } from "@/lib/os/prefs";
import { useHaEntities, useHaStatus } from "@/services/homeAssistant.hooks";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Pressable,
  Section,
  Skeleton,
  SkeletonGrid,
  grids,
  stacks,
} from "@/components/kit";
import {
  useActivity,
  useBulkToggleKind,
  useDevices,
  useRooms,
  useRunScene,
  useScenes,
  useToggleFavorite,
  useUpdateDevice,
} from "@/lib/smarthome";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Startseite – Smarthome Control" },
      {
        name: "description",
        content: "Begrüßung, Hausstatus, Wetter, Favoriten, Räume und Aktivitäten auf einen Blick.",
      },
      { property: "og:title", content: "Startseite – Smarthome Control" },
      {
        property: "og:description",
        content: "Begrüßung, Hausstatus, Wetter, Favoriten, Räume und Aktivitäten auf einen Blick.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const devices = useDevices();
  const rooms = useRooms();
  const activity = useActivity();
  const scenes = useScenes();
  const updateDevice = useUpdateDevice();
  const toggleFavorite = useToggleFavorite();
  const bulkToggle = useBulkToggleKind();
  const runScene = useRunScene();
  const navigate = useNavigate();
  const haEntities = useHaEntities();
  const haStatus = useHaStatus();
  const insights = useSmartInsights();
  const { pins } = usePins();
  const [away, setAway] = useState(false);
  const [armed, setArmed] = useState(false);

  const list = useMemo(() => devices.data ?? [], [devices.data]);
  const lights = list.filter((d) => d.kind === "light");
  const favorites = list.filter((d) => d.is_favorite);
  const switchable = list.filter((d) => d.kind !== "sensor" && d.kind !== "thermostat");
  const activeCount = switchable.filter((d) => d.is_on).length;
  const offline = list.filter((d) => !d.is_online);
  const roomList = rooms.data ?? [];
  const firstScene = (scenes.data ?? [])[0];

  const allOff = (label: string, target = switchable) =>
    bulkToggle.mutate(
      { devices: target.filter((d) => d.is_on), on: false },
      { onSuccess: (count) => toast.success(`${label}: ${count} Geräte ausgeschaltet`) },
    );

  const loading = devices.isLoading;

  return (
    <div className={stacks.page}>
      <HeroHeader
        name="Joel"
        away={away}
        onAwayChange={setAway}
        subtitle={
          loading
            ? "Dein Zuhause wird geladen…"
            : activeCount > 0
              ? `${activeCount} von ${switchable.length} Geräten sind aktiv.`
              : "Alles ruhig – nichts ist eingeschaltet."
        }
      />

      <DailyBriefing />

      <WeatherPanel />

      <Section
        title="Hausstatus"
        action={
          <Link to="/status" className="text-xs text-muted-foreground hover:text-foreground">
            Details
          </Link>
        }
      >
        <HouseStatusPanel entities={haEntities} status={haStatus} compact />
      </Section>

      <Section
        title="Assistent"
        action={
          <Link to="/insights" className="text-xs text-muted-foreground hover:text-foreground">
            Alle Insights
          </Link>
        }
      >
        <SmartInsightsList insights={insights} limit={4} />
      </Section>

      <Section title="Status">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-[86px] rounded-2xl" />
            ))}
          </div>
        ) : (
          <StatusCards devices={list} />
        )}
      </Section>

      <Section title="Schnellaktionen">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <QuickAction
            icon={Lightbulb}
            label="Alle Lichter aus"
            hint={`${lights.filter((d) => d.is_on).length} an`}
            disabled={!lights.some((d) => d.is_on) || bulkToggle.isPending}
            onPress={() => allOff("Lichter", lights)}
          />
          <QuickAction
            icon={LogOut}
            label="Haus verlassen"
            hint="Alles ausschalten"
            disabled={bulkToggle.isPending || !activeCount}
            onPress={() => {
              setAway(true);
              allOff("Haus verlassen");
            }}
          />
          <QuickAction
            icon={Moon}
            label="Gute Nacht"
            hint="Lichter & Steckdosen"
            disabled={bulkToggle.isPending || !activeCount}
            onPress={() => {
              allOff("Gute Nacht");
            }}
          />
          <QuickAction
            icon={ShieldCheck}
            label="Alarm"
            hint={armed ? "aktiviert" : "deaktiviert"}
            active={armed}
            onPress={() => {
              setArmed((value) => !value);
              toast.success(armed ? "Alarm deaktiviert" : "Alarm aktiviert");
            }}
          />
          <QuickAction
            icon={firstScene ? PlayCircle : Sparkles}
            label={firstScene ? firstScene.name : "Szenen"}
            hint={firstScene ? "Szene starten" : "Szene anlegen"}
            disabled={runScene.isPending}
            onPress={() => {
              if (firstScene) {
                runScene.mutate(firstScene, {
                  onSuccess: () => toast.success(`Szene „${firstScene.name}" gestartet`),
                });
              } else {
                navigate({ to: "/scenes" });
              }
            }}
          />
        </div>
        <div className="mt-3">
          <QuickActionsBar />
        </div>
      </Section>

      {pins.length ? (
        <Section title="Angepinnt">
          <div className="flex flex-wrap gap-2">
            {pins.map((pin) => (
              <span
                key={`${pin.kind}-${pin.id}`}
                className="panel-glass rounded-full px-3 py-1.5 text-xs"
              >
                {pin.label}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        id="favoriten"
        className="scroll-mt-4"
        title="Favoriten"
        action={
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
            Alle Geräte
          </Link>
        }
      >
        {loading ? (
          <SkeletonGrid count={3} />
        ) : favorites.length ? (
          <div className={grids.cards}>
            {favorites.map((device, index) => (
              <div
                key={device.id}
                className="rise-in h-full"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <DeviceCard
                  device={device}
                  onToggle={(next) =>
                    updateDevice.mutate({
                      device,
                      patch: { is_on: next },
                      log: `${device.name} ${next ? "eingeschaltet" : "ausgeschaltet"}`,
                    })
                  }
                  onBrightness={(value) =>
                    updateDevice.mutate({ device, patch: { brightness: value } })
                  }
                  onFavorite={(value) => toggleFavorite.mutate({ device, value })}
                  onOpen={() =>
                    navigate({ to: "/device/$deviceId", params: { deviceId: device.id } })
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="text-left"
            description={
              <span className="flex flex-col items-start gap-3">
                <span>
                  Noch keine Favoriten. Markiere Geräte mit dem Stern – ein Tipp schaltet, langes
                  Drücken öffnet die Details.
                </span>
                <Button asChild variant="secondary" className="min-h-11">
                  <Link to="/dashboard">Geräte auswählen</Link>
                </Button>
              </span>
            }
          />
        )}
      </Section>

      <Section
        title="Räume"
        action={
          <Link to="/rooms" className="text-xs text-muted-foreground hover:text-foreground">
            Alle Räume
          </Link>
        }
      >
        {loading ? (
          <SkeletonGrid count={3} />
        ) : roomList.length ? (
          <div className={grids.cards}>
            {roomList.slice(0, 6).map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                devices={list.filter((d) => d.room_id === room.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState description="Noch keine Räume – sie kommen beim nächsten Abgleich automatisch dazu." />
        )}
      </Section>

      <Section
        title="Letzte Aktivitäten"
        action={
          <span className="text-xs text-muted-foreground">
            {offline.length ? `${offline.length} offline` : "alles erreichbar"}
          </span>
        }
      >
        {activity.data?.length ? (
          <ActivityFeed entries={activity.data} />
        ) : (
          <div className="panel-glass flex items-center gap-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              {offline.length ? (
                <WifiOff className="size-4 text-destructive" />
              ) : (
                <Bell className="size-4" />
              )}
            </span>
            <p className="text-sm text-muted-foreground">
              {offline.length
                ? `${offline.length} Geräte sind offline.`
                : "Noch keine Ereignisse aufgezeichnet."}
            </p>
          </div>
        )}
      </Section>

      <Section title="Weiter">
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="secondary" className="h-14 justify-start gap-2 rounded-2xl">
            <Link to="/dashboard">
              <LayoutDashboard className="size-4 text-primary" />
              Geräteübersicht
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-14 justify-start gap-2 rounded-2xl">
            <Link to="/scenes">
              <Star className="size-4 text-primary" />
              Szenen
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-14 justify-start gap-2 rounded-2xl">
            <Link to="/status">
              <Activity className="size-4 text-primary" />
              Hausstatus
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-14 justify-start gap-2 rounded-2xl">
            <Link to="/energy">
              <Zap className="size-4 text-primary" />
              Energie
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-14 justify-start gap-2 rounded-2xl">
            <Link to="/cameras">
              <Camera className="size-4 text-primary" />
              Kameras
            </Link>
          </Button>
        </div>
      </Section>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  hint,
  active,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "panel panel-hover flex h-full min-h-28 flex-col items-start justify-between gap-3 p-4",
        "hover:-translate-y-0.5",
        active && "tile-on",
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-2xl transition-colors duration-300",
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </Pressable>
  );
}
