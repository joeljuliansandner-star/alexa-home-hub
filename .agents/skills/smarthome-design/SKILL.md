---
name: smarthome-design
description: Design- und UI-Regeln für dieses Smarthome-Adminpanel - dunkles Control-Room-Theme, Panel-Karten, deutsche Texte, Mobile/PWA-Verhalten. Anwenden bei jeder neuen Seite, Karte oder Komponente.
---

# Design-Regeln Smarthome Control

## Theme

Dunkles „Control Room“-Theme, definiert in `src/styles.css` als oklch-Tokens:
tiefes Nachtblau als Hintergrund, warmes Bernstein (`--primary`) für aktive Geräte,
Teal (`--accent`) für Sensorik/Messwerte.

**Nie** harte Farbklassen (`text-white`, `bg-black`, `bg-[#…]`). Immer Tokens:
`bg-surface`, `text-muted-foreground`, `border-border`, `text-accent`,
`bg-primary text-primary-foreground`.

Schriften: `font-display` (Outfit) für Logo, Uhrzeit und große Zahlen,
Standard-Sans (Figtree) für alles andere.

## Bausteine

- Karten immer mit der Utility-Klasse `panel` (`panel p-4`), Radius aus den
  `--radius-*`-Tokens, keine eigenen Schatten erfinden.
- Aktiver Gerätezustand: zusätzlich `tile-on` (Glow) — siehe `DeviceCard.tsx`.
- Icons: `lucide-react`, Größen `size-4` / `size-5`, Icon-Kachel
  `flex size-10 items-center justify-center rounded-xl`.
- Abstände: Seiten `space-y-8`, Sektionen `space-y-3`, Grids `gap-3`.
- Sektionsüberschriften klein:
  `text-sm font-semibold uppercase tracking-wider text-muted-foreground`.
- Grids: `grid gap-3 sm:grid-cols-2 xl:grid-cols-3` (Geräte),
  `sm:grid-cols-2 lg:grid-cols-4` (Sensorwerte).
- Ladezustand: zentrierter `Loader2` mit `animate-spin text-muted-foreground`.
- Rückmeldungen ausschließlich über `sonner`-Toasts.

## Sprache

Komplette Oberfläche auf Deutsch, geduzt, kurz („Beispiel-Setup laden“,
„Smart Life abgleichen“, „Raum“, „Gerät“). Auch Fehlermeldungen deutsch.
Route-`head()`-Titel im Schema „<Seite> – Smarthome Control“.

## Layout & Mobile

- Neue Seiten liegen unter `src/routes/_authenticated/` und werden in `nav`
  in `src/routes/_authenticated/route.tsx` mit Label und Icon eingetragen
  (Mobile-Grid-Spaltenzahl dort mit anpassen).
- Das Panel läuft als PWA im Standalone-Modus auf dem iPhone: Touch-Ziele
  mindestens 44 px, keine Hover-only-Bedienung, alles ab 390 px Breite lesbar.
- Footer bleibt zentriert „powered by Joel-Julian Sandner“, Lovable-Badge aus.
