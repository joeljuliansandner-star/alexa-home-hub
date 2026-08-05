import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Brain, HeartPulse, Lightbulb, Search, Zap } from "lucide-react";

import { DailyBriefing } from "@/components/os/DailyBriefing";
import { HouseReportPanel } from "@/components/os/HouseReportPanel";
import { RecommendationsPanel } from "@/components/os/RecommendationsPanel";
import { SmartInsightsList } from "@/components/os/SmartInsightsList";
import { EmptyState, PageHeader, Panel, Section, StatTile, grids, stacks } from "@/components/kit";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  useDeviceHealthPlus,
  useEnergyAnalysis,
  useHouseReport,
  useRecommendations,
  useSmartInsights,
} from "@/lib/os/intelligence.hooks";

export const Route = createFileRoute("/_authenticated/insights")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Smart Insights – Smarthome Control" },
      {
        name: "description",
        content:
          "Täglicher Gesundheitsbericht, intelligente Hinweise, erkannte Muster und erweiterte Gerätegesundheit deines Zuhauses.",
      },
      { property: "og:title", content: "Smart Insights – Smarthome Control" },
      {
        property: "og:description",
        content: "Automatische Analyse von Geräten, Sensoren und Verbrauch – vollständig lokal berechnet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const insights = useSmartInsights();
  const report = useHouseReport();
  const suggestions = useRecommendations();
  const energy = useEnergyAnalysis();
  const health = useDeviceHealthPlus();
  const [term, setTerm] = useState("");

  const filteredHealth = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return health;
    return health.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) || item.entityId.toLowerCase().includes(needle),
    );
  }, [health, term]);

  const criticalCount = health.filter((item) => item.critical).length;

  return (
    <div className={stacks.page}>
      <PageHeader
        title="Smart Insights"
        description="Automatische Auswertung aller Geräte, Sensoren und Verbräuche – lokal berechnet, ohne externe Dienste."
      />

      <DailyBriefing />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Score" value={`${report.score}`} />
        <StatTile label="Hinweise" value={`${insights.length}`} />
        <StatTile label="Trend" value={energy.trend} />
        <StatTile label="Kritisch" value={`${criticalCount}`} tone={criticalCount ? "warn" : "ok"} />
      </div>


      <Tabs defaultValue="bericht">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="bericht">Bericht</TabsTrigger>
          <TabsTrigger value="hinweise">Hinweise</TabsTrigger>
          <TabsTrigger value="muster">Vorschläge</TabsTrigger>
          <TabsTrigger value="energie">Energie</TabsTrigger>
          <TabsTrigger value="gesundheit">Gerätegesundheit</TabsTrigger>
        </TabsList>

        <TabsContent value="bericht" className="mt-4">
          <HouseReportPanel report={report} />
        </TabsContent>

        <TabsContent value="hinweise" className="mt-4">
          <SmartInsightsList insights={insights} />
        </TabsContent>

        <TabsContent value="muster" className="mt-4">
          <RecommendationsPanel recommendations={suggestions} />
        </TabsContent>

        <TabsContent value="energie" className="mt-4 space-y-4">
          <Panel className="space-y-1">
            <p className="text-sm font-semibold">Zusammenfassung</p>
            <p className="text-xs text-muted-foreground">{energy.summary}</p>
          </Panel>

          {energy.comparisons.length ? (
            <div className={grids.cards}>
              {energy.comparisons.map((item) => (
                <Panel key={item.label} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-display text-2xl font-semibold tabular-nums">
                    {item.current.toFixed(1)} {item.unit}
                  </p>
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      item.delta > 0 ? "text-destructive" : "text-success",
                    )}
                  >
                    {item.deltaPercent == null
                      ? "Kein Vergleichswert"
                      : `${item.delta > 0 ? "+" : ""}${item.deltaPercent.toFixed(0)} % gegenüber vorher`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{item.summary}</p>
                </Panel>
              ))}
            </div>
          ) : (
            <EmptyState description="Noch keine Verbrauchshistorie. Die Vergleiche erscheinen, sobald einige Tage aufgezeichnet wurden." />
          )}

          {energy.top.length ? (
            <Section title="Größte Verbraucher">
              <div className="space-y-2">
                {energy.top.map((item) => (
                  <div key={item.name} className="panel-glass space-y-2 p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm">{item.name}</span>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {Math.round(item.value)} {item.unit}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-700"
                        style={{ width: `${Math.min(100, item.share)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </TabsContent>

        <TabsContent value="gesundheit" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Gerät suchen…"
              className="pl-9"
            />
          </div>

          {filteredHealth.length ? (
            <div className={grids.cards}>
              {filteredHealth.map((item) => (
                <Panel key={item.entityId} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        item.critical ? "text-destructive" : "text-success",
                      )}
                    >
                      {item.score}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <span>Erreichbarkeit: {item.uptime == null ? "—" : `${item.uptime} %`}</span>
                    <span>
                      Verbindung: {item.linkQuality == null ? "—" : `${item.linkQuality} %`}
                    </span>
                    <span>Ausfälle: {item.outages}</span>
                    <span>Antwort: {item.responseMs == null ? "—" : `${item.responseMs} ms`}</span>
                  </div>
                  {item.batteryTrend.length > 1 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Batterie: {item.batteryTrend[item.batteryTrend.length - 1]?.v ?? "—"} % (
                      {item.batteryTrend.length} Messpunkte)
                    </p>
                  ) : null}
                </Panel>
              ))}
            </div>
          ) : (
            <EmptyState description="Keine Geräte gefunden." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
