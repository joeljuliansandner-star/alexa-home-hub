/**
 * Alexa – Server-Funktionen (öffentliche Schnittstelle für die Oberfläche).
 *
 * Nur Deklarationen: jede Implementierung liegt in den *.server-Dateien und
 * wird erst im Handler geladen.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  AlexaConnectionStatus,
  AlexaDeviceModel,
  AlexaLogEntry,
  AlexaSettingsModel,
  AlexaSyncResult,
} from "@/lib/alexa/model";

export const getAlexaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AlexaConnectionStatus> => {
    const { amazonConfig, isExpired } = await import("@/lib/alexa/auth-manager.server");
    const repo = await import("@/lib/alexa/repository.server");
    const connection = await repo.getConnection(context.userId);
    const devices = await repo.listDevices(context.userId);
    return {
      configured: amazonConfig() !== null,
      connected: connection !== null,
      accountName: connection?.account_name ?? null,
      accountEmail: connection?.account_email ?? null,
      needsReauth: connection
        ? isExpired(connection.expires_at) && !connection.refresh_token
        : false,
      expiresAt: connection?.expires_at ?? null,
      lastSyncAt: connection?.last_sync_at ?? null,
      lastError: connection?.last_error ?? null,
      deviceCount: devices.length,
    };
  });

export const startAlexaLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { redirectUri: string }) => data)
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { buildAuthorizeUrl } = await import("@/lib/alexa/auth-manager.server");
    return { url: buildAuthorizeUrl(context.userId.slice(0, 8), data.redirectUri) };
  });

export const completeAlexaLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; redirectUri: string }) => data)
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const { exchangeCode, fetchProfile } = await import("@/lib/alexa/auth-manager.server");
    const repo = await import("@/lib/alexa/repository.server");
    try {
      const tokens = await exchangeCode(data.code, data.redirectUri);
      const profile = await fetchProfile(tokens.accessToken);
      await repo.saveConnection(context.userId, {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_type: tokens.tokenType,
        scope: tokens.scope,
        expires_at: tokens.expiresAt,
        amazon_user_id: profile.amazonUserId,
        account_name: profile.name,
        account_email: profile.email,
        last_error: null,
      });
      return { ok: true, message: "Amazon-Konto verbunden." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.";
      await repo.addLogEntries(context.userId, [
        {
          endpoint: "https://api.amazon.com/auth/o2/token",
          method: "POST",
          statusCode: null,
          durationMs: null,
          ok: false,
          message,
        },
      ]);
      return { ok: false, message };
    }
  });

export const disconnectAlexa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const repo = await import("@/lib/alexa/repository.server");
    await repo.deleteDevices(context.userId);
    await repo.deleteConnection(context.userId);
    return { ok: true };
  });

export const listAlexaDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AlexaDeviceModel[]> => {
    const repo = await import("@/lib/alexa/repository.server");
    return repo.listDevices(context.userId);
  });

export const getAlexaDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { deviceId: string }) => data)
  .handler(async ({ data, context }): Promise<AlexaDeviceModel | null> => {
    const repo = await import("@/lib/alexa/repository.server");
    return repo.getDevice(context.userId, data.deviceId);
  });

export const syncAlexa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AlexaSyncResult> => {
    const { syncAlexaDevices } = await import("@/lib/alexa/sync-manager.server");
    return syncAlexaDevices(context.userId);
  });

export const controlAlexaDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { deviceId: string; volume?: number; muted?: boolean }) => data)
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const { sendAlexaCommand } = await import("@/lib/alexa/sync-manager.server");
    const payload: { volume?: number; muted?: boolean } = {};
    if (typeof data.volume === "number") payload.volume = data.volume;
    if (typeof data.muted === "boolean") payload.muted = data.muted;
    return sendAlexaCommand(context.userId, data.deviceId, payload);
  });

export const getAlexaSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AlexaSettingsModel> => {
    const repo = await import("@/lib/alexa/repository.server");
    return repo.getSettings(context.userId);
  });

export const saveAlexaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AlexaSettingsModel) => data)
  .handler(async ({ data, context }): Promise<AlexaSettingsModel> => {
    const repo = await import("@/lib/alexa/repository.server");
    return repo.saveSettings(context.userId, data);
  });

export const getAlexaLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AlexaLogEntry[]> => {
    const repo = await import("@/lib/alexa/repository.server");
    return repo.listLogEntries(context.userId);
  });

export const clearAlexaLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const repo = await import("@/lib/alexa/repository.server");
    await repo.clearLog(context.userId);
    return { ok: true };
  });
