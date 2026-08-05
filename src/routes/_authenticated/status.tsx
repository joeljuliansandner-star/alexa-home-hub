import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, HeartPulse, Search, ShieldCheck, Sparkles } from "lucide-react";

import { HouseStatusPanel } from "@/components/os/HouseStatusPanel";
import { AssistantPanel } from "@/components/os/AssistantPanel";
import { severityBg } from "@/components/os/severity";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { EmptyState, PageHeader, Panel, Section, SkeletonGrid, grids, stacks } from "@/components/kit";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { deviceHealth, isAvailable, type Health } from "@/lib/os/insights";
import { domainOf } from "@/services/homeAssistant";
import { useHaEntities, useHaStatus } from "@/services/homeAssistant.hooks";
import { useActivity } from "@/lib/smarthome";

export const Route = createFileRoute("/_authenticated/status")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Hausstatus – Smarthome Control" },
      {
        name: "description",
        content:
          "Automatische Bewertung deines Zuhauses: Türen, Fenster, Alarm, Kameras, Batterien, Verbindung und Gerätegesundheit.",
      },
      { property: "og:title", content: "Hausstatus – Smarthome Control" },
      {
        property: "og:description",
        content: "Sicherheitsprüfung, Assistenz-Hinweise, Timeline und Gerätegesundheit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatusPage,
});

const HEALTH_DOMAINS = ["light", "switch", "climate", "cover", "camera", "vacuum", "media_player"];

function StatusPage() {
  const entities = useHaEntities();
  const status = useHaStatus();
  const activity = useActivity();
  const [term, setTerm] = useState("");

  const health = useMemo(() => {
    const targets = entities.filter((entity) =>
      HEALTH_DOMAINS.includes(domainOf(entity.entity_id)),
    );
    return deviceHealth(entities, targets).sort((a, b) => a.score - b.score);
  }, [entities]);

  const filteredHealth = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return health;
    return health.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) || item.entityId.toLowerCase().includes(needle),
    );
  }, [health, term]);

  const offline = entities.filter((entity) => !isAvailable(entity)).length;

  return (
    <div className={stacks.page}>
      <PageHeader
        title="Hausstatus"
        description={`${entities.length} Entitäten · ${offline} nicht erreichbar · Live über Home Assistant`}
      />

      <Tabs defaultValue="uebersicht">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="uebersicht" className="gap-1.5">
            <ShieldCheck className="size-4" /> Übersicht
          </TabsTrigger>
          <TabsTrigger value="assistent" className="gap-1.5">
            <Sparkles className="size-4" /> Assistent
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Activity className="size-4" /> Aktivitäten
          </TabsTrigger>
          <TabsTrigger value="gesundheit" className="gap-1.5">
            <HeartPulse className="size-4" /> Gerätegesundheit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uebersicht" className="mt-4">
          <HouseStatusPanel entities={entities} status={status} />
        </TabsContent>

        <TabsContent value="assistent" className="mt-4">
          <AssistantPanel entities={entities} status={status} limit={12} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {activity.isLoading ? (
            <SkeletonGrid count={3} />
          ) : activity.data?.length ? (
            <ActivityFeed entries={activity.data} limit={40} />
          ) : (
            <EmptyState description="Noch keine Ereignisse aufgezeichnet." />
          )}
        </TabsContent>

        <TabsContent value="gesundheit" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Gerät suchen…"
              aria-label="Gerät suchen"
              className="h-11 pl-9"
            />
          </div>
          <Section title={`${filteredHealth.length} Geräte`}>
            <div className={grids.cards}>
              {filteredHealth.slice(0, 60).map((item) => (
                <HealthCard key={item.entityId} item={item} />
              ))}
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HealthCard({ item }: { item: Health }) {
  const tone = item.score >= 85 ? "ok" : item.score >= 60 ? "warn" : "critical";
  return (
    <Panel className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">{item.entityId}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
            severityBg[tone],
          )}
        >
          {item.score}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <Fact label="Status" value={item.online ? "online" : "offline"} />
        <Fact label="Batterie" value={item.battery != null ? `${item.battery}%` : "–"} />
        <Fact
          label="Signal"
          value={item.signal != null ? `${item.signal} ${item.signalUnit}` : "–"}
        />
        <Fact label="Firmware" value={item.firmware ?? "–"} />
        <Fact
          label="Letzte Änderung"
          value={item.lastChangedMinutes != null ? `vor ${item.lastChangedMinutes} Min.` : "–"}
        />
        <Fact label="Typ" value={item.domain} />
      </dl>

      {item.issues.length ? (
        <p className="text-xs text-destructive">{item.issues.join(" · ")}</p>
      ) : null}
    </Panel>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-2.5 py-1.5">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
