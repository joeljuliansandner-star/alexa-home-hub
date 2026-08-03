import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles } from "lucide-react";

import { WeatherClock } from "@/components/WeatherClock";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Startseite – Smarthome Control" },
      {
        name: "description",
        content: "Uhrzeit und aktuelles Wetter in Wurzen auf einen Blick.",
      },
      { property: "og:title", content: "Startseite – Smarthome Control" },
      {
        property: "og:description",
        content: "Uhrzeit und aktuelles Wetter in Wurzen auf einen Blick.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Startseite</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uhrzeit und Wetter für Wurzen
        </p>
      </header>

      <WeatherClock />

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Button asChild className="h-12 justify-start gap-2 sm:h-10 sm:justify-center">
          <Link to="/dashboard">
            <LayoutDashboard className="size-4" />
            Zur Geräteübersicht
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-12 justify-start gap-2 sm:h-10 sm:justify-center">
          <Link to="/scenes">
            <Sparkles className="size-4" />
            Szenen
          </Link>
        </Button>
      </div>
    </div>
  );
}
