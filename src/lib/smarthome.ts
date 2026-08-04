import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { controlTapoDevice } from "@/lib/tapo.functions";
import { controlTuyaDevice, refreshTuyaStates } from "@/lib/tuya.functions";
import type { Tables } from "@/integrations/supabase/types";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

export type Room = Tables<"rooms">;
export type Device = Tables<"devices">;
export type Scene = Tables<"scenes">;
export type SceneAction = Tables<"scene_actions">;
export type Automation = Tables<"automations">;
export type ActivityEntry = Tables<"activity_log">;
export type DeviceKind = Device["kind"];

export const deviceKindLabel: Record<string, string> = {
  light: "Licht",
  plug: "Steckdose",
  thermostat: "Thermostat",
  sensor: "Sensor",
  blind: "Rollladen",
  speaker: "Lautsprecher",
  vacuum: "Staubsauger",
};

export const controllableKinds: DeviceKind[] = ["light", "plug", "blind", "speaker"];


async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Nicht angemeldet");
  return data.user.id;
}

export async function logActivity(message: string) {
  const user_id = await currentUserId();
  await supabase.from("activity_log").insert({ user_id, message });
}

/* ---------------------------------- Rooms --------------------------------- */

export const roomsQuery = {
  queryKey: ["rooms"],
  queryFn: async (): Promise<Room[]> => {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
};

export function useRooms() {
  return useQuery(roomsQuery);
}

/* --------------------------------- Devices -------------------------------- */

export const devicesQuery = {
  queryKey: ["devices"],
  queryFn: async (): Promise<Device[]> => {
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
};

export function useDevices() {
  return useQuery({ ...devicesQuery, refetchInterval: 10_000 });
}

/**
 * Holt regelmäßig die Zustände aus Smart Life ins Panel,
 * damit Änderungen in der App auch hier sichtbar werden.
 */
export function useTuyaLiveSync(enabled = true) {
  const qc = useQueryClient();
  useQuery({
    queryKey: ["tuya-live"],
    queryFn: async () => {
      const result = await refreshTuyaStates();
      if (result.changed > 0) {
        await qc.invalidateQueries({ queryKey: ["devices"] });
      }
      return result;
    },
    enabled,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export const scenesQuery = {
  queryKey: ["scenes"],
  queryFn: async (): Promise<Scene[]> => {
    const { data, error } = await supabase.from("scenes").select("*").order("created_at");
    if (error) throw error;
    return data ?? [];
  },
};

export function useScenes() {
  return useQuery(scenesQuery);
}

export const sceneActionsQuery = {
  queryKey: ["scene_actions"],
  queryFn: async (): Promise<SceneAction[]> => {
    const { data, error } = await supabase.from("scene_actions").select("*");
    if (error) throw error;
    return data ?? [];
  },
};

export function useSceneActions() {
  return useQuery(sceneActionsQuery);
}

export const automationsQuery = {
  queryKey: ["automations"],
  queryFn: async (): Promise<Automation[]> => {
    const { data, error } = await supabase.from("automations").select("*").order("created_at");
    if (error) throw error;
    return data ?? [];
  },
};

export function useAutomations() {
  return useQuery(automationsQuery);
}

export const activityQuery = {
  queryKey: ["activity"],
  queryFn: async (): Promise<ActivityEntry[]> => {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  },
};

export function useActivity() {
  return useQuery(activityQuery);
}

/* -------------------------------- Mutations ------------------------------- */

function invalidateAll(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["devices"] });
  qc.invalidateQueries({ queryKey: ["rooms"] });
  qc.invalidateQueries({ queryKey: ["scenes"] });
  qc.invalidateQueries({ queryKey: ["scene_actions"] });
  qc.invalidateQueries({ queryKey: ["automations"] });
  qc.invalidateQueries({ queryKey: ["activity"] });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      device,
      patch,
      log,
    }: {
      device: Device;
      patch: Partial<Device>;
      log?: string;
    }) => {
      let note: string | null = null;

      // Real hardware: try to switch the physical Tapo device first.
      if (device.external_source === "tapo" && device.external_id && patch.is_on !== undefined) {
        try {
          const result = await controlTapoDevice({
            data: { externalId: device.external_id, on: patch.is_on },
          });
          if (!result.ok) note = result.message;
        } catch (error) {
          note = error instanceof Error ? error.message : "Tapo nicht erreichbar";
        }
      }

      // Smart Life / Tuya: schalten und dimmen läuft über die Tuya-Cloud.
      if (
        device.external_source === "tuya" &&
        device.external_id &&
        (patch.is_on !== undefined || patch.brightness !== undefined)
      ) {
        try {
          const result = await controlTuyaDevice({
            data: {
              externalId: device.external_id,
              ...(patch.is_on !== undefined ? { on: patch.is_on } : {}),
              ...(patch.brightness !== undefined ? { brightness: patch.brightness } : {}),
            },
          });
          if (!result.ok) note = result.message;
        } catch (error) {
          note = error instanceof Error ? error.message : "Smart Life nicht erreichbar";
        }
      }


      const { error } = await supabase.from("devices").update(patch).eq("id", device.id);
      if (error) throw error;
      if (log) await logActivity(log);
      return { note };
    },
    onSuccess: (result) => {
      invalidateAll(qc);
      if (result?.note) toast.warning(result.note);
    },
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; icon: string }) => {
      const user_id = await currentUserId();
      const { error } = await supabase.from("rooms").insert({ ...values, user_id });
      if (error) throw error;
      await logActivity(`Raum „${values.name}" angelegt`);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      kind: DeviceKind;
      room_id: string | null;
      manufacturer: string | null;
      alexa_name: string | null;
    }) => {
      const user_id = await currentUserId();
      const { error } = await supabase.from("devices").insert({ ...values, user_id });
      if (error) throw error;
      await logActivity(`Gerät „${values.name}" hinzugefügt`);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteRow(table: "devices" | "rooms" | "scenes" | "automations") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      icon: string;
      description: string | null;
      deviceIds: string[];
      setOn: boolean;
    }) => {
      const user_id = await currentUserId();
      const { data, error } = await supabase
        .from("scenes")
        .insert({
          user_id,
          name: values.name,
          icon: values.icon,
          description: values.description,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (values.deviceIds.length) {
        const { error: aErr } = await supabase.from("scene_actions").insert(
          values.deviceIds.map((device_id) => ({
            user_id,
            scene_id: data.id,
            device_id,
            set_on: values.setOn,
          })),
        );
        if (aErr) throw aErr;
      }
      await logActivity(`Szene „${values.name}" erstellt`);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRunScene() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scene: Scene) => {
      const { data: actions, error } = await supabase
        .from("scene_actions")
        .select("*")
        .eq("scene_id", scene.id);
      if (error) throw error;
      for (const action of actions ?? []) {
        const patch: Partial<Device> = { is_on: action.set_on };
        if (action.set_brightness != null) patch.brightness = action.set_brightness;
        const { error: uErr } = await supabase
          .from("devices")
          .update(patch)
          .eq("id", action.device_id);
        if (uErr) throw uErr;
      }
      await logActivity(`Szene „${scene.name}" ausgeführt`);
      return actions?.length ?? 0;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      trigger_type: string;
      trigger_value: string | null;
      scene_id: string | null;
    }) => {
      const user_id = await currentUserId();
      const { error } = await supabase.from("automations").insert({ ...values, user_id });
      if (error) throw error;
      await logActivity(`Automation „${values.name}" erstellt`);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (automation: Automation) => {
      const { error } = await supabase
        .from("automations")
        .update({ is_active: !automation.is_active })
        .eq("id", automation.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/* ------------------------------- Demo-Daten ------------------------------- */

export function useSeedDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const user_id = await currentUserId();
      const roomDefs = [
        { name: "Wohnzimmer", icon: "sofa", sort_order: 0 },
        { name: "Küche", icon: "utensils", sort_order: 1 },
        { name: "Schlafzimmer", icon: "bed", sort_order: 2 },
        { name: "Büro", icon: "laptop", sort_order: 3 },
      ];
      const { data: rooms, error: rErr } = await supabase
        .from("rooms")
        .insert(roomDefs.map((r) => ({ ...r, user_id })))
        .select("*");
      if (rErr) throw rErr;
      const byName = (n: string) => rooms?.find((r) => r.name === n)?.id ?? null;

      const devices = [
        {
          name: "Deckenlicht",
          kind: "light" as const,
          room_id: byName("Wohnzimmer"),
          is_on: true,
          brightness: 70,
          manufacturer: "Philips Hue",
          alexa_name: "Wohnzimmerlicht",
        },
        {
          name: "Stehlampe",
          kind: "light" as const,
          room_id: byName("Wohnzimmer"),
          brightness: 40,
          manufacturer: "Philips Hue",
          alexa_name: "Stehlampe",
        },
        {
          name: "TV-Steckdose",
          kind: "plug" as const,
          room_id: byName("Wohnzimmer"),
          manufacturer: "Shelly",
          alexa_name: "Fernseher",
        },
        {
          name: "Kaffeemaschine",
          kind: "plug" as const,
          room_id: byName("Küche"),
          manufacturer: "TP-Link Tapo",
          alexa_name: "Kaffee",
        },
        {
          name: "Küchenlicht",
          kind: "light" as const,
          room_id: byName("Küche"),
          brightness: 100,
          manufacturer: "Philips Hue",
        },
        {
          name: "Nachttischlampe",
          kind: "light" as const,
          room_id: byName("Schlafzimmer"),
          brightness: 25,
          manufacturer: "Philips Hue",
        },
        {
          name: "Rollladen",
          kind: "blind" as const,
          room_id: byName("Schlafzimmer"),
          manufacturer: "Shelly",
        },
        {
          name: "Echo Dot",
          kind: "speaker" as const,
          room_id: byName("Büro"),
          manufacturer: "Amazon",
          alexa_name: "Büro Echo",
        },
        {
          name: "Temperatur Wohnzimmer",
          kind: "sensor" as const,
          room_id: byName("Wohnzimmer"),
          sensor_value: 21.4,
          sensor_unit: "°C",
        },
        {
          name: "Luftfeuchte Bad",
          kind: "sensor" as const,
          room_id: byName("Küche"),
          sensor_value: 54,
          sensor_unit: "%",
        },
        {
          name: "Stromverbrauch",
          kind: "sensor" as const,
          room_id: null,
          sensor_value: 312,
          sensor_unit: "W",
        },
        {
          name: "Heizung Büro",
          kind: "thermostat" as const,
          room_id: byName("Büro"),
          sensor_value: 20.5,
          sensor_unit: "°C",
          target_value: 22,
        },
      ];
      const { data: createdDevices, error: dErr } = await supabase
        .from("devices")
        .insert(devices.map((d, i) => ({ ...d, user_id, sort_order: i })))
        .select("*");
      if (dErr) throw dErr;

      const scenes = [
        { name: "Guten Morgen", icon: "sunrise", description: "Licht an, Kaffee läuft" },
        { name: "Filmabend", icon: "clapperboard", description: "Gedimmtes Licht, TV an" },
        { name: "Alles aus", icon: "power", description: "Jedes Gerät ausschalten" },
      ];
      const { data: createdScenes, error: sErr } = await supabase
        .from("scenes")
        .insert(scenes.map((s) => ({ ...s, user_id })))
        .select("*");
      if (sErr) throw sErr;

      const deviceId = (n: string) => createdDevices?.find((d) => d.name === n)?.id;
      const sceneId = (n: string) => createdScenes?.find((s) => s.name === n)?.id;
      const actions: {
        user_id: string;
        scene_id: string;
        device_id: string;
        set_on: boolean;
        set_brightness: number | null;
      }[] = [];
      const push = (scene: string, device: string, set_on: boolean, b: number | null = null) => {
        const s = sceneId(scene);
        const d = deviceId(device);
        if (s && d) actions.push({ user_id, scene_id: s, device_id: d, set_on, set_brightness: b });
      };
      push("Guten Morgen", "Küchenlicht", true, 100);
      push("Guten Morgen", "Kaffeemaschine", true);
      push("Guten Morgen", "Rollladen", true);
      push("Filmabend", "Deckenlicht", true, 15);
      push("Filmabend", "Stehlampe", true, 30);
      push("Filmabend", "TV-Steckdose", true);
      for (const d of ["Deckenlicht", "Stehlampe", "TV-Steckdose", "Küchenlicht", "Kaffeemaschine", "Nachttischlampe"]) {
        push("Alles aus", d, false);
      }
      if (actions.length) {
        const { error: aErr } = await supabase.from("scene_actions").insert(actions);
        if (aErr) throw aErr;
      }

      const morgen = sceneId("Guten Morgen");
      const ausId = sceneId("Alles aus");
      await supabase.from("automations").insert([
        {
          user_id,
          name: "Wecker-Routine",
          trigger_type: "time",
          trigger_value: "06:45",
          scene_id: morgen ?? null,
        },
        {
          user_id,
          name: "Nachtabschaltung",
          trigger_type: "time",
          trigger_value: "23:30",
          scene_id: ausId ?? null,
        },
      ]);

      await logActivity("Beispiel-Setup angelegt");
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/* ------------------------------- Favoriten -------------------------------- */

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ device, value }: { device: Device; value: boolean }) => {
      const { error } = await supabase
        .from("devices")
        .update({ is_favorite: value })
        .eq("id", device.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["devices"] }),
  });
}

/** Schaltet alle Geräte eines Typs gemeinsam. */
export function useBulkToggleKind() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ devices, on }: { devices: Device[]; on: boolean }) => {
      for (const device of devices) {
        if (device.external_source === "tuya" && device.external_id) {
          try {
            await controlTuyaDevice({ data: { externalId: device.external_id, on } });
          } catch {
            /* Gerät offline – lokaler Zustand wird trotzdem gesetzt */
          }
        }
        if (device.external_source === "tapo" && device.external_id) {
          try {
            await controlTapoDevice({ data: { externalId: device.external_id, on } });
          } catch {
            /* siehe oben */
          }
        }
        await supabase.from("devices").update({ is_on: on }).eq("id", device.id);
      }
      return devices.length;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
