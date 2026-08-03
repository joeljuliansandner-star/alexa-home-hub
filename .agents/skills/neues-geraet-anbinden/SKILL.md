---
name: neues-geraet-anbinden
description: Muster zum Anbinden einer neuen Smarthome-Cloud (Hue, Shelly, Kasa, Meross, Tuya, Tapo, Dreame) an dieses Adminpanel - Server-Client, Server-Function, Sync-Logik, Steuerung und Settings-UI.
---

# Neue Geräte-Cloud anbinden

Jede Marke folgt exakt demselben Aufbau. Nie davon abweichen.

## 1. Zugangsdaten

Secrets über das Secret-Tool anlegen, Namensschema `<MARKE>_EMAIL`, `<MARKE>_PASSWORD`
bzw. `<MARKE>_ACCESS_ID` / `<MARKE>_ACCESS_SECRET`. Niemals in Code oder Chat wiederholen.
`process.env['X']` immer **innerhalb** des Handlers lesen.

## 2. Dateien (immer genau diese zwei)

- `src/lib/<marke>.server.ts` — reiner Cloud-Client: Login/Token-Cache, Geräteliste,
  Statusabfrage, Kommando-Senden, Mapper (`kindFor…`, `iconForRoom`, Property-Codes).
  Kein Supabase, kein React.
- `src/lib/<marke>.functions.ts` — `createServerFn({ method: "POST" })`
  `.middleware([requireSupabaseAuth])`, Server-Modul per `await import("./<marke>.server")`
  **im Handler** laden (sonst landet es im Client-Bundle). Modul-Scope enthält nur
  Imports und die exportierten Server-Functions.

Typische Exporte: `sync<Marke>Devices`, `control<Marke>Device`, `refresh<Marke>States`.

## 3. Sync-Logik (Pflichtmuster)

Kein `upsert` mit `onConflict` — PostgREST scheitert an den partiellen Unique-Indizes.
Stattdessen pro Gerät:

```ts
const { data: existing } = await context.supabase
  .from("devices").select("id")
  .eq("user_id", context.userId).eq("external_id", cloud.id).maybeSingle();
if (existing) await context.supabase.from("devices").update(patch).eq("id", existing.id);
else await context.supabase.from("devices").insert({ user_id: context.userId, ...patch });
```

Räume genauso (Match über `name`). Räume sind optional: Fehler beim Raum-Abgleich
in `try/catch` schlucken, Geräte-Sync läuft weiter. Rückgabe:
`{ imported: number, rooms: number }`.

## 4. Steuerung verdrahten

In `src/lib/smarthome.ts` in `useUpdateDevice` den neuen Provider ergänzen: bei
`device.provider === "<marke>"` die `control<Marke>Device`-Function aufrufen,
Fehler per `toast.error` melden, danach lokal weiter wie gehabt.
Live-Abgleich (falls die Cloud es hergibt) analog zu `useTuyaLiveSync`
(Polling ~15 s, nur wenn Tab sichtbar).

## 5. UI

- Settings-Seite: eigener Abschnitt mit Status, Button „<Marke> abgleichen“,
  Toast mit Anzahl importierter Geräte/Räume.
- Dashboard-Leerzustand: Sync-Button ergänzen.
- Geräte-Typen ausschließlich aus `deviceKindLabel` in `src/lib/smarthome.ts`.

## 6. Fehlerbilder

- Gerät schläft / Cloud antwortet „Befehl abgelaufen“: Retry-Schleife mit
  Backoff (~4 Versuche, 1200 ms Pause) und Status-Label „Standby (schläft)“
  statt „Nicht erreichbar“ — siehe `dreame.server.ts`.
- Fehlermeldungen immer auf Deutsch, kurz und handlungsorientiert.
