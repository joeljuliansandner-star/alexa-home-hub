import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { House, Lightbulb, Mic, ShieldCheck, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smarthome Control – Dein privates Adminpanel" },
      {
        name: "description",
        content:
          "Steuere Licht, Steckdosen, Szenen und Sensoren deines Zuhauses über ein privates Web-Adminpanel.",
      },
      { property: "og:title", content: "Smarthome Control – Dein privates Adminpanel" },
      {
        property: "og:description",
        content: "Räume, Geräte, Szenen und Automationen zentral steuern – privat und passwortgeschützt.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Lightbulb,
    title: "Geräte & Räume",
    text: "Licht dimmen, Steckdosen schalten, alles nach Räumen gruppiert.",
  },
  {
    icon: Sparkles,
    title: "Szenen",
    text: "Filmabend oder Guten Morgen – mehrere Geräte mit einem Klick.",
  },
  {
    icon: Mic,
    title: "Alexa-fähig",
    text: "Alexa-Namen pro Gerät, vorbereitet für die Kopplung über eine Bridge.",
  },
  {
    icon: ShieldCheck,
    title: "Privat",
    text: "Passwortgeschützt – nur dein Konto sieht deine Geräte.",
  },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="hero-glow min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col px-5 py-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <House className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold">Smarthome Control</span>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/auth">Anmelden</Link>
          </Button>
        </header>

        <main className="py-16 md:py-24">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Adminpanel</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] md:text-6xl">
            <span className="text-gradient">Dein Zuhause</span> – vollständig unter Kontrolle.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            Ein Panel für Licht, Steckdosen, Rollläden, Sensoren, Szenen und Automationen.
            Vorbereitet für die Kopplung mit Alexa über eine Steuerzentrale.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Panel öffnen</Link>
            </Button>
          </div>

          <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="panel p-5">
                <feature.icon className="size-5 text-primary" />
                <h2 className="mt-3 text-base font-semibold">{feature.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.text}</p>
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
