import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { House } from "lucide-react";

import { PageHeader, Panel, stacks } from "@/components/kit";
import { HomeAssistantWizard } from "@/components/homeassistant/HomeAssistantWizard";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Einrichtung – Smarthome Control" },
      {
        name: "description",
        content:
          "Home Assistant verbinden: automatische Suche im Heimnetz, Token prüfen und Geräte übernehmen.",
      },
      { property: "og:title", content: "Einrichtung – Smarthome Control" },
      {
        property: "og:description",
        content: "Verbinde dein Zuhause in wenigen Schritten mit Home Assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();

  return (
    <div className={stacks.page}>
      <PageHeader
        title="Willkommen"
        description="Verbinde dein Zuhause mit Home Assistant – danach stehen alle Geräte, Räume und Live-Zustände automatisch zur Verfügung."
      />

      <Panel className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <House className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">
          Home Assistant ist die zentrale Plattform dieser App. Geräte, Räume, Szenen und Sensoren
          kommen ausschließlich von dort.
        </p>
      </Panel>

      <HomeAssistantWizard onConnected={() => navigate({ to: "/home" })} />
    </div>
  );
}
