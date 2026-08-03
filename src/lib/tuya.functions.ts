import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Holt alle Smart-Life-/Tuya-Geräte in das Panel. */
export const syncTuyaDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const {
      tuyaToken,
      tuyaDeviceList,
      tuyaRooms,
      iconForRoom,
      kindForCategory,
      switchCode,
      brightnessCode,
    } = await import("./tuya.server");

    const token = await tuyaToken();
    const cloudDevices = await tuyaDeviceList(token);

    // Räume aus Smart Life holen und im Panel anlegen
    const deviceRoom = new Map<string, string>();
    let roomsImported = 0;
    const uid = cloudDevices.find((d) => d.uid)?.uid;

    if (uid) {
      try {
        const cloudRooms = await tuyaRooms(token, uid);
        for (const room of cloudRooms) {
          const { data: existingRoom } = await context.supabase
            .from("rooms")
            .select("id")
            .eq("user_id", context.userId)
            .eq("name", room.name)
            .maybeSingle();

          let roomId = existingRoom?.id ?? null;
          if (!roomId) {
            const { data: created, error: roomError } = await context.supabase
              .from("rooms")
              .insert({
                user_id: context.userId,
                name: room.name,
                icon: iconForRoom(room.name),
                sort_order: roomsImported,
              })
              .select("id")
              .single();
            if (roomError) throw new Error(roomError.message);
            roomId = created.id;
          }
          roomsImported += 1;
          for (const deviceId of room.deviceIds) deviceRoom.set(deviceId, roomId);
        }
      } catch {
        // Räume sind optional – Geräteabgleich läuft trotzdem weiter
      }
    }

    let imported = 0;
    let online = 0;

    for (const device of cloudDevices) {
      const kind = kindForCategory(device.category);
      if (device.online) online += 1;

      const sw = switchCode(device.status);
      const isOn = sw
        ? Boolean(device.status.find((s) => s.code === sw)?.value)
        : false;

      const bright = brightnessCode(device.status);
      const brightness = bright
        ? Math.round(
            (Number(device.status.find((s) => s.code === bright.code)?.value ?? bright.max) /
              bright.max) *
              100,
          )
        : 100;

      const payload = {
        user_id: context.userId,
        external_id: device.id,
        external_source: "tuya",
        name: device.name,
        model: device.product_name ?? device.category,
        kind,
        manufacturer: "Smart Life / Tuya",
        alexa_name: device.name,
        is_online: device.online,
        is_on: isOn,
        brightness: Math.min(100, Math.max(1, brightness)),
        ...(deviceRoom.has(device.id) ? { room_id: deviceRoom.get(device.id)! } : {}),
      };

      const { data: existing } = await context.supabase
        .from("devices")
        .select("id")
        .eq("user_id", context.userId)
        .eq("external_id", device.id)
        .maybeSingle();

      const { error } = existing
        ? await context.supabase.from("devices").update(payload).eq("id", existing.id)
        : await context.supabase.from("devices").insert(payload);

      if (error) throw new Error(error.message);
      imported += 1;
    }

    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      message: `Smart-Life-Abgleich: ${imported} Geräte und ${roomsImported} Räume übernommen`,
    });

    return {
      imported,
      online,
      rooms: roomsImported,
      devices: cloudDevices.map((d) => ({
        name: d.name,
        model: d.product_name ?? d.category,
        online: d.online,
      })),
    };

  });

/** Schaltet bzw. dimmt ein Smart-Life-/Tuya-Gerät über die Cloud. */
export const controlTuyaDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        externalId: z.string().min(1).max(128),
        on: z.boolean().optional(),
        brightness: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { tuyaToken, tuyaDeviceStatus, tuyaSendCommands, switchCode, brightnessCode } =
      await import("./tuya.server");

    const { data: device } = await context.supabase
      .from("devices")
      .select("id")
      .eq("user_id", context.userId)
      .eq("external_id", data.externalId)
      .maybeSingle();
    if (!device) throw new Error("Gerät nicht gefunden");

    const token = await tuyaToken();
    const status = await tuyaDeviceStatus(token, data.externalId);

    const commands: Array<{ code: string; value: unknown }> = [];

    if (data.on !== undefined) {
      const code = switchCode(status);
      if (!code) {
        return { ok: false, message: "Dieses Gerät lässt sich nicht schalten." };
      }
      commands.push({ code, value: data.on });
    }

    if (data.brightness !== undefined) {
      const bright = brightnessCode(status);
      if (bright) {
        commands.push({
          code: bright.code,
          value: Math.max(1, Math.round((data.brightness / 100) * bright.max)),
        });
      }
    }

    if (!commands.length) return { ok: true, message: "Nichts zu tun" };

    try {
      const ok = await tuyaSendCommands(token, data.externalId, commands);
      return ok
        ? { ok: true, message: "Befehl gesendet" }
        : { ok: false, message: "Tuya hat den Befehl abgelehnt." };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Tuya nicht erreichbar",
      };
    }
  });

/** Holt nur die aktuellen Zustände (an/aus, Helligkeit, online) aus Smart Life. */
export const refreshTuyaStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tuyaToken, tuyaDeviceList, switchCode, brightnessCode } = await import(
      "./tuya.server"
    );

    const { data: known } = await context.supabase
      .from("devices")
      .select("id, external_id, is_on, brightness, is_online")
      .eq("user_id", context.userId)
      .eq("external_source", "tuya");

    if (!known?.length) return { changed: 0 };

    const byExternal = new Map(known.map((d) => [d.external_id ?? "", d]));

    let token: string;
    let cloudDevices;
    try {
      token = await tuyaToken();
      cloudDevices = await tuyaDeviceList(token);
    } catch {
      return { changed: 0 };
    }

    let changed = 0;

    for (const device of cloudDevices) {
      const row = byExternal.get(device.id);
      if (!row) continue;

      const sw = switchCode(device.status);
      const isOn = sw ? Boolean(device.status.find((s) => s.code === sw)?.value) : row.is_on;

      const bright = brightnessCode(device.status);
      const brightness = bright
        ? Math.min(
            100,
            Math.max(
              1,
              Math.round(
                (Number(device.status.find((s) => s.code === bright.code)?.value ?? bright.max) /
                  bright.max) *
                  100,
              ),
            ),
          )
        : row.brightness;

      if (
        isOn === row.is_on &&
        brightness === row.brightness &&
        device.online === row.is_online
      ) {
        continue;
      }

      await context.supabase
        .from("devices")
        .update({ is_on: isOn, brightness, is_online: device.online })
        .eq("id", row.id);
      changed += 1;
    }

    return { changed };
  });

/* ------------------------------ Saugroboter ------------------------------- */

/** Liest Akku, Status und Reinigungsdaten aller Saugroboter aus Smart Life. */
export const getVacuumStates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tuyaToken, tuyaDeviceStatus, parseVacuumState } = await import("./tuya.server");

    const { data: rows } = await context.supabase
      .from("devices")
      .select("id, name, external_id, is_online, model")
      .eq("user_id", context.userId)
      .eq("kind", "vacuum");

    if (!rows?.length) return { vacuums: [] };

    let token: string;
    try {
      token = await tuyaToken();
    } catch {
      return { vacuums: [] };
    }

    const vacuums = [];
    for (const row of rows) {
      if (!row.external_id) continue;
      try {
        const status = await tuyaDeviceStatus(token, row.external_id);
        vacuums.push({
          id: row.id,
          externalId: row.external_id,
          name: row.name,
          model: row.model,
          online: row.is_online,
          ...parseVacuumState(status),
        });
      } catch {
        vacuums.push({
          id: row.id,
          externalId: row.external_id,
          name: row.name,
          model: row.model,
          online: false,
          battery: null,
          status: null,
          mode: null,
          cleanArea: null,
          cleanTime: null,
          fanSpeed: null,
          isRunning: false,
        });
      }
    }

    return { vacuums };
  });

/** Startet, pausiert, schickt zur Ladestation oder lässt den Sauger piepen. */
export const controlVacuum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        externalId: z.string().min(1).max(128),
        action: z.enum(["start", "pause", "dock", "locate"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { tuyaToken, tuyaDeviceStatus, tuyaSendCommands, vacuumCommands } = await import(
      "./tuya.server"
    );

    const { data: device } = await context.supabase
      .from("devices")
      .select("id, name")
      .eq("user_id", context.userId)
      .eq("external_id", data.externalId)
      .maybeSingle();
    if (!device) throw new Error("Staubsauger nicht gefunden");

    try {
      const token = await tuyaToken();
      const status = await tuyaDeviceStatus(token, data.externalId);
      const commands = vacuumCommands(status, data.action);
      if (!commands.length) {
        return { ok: false, message: "Dieser Befehl wird vom Gerät nicht unterstützt." };
      }
      const ok = await tuyaSendCommands(token, data.externalId, commands);
      if (ok) {
        await context.supabase.from("activity_log").insert({
          user_id: context.userId,
          message: `${device.name}: ${data.action}`,
        });
      }
      return ok
        ? { ok: true, message: "Befehl gesendet" }
        : { ok: false, message: "Smart Life hat den Befehl abgelehnt." };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Smart Life nicht erreichbar",
      };
    }
  });
